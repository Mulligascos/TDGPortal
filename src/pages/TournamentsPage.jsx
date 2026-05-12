import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../hooks/useDarkMode";
import { getTheme } from "../lib/theme";
import {
  calcStrokeplayStandings,
  calcMatchplayStandings,
  formatRelativeToParT,
} from "../lib/tournamentScoring";
import Layout from "../components/shared/Layout";

export default function TournamentsPage() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "published")
      .order("start_date", { ascending: false });
    setTournaments(data ?? []);
    setLoading(false);
  }

  const now = new Date();
  const active = tournaments.filter(
    (t) => new Date(t.start_date) <= now && new Date(t.end_date) >= now,
  );
  const completed = tournaments.filter((t) => new Date(t.end_date) < now);
  const upcoming = tournaments.filter((t) => new Date(t.start_date) > now);

  return (
    <Layout title="Tournaments">
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        {[
          { key: "active", label: `Active (${active.length})` },
          { key: "completed", label: `Completed (${completed.length})` },
          { key: "upcoming", label: `Upcoming (${upcoming.length})` },
        ].map((tab_) => (
          <button
            key={tab_.key}
            onClick={() => setTab(tab_.key)}
            style={{
              padding: "0.4rem 0.875rem",
              borderRadius: 20,
              border: `1.5px solid ${tab === tab_.key ? t.accent : t.border}`,
              background: tab === tab_.key ? t.accentLight : t.card,
              color: tab === tab_.key ? t.accentText : t.textSub,
              fontWeight: tab === tab_.key ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: t.textSub }}>Loading...</p>}

      {!loading && tab === "active" && active.length === 0 && (
        <p style={{ color: t.textSub }}>No active tournaments.</p>
      )}
      {!loading && tab === "completed" && completed.length === 0 && (
        <p style={{ color: t.textSub }}>No completed tournaments yet.</p>
      )}
      {!loading && tab === "upcoming" && upcoming.length === 0 && (
        <p style={{ color: t.textSub }}>No upcoming tournaments.</p>
      )}

      {tab === "active" &&
        active.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} t={t} />
        ))}
      {tab === "completed" &&
        completed.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} t={t} />
        ))}
      {tab === "upcoming" &&
        upcoming.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} t={t} />
        ))}
    </Layout>
  );
}

function TournamentCard({ tournament, t }) {
  const [expanded, setExpanded] = useState(false);
  const [standings, setStandings] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [tRounds, setTRounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState({});

  async function load() {
    setLoading(true);
    const [divRes, roundRes, playerRes] = await Promise.all([
      supabase
        .from("tournament_divisions")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("display_order"),
      supabase
        .from("tournament_rounds")
        .select("*, layouts(layout_name, number_of_holes, loops, par_json)")
        .eq("tournament_id", tournament.id)
        .order("round_number"),
      supabase
        .from("tournament_players")
        .select(
          "*, profiles(id, full_name, nickname), tournament_divisions(name)",
        )
        .eq("tournament_id", tournament.id),
    ]);

    const divList = divRes.data ?? [];
    const roundList = roundRes.data ?? [];
    const playerList = playerRes.data ?? [];

    setDivisions(divList);
    setTRounds(roundList);

    // Fetch scores for all linked rounds
    const linkedRoundIds = roundList
      .filter((r) => r.round_id)
      .map((r) => r.round_id);
    let scores = [];
    if (linkedRoundIds.length > 0) {
      const { data: scoreData } = await supabase
        .from("scores")
        .select("player_id, strokes, round_id, hole_number, loop")
        .in("round_id", linkedRoundIds);
      scores = scoreData ?? [];
    }

    // Calculate standings
    const calc =
      tournament.format === "matchplay"
        ? calcMatchplayStandings(playerList, roundList, scores, tournament)
        : calcStrokeplayStandings(playerList, roundList, scores, tournament);

    setStandings(calc);
    setLoading(false);

    // Auto-expand first division
    if (divList.length > 0) setExpandedDivisions({ [divList[0].id]: true });
    else setExpandedDivisions({ ungrouped: true });
  }

  async function toggle() {
    if (!expanded) await load();
    setExpanded((e) => !e);
  }

  function toggleDiv(id) {
    setExpandedDivisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const isMatchplay = tournament.format === "matchplay";
  const isComplete = new Date(tournament.end_date) < new Date();
  const isActive = new Date(tournament.start_date) <= new Date() && !isComplete;

  // Group standings by division
  const divisionGroups = divisions.map((div) => ({
    division: div,
    players: standings.filter((s) => s.division_id === div.id),
  }));
  const ungrouped = standings.filter(
    (s) => !divisions.find((d) => d.id === s.division_id),
  );

  return (
    <div
      style={{
        background: t.card,
        borderRadius: 12,
        marginBottom: 12,
        boxShadow: t.shadow,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "1rem", cursor: "pointer" }} onClick={toggle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: t.text }}>
                {tournament.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: isComplete
                    ? t.borderCard
                    : isActive
                      ? t.successLight
                      : t.warnLight,
                  color: isComplete
                    ? t.textMuted
                    : isActive
                      ? t.success
                      : t.warn,
                }}
              >
                {isComplete ? "Completed" : isActive ? "● Active" : "Upcoming"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: t.textSub }}>
              {new Date(tournament.start_date).toLocaleDateString("en-NZ", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Pacific/Auckland",
              })}
              {" → "}
              {new Date(tournament.end_date).toLocaleDateString("en-NZ", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Pacific/Auckland",
              })}
              {" · "}
              <span style={{ textTransform: "capitalize" }}>
                {tournament.format}
              </span>
              {tournament.scoring_type === "best_rounds" &&
                ` · Best ${tournament.best_rounds_count} rounds`}
            </div>
            {tournament.description && (
              <div
                style={{
                  fontSize: 13,
                  color: t.textSub,
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                {tournament.description}
              </div>
            )}
          </div>
          <span style={{ fontSize: 18, color: t.textSub, marginLeft: 8 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "1rem" }}>
          {loading && (
            <p style={{ color: t.textSub, fontSize: 13 }}>
              Loading standings...
            </p>
          )}

          {/* Rounds summary */}
          {!loading && tRounds.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.textSub,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                }}
              >
                Rounds
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tRounds.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: r.round_id ? t.successLight : t.cardAlt,
                      border: `1px solid ${r.round_id ? t.success : t.border}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: r.round_id ? t.success : t.textSub,
                      }}
                    >
                      Round {r.round_number} {r.round_id ? "✓" : "—"}
                    </span>
                    {r.layouts && (
                      <span
                        style={{
                          fontSize: 11,
                          color: t.textMuted,
                          marginLeft: 4,
                        }}
                      >
                        {r.layouts.layout_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standings */}
          {!loading && standings.length === 0 && (
            <p style={{ color: t.textSub, fontSize: 13 }}>No scores yet.</p>
          )}

          {!loading &&
            [
              ...divisionGroups,
              ...(ungrouped.length > 0
                ? [
                    {
                      division: { id: "ungrouped", name: "Open" },
                      players: ungrouped,
                    },
                  ]
                : []),
            ].map(({ division, players: divPlayers }) => (
              <div
                key={division.id}
                style={{
                  marginBottom: 8,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <button
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    background: t.cardAlt,
                    border: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    color: t.text,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                  onClick={() => toggleDiv(division.id)}
                >
                  <span>
                    {division.name} ({divPlayers.length})
                  </span>
                  <span style={{ fontSize: 12 }}>
                    {expandedDivisions[division.id] ? "▲" : "▼"}
                  </span>
                </button>

                {expandedDivisions[division.id] && (
                  <div>
                    {/* Header row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMatchplay
                          ? "24px 1fr 40px 80px 50px"
                          : `24px 1fr ${tRounds.map(() => "36px").join(" ")} 50px 50px`,
                        gap: 4,
                        padding: "6px 0.875rem",
                        borderBottom: `1px solid ${t.borderCard}`,
                      }}
                    >
                      <div style={{ fontSize: 10, color: t.textMuted }}>#</div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>
                        Player
                      </div>
                      {isMatchplay ? (
                        <>
                          <div
                            style={{
                              fontSize: 10,
                              color: t.textMuted,
                              textAlign: "center",
                            }}
                          >
                            W/H/L
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: t.textMuted,
                              textAlign: "center",
                            }}
                          >
                            Pts
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: t.textMuted,
                              textAlign: "center",
                            }}
                          >
                            Diff
                          </div>
                        </>
                      ) : (
                        <>
                          {tRounds.map((r) => (
                            <div
                              key={r.id}
                              style={{
                                fontSize: 10,
                                color: t.textMuted,
                                textAlign: "center",
                              }}
                            >
                              R{r.round_number}
                            </div>
                          ))}
                          <div
                            style={{
                              fontSize: 10,
                              color: t.textMuted,
                              textAlign: "center",
                            }}
                          >
                            Tot
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: t.textMuted,
                              textAlign: "center",
                            }}
                          >
                            +/-
                          </div>
                        </>
                      )}
                    </div>

                    {divPlayers.length === 0 && (
                      <p
                        style={{
                          padding: "0.75rem 0.875rem",
                          color: t.textSub,
                          fontSize: 13,
                          margin: 0,
                        }}
                      >
                        No players.
                      </p>
                    )}

                    {divPlayers.map((p, i) => (
                      <div
                        key={p.player_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: isMatchplay
                            ? "24px 1fr 40px 80px 50px"
                            : `24px 1fr ${tRounds.map(() => "36px").join(" ")} 50px 50px`,
                          gap: 4,
                          padding: "8px 0.875rem",
                          borderBottom: `1px solid ${t.borderCard}`,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: i === 0 ? t.accentText : t.textSub,
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: t.text,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </span>

                        {isMatchplay ? (
                          <>
                            <div
                              style={{
                                fontSize: 12,
                                textAlign: "center",
                                color: t.textSub,
                              }}
                            >
                              {p.wins}W/{p.halved}H/{p.losses}L
                            </div>
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 800,
                                textAlign: "center",
                                color: i === 0 ? t.accentText : t.text,
                              }}
                            >
                              {p.matchesPlayed > 0 ? p.points : "—"}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                textAlign: "center",
                                color:
                                  p.differential >= 0 ? t.success : t.danger,
                              }}
                            >
                              {p.matchesPlayed > 0
                                ? p.differential >= 0
                                  ? `+${p.differential}`
                                  : p.differential
                                : "—"}
                            </div>
                          </>
                        ) : (
                          <>
                            {tRounds.map((r) => {
                              const result = p.roundResults?.find(
                                (rr) => rr.roundId === r.round_id,
                              );
                              const isCounted =
                                tournament.scoring_type === "best_rounds"
                                  ? p.countedRounds?.some(
                                      (cr) => cr.roundId === r.round_id,
                                    )
                                  : true;
                              return (
                                <div
                                  key={r.id}
                                  style={{
                                    fontSize: 12,
                                    textAlign: "center",
                                    fontWeight: 600,
                                    color: result
                                      ? result.relativeToPar < 0
                                        ? t.success
                                        : result.relativeToPar > 0
                                          ? t.danger
                                          : t.textSub
                                      : t.textMuted,
                                    opacity: !isCounted && result ? 0.4 : 1,
                                    textDecoration:
                                      !isCounted && result
                                        ? "line-through"
                                        : "none",
                                  }}
                                >
                                  {result
                                    ? formatRelativeToParT(result.relativeToPar)
                                    : "—"}
                                </div>
                              );
                            })}
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                textAlign: "center",
                                color: t.text,
                              }}
                            >
                              {p.roundsPlayed > 0 ? p.totalStrokes : "—"}
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 800,
                                textAlign: "center",
                                color:
                                  p.relativeToPar == null
                                    ? t.textMuted
                                    : p.relativeToPar < 0
                                      ? t.success
                                      : p.relativeToPar > 0
                                        ? t.danger
                                        : t.textSub,
                              }}
                            >
                              {formatRelativeToParT(p.relativeToPar)}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
