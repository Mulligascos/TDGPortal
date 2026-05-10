// ── HistoryPage ───────────────────────────────────────────
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../hooks/useDarkMode";
import { getTheme } from "../lib/theme";
import Layout from "../components/shared/Layout";

// ── HistoryPage ───────────────────────────────────────────
export function HistoryPage() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [rounds, setRounds] = useState([]);
  async function load() {
    // Step 1: get all round IDs this player participated in
    const { data: participated, error: e1 } = await supabase
      .from("round_players")
      .select("round_id")
      .eq("player_id", user.id);
    console.log("userid:", user.id, "participated:", participated, "e1:", e1);
    if (e1) {
      console.error("round_players error:", e1);
      setLoading(false);
      return;
    }
    if (!participated || participated.length === 0) {
      setLoading(false);
      return;
    }

    const roundIds = participated.map((r) => r.round_id);

    // Step 2: fetch round details ordered by played_at on the rounds table
    const { data, error: e2 } = await supabase
      .from("rounds")
      .select(
        "id, played_at, status, format, starting_hole, play_for_tags, courses(name), layouts(layout_name, number_of_holes, loops)",
      )
      .in("round_id", roundIds)
      .order("played_at", { ascending: false });

    if (e2) console.error("rounds error:", e2);
    setRounds(data ?? []);
    setLoading(false);
  }

  return (
    <Layout title="My history">
      {rounds.length === 0 && (
        <p style={{ color: t.textSub }}>No rounds yet. Start one!</p>
      )}
      {rounds.map((r) => (
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
              {r.layouts?.layout_name} · {r.format} · Start hole{" "}
              {r.starting_hole}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
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
    </Layout>
  );
}

// ── BagTagsPage ──────────────────────────────────────────
export function BagTagsPage() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, nickname, bag_tag_number, handicap")
      .not("bag_tag_number", "is", null)
      .order("bag_tag_number")
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  return (
    <Layout title="Bag tags">
      <p style={{ color: t.textSub, fontSize: 14, marginTop: 0 }}>
        Lower tag = higher rank. Challenge the holder to take their tag!
      </p>
      {members.map((m, i) => (
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
      {members.length === 0 && (
        <p style={{ color: t.textSub }}>No bag tags assigned yet.</p>
      )}
    </Layout>
  );
}

// ── NewsPage ────────────────────────────────────────────
export function NewsPage() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [items, setItems] = useState([]);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("*, profiles(full_name, nickname)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, []);

  return (
    <Layout title="News & announcements">
      {items.length === 0 && (
        <p style={{ color: t.textSub }}>No announcements yet.</p>
      )}
      {items.map((a) => (
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

// ── ReportsPage ──────────────────────────────────────────
export function ReportsPage() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [type, setType] = useState("hazard");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [holeNumber, setHoleNumber] = useState("");
  const [courses, setCourses] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [myReports, setMyReports] = useState([]);

  useEffect(() => {
    supabase
      .from("courses")
      .select("id, name")
      .then(({ data }) => setCourses(data ?? []));
    supabase
      .from("reports")
      .select("*, courses(name)")
      .eq("reported_by", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyReports(data ?? []));
  }, [submitted]);

  async function submit(e) {
    e.preventDefault();
    await supabase.from("reports").insert({
      type,
      description,
      course_id: courseId || null,
      hole_number: holeNumber ? parseInt(holeNumber) : null,
      reported_by: user.id,
    });
    setDescription("");
    setHoleNumber("");
    setSubmitted((s) => !s);
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
            Submit
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
