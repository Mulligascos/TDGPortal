import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../hooks/useDarkMode";
import { getTheme } from "../lib/theme";
import Layout from "../components/shared/Layout";
import {
  calcStrokeplayStandings,
  calcMatchplayStandings,
  formatRelativeToParT,
} from "../lib/tournamentScoring";

function Section({
  title,
  count,
  defaultOpen = true,
  accent,
  children,
  t,
  action,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.5rem 0",
          marginBottom: open ? "0.5rem" : 0,
        }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>
              {title}
            </span>
            {count != null && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 10,
                  background: accent ?? t.accentLight,
                  color: accent ? "#fff" : t.accentText,
                }}
              >
                {count}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: 13,
              color: t.textSub,
              transition: "transform 0.2s",
              display: "inline-block",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              marginLeft: 4,
            }}
          >
            ▼
          </span>
        </button>
        {action && <div>{action}</div>}
      </div>
      {open && children}
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [recentRounds, setRecentRounds] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [upcomingTournamentRounds, setUpcomingTournamentRounds] = useState([]);
  const [activeTournaments, setActiveTournaments] = useState([]);

  useEffect(() => {
    const now = new Date().toISOString();
    // Active tournaments (started but not ended)
    const nowStr = new Date().toISOString().split("T")[0];
    supabase
      .from("tournaments")
      .select("*")
      .eq("status", "published")
      .lte("start_date", nowStr)
      .gte("end_date", nowStr)
      .then(({ data }) => setActiveTournaments(data ?? []));
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements(data ?? []));

    supabase
      .from("events")
      .select("*, courses(name), layouts(layout_name)")
      .gte("event_date", now)
      .order("event_date", { ascending: true })
      .limit(5)
      .then(({ data }) => setUpcomingEvents(data ?? []));

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
        const enriched = (tRounds ?? []).map((r) => ({
          ...r,
          tournaments: publishedTournaments.find(
            (pt) => pt.id === r.tournament_id,
          ),
        }));
        setUpcomingTournamentRounds(enriched);
      });

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
    console.log("startTournamentRound called", tr);
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
  const [showCalendar, setShowCalendar] = useState(false);
  const upcomingCount = upcomingEvents.length + upcomingTournamentRounds.length;
  // Merge and sort all upcoming items by date
  const allUpcoming = [
    ...upcomingEvents.map((e) => ({
      ...e,
      _type: "event",
      _date: new Date(e.event_date),
    })),
    ...upcomingTournamentRounds.map((t) => ({
      ...t,
      _type: "tournament",
      _date: new Date(t.scheduled_date),
    })),
  ].sort((a, b) => a._date - b._date);

  return (
    <Layout
      title={`G'day, ${profile?.nickname || profile?.full_name?.split(" ")[0] || "Mate"} 👋`}
    >
      {/* Quick actions row */}
      <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
        <Link
          to="/round/new"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: t.accent,
            color: "#fff",
            padding: "0.875rem 1rem",
            borderRadius: 12,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 26 }}>🥏</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>New round</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Stroke or match</div>
          </div>
        </Link>
        {profile?.bag_tag_number && (
          <Link
            to="/bag-tags"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: t.card,
              padding: "0.875rem 1rem",
              borderRadius: 12,
              textDecoration: "none",
              boxShadow: t.shadow,
              minWidth: 100,
            }}
          >
            <span style={{ fontSize: 22 }}>🏷️</span>
            <div>
              <div style={{ fontSize: 11, color: t.textSub }}>Bag tag</div>
              <div
                style={{ fontSize: 20, fontWeight: 800, color: t.accentText }}
              >
                #{profile.bag_tag_number}
              </div>
            </div>
          </Link>
        )}
      </div>
      {/* Latest news */}
      {announcements.length > 0 && (
        <Section
          title="Latest news"
          count={announcements.length}
          defaultOpen={true}
          t={t}
        >
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
          <Link
            to="/news"
            style={{
              display: "block",
              textAlign: "center",
              fontSize: 13,
              color: t.accentText,
              textDecoration: "none",
              fontWeight: 500,
              padding: "0.25rem 0 0.5rem",
            }}
          >
            See all →
          </Link>
        </Section>
      )}
      {/* Active tournament mini leaderboards */}

      {/* Upcoming */}
      {upcomingCount > 0 && (
        <Section
          title="Upcoming"
          count={upcomingCount}
          accent={t.accent}
          defaultOpen
          t={t}
          action={
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCalendar((s) => !s);
              }}
              style={{
                padding: "3px 10px",
                background: showCalendar ? t.accent : t.card,
                color: showCalendar ? "#fff" : t.textSub,
                border: `1px solid ${showCalendar ? t.accent : t.border}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {showCalendar ? "📅 List" : "📅 Calendar"}
            </button>
          }
        >
          {showCalendar ? (
            <MiniCalendar items={allUpcoming} t={t} />
          ) : (
            allUpcoming.map((item) => {
              const d = item._date;
              const nzFmt = new Intl.DateTimeFormat("en-NZ", {
                timeZone: "Pacific/Auckland",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              });
              const isToday = nzFmt.format(new Date()) === nzFmt.format(d);

              if (item._type === "tournament") {
                const tr = item;
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
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
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
                      Round {tr.round_number} · {tr.courses?.name ?? "TBC"}
                      {tr.layouts ? ` · ${tr.layouts.layout_name}` : ""}
                    </div>
                    <div
                      style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}
                    >
                      {d.toLocaleDateString("en-NZ", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: "Pacific/Auckland",
                      })}
                      {" · "}
                      {d.toLocaleTimeString("en-NZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Pacific/Auckland",
                      })}
                    </div>
                    {(() => {
                      const nzFmt2 = new Intl.DateTimeFormat("en-NZ", {
                        timeZone: "Pacific/Auckland",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      });
                      const todayNZ = nzFmt2.format(new Date());
                      const roundDateNZ = nzFmt2.format(d);
                      const isRoundToday = todayNZ === roundDateNZ;
                      const hasSetup = tr.course_id && tr.layout_id;
                      const disabled = !isRoundToday || !hasSetup;
                      const reason = !hasSetup
                        ? "No course or layout assigned yet"
                        : !isRoundToday
                          ? `Available on ${d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short", timeZone: "Pacific/Auckland" })}`
                          : "";
                      return (
                        <div style={{ marginTop: 10 }}>
                          <button
                            style={{
                              width: "100%",
                              padding: "0.625rem",
                              background: disabled ? t.textMuted : t.accent,
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 14,
                              cursor: disabled ? "not-allowed" : "pointer",
                              opacity: disabled ? 0.6 : 1,
                            }}
                            disabled={disabled}
                            onClick={() => startTournamentRound(tr)}
                          >
                            🥏 Start tournament round
                          </button>
                          {reason && (
                            <div
                              style={{
                                fontSize: 11,
                                color: t.textMuted,
                                textAlign: "center",
                                marginTop: 4,
                              }}
                            >
                              {reason}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              }

              // Regular event
              const ev = item;
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
                      marginBottom: 4,
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
                    <div
                      style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}
                    >
                      {ev.courses.name}
                      {ev.layouts ? ` · ${ev.layouts.layout_name}` : ""}
                    </div>
                  )}
                  <div
                    style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}
                  >
                    {d.toLocaleDateString("en-NZ", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "Pacific/Auckland",
                    })}
                    {" · "}
                    {d.toLocaleTimeString("en-NZ", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Pacific/Auckland",
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
            })
          )}
        </Section>
      )}

      {/* Recent rounds */}
      {recentRounds.length > 0 && (
        <Section
          title="Recent rounds"
          count={recentRounds.length}
          defaultOpen={false}
          t={t}
        >
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
          <Link
            to="/history"
            style={{
              display: "block",
              textAlign: "center",
              fontSize: 13,
              color: t.accentText,
              textDecoration: "none",
              fontWeight: 500,
              padding: "0.25rem 0 0.5rem",
            }}
          >
            See all →
          </Link>
        </Section>
      )}
    </Layout>
  );
  function MiniCalendar({ items, t }) {
    const [currentMonth, setCurrentMonth] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDay, setSelectedDay] = useState(null);

    const NZ_TZ = "Pacific/Auckland";
    function toNZDate(str) {
      return new Date(
        new Date(str).toLocaleString("en-US", { timeZone: NZ_TZ }),
      );
    }

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayNZ = toNZDate(new Date().toISOString());

    // Map items to NZ dates
    const itemsByDay = {};
    for (const item of items) {
      const dateStr =
        item._type === "tournament" ? item.scheduled_date : item.event_date;
      const d = toNZDate(dateStr);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      if (!itemsByDay[day]) itemsByDay[day] = [];
      itemsByDay[day].push(item);
    }

    const selectedItems = selectedDay ? (itemsByDay[selectedDay] ?? []) : [];
    const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

    return (
      <div
        style={{
          background: t.card,
          borderRadius: 12,
          padding: "0.875rem",
          marginBottom: 8,
          boxShadow: t.shadow,
        }}
      >
        {/* Month nav */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <button
            onClick={() => {
              setCurrentMonth(new Date(year, month - 1, 1));
              setSelectedDay(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: t.textSub,
              cursor: "pointer",
              fontSize: 18,
              padding: "0 8px",
            }}
          >
            ‹
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>
            {currentMonth.toLocaleDateString("en-NZ", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <button
            onClick={() => {
              setCurrentMonth(new Date(year, month + 1, 1));
              setSelectedDay(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: t.textSub,
              cursor: "pointer",
              fontSize: 18,
              padding: "0 8px",
            }}
          >
            ›
          </button>
        </div>

        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginBottom: 4,
          }}
        >
          {dayNames.map((d, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: t.textMuted,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 2,
          }}
        >
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayItems = itemsByDay[day] ?? [];
            const isToday =
              todayNZ.getDate() === day &&
              todayNZ.getMonth() === month &&
              todayNZ.getFullYear() === year;
            const isSelected = selectedDay === day;
            const hasTournament = dayItems.some(
              (i) => i._type === "tournament",
            );
            const hasEvent = dayItems.some((i) => i._type === "event");

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: dayItems.length > 0 ? "pointer" : "default",
                  background: isSelected
                    ? t.accent
                    : isToday
                      ? t.accentLight
                      : "transparent",
                  border:
                    isToday && !isSelected
                      ? `1.5px solid ${t.accent}`
                      : "1.5px solid transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isToday || isSelected ? 700 : 400,
                    color: isSelected
                      ? "#fff"
                      : isToday
                        ? t.accentText
                        : dayItems.length > 0
                          ? t.text
                          : t.textMuted,
                  }}
                >
                  {day}
                </span>
                {dayItems.length > 0 && (
                  <div style={{ display: "flex", gap: 2, marginTop: 1 }}>
                    {hasTournament && (
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: isSelected ? "#fff" : t.accentText,
                        }}
                      />
                    )}
                    {hasEvent && (
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: isSelected ? "#fff" : t.warn,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 8,
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: t.accentText,
              }}
            />
            <span style={{ fontSize: 10, color: t.textSub }}>Tournament</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: t.warn,
              }}
            />
            <span style={{ fontSize: 10, color: t.textSub }}>Event</span>
          </div>
        </div>

        {/* Selected day items */}
        {selectedItems.length > 0 && (
          <div
            style={{
              marginTop: 12,
              borderTop: `1px solid ${t.border}`,
              paddingTop: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: t.textSub,
                marginBottom: 8,
              }}
            >
              {new Date(year, month, selectedDay).toLocaleDateString("en-NZ", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            {selectedItems.map((item, i) => {
              const isTournament = item._type === "tournament";
              const dateStr = isTournament
                ? item.scheduled_date
                : item.event_date;
              const time = new Date(dateStr).toLocaleTimeString("en-NZ", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: NZ_TZ,
              });
              return (
                <div
                  key={i}
                  style={{
                    padding: "8px 0",
                    borderBottom:
                      i < selectedItems.length - 1
                        ? `1px solid ${t.borderCard}`
                        : "none",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: isTournament ? t.accentLight : t.warnLight,
                        color: isTournament ? t.accentText : t.warn,
                      }}
                    >
                      {isTournament ? "🏆" : "📅"}
                    </span>
                    <span style={{ fontSize: 13, color: t.textMuted }}>
                      {time}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: t.text,
                      marginTop: 4,
                    }}
                  >
                    {isTournament
                      ? `${item.tournaments?.name} — Round ${item.round_number}`
                      : item.name}
                  </div>
                  {item.courses && (
                    <div style={{ fontSize: 12, color: t.textSub }}>
                      {item.courses.name}
                      {item.layouts ? ` · ${item.layouts.layout_name}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function MiniLeaderboard({ tournament, t, navigate }) {
    const [standings, setStandings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      load();
    }, [tournament.id]);

    async function load() {
      const [roundRes, playerRes] = await Promise.all([
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

      const roundList = roundRes.data ?? [];
      const playerList = playerRes.data ?? [];
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

      const calc =
        tournament.format === "matchplay"
          ? calcMatchplayStandings(playerList, roundList, scores, tournament)
          : calcStrokeplayStandings(playerList, roundList, scores, tournament);

      setStandings(calc.slice(0, 5)); // top 5 only on dashboard
      setLoading(false);
    }

    return (
      <div
        style={{
          background: t.card,
          borderRadius: 12,
          padding: "1rem",
          marginBottom: "0.75rem",
          boxShadow: t.shadow,
          border: `2px solid ${t.accent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>
              🏆 {tournament.name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.textSub,
                marginTop: 2,
                textTransform: "capitalize",
              }}
            >
              {tournament.format} ·{" "}
              {tournament.scoring_type === "best_rounds"
                ? `Best ${tournament.best_rounds_count} rounds`
                : "Total score"}
            </div>
          </div>
          <button
            style={{
              padding: "4px 10px",
              background: t.accentLight,
              color: t.accentText,
              border: `1px solid ${t.accent}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => navigate("/tournaments")}
          >
            Full standings →
          </button>
        </div>

        {loading && (
          <p style={{ color: t.textSub, fontSize: 13, margin: 0 }}>
            Loading...
          </p>
        )}

        {!loading && standings.length === 0 && (
          <p style={{ color: t.textSub, fontSize: 13, margin: 0 }}>
            No scores yet.
          </p>
        )}

        {standings.map((p, i) => (
          <div
            key={p.player_id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 0",
              borderBottom: `1px solid ${t.borderCard}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: i === 0 ? t.accentText : t.textSub,
                  width: 20,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: i === 0 ? 700 : 500,
                  color: t.text,
                }}
              >
                {p.name}
              </span>
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color:
                  tournament.format === "matchplay"
                    ? t.text
                    : p.relativeToPar < 0
                      ? t.success
                      : p.relativeToPar > 0
                        ? t.danger
                        : t.textSub,
              }}
            >
              {tournament.format === "matchplay"
                ? `${p.points ?? 0} pts`
                : formatRelativeToParT(p.relativeToPar)}
            </span>
          </div>
        ))}
      </div>
    );
  }
}
