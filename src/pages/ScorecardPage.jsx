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
  const [scores, setScores] = useState({});
  const [playOrder, setPlayOrder] = useState([]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("darkMode") === "true",
  );
  const [showSummary, setShowSummary] = useState(false);
  const [playoffHoles, setPlayoffHoles] = useState([]); // extra holes beyond layout

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

    const parJson = roundData.layouts.par_json;
    const order = getPlayOrder(
      roundData.starting_hole,
      roundData.layouts.number_of_holes,
      roundData.layouts.loops,
      parJson,
    );

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

    // Detect any stored playoff holes (play_order > order.length)
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

    setSaving(false);
    if (nextIndex !== undefined) goToHole(nextIndex);
  }

  // Add a playoff hole continuing from where the course left off
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

  async function finishRound() {
    setFinishing(true);
    await saveHole();
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
      <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
    );

  const isMatchplay = round.format === "matchplay";
  const fullOrder = [...playOrder, ...playoffHoles];
  const hole = fullOrder[currentHoleIndex];
  const parJson = layout.par_json;
  const isLastHole = currentHoleIndex === fullOrder.length - 1;
  const d = darkMode;

  // Matchplay running score
  function calcMatchScore() {
    if (!isMatchplay || players.length !== 2) return null;
    const [p1, p2] = players;
    let score = 0; // positive = p1 leads
    let holesLeft = fullOrder.length - currentHoleIndex - 1;

    for (let i = 0; i <= currentHoleIndex; i++) {
      const h = fullOrder[i];
      const s1 = getScore(p1.id, h.holeNumber, h.loop);
      const s2 = getScore(p2.id, h.holeNumber, h.loop);
      if (s1 != null && s2 != null) {
        if (s1 < s2) score++;
        else if (s2 < s1) score--;
      }
    }

    const holesPlayed = currentHoleIndex + 1;
    const absScore = Math.abs(score);
    const leader = score > 0 ? p1 : score < 0 ? p2 : null;

    // Match won if lead > holes remaining
    const matchWon = absScore > holesLeft;
    const allSquare = score === 0;

    return {
      score,
      absScore,
      leader,
      holesLeft,
      matchWon,
      allSquare,
      holesPlayed,
    };
  }

  const matchScore = calcMatchScore();

  // Strokeplay summary
  const summary = players
    .map((p) => {
      const rows = fullOrder
        .map((h) => ({
          hole_number: h.holeNumber,
          loop: h.loop,
          strokes: getScore(p.id, h.holeNumber, h.loop),
        }))
        .filter((s) => s.strokes != null);
      const { total, relativeToPar, holesPlayed } = calcPlayerScore(
        rows,
        parJson,
      );
      return { player: p, total, relativeToPar, holesPlayed };
    })
    .sort((a, b) => a.relativeToPar - b.relativeToPar);

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
      {/* Header */}
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

        {/* Matchplay running score banner */}
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
              {matchScore.matchWon ? "" : `${matchScore.holesLeft} to play`}
            </span>
          </div>
        )}

        {/* Cancel button */}
        {isOwner && (
          <div
            style={{
              maxWidth: 680,
              margin: "0.375rem auto 0",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={cancelRound}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕ Cancel round
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "0.75rem 1rem", maxWidth: 680, margin: "0 auto" }}>
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

            {/* Score entry */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {players.map((player, playerIdx) => {
                const strokes =
                  getScore(player.id, hole.holeNumber, hole.loop) ?? hole.par;
                const parRel = strokes - hole.par;

                // Matchplay: hole result vs opponent
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
                  <div key={player.id}>
                    <div
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
                    </div>
                  </div>
                );
              })}
            </div>

            {isOwner && (
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
                    // Matchplay: if tied after regulation, offer playoff instead of finish
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
                        onClick={finishRound}
                        disabled={finishing}
                      >
                        {finishing ? "Finishing…" : "Finish round ✓"}
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

                {/* Once match is won, show finish button even on a playoff hole */}
                {isMatchplay && matchScore?.matchWon && (
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
                    onClick={finishRound}
                    disabled={finishing}
                  >
                    {finishing ? "Finishing…" : "Finish round ✓"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hole dots */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
            marginBottom: "0.75rem",
          }}
        >
          {fullOrder.map((h, i) => {
            const allScored = players.every(
              (p) => getScore(p.id, h.holeNumber, h.loop) != null,
            );
            return (
              <button
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform 0.1s",
                  background:
                    i === currentHoleIndex
                      ? "#1d6b3a"
                      : h.isPlayoff
                        ? dm.dotPlayoff
                        : allScored
                          ? dm.dotDone
                          : dm.dot,
                  transform: i === currentHoleIndex ? "scale(1.4)" : "none",
                }}
                onClick={() => saveHole(i)}
              />
            );
          })}
          {playoffHoles.length > 0 && (
            <span style={{ fontSize: 10, color: dm.sub, alignSelf: "center" }}>
              🔴 playoff
            </span>
          )}
        </div>

        {/* Scoreboard toggle */}
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
              // Matchplay scoreboard — hole by hole W/L/H
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr repeat(" + fullOrder.length + ", 22px) 60px",
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

                {players.map((player, playerIdx) => {
                  let runningScore = 0;
                  return (
                    <div
                      key={player.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "1fr repeat(" + fullOrder.length + ", 22px) 60px",
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
                        const s = getScore(player.id, h.holeNumber, h.loop);
                        const opp = players[1 - playerIdx];
                        const oppS = getScore(opp.id, h.holeNumber, h.loop);
                        let cell = {
                          label: s ?? "·",
                          style: { color: dm.sub, fontSize: 11 },
                        };
                        if (s != null && oppS != null) {
                          if (s < oppS) {
                            cell = {
                              label: "W",
                              style: {
                                color: "#16a34a",
                                fontWeight: 700,
                                fontSize: 11,
                              },
                            };
                          } else if (s > oppS) {
                            cell = {
                              label: "L",
                              style: {
                                color: "#dc2626",
                                fontWeight: 700,
                                fontSize: 11,
                              },
                            };
                          } else {
                            cell = {
                              label: "H",
                              style: {
                                color: "#ca8a04",
                                fontWeight: 700,
                                fontSize: 11,
                              },
                            };
                          }
                        }
                        return (
                          <div
                            key={i}
                            style={{ textAlign: "center", ...cell.style }}
                          >
                            {cell.label}
                          </div>
                        );
                      })}
                      {/* Running match score for this player */}
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
                  );
                })}

                {/* Par row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr repeat(" + fullOrder.length + ", 22px) 60px",
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
              // Strokeplay scoreboard
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr repeat(" + fullOrder.length + ", 24px) 48px 36px",
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
                        gridTemplateColumns:
                          "1fr repeat(" +
                          fullOrder.length +
                          ", 24px) 48px 36px",
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
                        const s = getScore(player.id, h.holeNumber, h.loop);
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
                    gridTemplateColumns:
                      "1fr repeat(" + fullOrder.length + ", 24px) 48px 36px",
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
    </div>
  );
}

function getRelStyle(rel, dark) {
  if (rel < 0)
    return { background: dark ? "#3d1a1a" : "#fee2e2", color: "#dc2626" };
  if (rel === 0)
    return { background: dark ? "#1a3d2a" : "#f0fdf4", color: "#16a34a" };
  if (rel === 1)
    return { background: dark ? "#3d3310" : "#fef9c3", color: "#ca8a04" };
  return { background: dark ? "#1a2a3d" : "#eff6ff", color: "#2563eb" };
}
