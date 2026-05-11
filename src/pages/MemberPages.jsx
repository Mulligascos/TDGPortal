import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../hooks/useDarkMode";
import { useAppData } from "../hooks/useAppData";
import { getTheme } from "../lib/theme";
import Layout from "../components/shared/Layout";

// ── HistoryPage ───────────────────────────────────────────
export function HistoryPage() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    load();
  }, [user.id]);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("rounds")
      .select(
        `
        id, played_at, status, format, starting_hole, play_for_tags, created_by,
        courses(name), layouts(layout_name, number_of_holes, loops),
        round_players!inner(player_id)
      `,
      )
      .eq("round_players.player_id", user.id)
      .order("played_at", { ascending: false });
    if (error) {
      console.error("History error:", error);
      setError(error.message);
    }
    setRounds(data ?? []);
    setLoading(false);
  }

  async function removeRound(round) {
    if (!confirm("Remove this round? All scores will be deleted.")) return;
    setRemoving(round.id);
    await supabase.from("scores").delete().eq("round_id", round.id);
    await supabase.from("round_players").delete().eq("round_id", round.id);
    await supabase.from("rounds").delete().eq("id", round.id);
    setRemoving(null);
    load();
  }

  const inProgress = rounds.filter((r) => r.status === "in_progress");
  const completed = rounds.filter((r) => r.status === "complete");

  return (
    <Layout title="My history">
      {loading && (
        <div style={{ textAlign: "center", padding: "2rem", color: t.textSub }}>
          Loading...
        </div>
      )}
      {error && (
        <div
          style={{
            background: t.dangerLight,
            color: t.danger,
            padding: "0.75rem 1rem",
            borderRadius: 8,
            marginBottom: "1rem",
            fontSize: 14,
          }}
        >
          Error: {error}
        </div>
      )}
      {!loading && rounds.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🥏</div>
          <div style={{ color: t.textSub, fontSize: 15 }}>
            No rounds yet — start one!
          </div>
        </div>
      )}
      {inProgress.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 0.5rem",
            }}
          >
            In progress
          </div>
          {inProgress.map((r) => (
            <RoundCard
              key={r.id}
              r={r}
              t={t}
              userId={user.id}
              onRemove={removeRound}
              removing={removing}
            />
          ))}
        </>
      )}
      {completed.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: `${inProgress.length > 0 ? "1rem" : "0"} 0 0.5rem`,
            }}
          >
            Completed
          </div>
          {completed.map((r) => (
            <RoundCard
              key={r.id}
              r={r}
              t={t}
              userId={user.id}
              onRemove={removeRound}
              removing={removing}
            />
          ))}
        </>
      )}
    </Layout>
  );
}

function RoundCard({ r, t, userId, onRemove, removing }) {
  const isOwner = r.created_by === userId;
  const totalHoles = r.layouts
    ? r.layouts.number_of_holes * r.layouts.loops
    : "?";
  return (
    <div
      style={{
        background: t.card,
        borderRadius: 10,
        padding: "0.875rem 1rem",
        marginBottom: 8,
        boxShadow: t.shadow,
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
          <Link to={`/round/${r.id}`} style={{ textDecoration: "none" }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              {r.courses?.name ?? "Unknown course"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: t.textSub,
                textTransform: "capitalize",
                marginTop: 2,
              }}
            >
              {r.layouts?.layout_name} · {r.format} · {totalHoles} holes · Start
              hole {r.starting_hole}
            </div>
            {r.play_for_tags && (
              <div style={{ fontSize: 11, color: t.accentText, marginTop: 2 }}>
                🏷️ Tags played
              </div>
            )}
          </Link>
        </div>
        <div style={{ textAlign: "right", marginLeft: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 4 }}>
            {new Date(r.played_at).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              display: "inline-block",
              ...(r.status === "complete"
                ? { background: t.successLight, color: t.success }
                : { background: t.warnLight, color: t.warn }),
            }}
          >
            {r.status === "complete" ? "Complete" : "● In progress"}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 10,
          borderTop: `1px solid ${t.borderCard}`,
          paddingTop: 8,
        }}
      >
        <Link
          to={`/round/${r.id}`}
          style={{
            flex: 1,
            padding: "0.5rem",
            background: t.accentLight,
            color: t.accentText,
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {r.status === "complete" ? "📊 View scorecard" : "▶️ Resume round"}
        </Link>
        {isOwner && (
          <button
            style={{
              padding: "0.5rem 0.875rem",
              background: t.dangerLight,
              color: t.danger,
              border: `1px solid ${t.danger}`,
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              opacity: removing === r.id ? 0.5 : 1,
            }}
            disabled={removing === r.id}
            onClick={() => onRemove(r)}
          >
            {removing === r.id ? "..." : "🗑 Remove"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── BagTagsPage — uses AppData (no fetch) ─────────────────
export function BagTagsPage() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const { members, loaded } = useAppData();

  const tagged = members
    .filter((m) => m.bag_tag_number != null)
    .sort((a, b) => a.bag_tag_number - b.bag_tag_number);

  return (
    <Layout title="Bag tags">
      <p style={{ color: t.textSub, fontSize: 14, marginTop: 0 }}>
        Lower tag = higher rank. Challenge the holder to take their tag!
      </p>
      {!loaded && <p style={{ color: t.textSub }}>Loading...</p>}
      {loaded && tagged.length === 0 && (
        <p style={{ color: t.textSub }}>No bag tags assigned yet.</p>
      )}
      {tagged.map((m, i) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: t.card,
            borderRadius: 10,
            padding: "0.75rem 1rem",
            marginBottom: 8,
            boxShadow: t.shadow,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: t.accentText,
              width: 42,
              textAlign: "center",
            }}
          >
            #{m.bag_tag_number}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              {m.nickname || m.full_name}
            </div>
            {m.handicap != null && (
              <div style={{ fontSize: 13, color: t.textSub }}>
                Handicap {m.handicap}
              </div>
            )}
          </div>
          {i === 0 && (
            <span
              style={{
                fontSize: 12,
                background: "#fef9c3",
                color: "#92400e",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              👑 Leader
            </span>
          )}
        </div>
      ))}
    </Layout>
  );
}

// ── NewsPage — uses AppData (no fetch) ────────────────────
export function NewsPage() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const { announcements, loaded } = useAppData();

  return (
    <Layout title="News & announcements">
      {!loaded && <p style={{ color: t.textSub }}>Loading...</p>}
      {loaded && announcements.length === 0 && (
        <p style={{ color: t.textSub }}>No announcements yet.</p>
      )}
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
                background: "#fef3c7",
                color: "#92400e",
                padding: "1px 6px",
                borderRadius: 4,
                marginBottom: 6,
                display: "inline-block",
              }}
            >
              📌 Pinned
            </span>
          )}
          <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
            {a.title}
          </div>
          <div
            style={{ fontSize: 12, color: t.textMuted, margin: "2px 0 8px" }}
          >
            {a.profiles?.nickname || a.profiles?.full_name} ·{" "}
            {new Date(a.created_at).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "long",
            })}
          </div>
          <div
            style={{
              fontSize: 14,
              color: t.textSub,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {a.body}
          </div>
        </div>
      ))}
    </Layout>
  );
}

// ── ReportsPage — submits new reports, reads from AppData ─
export function ReportsPage() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const { courses, reports, refresh } = useAppData();
  const [type, setType] = useState("hazard");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [holeNumber, setHoleNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const myReports = reports.filter((r) => r.reported_by === user.id);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    await supabase.from("reports").insert({
      type,
      description,
      course_id: courseId || null,
      hole_number: holeNumber ? parseInt(holeNumber) : null,
      reported_by: user.id,
    });
    setDescription("");
    setHoleNumber("");
    setCourseId("");
    setSubmitting(false);
    setSubmitSuccess(true);
    refresh("reports"); // refresh reports in app data
    setTimeout(() => setSubmitSuccess(false), 3000);
  }

  const typeLabels = {
    hazard: "⚠️ Hazard",
    lost_disc: "💿 Lost disc",
    found_disc: "🟢 Found disc",
    suggestion: "💡 Suggestion",
  };

  const inp = {
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: `1.5px solid ${t.inputBorder}`,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    background: t.input,
    color: t.text,
  };

  return (
    <Layout title="Reports & suggestions">
      <div
        style={{
          background: t.card,
          borderRadius: 12,
          padding: "1.25rem",
          marginBottom: "1rem",
          boxShadow: t.shadow,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            margin: "0 0 1rem",
            color: t.text,
          }}
        >
          Submit a report
        </h2>
        {submitSuccess && (
          <div
            style={{
              background: t.successLight,
              color: t.success,
              padding: "0.75rem",
              borderRadius: 8,
              marginBottom: "0.75rem",
              fontSize: 14,
            }}
          >
            ✓ Report submitted successfully
          </div>
        )}
        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(typeLabels).map(([k, v]) => (
              <button
                type="button"
                key={k}
                onClick={() => setType(k)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1.5px solid ${type === k ? t.accent : t.border}`,
                  background: type === k ? t.accentLight : t.card,
                  color: type === k ? t.accentText : t.textSub,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <select
            style={inp}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">Select course (optional)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            style={inp}
            type="number"
            placeholder="Hole number (optional)"
            value={holeNumber}
            onChange={(e) => setHoleNumber(e.target.value)}
            min={1}
            max={99}
          />
          <textarea
            style={{
              ...inp,
              minHeight: 80,
              resize: "vertical",
              fontFamily: "inherit",
            }}
            placeholder="Describe the issue or suggestion..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.75rem",
              background: t.accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>

      {myReports.length > 0 && (
        <>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              margin: "1rem 0 0.5rem",
              color: t.text,
            }}
          >
            My reports
          </div>
          {myReports.map((r) => (
            <div
              key={r.id}
              style={{
                background: t.card,
                borderRadius: 10,
                padding: "0.875rem 1rem",
                marginBottom: 8,
                boxShadow: t.shadow,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
                  {typeLabels[r.type]}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background:
                      r.status === "resolved" ? t.successLight : t.warnLight,
                    color: r.status === "resolved" ? t.success : t.warn,
                  }}
                >
                  {r.status}
                </span>
              </div>
              {r.courses && (
                <div style={{ fontSize: 13, color: t.textSub }}>
                  {r.courses.name}
                  {r.hole_number ? ` · Hole ${r.hole_number}` : ""}
                </div>
              )}
              <div style={{ fontSize: 14, color: t.text, marginTop: 4 }}>
                {r.description}
              </div>
            </div>
          ))}
        </>
      )}
    </Layout>
  );
}
// ── Shared styles ────────────────────────────────────────
const cardStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#fff",
  borderRadius: 10,
  padding: "0.875rem 1rem",
  marginBottom: 8,
  textDecoration: "none",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const courseStyle = {
  fontWeight: 600,
  fontSize: 15,
  color: "#1a2e1a",
  marginBottom: 2,
};
const subStyle = {
  fontSize: 13,
  color: "#6b7280",
  textTransform: "capitalize",
};
const badgeStyle = {
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 6px",
  borderRadius: 4,
  marginTop: 4,
};
const doneBadge = { background: "#dcfce7", color: "#15803d" };
const progBadge = { background: "#fef9c3", color: "#a16207" };
const tagNumStyle = {
  fontSize: 20,
  fontWeight: 800,
  color: "#1d6b3a",
  width: 42,
  textAlign: "center",
};
const leaderBadge = {
  fontSize: 12,
  background: "#fef9c3",
  color: "#92400e",
  padding: "2px 8px",
  borderRadius: 4,
};
const pinStyle = {
  fontSize: 11,
  background: "#fef3c7",
  color: "#92400e",
  padding: "1px 6px",
  borderRadius: 4,
  marginBottom: 6,
  display: "inline-block",
};
const bodyStyle = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};
const inputStyle = {
  padding: "0.625rem 0.75rem",
  borderRadius: 8,
  border: "1.5px solid #d1d5db",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
};
