import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../hooks/useDarkMode";
import { getTheme } from "../lib/theme";
import Layout from "../components/shared/Layout";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [recentRounds, setRecentRounds] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [upcomingTournamentRounds, setUpcomingTournamentRounds] = useState([]);

  useEffect(() => {
    const now = new Date().toISOString();

    // Announcements
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements(data ?? []));

    // Upcoming events (next 14 days)
    supabase
      .from("events")
      .select("*, courses(name), layouts(layout_name)")
      .gte("event_date", now)
      .order("event_date", { ascending: true })
      .limit(5)
      .then(({ data }) => setUpcomingEvents(data ?? []));

    // Get published tournament IDs first, then fetch their rounds
    supabase
      .from("tournaments")
      .select("id, name, status, format")
      .eq("status", "published")
      .then(async ({ data: publishedTournaments }) => {
        if (!publishedTournaments || publishedTournaments.length === 0) return;
        const tIds = publishedTournaments.map((t) => t.id);

        const { data: tRounds, error } = await supabase
          .from("tournament_rounds")
          .select(
            "*, courses(id, name), layouts(id, layout_name, number_of_holes, loops, par_json)",
          )
          .in("tournament_id", tIds)
          .gte("scheduled_date", now)
          .order("scheduled_date", { ascending: true })
          .limit(5);

        if (error) {
          console.error("tournament rounds error:", error);
          return;
        }

        // Attach tournament info to each round
        const enriched = (tRounds ?? []).map((r) => ({
          ...r,
          tournaments: publishedTournaments.find(
            (t) => t.id === r.tournament_id,
          ),
        }));
        setUpcomingTournamentRounds(enriched);
      });

    // Recent rounds
    if (profile) {
      supabase
        .from("rounds")
        .select(
          `id, played_at, status, format, courses(name), layouts(layout_name), round_players!inner(player_id)`,
        )
        .eq("round_players.player_id", profile.id)
        .order("played_at", { ascending: false })
        .limit(5)
        .then(({ data }) => setRecentRounds(data ?? []));
    }
  }, [profile]);

  async function startTournamentRound(tr) {
    // Navigate to new round page with tournament round pre-filled
    navigate("/round/new", {
      state: {
        tournamentRoundId: tr.id,
        tournamentId: tr.tournaments.id,
        tournamentName: tr.tournaments.name,
        courseId: tr.course_id,
        courseName: tr.courses?.name,
        layoutId: tr.layout_id,
        layoutName: tr.layouts?.layout_name,
        format: tr.tournaments.format,
        prefilledFromTournament: true,
      },
    });
  }

  const hasUpcoming =
    upcomingEvents.length > 0 || upcomingTournamentRounds.length > 0;

  return (
    <Layout
      title={`G'day, ${profile?.nickname || profile?.full_name?.split(" ")[0] || "Mate"} 👋`}
    >
      {/* Quick action */}
      <Link
        to="/round/new"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: t.accent,
          color: "#fff",
          padding: "1rem 1.25rem",
          borderRadius: 12,
          textDecoration: "none",
          marginBottom: "0.75rem",
        }}
      >
        <span style={{ fontSize: 32 }}>🥏</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Start a new round</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
            Strokeplay or matchplay
          </div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 20, opacity: 0.7 }}>
          →
        </span>
      </Link>

      {/* Bag tag */}
      {profile?.bag_tag_number && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: t.card,
            borderRadius: 10,
            padding: "0.875rem 1rem",
            marginBottom: "1rem",
            boxShadow: t.shadow,
          }}
        >
          <span style={{ fontSize: 28 }}>🏷️</span>
          <div>
            <div style={{ fontSize: 12, color: t.textSub }}>Your bag tag</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.accentText }}>
              #{profile.bag_tag_number}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming events & tournament rounds */}
      {hasUpcoming && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              marginTop: "0.25rem",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              Upcoming
            </span>
          </div>

          {/* Tournament rounds */}
          {upcomingTournamentRounds.map((tr) => {
            const d = new Date(tr.scheduled_date);
            const isToday = new Date().toDateString() === d.toDateString();
            return (
              <div
                key={tr.id}
                style={{
                  background: t.card,
                  borderRadius: 10,
                  padding: "0.875rem 1rem",
                  marginBottom: 8,
                  boxShadow: t.shadow,
                  border: isToday
                    ? `2px solid ${t.accent}`
                    : `1px solid ${t.border}`,
                }}
              >
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
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: t.accentLight,
                          color: t.accentText,
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        🏆 Tournament
                      </span>
                      {isToday && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: t.successLight,
                            color: t.success,
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    <div
                      style={{ fontWeight: 700, fontSize: 15, color: t.text }}
                    >
                      {tr.tournaments?.name}
                    </div>
                    <div
                      style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}
                    >
                      Round {tr.round_number} · {tr.courses?.name ?? "TBC"}{" "}
                      {tr.layouts ? `· ${tr.layouts.layout_name}` : ""}
                    </div>
                    <div
                      style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}
                    >
                      {d.toLocaleDateString("en-NZ", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {d.toLocaleTimeString("en-NZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                {isToday && tr.course_id && tr.layout_id && (
                  <button
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "0.625rem",
                      background: t.accent,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                    onClick={() => startTournamentRound(tr)}
                  >
                    🥏 Start tournament round
                  </button>
                )}
              </div>
            );
          })}

          {/* Regular events */}
          {upcomingEvents.map((ev) => {
            const d = new Date(ev.event_date);
            const isToday = new Date().toDateString() === d.toDateString();
            return (
              <div
                key={ev.id}
                style={{
                  background: t.card,
                  borderRadius: 10,
                  padding: "0.875rem 1rem",
                  marginBottom: 8,
                  boxShadow: t.shadow,
                  border: isToday
                    ? `2px solid ${t.accent}`
                    : `1px solid ${t.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: t.warnLight,
                      color: t.warn,
                      padding: "1px 6px",
                      borderRadius: 4,
                    }}
                  >
                    📅 Event
                  </span>
                  {isToday && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: t.successLight,
                        color: t.success,
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>
                  {ev.name}
                </div>
                {ev.courses && (
                  <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
                    {ev.courses.name}
                    {ev.layouts ? ` · ${ev.layouts.layout_name}` : ""}
                  </div>
                )}
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  {d.toLocaleDateString("en-NZ", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                  {" · "}
                  {d.toLocaleTimeString("en-NZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {ev.description && (
                  <div
                    style={{
                      fontSize: 13,
                      color: t.textSub,
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {ev.description}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              marginTop: "0.5rem",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              Latest news
            </span>
            <Link
              to="/news"
              style={{
                fontSize: 13,
                color: t.accentText,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              See all →
            </Link>
          </div>
          {announcements.map((a) => (
            <div
              key={a.id}
              style={{
                background: t.card,
                borderRadius: 10,
                padding: "0.875rem 1rem",
                marginBottom: 8,
                boxShadow: t.shadow,
              }}
            >
              {a.pinned && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#92400e",
                    background: "#fef3c7",
                    padding: "1px 6px",
                    borderRadius: 4,
                    marginBottom: 4,
                    display: "inline-block",
                  }}
                >
                  📌 Pinned
                </span>
              )}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: t.text,
                  marginBottom: 4,
                }}
              >
                {a.title}
              </div>
              <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.4 }}>
                {a.body.slice(0, 120)}
                {a.body.length > 120 ? "…" : ""}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Recent rounds */}
      {recentRounds.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              marginTop: "0.5rem",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              Recent rounds
            </span>
            <Link
              to="/history"
              style={{
                fontSize: 13,
                color: t.accentText,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              See all →
            </Link>
          </div>
          {recentRounds.map((r) => (
            <Link
              key={r.id}
              to={`/round/${r.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: t.card,
                borderRadius: 10,
                padding: "0.875rem 1rem",
                marginBottom: 8,
                textDecoration: "none",
                boxShadow: t.shadow,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
                  {r.courses?.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: t.textSub,
                    textTransform: "capitalize",
                  }}
                >
                  {r.layouts?.layout_name} · {r.format}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontSize: 13, color: t.textSub, marginBottom: 4 }}
                >
                  {new Date(r.played_at).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 4,
                    ...(r.status === "complete"
                      ? { background: t.successLight, color: t.success }
                      : { background: t.warnLight, color: t.warn }),
                  }}
                >
                  {r.status === "complete" ? "Complete" : "In progress"}
                </div>
              </div>
            </Link>
          ))}
        </>
      )}
    </Layout>
  );
}
