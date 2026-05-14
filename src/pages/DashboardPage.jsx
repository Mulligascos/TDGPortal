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

// ── Section component ─────────────────────────────────────
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

// ── StatTile ──────────────────────────────────────────────
function StatTile({ label, value, sub, icon, color, t }) {
  return (
    <div
      style={{
        background: t.card,
        borderRadius: 10,
        padding: "0.875rem 0.75rem",
        boxShadow: t.shadow,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: t.textSub, fontWeight: 500 }}>
        {icon ? `${icon} ` : ""}
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: color ?? t.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: t.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── AchievementRow ────────────────────────────────────────
function AchievementRow({ icon, label, value, highlight, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: t.textSub }}>{label}</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: highlight ? t.success : t.text,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────
function Sparkline({ scores, t }) {
  if (!scores || scores.length < 2) return null;
  const min = Math.min(...scores) - 1;
  const max = Math.max(...scores) + 1;
  const range = max - min || 1;
  const w = 80;
  const h = 30;
  const points = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * w;
      const y = h - ((s - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={points}
        fill="none"
        stroke={t.accentText}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {scores.map((s, i) => {
        const x = (i / (scores.length - 1)) * w;
        const y = h - ((s - min) / range) * h;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill={s < 0 ? t.success : s > 0 ? t.danger : t.textSub}
          />
        );
      })}
    </svg>
  );
}

// ── StatsPanel ────────────────────────────────────────────
function StatsPanel({ stats, t }) {
  const trendIcon =
    stats.trend === "improving"
      ? "📈"
      : stats.trend === "declining"
        ? "📉"
        : "➡️";
  const trendLabel =
    stats.trend === "improving"
      ? "Improving"
      : stats.trend === "declining"
        ? "Declining"
        : "Steady";
  const trendColor =
    stats.trend === "improving"
      ? t.success
      : stats.trend === "declining"
        ? t.danger
        : t.textSub;

  function relFormat(n) {
    if (n == null) return "—";
    if (n === 0) return "E";
    return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
      >
        <StatTile label="Rounds" value={stats.totalRounds} t={t} />
        <StatTile
          label="Best round"
          value={
            stats.bestRound ? relFormat(stats.bestRound.relativeToPar) : "—"
          }
          sub={stats.bestRound?.courseName}
          color={stats.bestRound?.relativeToPar < 0 ? t.success : t.text}
          t={t}
        />
        <StatTile
          label="Average score vs Par"
          value={relFormat(stats.avgRelToPar)}
          color={
            stats.avgRelToPar < 0
              ? t.success
              : stats.avgRelToPar > 0
                ? t.danger
                : t.textSub
          }
          t={t}
        />
      </div>

      {stats.last5Scores.length >= 2 && (
        <div
          style={{
            background: t.card,
            borderRadius: 10,
            padding: "0.875rem 1rem",
            boxShadow: t.shadow,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: t.textSub, marginBottom: 4 }}>
              Last 5 rounds
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>{trendIcon}</span>
              <span
                style={{ fontSize: 14, fontWeight: 700, color: trendColor }}
              >
                {trendLabel}
              </span>
            </div>
          </div>
          <Sparkline scores={stats.last5Scores} t={t} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <StatTile
          label="Under par streak"
          value={
            stats.currentStreak === 0 ? "None" : `${stats.currentStreak} rounds`
          }
          icon="🔥"
          color={stats.currentStreak > 0 ? t.success : t.textSub}
          t={t}
        />
        <StatTile
          label="Longest streak"
          value={stats.bestStreak === 0 ? "None" : `${stats.bestStreak} rounds`}
          icon="⭐"
          t={t}
        />
      </div>

      <div
        style={{
          background: t.card,
          borderRadius: 10,
          padding: "0.875rem 1rem",
          boxShadow: t.shadow,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: t.textSub,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 10,
          }}
        >
          Achievements
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          <AchievementRow
            icon="🦅"
            label="Eagles"
            value={stats.totalEagles}
            t={t}
          />
          <AchievementRow
            icon="🐦"
            label="Birdies"
            value={stats.totalBirdies}
            t={t}
          />
          <AchievementRow
            icon="🎯"
            label="Aces"
            value={stats.totalAces}
            highlight={stats.totalAces > 0}
            t={t}
          />
          <AchievementRow
            icon="🐦‍⬛"
            label="Most birdies in a round"
            value={stats.bestBirdieRound?.birdies ?? 0}
            t={t}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {stats.homeCourse && (
          <StatTile
            label="Most rounds played at"
            value={stats.homeCourse[0]}
            sub={`${stats.homeCourse[1]} rounds`}
            icon="⛳"
            t={t}
          />
        )}
        {stats.topPartner && (
          <StatTile
            label="Most rounds played with"
            value={stats.topPartner[0]}
            sub={`${stats.topPartner[1]} rounds together`}
            icon="🤝"
            t={t}
          />
        )}
      </div>
    </div>
  );
}

// ── MiniCalendar ──────────────────────────────────────────
function MiniCalendar({ items, t }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const NZ_TZ = "Pacific/Auckland";

  function toNZDate(str) {
    return new Date(new Date(str).toLocaleString("en-US", { timeZone: NZ_TZ }));
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayNZ = toNZDate(new Date().toISOString());

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
            fontSize: 25,
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
            fontSize: 22,
            padding: "0 8px",
          }}
        >
          ›
        </button>
      </div>

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
              fontSize: 14,
              fontWeight: 600,
              color: t.textMuted,
            }}
          >
            {d}
          </div>
        ))}
      </div>

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
          const hasTournament = dayItems.some((i) => i._type === "tournament");
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
                  fontSize: 19,
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
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: isSelected ? "#fff" : t.accentText,
                      }}
                    />
                  )}
                  {hasEvent && (
                    <div
                      style={{
                        width: 12,
                        height: 12,
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
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: t.accentText,
            }}
          />
          <span style={{ fontSize: 10, color: t.textSub }}>Tournament</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: t.warn,
            }}
          />
          <span style={{ fontSize: 10, color: t.textSub }}>Event</span>
        </div>
      </div>

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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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

// ── MiniLeaderboard ───────────────────────────────────────
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
    setStandings(calc.slice(0, 5));
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
        <p style={{ color: t.textSub, fontSize: 13, margin: 0 }}>Loading...</p>
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

// ── DashboardPage ─────────────────────────────────────────
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
  const [showCalendar, setShowCalendar] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  async function loadStats(userId) {
    setStatsLoading(true);
    const { data: roundPlayers } = await supabase
      .from("round_players")
      .select("round_id")
      .eq("player_id", userId);
    if (!roundPlayers || roundPlayers.length === 0) {
      setStats({ noData: true });
      setStatsLoading(false);
      return;
    }
    const roundIds = roundPlayers.map((r) => r.round_id);
    const { data: rounds } = await supabase
      .from("rounds")
      .select(
        "id, played_at, format, layouts(number_of_holes, loops, par_json), courses(name)",
      )
      .in("id", roundIds)
      .eq("status", "complete")
      .order("played_at", { ascending: false });
    if (!rounds || rounds.length === 0) {
      setStats({ noData: true });
      setStatsLoading(false);
      return;
    }
    const { data: scores } = await supabase
      .from("scores")
      .select("round_id, hole_number, loop, strokes, player_id")
      .in(
        "round_id",
        rounds.map((r) => r.id),
      )
      .eq("player_id", userId);
    const { data: allRoundPlayers } = await supabase
      .from("round_players")
      .select("round_id, player_id, profiles(full_name, nickname)")
      .in(
        "round_id",
        rounds.map((r) => r.id),
      )
      .neq("player_id", userId);

    const scoresByRound = {};
    for (const s of scores ?? []) {
      if (!scoresByRound[s.round_id]) scoresByRound[s.round_id] = [];
      scoresByRound[s.round_id].push(s);
    }

    const roundStats = rounds
      .filter((r) => r.layouts?.par_json)
      .map((r) => {
        const roundScores = scoresByRound[r.id] ?? [];
        const parJson = r.layouts.par_json;
        const loops = r.layouts.loops ?? 1;
        const totalPar = parJson.reduce((s, p) => s + p, 0) * loops;
        const totalStrokes = roundScores.reduce((s, sc) => s + sc.strokes, 0);
        const holesPlayed = roundScores.length;
        const expectedHoles = parJson.length * loops;
        const relativeToPar =
          holesPlayed === expectedHoles ? totalStrokes - totalPar : null;
        let eagles = 0,
          birdies = 0,
          pars = 0,
          bogeys = 0,
          doublePlus = 0,
          aces = 0;
        for (const sc of roundScores) {
          const par = parJson[(sc.hole_number - 1) % parJson.length];
          const diff = sc.strokes - par;
          if (sc.strokes === 1) aces++;
          if (diff <= -2) eagles++;
          else if (diff === -1) birdies++;
          else if (diff === 0) pars++;
          else if (diff === 1) bogeys++;
          else doublePlus++;
        }
        return {
          roundId: r.id,
          playedAt: new Date(r.played_at),
          courseName: r.courses?.name,
          totalStrokes,
          totalPar,
          relativeToPar,
          holesPlayed,
          expectedHoles,
          eagles,
          birdies,
          pars,
          bogeys,
          doublePlus,
          aces,
          complete: holesPlayed === expectedHoles,
        };
      })
      .filter((r) => r.complete);

    const totalRounds = roundStats.length;
    if (totalRounds === 0) {
      setStats({ noData: true });
      setStatsLoading(false);
      return;
    }

    const validRounds = roundStats.filter((r) => r.relativeToPar != null);
    const bestRound =
      validRounds.length > 0
        ? validRounds.reduce((best, r) =>
            r.relativeToPar < best.relativeToPar ? r : best,
          )
        : null;
    const avgRelToPar =
      validRounds.length > 0
        ? validRounds.reduce((s, r) => s + r.relativeToPar, 0) /
          validRounds.length
        : null;
    const last5 = validRounds.slice(0, 5);
    const prev5 = validRounds.slice(5, 10);
    const last5Avg =
      last5.length > 0
        ? last5.reduce((s, r) => s + r.relativeToPar, 0) / last5.length
        : null;
    const prev5Avg =
      prev5.length > 0
        ? prev5.reduce((s, r) => s + r.relativeToPar, 0) / prev5.length
        : null;
    const trend =
      last5Avg != null && prev5Avg != null
        ? last5Avg < prev5Avg
          ? "improving"
          : last5Avg > prev5Avg
            ? "declining"
            : "steady"
        : null;

    let currentStreak = 0,
      bestStreak = 0,
      tempStreak = 0;
    for (const r of validRounds) {
      if (r.relativeToPar < 0) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    if (validRounds.length > 0 && validRounds[0].relativeToPar < 0)
      currentStreak = tempStreak;

    const totalEagles = roundStats.reduce((s, r) => s + r.eagles, 0);
    const totalBirdies = roundStats.reduce((s, r) => s + r.birdies, 0);
    const totalAces = roundStats.reduce((s, r) => s + r.aces, 0);
    const bestBirdieRound = roundStats.reduce(
      (best, r) => (r.birdies > best.birdies ? r : best),
      roundStats[0],
    );

    const courseCounts = {};
    for (const r of roundStats) {
      if (r.courseName)
        courseCounts[r.courseName] = (courseCounts[r.courseName] ?? 0) + 1;
    }
    const homeCourse = Object.entries(courseCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];

    const partnerCounts = {};
    for (const rp of allRoundPlayers ?? []) {
      const name = rp.profiles?.nickname || rp.profiles?.full_name;
      if (name) partnerCounts[name] = (partnerCounts[name] ?? 0) + 1;
    }
    const topPartner = Object.entries(partnerCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const last5Scores = validRounds
      .slice(0, 5)
      .reverse()
      .map((r) => r.relativeToPar);

    setStats({
      totalRounds,
      bestRound,
      avgRelToPar,
      trend,
      currentStreak,
      bestStreak,
      totalEagles,
      totalBirdies,
      totalAces,
      bestBirdieRound,
      homeCourse,
      topPartner,
      last5Scores,
      noData: false,
    });
    setStatsLoading(false);
  }

  useEffect(() => {
    const now = new Date().toISOString();
    const nowStr = now.split("T")[0];

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

      loadStats(profile.id);
    }
  }, [profile]);

  async function startTournamentRound(tr) {
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

  const upcomingCount = upcomingEvents.length + upcomingTournamentRounds.length;
  const allUpcoming = [
    ...upcomingEvents.map((e) => ({
      ...e,
      _type: "event",
      _date: new Date(e.event_date),
    })),
    ...upcomingTournamentRounds.map((tr) => ({
      ...tr,
      _type: "tournament",
      _date: new Date(tr.scheduled_date),
    })),
  ].sort((a, b) => a._date - b._date);

  return (
    <Layout
      title={`G'day, ${profile?.nickname || profile?.full_name?.split(" ")[0] || "Mate"} 👋`}
    >
      {/* Quick actions */}
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
          defaultOpen={false}
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

      {/* Active tournament leaderboards */}
      {activeTournaments.map((tournament) => (
        <MiniLeaderboard
          key={tournament.id}
          tournament={tournament}
          t={t}
          navigate={navigate}
        />
      ))}

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
                      const isRoundToday =
                        nzFmt2.format(new Date()) === nzFmt2.format(d);
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

      {/* My stats */}
      <Section title="My stats" defaultOpen={false} t={t}>
        {statsLoading && (
          <p style={{ color: t.textSub, fontSize: 14 }}>Calculating...</p>
        )}
        {stats?.noData && (
          <p style={{ color: t.textSub, fontSize: 14 }}>
            Complete some rounds to see your stats.
          </p>
        )}
        {stats && !stats.noData && !statsLoading && (
          <StatsPanel stats={stats} t={t} />
        )}
      </Section>
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
}
