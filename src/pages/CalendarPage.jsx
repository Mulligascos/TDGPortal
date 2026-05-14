import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../hooks/useDarkMode";
import { getTheme } from "../lib/theme";
import Layout from "../components/shared/Layout";

const NZ_TZ = "Pacific/Auckland";

function toNZDate(utcStr) {
  return new Date(
    new Date(utcStr).toLocaleString("en-US", { timeZone: NZ_TZ }),
  );
}

function formatNZTime(utcStr) {
  return new Date(utcStr).toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: NZ_TZ,
  });
}

function formatNZDate(utcStr) {
  return new Date(utcStr).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: NZ_TZ,
  });
}

export default function CalendarPage() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [events, setEvents] = useState([]);
  const [tournamentRounds, setTournamentRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [evRes, tRes] = await Promise.all([
      supabase
        .from("events")
        .select("*, courses(name), layouts(layout_name)")
        .order("event_date"),
      supabase
        .from("tournaments")
        .select("id, name, format, status")
        .eq("status", "published"),
    ]);

    setEvents(evRes.data ?? []);

    if (tRes.data && tRes.data.length > 0) {
      const tIds = tRes.data.map((t) => t.id);
      const { data: rounds } = await supabase
        .from("tournament_rounds")
        .select("*, courses(name), layouts(layout_name)")
        .in("tournament_id", tIds)
        .order("scheduled_date");

      // Attach tournament info
      const enriched = (rounds ?? []).map((r) => ({
        ...r,
        tournament: tRes.data.find((t) => t.id === r.tournament_id),
      }));
      setTournamentRounds(enriched);
    }

    setLoading(false);
  }

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toNZDate(new Date().toISOString());

  // Map all items to their NZ date
  const itemsByDate = {};

  for (const ev of events) {
    const d = toNZDate(ev.event_date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!itemsByDate[key]) itemsByDate[key] = [];
    itemsByDate[key].push({ ...ev, _type: "event", _date: d });
  }

  for (const tr of tournamentRounds) {
    const d = toNZDate(tr.scheduled_date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!itemsByDate[key]) itemsByDate[key] = [];
    itemsByDate[key].push({ ...tr, _type: "tournament", _date: d });
  }

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(null);
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
  }

  function selectDate(day) {
    const key = `${year}-${month}-${day}`;
    if (itemsByDate[key]) setSelectedDate(day);
    else setSelectedDate(null);
  }

  const selectedItems = selectedDate
    ? (itemsByDate[`${year}-${month}-${selectedDate}`] ?? []).sort(
        (a, b) => a._date - b._date,
      )
    : [];

  // All items this month sorted by date for list view
  const monthItems = Object.entries(itemsByDate)
    .filter(([key]) => {
      const [y, m] = key.split("-").map(Number);
      return y === year && m === month;
    })
    .flatMap(([, items]) => items)
    .sort((a, b) => a._date - b._date);

  const monthName = currentMonth.toLocaleDateString("en-NZ", {
    month: "long",
    year: "numeric",
  });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Layout title="Calendar">
      {/* Month navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            padding: "6px 14px",
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.text,
            cursor: "pointer",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ‹
        </button>
        <span style={{ fontWeight: 700, fontSize: 17, color: t.text }}>
          {monthName}
        </span>
        <button
          onClick={nextMonth}
          style={{
            padding: "6px 14px",
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            color: t.text,
            cursor: "pointer",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div
        style={{
          background: t.card,
          borderRadius: 12,
          padding: "0.75rem",
          marginBottom: "1rem",
          boxShadow: t.shadow,
        }}
      >
        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginBottom: 6,
          }}
        >
          {dayNames.map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: t.textMuted,
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 2,
          }}
        >
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const key = `${year}-${month}-${day}`;
            const items = itemsByDate[key] ?? [];
            const isToday =
              today.getDate() === day &&
              today.getMonth() === month &&
              today.getFullYear() === year;
            const isSelected = selectedDate === day;
            const hasItems = items.length > 0;
            const hasTournament = items.some((i) => i._type === "tournament");
            const hasEvent = items.some((i) => i._type === "event");

            return (
              <div
                key={day}
                onClick={() => selectDate(day)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  padding: "4px 2px",
                  cursor: hasItems ? "pointer" : "default",
                  background: isSelected
                    ? t.accent
                    : isToday
                      ? t.accentLight
                      : "transparent",
                  border:
                    isToday && !isSelected
                      ? `2px solid ${t.accent}`
                      : "2px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isToday || isSelected ? 700 : 400,
                    color: isSelected
                      ? "#fff"
                      : isToday
                        ? t.accentText
                        : hasItems
                          ? t.text
                          : t.textMuted,
                  }}
                >
                  {day}
                </span>
                {hasItems && (
                  <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                    {hasTournament && (
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: isSelected ? "#fff" : t.accentText,
                        }}
                      />
                    )}
                    {hasEvent && (
                      <div
                        style={{
                          width: 5,
                          height: 5,
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
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: t.accentText,
              }}
            />
            <span style={{ fontSize: 11, color: t.textSub }}>Tournament</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: t.warn,
              }}
            />
            <span style={{ fontSize: 11, color: t.textSub }}>Event</span>
          </div>
        </div>
      </div>

      {/* Selected date items */}
      {selectedDate && selectedItems.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            {new Date(year, month, selectedDate).toLocaleDateString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          {selectedItems.map((item, i) => (
            <ItemCard key={i} item={item} t={t} />
          ))}
        </div>
      )}

      {/* Month list view */}
      {monthItems.length === 0 && !loading && (
        <p style={{ color: t.textSub, textAlign: "center" }}>
          No events or tournament rounds this month.
        </p>
      )}

      {!selectedDate && monthItems.length > 0 && (
        <>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            All events this month
          </div>
          {monthItems.map((item, i) => (
            <ItemCard key={i} item={item} t={t} />
          ))}
        </>
      )}
    </Layout>
  );
}

function ItemCard({ item, t }) {
  const isTournament = item._type === "tournament";
  const dateStr = isTournament ? item.scheduled_date : item.event_date;

  return (
    <div
      style={{
        background: t.card,
        borderRadius: 10,
        padding: "0.875rem 1rem",
        marginBottom: 8,
        boxShadow: t.shadow,
        borderLeft: `4px solid ${isTournament ? t.accentText : t.warn}`,
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
            padding: "1px 6px",
            borderRadius: 4,
            background: isTournament ? t.accentLight : t.warnLight,
            color: isTournament ? t.accentText : t.warn,
          }}
        >
          {isTournament ? "🏆 Tournament" : "📅 Event"}
        </span>
        <span style={{ fontSize: 12, color: t.textMuted }}>
          {formatNZTime(dateStr)}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>
        {isTournament
          ? `${item.tournament?.name} — Round ${item.round_number}`
          : item.name}
      </div>
      {item.courses && (
        <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
          {item.courses.name}
          {item.layouts ? ` · ${item.layouts.layout_name}` : ""}
        </div>
      )}
      {!isTournament && item.description && (
        <div
          style={{
            fontSize: 13,
            color: t.textSub,
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {item.description}
        </div>
      )}
    </div>
  );
}
