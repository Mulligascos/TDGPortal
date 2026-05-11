import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import {
  getPlayOrder,
  getParForHole,
  calcPlayerScore,
  formatRelativeToPar,
} from "../lib/scoring";

export default function ScorecardPage() {
  const { roundId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [round, setRound] = useState(null);
  const [layout, setLayout] = useState(null);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState({}); // live editing state
  const [savedScores, setSavedScores] = useState({}); // confirmed saved to DB
  const [playOrder, setPlayOrder] = useState([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );
  const [showSummary, setShowSummary] = useState(false);
  const [playoffHoles, setPlayoffHoles] = useState([]);
  const [tagResolution, setTagResolution] = useState(null);
  const [confirmingTags, setConfirmingTags] = useState(false);
  const [tagTieInfo, setTagTieInfo] = useState(null);

  useEffect(() => {
    loadRound();
  }, [roundId]);

  async function loadRound() {
    const { data: roundData } = await supabase
      .from("rounds")
      .select("*, courses(name), layouts(*)")
      .eq("id", roundId)
      .single();
    if (!roundData) return;

    setRound(roundData);
    setLayout(roundData.layouts);
    setIsOwner(roundData.created_by === user.id);
    setIsComplete(roundData.status === "complete");
    if (roundData.status === "complete") setShowSummary(true);

    const parJson = roundData.layouts.par_json;
    const order = getPlayOrder(
      roundData.starting_hole,
      roundData.layouts.number_of_holes,
      roundData.layouts.loops,
      parJson,
    );
    setPlayOrder(order);

    const { data: rp } = await supabase
      .from("round_players")
      .select("profiles(id, full_name, nickname)")
      .eq("round_id", roundId);
    const playerList = rp?.map((r) => r.profiles) ?? [];
    setPlayers(playerList);

    const { data: existingScores } = await supabase
      .from("scores")
      .select("*")
      .eq("round_id", roundId);

    const scoreMap = {};
    for (const s of existingScores ?? []) {
      scoreMap[scoreKey(s.player_id, s.hole_number, s.loop)] = s.strokes;
    }
    setScores(scoreMap);
    setSavedScores(scoreMap); // both start from DB

    // Detect stored playoff holes
    const maxPlayOrder = Math.max(
      0,
      ...(existingScores ?? []).map((s) => s.play_order),
    );
    const extraHoles = [];
    if (roundData.format === "matchplay" && maxPlayOrder > order.length) {
      for (let i = order.length + 1; i <= maxPlayOrder; i++) {
        const baseHole = order[(i - 1) % order.length];
        extraHoles.push({
          ...baseHole,
          playOrder: i,
          scorecardLabel: `Playoff ${i - order.length}`,
          isPlayoff: true,
        });
      }
    }
    setPlayoffHoles(extraHoles);

    const fullOrder = [...order, ...extraHoles];
    const firstIncomplete = fullOrder.findIndex((h) =>
      playerList.some(
        (p) => scoreMap[scoreKey(p.id, h.holeNumber, h.loop)] == null,
      ),
    );
    setCurrentHoleIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
  }

  function scoreKey(playerId, holeNumber, loop) {
    return `${playerId}-${holeNumber}-${loop}`;
  }

  function getScore(playerId, holeNumber, loop) {
    return scores[scoreKey(playerId, holeNumber, loop)];
  }

  function updateScore(playerId, holeNumber, loop, strokes) {
    setScores((prev) => ({
      ...prev,
      [scoreKey(playerId, holeNumber, loop)]: strokes,
    }));
  }

  function goToHole(index) {
    const fullOrder = [...playOrder, ...playoffHoles];
    const hole = fullOrder[index];
    if (!hole) return;
    if (isOwner) {
      setScores((prev) => {
        const next = { ...prev };
        for (const p of players) {
          const k = scoreKey(p.id, hole.holeNumber, hole.loop);
          if (next[k] == null) next[k] = hole.par;
        }
        return next;
      });
    }
    setCurrentHoleIndex(index);
  }

  async function saveHole(nextIndex) {
    if (!isOwner) return;
    setSaving(true);
    const fullOrder = [...playOrder, ...playoffHoles];
    const hole = fullOrder[currentHoleIndex];

    const upserts = players.map((p) => ({
      round_id: roundId,
      player_id: p.id,
      hole_number: hole.holeNumber,
      loop: hole.loop,
      play_order: hole.playOrder,
      strokes: getScore(p.id, hole.holeNumber, hole.loop) ?? hole.par,
      created_by: user.id,
    }));

    await supabase.from("scores").upsert(upserts, {
      onConflict: "round_id,player_id,hole_number,loop",
    });
    // Mark these scores as saved
    setSavedScores((prev) => {
      const next = { ...prev };
      for (const u of upserts) {
        next[scoreKey(u.player_id, u.hole_number, u.loop)] = u.strokes;
      }
      return next;
    });
    setSaving(false);
    if (nextIndex !== undefined) goToHole(nextIndex);
  }

  function addPlayoffHole() {
    const fullOrder = [...playOrder, ...playoffHoles];
    const lastHole = fullOrder[fullOrder.length - 1];
    const nextHoleNumber = (lastHole.holeNumber % layout.number_of_holes) + 1;
    const par = getParForHole(nextHoleNumber, layout.par_json);
    const newHole = {
      playOrder: fullOrder.length + 1,
      holeNumber: nextHoleNumber,
      loop: 1,
      par,
      scorecardLabel: `Playoff ${playoffHoles.length + 1}`,
      isPlayoff: true,
    };
    setPlayoffHoles((prev) => [...prev, newHole]);
    goToHole(fullOrder.length);
  }

  // ── Bag tag resolution ──────────────────────────────────
  async function resolveTagsAfterRound(fullOrder, parJson) {
    if (!round.play_for_tags) return null;

    const playerIds = players.map((p) => p.id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, nickname, bag_tag_number")
      .in("id", playerIds);

    const taggedPlayers = profiles.filter((p) => p.bag_tag_number != null);
    if (taggedPlayers.length < 2) return null;

    const playerTotals = taggedPlayers.map((p) => {
      const rows = fullOrder
        .map((h) => ({
          hole_number: h.holeNumber,
          loop: h.loop,
          strokes: getScore(p.id, h.holeNumber, h.loop),
        }))
        .filter((s) => s.strokes != null);
      const { total } = calcPlayerScore(rows, parJson);
      return { ...p, total };
    });

    // Sort players by score ascending (lowest = best)
    const sortedByScore = [...playerTotals].sort((a, b) => a.total - b.total);

    // Sort tags ascending (lowest number = best rank)
    const sortedTags = taggedPlayers
      .map((p) => p.bag_tag_number)
      .sort((a, b) => a - b);

    // Assign best score → lowest tag
    const changes = [];
    sortedByScore.forEach((player, i) => {
      const newTag = sortedTags[i];
      if (player.bag_tag_number !== newTag) {
        changes.push({
          playerId: player.id,
          name: player.nickname || player.full_name,
          oldTag: player.bag_tag_number,
          newTag,
          score: player.total,
        });
      }
    });

    return { changes, allPlayers: sortedByScore, sortedTags };
  }

  async function handleFinishWithTags() {
    setFinishing(true);
    await saveHole();

    const currentFullOrder = [...playOrder, ...playoffHoles];
    const currentParJson = layout.par_json;

    if (round.play_for_tags) {
      // Get tagged players and their scores
      const playerIds = players.map((p) => p.id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, nickname, bag_tag_number")
        .in("id", playerIds);

      const taggedPlayers = profiles.filter((p) => p.bag_tag_number != null);

      if (taggedPlayers.length >= 2) {
        // Calculate totals for tagged players using savedScores
        const taggedTotals = taggedPlayers.map((p) => {
          const rows = currentFullOrder
            .map((h) => ({
              hole_number: h.holeNumber,
              loop: h.loop,
              strokes:
                savedScores[scoreKey(p.id, h.holeNumber, h.loop)] ?? null,
            }))
            .filter((s) => s.strokes != null);
          const { total } = calcPlayerScore(rows, currentParJson);
          return { ...p, total };
        });

        // Check for ties between tagged players
        const scores = taggedTotals.map((p) => p.total);
        const uniqueScores = new Set(scores);
        const hasTie = uniqueScores.size < scores.length;

        if (hasTie) {
          // Find who is tied
          const scoreCounts = {};
          scores.forEach((s) => {
            scoreCounts[s] = (scoreCounts[s] || 0) + 1;
          });
          const tiedScores = Object.entries(scoreCounts)
            .filter(([, count]) => count > 1)
            .map(([score]) => parseInt(score));
          const tiedPlayers = taggedTotals.filter((p) =>
            tiedScores.includes(p.total),
          );
          const tiedNames = tiedPlayers
            .map((p) => p.nickname || p.full_name)
            .join(" & ");

          setFinishing(false);
          setTagTieInfo({ tiedNames, tiedPlayers });
          return;
        }
      }

      // No ties — resolve normally
      const resolution = await resolveTagsAfterRound(
        currentFullOrder,
        currentParJson,
      );
      if (resolution && resolution.changes.length > 0) {
        setTagResolution(resolution);
        setFinishing(false);
        return;
      }
    }

    await supabase
      .from("rounds")
      .update({ status: "complete" })
      .eq("id", roundId);
    navigate("/history");
  }

  async function declineTagChanges() {
    await supabase
      .from("rounds")
      .update({ status: "complete" })
      .eq("id", roundId);
    navigate("/history");
  }

  async function cancelRound() {
    if (!confirm("Cancel this round? All scores will be deleted.")) return;
    await supabase.from("scores").delete().eq("round_id", roundId);
    await supabase.from("round_players").delete().eq("round_id", roundId);
    await supabase.from("rounds").delete().eq("id", roundId);
    navigate("/");
  }

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", next);
  }

  if (!round || !layout)
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
        Loading...
      </div>
    );

  const isMatchplay = round.format === "matchplay";
  const fullOrder = [...playOrder, ...playoffHoles];
  const hole = fullOrder[currentHoleIndex];
  const parJson = layout.par_json;
  const isLastHole = currentHoleIndex === fullOrder.length - 1;
  const d = darkMode;

  // ── Matchplay running score ─────────────────────────────
  function calcMatchScore() {
    if (!isMatchplay || players.length !== 2) return null;
    const [p1, p2] = players;
    let score = 0;
    const holesLeft = fullOrder.length - currentHoleIndex - 1;

    for (let i = 0; i <= currentHoleIndex; i++) {
      const h = fullOrder[i];
      const s1 = savedScores[scoreKey(p1.id, h.holeNumber, h.loop)] ?? null;
      const s2 = savedScores[scoreKey(p2.id, h.holeNumber, h.loop)] ?? null;
      if (s1 != null && s2 != null) {
        if (s1 < s2) score++;
        else if (s2 < s1) score--;
      }
    }

    const absScore = Math.abs(score);
    const leader = score > 0 ? p1 : score < 0 ? p2 : null;
    const matchWon = absScore > holesLeft;
    const allSquare = score === 0;

    return { score, absScore, leader, holesLeft, matchWon, allSquare };
  }

  const matchScore = calcMatchScore();

  // ── Strokeplay summary ──────────────────────────────────
  const summary = players
    .map((p) => {
      const rows = fullOrder
        .map((h) => ({
          hole_number: h.holeNumber,
          loop: h.loop,
          strokes: savedScores[scoreKey(p.id, h.holeNumber, h.loop)] ?? null,
        }))
        .filter((s) => s.strokes != null);
      const { total, relativeToPar, holesPlayed } = calcPlayerScore(
        rows,
        parJson,
      );
      return { player: p, total, relativeToPar, holesPlayed };
    })
    .sort((a, b) => a.relativeToPar - b.relativeToPar);

  // ── Dark mode tokens ────────────────────────────────────
  const dm = {
    bg: d ? "#0f1a0f" : "#f0f4f0",
    card: d ? "#1a2e1a" : "#fff",
    header: d ? "#0d2b18" : "#1d6b3a",
    text: d ? "#e5f5e5" : "#1a2e1a",
    sub: d ? "#86a886" : "#6b7280",
    border: d ? "#2d4a2d" : "#f3f4f6",
    input: d ? "#243824" : "#f3f4f6",
    dot: d ? "#2d4a2d" : "#e5e7eb",
    dotDone: d ? "#2d6b3a" : "#86efac",
    dotPlayoff: d ? "#6b3a2d" : "#fca5a5",
  };

  return (
    <div style={{ minHeight: "100vh", background: dm.bg, paddingBottom: 80 }}>
      {/* ── Header ── */}
      <div
        style={{
          background: dm.header,
          color: "#fff",
          padding: "0.75rem 1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: 680,
            margin: "0 auto",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {round.courses?.name}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.8,
                marginTop: 2,
                textTransform: "capitalize",
              }}
            >
              {layout.layout_name} · {round.format}
              {round.starting_hole > 1
                ? ` · Start hole ${round.starting_hole}`
                : ""}
              {round.play_for_tags ? " · 🏷️ Tags" : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={toggleDark}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <div style={{ fontSize: 22, fontWeight: 700, opacity: 0.9 }}>
              {currentHoleIndex + 1} / {fullOrder.length}
            </div>
          </div>
        </div>

        {/* Matchplay banner */}
        {isMatchplay && matchScore && (
          <div
            style={{
              maxWidth: 680,
              margin: "0.5rem auto 0",
              background: "rgba(0,0,0,0.25)",
              borderRadius: 8,
              padding: "0.5rem 0.75rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, opacity: 0.8 }}>Match score</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>
              {matchScore.allSquare
                ? "All Square"
                : matchScore.matchWon
                  ? `${matchScore.leader?.nickname || matchScore.leader?.full_name} wins!`
                  : `${matchScore.leader?.nickname || matchScore.leader?.full_name} ${matchScore.absScore} UP`}
            </span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {matchScore.matchWon ? "🏆" : `${matchScore.holesLeft} to play`}
            </span>
          </div>
        )}
      </div>
      {/* Navigation buttons */}
      <div
        style={{
          maxWidth: 680,
          margin: "0.5rem auto 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.3)",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        {isOwner && !isComplete && (
          <button
            onClick={cancelRound}
            style={{
              background: "rgba(220,38,38,0.25)",
              border: "2px solid rgba(220,38,38,0.5)",
              color: "#fca5a5",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕ Cancel round
          </button>
        )}
      </div>

      <div style={{ padding: "0.75rem 1rem", maxWidth: 680, margin: "0 auto" }}>
        {/* ── Hole card ── */}
        {hole && (
          <div
            style={{
              background: dm.card,
              borderRadius: 12,
              padding: "1rem",
              marginBottom: "0.75rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: dm.text }}>
                  {hole.isPlayoff
                    ? hole.scorecardLabel
                    : `Hole ${hole.holeNumber}`}
                  {hole.loop > 1 && (
                    <span
                      style={{ fontSize: 13, color: dm.sub, marginLeft: 8 }}
                    >
                      Loop {hole.loop}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: dm.sub, marginTop: 2 }}>
                  {hole.isPlayoff
                    ? `Course hole ${hole.holeNumber}`
                    : `Hole ${currentHoleIndex + 1} of ${fullOrder.length}`}
                </div>
              </div>
              <div
                style={{
                  background: d ? "#0d3d1f" : "#f0faf4",
                  color: "#1d6b3a",
                  padding: "4px 14px",
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                Par {hole.par}
              </div>
            </div>

            {/* Score entry per player */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {players.map((player, playerIdx) => {
                const strokes =
                  getScore(player.id, hole.holeNumber, hole.loop) ?? hole.par;
                const parRel = strokes - hole.par;

                let matchHoleResult = null;
                if (isMatchplay && players.length === 2) {
                  const opp = players[1 - playerIdx];
                  const oppStrokes =
                    getScore(opp.id, hole.holeNumber, hole.loop) ?? hole.par;
                  if (strokes < oppStrokes)
                    matchHoleResult = {
                      label: "WIN",
                      bg: d ? "#1a3d1a" : "#dcfce7",
                      color: "#16a34a",
                    };
                  else if (strokes > oppStrokes)
                    matchHoleResult = {
                      label: "LOSS",
                      bg: d ? "#3d1a1a" : "#fee2e2",
                      color: "#dc2626",
                    };
                  else
                    matchHoleResult = {
                      label: "HALF",
                      bg: d ? "#3d3310" : "#fef9c3",
                      color: "#ca8a04",
                    };
                }

                return (
                  <div
                    key={player.id}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: 600,
                        color: dm.text,
                      }}
                    >
                      {player.nickname || player.full_name}
                    </span>
                    {isComplete ? (
                      // View only — no controls
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            fontWeight: 700,
                            ...getRelStyle(parRel, d),
                          }}
                        >
                          {strokes}
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            minWidth: 28,
                            textAlign: "center",
                            ...getRelStyle(parRel, d),
                          }}
                        >
                          {formatRelativeToPar(parRel)}
                        </span>
                        {isMatchplay && matchHoleResult && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: matchHoleResult.bg,
                              color: matchHoleResult.color,
                              minWidth: 36,
                              textAlign: "center",
                            }}
                          >
                            {matchHoleResult.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      // Editable controls
                      <>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <button
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              border: `1.5px solid ${dm.border}`,
                              background: dm.input,
                              fontSize: 20,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: dm.text,
                            }}
                            disabled={!isOwner || strokes <= 1}
                            onClick={() =>
                              updateScore(
                                player.id,
                                hole.holeNumber,
                                hole.loop,
                                Math.max(1, strokes - 1),
                              )
                            }
                          >
                            −
                          </button>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 20,
                              fontWeight: 700,
                              ...getRelStyle(parRel, d),
                            }}
                          >
                            {strokes}
                          </div>
                          <button
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              border: `1.5px solid ${dm.border}`,
                              background: dm.input,
                              fontSize: 20,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              color: dm.text,
                            }}
                            disabled={!isOwner}
                            onClick={() =>
                              updateScore(
                                player.id,
                                hole.holeNumber,
                                hole.loop,
                                strokes + 1,
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            minWidth: 28,
                            textAlign: "center",
                            ...getRelStyle(parRel, d),
                          }}
                        >
                          {formatRelativeToPar(parRel)}
                        </span>
                        {isMatchplay && matchHoleResult && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: matchHoleResult.bg,
                              color: matchHoleResult.color,
                              minWidth: 36,
                              textAlign: "center",
                            }}
                          >
                            {matchHoleResult.label}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            {isOwner && !isComplete && (
              <div
                style={{
                  marginTop: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  {currentHoleIndex > 0 && (
                    <button
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        background: dm.input,
                        color: dm.text,
                        border: `1.5px solid ${dm.border}`,
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: "pointer",
                      }}
                      onClick={() => saveHole(currentHoleIndex - 1)}
                    >
                      ← Prev
                    </button>
                  )}
                  {isLastHole ? (
                    isMatchplay && matchScore && !matchScore.matchWon ? (
                      <button
                        style={{
                          flex: 2,
                          padding: "0.875rem",
                          background: "#b45309",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          saveHole();
                          addPlayoffHole();
                        }}
                      >
                        ⚔️ Add playoff hole
                      </button>
                    ) : (
                      <button
                        style={{
                          flex: 2,
                          padding: "0.875rem",
                          background: "#1d6b3a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 16,
                          cursor: "pointer",
                        }}
                        onClick={handleFinishWithTags}
                        disabled={finishing}
                      >
                        {finishing
                          ? "Finishing…"
                          : round.play_for_tags
                            ? "Finish & resolve tags 🏷️"
                            : "Finish round ✓"}
                      </button>
                    )
                  ) : (
                    <button
                      style={{
                        flex: 2,
                        padding: "0.875rem",
                        background: "#1d6b3a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                      onClick={() => saveHole(currentHoleIndex + 1)}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save & next →"}
                    </button>
                  )}
                </div>
                {/* On playoff holes for tag resolution — always show finish (will re-check for ties) */}
                {!isMatchplay &&
                  round.play_for_tags &&
                  hole?.isPlayoff &&
                  isLastHole && (
                    <button
                      style={{
                        padding: "0.875rem",
                        background: "#1d6b3a",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: "pointer",
                        marginTop: 4,
                      }}
                      onClick={handleFinishWithTags}
                      disabled={finishing}
                    >
                      {finishing ? "Finishing…" : "Finish & resolve tags 🏷️"}
                    </button>
                  )}
                {/* Show finish button once match is won on a playoff hole */}
                {isMatchplay && matchScore?.matchWon && !isLastHole && (
                  <button
                    style={{
                      padding: "0.875rem",
                      background: "#1d6b3a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                    onClick={handleFinishWithTags}
                    disabled={finishing}
                  >
                    {finishing ? "Finishing…" : "Finish round ✓"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Hole navigation dots ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: "0.75rem",
            padding: "0.5rem",
          }}
        >
          {fullOrder.map((h, i) => {
            const allScored = players.every((p) => {
              const k = scoreKey(p.id, h.holeNumber, h.loop);
              return savedScores[k] != null;
            });
            const isCurrent = i === currentHoleIndex;
            return (
              <button
                key={i}
                style={{
                  width: isCurrent ? 36 : 14,
                  height: isCurrent ? 36 : 14,
                  borderRadius: "50%",
                  border: isCurrent ? "3px solid #fff" : "none",
                  cursor: "pointer",
                  padding: 0,
                  background: isCurrent
                    ? "#1d6b3a"
                    : h.isPlayoff
                      ? dm.dotPlayoff
                      : allScored
                        ? dm.dotDone
                        : dm.dot,
                  boxShadow: isCurrent
                    ? "0 0 0 3px #1d6b3a, 0 2px 8px rgba(0,0,0,0.4)"
                    : "none",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                }}
                onClick={() => saveHole(i)}
              >
                {isCurrent ? (h.isPlayoff ? "P" : h.holeNumber) : ""}
              </button>
            );
          })}
          {playoffHoles.length > 0 && (
            <span style={{ fontSize: 10, color: dm.sub, alignSelf: "center" }}>
              🔴 playoff
            </span>
          )}
        </div>

        {/* ── Scoreboard toggle ── */}
        <button
          style={{
            width: "100%",
            padding: "0.625rem",
            background: dm.card,
            border: `1.5px solid ${dm.border}`,
            borderRadius: 10,
            color: dm.sub,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "0.5rem",
          }}
          onClick={() => setShowSummary((s) => !s)}
        >
          {showSummary ? "▲ Hide scoreboard" : "▼ Show scoreboard"}
        </button>

        {showSummary && (
          <div
            style={{
              background: dm.card,
              borderRadius: 12,
              padding: "1rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              overflowX: "auto",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: dm.sub,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 10,
              }}
            >
              Scoreboard
            </div>

            {isMatchplay && matchScore ? (
              // ── Matchplay scoreboard ──
              <div style={{ minWidth: fullOrder.length * 22 + 160 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `120px repeat(${fullOrder.length}, 22px) 60px`,
                    gap: 2,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 11, color: dm.sub }}>Player</div>
                  {fullOrder.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        color: i === currentHoleIndex ? "#1d6b3a" : dm.sub,
                        textAlign: "center",
                        fontWeight: i === currentHoleIndex ? 700 : 400,
                      }}
                    >
                      {h.isPlayoff ? "P" : h.holeNumber}
                    </div>
                  ))}
                  <div
                    style={{ fontSize: 11, color: dm.sub, textAlign: "center" }}
                  >
                    Match
                  </div>
                </div>

                {players.map((player, playerIdx) => (
                  <div
                    key={player.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `120px repeat(${fullOrder.length}, 22px) 60px`,
                      gap: 2,
                      padding: "4px 0",
                      borderTop: `1px solid ${dm.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: dm.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {player.nickname || player.full_name}
                    </div>
                    {fullOrder.map((h, i) => {
                      const s =
                        savedScores[
                          scoreKey(player.id, h.holeNumber, h.loop)
                        ] ?? null;
                      const opp = players[1 - playerIdx];
                      const oppS =
                        savedScores[scoreKey(opp.id, h.holeNumber, h.loop)] ??
                        null;
                      let label = s ?? "·";
                      let style = { color: dm.sub, fontSize: 11 };
                      if (s != null && oppS != null) {
                        if (s < oppS) {
                          label = "W";
                          style = {
                            color: "#16a34a",
                            fontWeight: 700,
                            fontSize: 11,
                          };
                        } else if (s > oppS) {
                          label = "L";
                          style = {
                            color: "#dc2626",
                            fontWeight: 700,
                            fontSize: 11,
                          };
                        } else {
                          label = "H";
                          style = {
                            color: "#ca8a04",
                            fontWeight: 700,
                            fontSize: 11,
                          };
                        }
                      }
                      return (
                        <div key={i} style={{ textAlign: "center", ...style }}>
                          {label}
                        </div>
                      );
                    })}
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textAlign: "center",
                        color:
                          matchScore.leader?.id === player.id
                            ? "#16a34a"
                            : matchScore.allSquare
                              ? dm.sub
                              : "#dc2626",
                      }}
                    >
                      {matchScore.allSquare
                        ? "AS"
                        : matchScore.leader?.id === player.id
                          ? `${matchScore.absScore} UP`
                          : `${matchScore.absScore} DN`}
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `120px repeat(${fullOrder.length}, 22px) 60px`,
                    gap: 2,
                    padding: "4px 0",
                    borderTop: `1px solid ${dm.border}`,
                    marginTop: 2,
                  }}
                >
                  <div style={{ fontSize: 11, color: dm.sub }}>Par</div>
                  {fullOrder.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        textAlign: "center",
                        color: dm.sub,
                      }}
                    >
                      {h.par}
                    </div>
                  ))}
                  <div />
                </div>
              </div>
            ) : (
              // ── Strokeplay scoreboard ──
              <div style={{ minWidth: fullOrder.length * 24 + 180 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `120px repeat(${fullOrder.length}, 24px) 48px 40px`,
                    gap: 2,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 11, color: dm.sub }}>Player</div>
                  {fullOrder.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        color: i === currentHoleIndex ? "#1d6b3a" : dm.sub,
                        textAlign: "center",
                        fontWeight: i === currentHoleIndex ? 700 : 400,
                      }}
                    >
                      {h.holeNumber}
                    </div>
                  ))}
                  <div
                    style={{ fontSize: 11, color: dm.sub, textAlign: "center" }}
                  >
                    Tot
                  </div>
                  <div
                    style={{ fontSize: 11, color: dm.sub, textAlign: "center" }}
                  >
                    +/-
                  </div>
                </div>

                {summary.map(
                  ({ player, total, relativeToPar, holesPlayed }) => (
                    <div
                      key={player.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: `120px repeat(${fullOrder.length}, 24px) 48px 40px`,
                        gap: 2,
                        padding: "4px 0",
                        borderTop: `1px solid ${dm.border}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: dm.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {player.nickname || player.full_name}
                      </div>
                      {fullOrder.map((h, i) => {
                        const s =
                          savedScores[
                            scoreKey(player.id, h.holeNumber, h.loop)
                          ] ?? null;
                        const rel = s != null ? s - h.par : null;
                        return (
                          <div
                            key={i}
                            style={{
                              fontSize: 11,
                              textAlign: "center",
                              fontWeight: 600,
                              borderRadius: 3,
                              ...(rel != null
                                ? getRelStyle(rel, d)
                                : { color: dm.sub }),
                            }}
                          >
                            {s ?? "·"}
                          </div>
                        );
                      })}
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: dm.text,
                          textAlign: "center",
                        }}
                      >
                        {holesPlayed > 0 ? total : "—"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          textAlign: "center",
                          color:
                            relativeToPar < 0
                              ? "#dc2626"
                              : relativeToPar > 0
                                ? "#2563eb"
                                : "#16a34a",
                        }}
                      >
                        {holesPlayed > 0
                          ? formatRelativeToPar(relativeToPar)
                          : "—"}
                      </div>
                    </div>
                  ),
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `120px repeat(${fullOrder.length}, 24px) 48px 40px`,
                    gap: 2,
                    padding: "4px 0",
                    borderTop: `1px solid ${dm.border}`,
                    marginTop: 2,
                  }}
                >
                  <div style={{ fontSize: 11, color: dm.sub }}>Par</div>
                  {fullOrder.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 11,
                        textAlign: "center",
                        color: dm.sub,
                      }}
                    >
                      {h.par}
                    </div>
                  ))}
                  <div
                    style={{ fontSize: 11, textAlign: "center", color: dm.sub }}
                  >
                    {fullOrder.reduce((s, h) => s + h.par, 0)}
                  </div>
                  <div
                    style={{ fontSize: 11, textAlign: "center", color: dm.sub }}
                  >
                    E
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ── Tag tie — playoff required modal ── */}
      {tagTieInfo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 200,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: dm.card,
              borderRadius: 16,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 480,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: dm.text,
                marginBottom: 8,
              }}
            >
              ⚔️ Playoff required
            </div>
            <div
              style={{
                fontSize: 15,
                color: dm.sub,
                marginBottom: "1.25rem",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: dm.text }}>{tagTieInfo.tiedNames}</strong>{" "}
              are tied for bag tags. An additional hole must be played to
              determine the tag order.
            </div>
            <div
              style={{
                background: dm.input,
                borderRadius: 8,
                padding: "0.875rem",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ fontSize: 13, color: dm.sub, marginBottom: 6 }}>
                Tied players
              </div>
              {tagTieInfo.tiedPlayers.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom:
                      i < tagTieInfo.tiedPlayers.length - 1
                        ? `1px solid ${dm.border}`
                        : "none",
                  }}
                >
                  <span
                    style={{ fontSize: 14, fontWeight: 600, color: dm.text }}
                  >
                    {p.nickname || p.full_name}
                  </span>
                  <span style={{ fontSize: 14, color: dm.sub }}>
                    {p.total} strokes · Tag #{p.bag_tag_number}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  background: dm.input,
                  color: dm.text,
                  border: `1.5px solid ${dm.border}`,
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
                onClick={async () => {
                  // Skip playoff — no tag changes
                  setTagTieInfo(null);
                  await supabase
                    .from("rounds")
                    .update({ status: "complete" })
                    .eq("id", roundId);
                  navigate("/history");
                }}
              >
                Skip — no tag changes
              </button>
              <button
                style={{
                  flex: 2,
                  padding: "0.875rem",
                  background: "#b45309",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setTagTieInfo(null);
                  addPlayoffHole();
                }}
              >
                ⚔️ Play playoff hole
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Tag resolution modal ── */}
      {tagResolution && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 200,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: dm.card,
              borderRadius: 16,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 480,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: dm.text,
                marginBottom: 4,
              }}
            >
              🏷️ Tag resolution
            </div>
            <div
              style={{ fontSize: 14, color: dm.sub, marginBottom: "1.25rem" }}
            >
              Based on final scores — lowest score wins the lowest tag number.
            </div>

            {/* Final standings */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: dm.sub,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                Final standings
              </div>
              {tagResolution.allPlayers.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: `1px solid ${dm.border}`,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#1d6b3a",
                        width: 24,
                        textAlign: "center",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{ fontSize: 15, fontWeight: 600, color: dm.text }}
                    >
                      {p.nickname || p.full_name}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{ fontSize: 15, fontWeight: 700, color: dm.text }}
                    >
                      {p.total} strokes
                    </div>
                    <div style={{ fontSize: 12, color: dm.sub }}>
                      Current tag #{p.bag_tag_number}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tag changes */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: dm.sub,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                Tag changes
              </div>
              {tagResolution.changes.length === 0 ? (
                <div
                  style={{
                    background: d ? "#1a3d1a" : "#f0faf4",
                    borderRadius: 8,
                    padding: "0.75rem",
                    fontSize: 14,
                    color: "#16a34a",
                    fontWeight: 500,
                  }}
                >
                  ✓ No changes — all players keep their current tags.
                </div>
              ) : (
                tagResolution.changes.map((c) => (
                  <div
                    key={c.playerId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: `1px solid ${dm.border}`,
                    }}
                  >
                    <span
                      style={{ fontSize: 15, fontWeight: 600, color: dm.text }}
                    >
                      {c.name}
                    </span>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: dm.sub,
                          textDecoration: "line-through",
                        }}
                      >
                        #{c.oldTag}
                      </span>
                      <span style={{ fontSize: 16, color: dm.sub }}>→</span>
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#1d6b3a",
                        }}
                      >
                        #{c.newTag}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  padding: "0.875rem",
                  background: dm.input,
                  color: dm.text,
                  border: `1.5px solid ${dm.border}`,
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
                onClick={declineTagChanges}
                disabled={confirmingTags}
              >
                Skip changes
              </button>
              <button
                style={{
                  flex: 2,
                  padding: "0.875rem",
                  background: "#1d6b3a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={confirmTagChanges}
                disabled={confirmingTags}
              >
                {confirmingTags
                  ? "Saving…"
                  : tagResolution.changes.length === 0
                    ? "Finish round ✓"
                    : `Confirm ${tagResolution.changes.length} change${tagResolution.changes.length > 1 ? "s" : ""} ✓`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRelStyle(rel, dark) {
  if (rel === undefined || rel === null)
    return { background: "transparent", color: dark ? "#4a5080" : "#9ca3af" };
  if (rel <= -3)
    return { background: dark ? "#0a1a3d" : "#dbeafe", color: "#1d4ed8" }; // -3 or better = light blue
  if (rel === -2)
    return { background: dark ? "#0a2a1a" : "#bbf7d0", color: "#15803d" }; // -2 = light green
  if (rel === -1)
    return { background: dark ? "#0d3d1a" : "#dcfce7", color: "#16a34a" }; // -1 = green
  if (rel === 0)
    return {
      background: dark ? "#1a1a2e" : "#f3f4f6",
      color: dark ? "#7b86c2" : "#6b7280",
    }; // par = gray
  if (rel === 1)
    return { background: dark ? "#3d0a0a" : "#fee2e2", color: "#dc2626" }; // +1 = red
  if (rel === 2)
    return { background: dark ? "#3d1f0a" : "#ffedd5", color: "#ea580c" }; // +2 = orange
  if (rel === 3)
    return { background: dark ? "#2a0a3d" : "#f3e8ff", color: "#9333ea" }; // +3 = purple
  return { background: dark ? "#2a1505" : "#f5f0eb", color: "#92400e" }; // +4+ = brown
}
