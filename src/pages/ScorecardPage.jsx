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
import Layout from "../components/shared/Layout";

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
    setPlayOrder(order);

    const { data: rp } = await supabase
      .from("round_players")
      .select("profiles(id, full_name, nickname)")
      .eq("round_id", roundId);
    setPlayers(rp?.map((r) => r.profiles) ?? []);

    const { data: existingScores } = await supabase
      .from("scores")
      .select("*")
      .eq("round_id", roundId);

    const scoreMap = {};
    for (const s of existingScores ?? []) {
      scoreMap[scoreKey(s.player_id, s.hole_number, s.loop)] = s.strokes;
    }
    setScores(scoreMap);

    // Find first incomplete hole
    const firstIncomplete = order.findIndex((h) =>
      rp?.some(
        (r) => scoreMap[scoreKey(r.profiles.id, h.holeNumber, h.loop)] == null,
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

  // When switching holes, default unset scores to par
  function goToHole(index) {
    if (!isOwner) {
      setCurrentHoleIndex(index);
      return;
    }
    const hole = playOrder[index];
    setScores((prev) => {
      const next = { ...prev };
      for (const p of players) {
        const k = scoreKey(p.id, hole.holeNumber, hole.loop);
        if (next[k] == null) next[k] = hole.par;
      }
      return next;
    });
    setCurrentHoleIndex(index);
  }

  async function saveHole(nextIndex) {
    if (!isOwner) return;
    setSaving(true);
    const hole = playOrder[currentHoleIndex];

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

  async function finishRound() {
    setFinishing(true);
    await saveHole();
    await supabase
      .from("rounds")
      .update({ status: "complete" })
      .eq("id", roundId);
    navigate("/history");
  }

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", next);
  }

  if (!round || !layout)
    return (
      <Layout title="Scorecard">
        <p>Loading...</p>
      </Layout>
    );

  const hole = playOrder[currentHoleIndex];
  const parJson = layout.par_json;
  const isLastHole = currentHoleIndex === playOrder.length - 1;
  const d = darkMode;

  // Compute summary for all players across all holes
  const summary = players
    .map((p) => {
      const playerScoreRows = playOrder
        .map((h) => ({
          hole_number: h.holeNumber,
          loop: h.loop,
          strokes: getScore(p.id, h.holeNumber, h.loop),
        }))
        .filter((s) => s.strokes != null);
      const { total, relativeToPar, holesPlayed } = calcPlayerScore(
        playerScoreRows,
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
    btn: d ? "#1d6b3a" : "#1d6b3a",
    dot: d ? "#2d4a2d" : "#e5e7eb",
    dotDone: d ? "#2d6b3a" : "#86efac",
  };

  return (
    <div style={{ minHeight: "100vh", background: dm.bg, paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          background: dm.header,
          color: "#fff",
          padding: "0.75rem 1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
            {currentHoleIndex + 1} / {playOrder.length}
          </div>
        </div>
      </div>

      <div style={{ padding: "0.75rem 1rem", maxWidth: 680, margin: "0 auto" }}>
        {/* Current hole card */}
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
                  Hole {hole.holeNumber}
                  {hole.loop > 1 && (
                    <span
                      style={{ fontSize: 13, color: dm.sub, marginLeft: 8 }}
                    >
                      Loop {hole.loop}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: dm.sub, marginTop: 2 }}>
                  Hole {currentHoleIndex + 1} of {playOrder.length}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {players.map((player) => {
                const strokes =
                  getScore(player.id, hole.holeNumber, hole.loop) ?? hole.par;
                const rel = strokes - hole.par;

                return (
                  <div
                    key={player.id}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: 500,
                        color: dm.text,
                      }}
                    >
                      {player.nickname || player.full_name}
                    </span>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
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
                          ...getRelStyle(rel, d),
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
                        ...getRelStyle(rel, d),
                      }}
                    >
                      {formatRelativeToPar(rel)}
                    </span>
                  </div>
                );
              })}
            </div>

            {isOwner && (
              <div style={{ marginTop: "1.25rem", display: "flex", gap: 8 }}>
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
            )}
          </div>
        )}

        {/* Hole navigation dots */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            justifyContent: "center",
            marginBottom: "0.75rem",
          }}
        >
          {playOrder.map((h, i) => {
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
                  background:
                    i === currentHoleIndex
                      ? "#1d6b3a"
                      : allScored
                        ? dm.dotDone
                        : dm.dot,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transform: i === currentHoleIndex ? "scale(1.4)" : "none",
                }}
                onClick={() => saveHole(i)}
              />
            );
          })}
        </div>

        {/* Summary scoreboard toggle */}
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

            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr repeat(" + playOrder.length + ", 24px) 48px 36px",
                gap: 2,
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 11, color: dm.sub }}>Player</div>
              {playOrder.map((h, i) => (
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
              <div style={{ fontSize: 11, color: dm.sub, textAlign: "center" }}>
                Tot
              </div>
              <div style={{ fontSize: 11, color: dm.sub, textAlign: "center" }}>
                +/-
              </div>
            </div>

            {/* Player rows */}
            {summary.map(({ player, total, relativeToPar, holesPlayed }) => (
              <div
                key={player.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr repeat(" + playOrder.length + ", 24px) 48px 36px",
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
                {playOrder.map((h, i) => {
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
                  {holesPlayed > 0 ? formatRelativeToPar(relativeToPar) : "—"}
                </div>
              </div>
            ))}

            {/* Par row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr repeat(" + playOrder.length + ", 24px) 48px 36px",
                gap: 2,
                padding: "4px 0",
                borderTop: `1px solid ${dm.border}`,
                marginTop: 2,
              }}
            >
              <div style={{ fontSize: 11, color: dm.sub }}>Par</div>
              {playOrder.map((h, i) => (
                <div
                  key={i}
                  style={{ fontSize: 11, textAlign: "center", color: dm.sub }}
                >
                  {h.par}
                </div>
              ))}
              <div style={{ fontSize: 11, textAlign: "center", color: dm.sub }}>
                {playOrder.reduce((s, h) => s + h.par, 0)}
              </div>
              <div style={{ fontSize: 11, textAlign: "center", color: dm.sub }}>
                E
              </div>
            </div>
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
