import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import Layout from "../components/shared/Layout";

const STEPS = ["Course", "Layout", "Players", "Start"];

export default function NewRoundPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [courses, setCourses] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [members, setMembers] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [startingHole, setStartingHole] = useState(1);
  const [format, setFormat] = useState("strokeplay");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [playForTags, setPlayForTags] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load courses on mount
  useEffect(() => {
    supabase
      .from("courses")
      .select("*")
      .order("name")
      .then(({ data }) => setCourses(data ?? []));
  }, []);

  // Load layouts when course selected
  useEffect(() => {
    if (!selectedCourse) return;
    supabase
      .from("layouts")
      .select("*")
      .eq("course_id", selectedCourse.id)
      .order("layout_name")
      .then(({ data }) => setLayouts(data ?? []));
    setSelectedLayout(null);
    setStartingHole(1);
  }, [selectedCourse]);

  // Load members when reaching players step
  useEffect(() => {
    if (step !== 2) return;
    supabase
      .from("profiles")
      .select("id, full_name, nickname, bag_tag_number")
      .order("full_name")
      .then(({ data }) => {
        setMembers(data ?? []);
        // Pre-select the scorer
        setSelectedPlayers((prev) => (prev.length ? prev : [user.id]));
      });
  }, [step]);

  // Reset play for tags if format changes or fewer than 2 players
  useEffect(() => {
    if (format === "matchplay" || selectedPlayers.length < 2) {
      setPlayForTags(false);
    }
  }, [format, selectedPlayers]);

  function togglePlayer(id) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  // How many selected players actually have bag tags
  const taggedSelectedCount = members.filter(
    (m) => selectedPlayers.includes(m.id) && m.bag_tag_number != null,
  ).length;

  async function startRound() {
    setLoading(true);
    setError(null);
    try {
      // Create the round
      const { data: round, error: roundErr } = await supabase
        .from("rounds")
        .insert({
          course_id: selectedCourse.id,
          layout_id: selectedLayout.id,
          starting_hole: startingHole,
          format,
          play_for_tags: playForTags,
          created_by: user.id,
        })
        .select()
        .single();

      if (roundErr) throw roundErr;

      // Add ALL selected players to round_players
      const playerRows = selectedPlayers.map((pid) => ({
        round_id: round.id,
        player_id: pid,
      }));

      const { error: playersErr } = await supabase
        .from("round_players")
        .insert(playerRows);

      if (playersErr) throw playersErr;

      navigate(`/round/${round.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const totalHoles = selectedLayout
    ? selectedLayout.number_of_holes * selectedLayout.loops
    : 0;

  return (
    <Layout title="New round">
      {/* Step indicator */}
      <div style={styles.steps}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              ...styles.stepItem,
              ...(i === step
                ? styles.stepActive
                : i < step
                  ? styles.stepDone
                  : {}),
            }}
          >
            <div style={styles.stepDot}>{i < step ? "✓" : i + 1}</div>
            <span style={styles.stepLabel}>{s}</span>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        {/* STEP 0: Select course */}
        {step === 0 && (
          <div>
            <h2 style={styles.stepTitle}>Select a course</h2>
            {courses.length === 0 && (
              <p style={styles.empty}>
                No courses set up yet. Ask an admin to add one.
              </p>
            )}
            <div style={styles.list}>
              {courses.map((c) => (
                <button
                  key={c.id}
                  style={{
                    ...styles.listItem,
                    ...(selectedCourse?.id === c.id
                      ? styles.listItemActive
                      : {}),
                  }}
                  onClick={() => setSelectedCourse(c)}
                >
                  <strong>{c.name}</strong>
                  {c.location && <span style={styles.sub}>{c.location}</span>}
                </button>
              ))}
            </div>
            <button
              style={styles.nextBtn}
              disabled={!selectedCourse}
              onClick={() => setStep(1)}
            >
              Next →
            </button>
          </div>
        )}

        {/* STEP 1: Layout + starting hole + format */}
        {step === 1 && (
          <div>
            <h2 style={styles.stepTitle}>Select layout</h2>
            <div style={styles.list}>
              {layouts.map((l) => (
                <button
                  key={l.id}
                  style={{
                    ...styles.listItem,
                    ...(selectedLayout?.id === l.id
                      ? styles.listItemActive
                      : {}),
                  }}
                  onClick={() => {
                    setSelectedLayout(l);
                    setStartingHole(1);
                  }}
                >
                  <strong>{l.layout_name}</strong>
                  <span style={styles.sub}>
                    {l.number_of_holes} holes
                    {l.loops > 1
                      ? ` × ${l.loops} loops = ${l.number_of_holes * l.loops} total`
                      : ""}
                  </span>
                </button>
              ))}
            </div>

            {selectedLayout && (
              <>
                <label style={styles.label}>Starting hole</label>
                <select
                  style={styles.select}
                  value={startingHole}
                  onChange={(e) => setStartingHole(Number(e.target.value))}
                >
                  {Array.from(
                    { length: selectedLayout.number_of_holes },
                    (_, i) => i + 1,
                  ).map((h) => (
                    <option key={h} value={h}>
                      Hole {h}
                    </option>
                  ))}
                </select>

                <label style={styles.label}>Format</label>
                <div style={styles.formatRow}>
                  {["strokeplay", "matchplay"].map((f) => (
                    <button
                      key={f}
                      style={{
                        ...styles.formatBtn,
                        ...(format === f ? styles.formatBtnActive : {}),
                      }}
                      onClick={() => setFormat(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={styles.navRow}>
              <button style={styles.backBtn} onClick={() => setStep(0)}>
                ← Back
              </button>
              <button
                style={styles.nextBtn}
                disabled={!selectedLayout}
                onClick={() => setStep(2)}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Select players */}
        {step === 2 && (
          <div>
            <h2 style={styles.stepTitle}>Confirm players</h2>
            {format === "matchplay" ? (
              <p style={styles.hint}>
                Matchplay requires exactly 2 players. Select your opponent.
              </p>
            ) : (
              <p style={styles.hint}>
                Select all players in the group. You are the scorer.
              </p>
            )}

            <div style={styles.list}>
              {members.map((m) => {
                const selected = selectedPlayers.includes(m.id);
                const isMe = m.id === user.id;
                const matchplayFull =
                  format === "matchplay" &&
                  selectedPlayers.length >= 2 &&
                  !selected;
                return (
                  <button
                    key={m.id}
                    style={{
                      ...styles.listItem,
                      ...(selected ? styles.listItemActive : {}),
                      ...(matchplayFull ? { opacity: 0.4 } : {}),
                    }}
                    disabled={matchplayFull}
                    onClick={() => togglePlayer(m.id)}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>
                        {m.nickname || m.full_name}
                        {isMe && <span style={styles.youBadge}>You</span>}
                      </span>
                      {m.bag_tag_number && (
                        <span style={styles.tagBadge}>
                          🏷️ #{m.bag_tag_number}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Play for tags toggle — strokeplay only, 2+ tagged players selected */}
            {format === "strokeplay" && taggedSelectedCount >= 2 && (
              <div
                style={styles.toggleRow}
                onClick={() => setPlayForTags((t) => !t)}
              >
                <div
                  style={{
                    ...styles.toggle,
                    ...(playForTags ? styles.toggleOn : {}),
                  }}
                >
                  <div
                    style={{
                      ...styles.toggleThumb,
                      ...(playForTags ? styles.toggleThumbOn : {}),
                    }}
                  />
                </div>
                <div>
                  <div style={styles.toggleLabel}>Play for bag tags</div>
                  <div style={styles.toggleSub}>
                    {taggedSelectedCount} tagged players — tags reassigned by
                    final score
                  </div>
                </div>
              </div>
            )}

            {format === "matchplay" && selectedPlayers.length !== 2 && (
              <p
                style={{ color: "#dc2626", fontSize: 13, margin: "0 0 0.5rem" }}
              >
                Select exactly 2 players for matchplay
              </p>
            )}

            <div style={styles.navRow}>
              <button style={styles.backBtn} onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                style={styles.nextBtn}
                disabled={
                  format === "matchplay"
                    ? selectedPlayers.length !== 2
                    : selectedPlayers.length === 0
                }
                onClick={() => setStep(3)}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Confirm and start */}
        {step === 3 && (
          <div>
            <h2 style={styles.stepTitle}>Ready to start</h2>
            <div style={styles.summary}>
              <div style={styles.summaryRow}>
                <span>Course</span>
                <strong>{selectedCourse?.name}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Layout</span>
                <strong>{selectedLayout?.layout_name}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Holes</span>
                <strong>
                  {totalHoles}
                  {selectedLayout?.loops > 1
                    ? ` (${selectedLayout?.number_of_holes} × ${selectedLayout?.loops})`
                    : ""}
                </strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Starting hole</span>
                <strong>Hole {startingHole}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Format</span>
                <strong style={{ textTransform: "capitalize" }}>
                  {format}
                </strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Players</span>
                <strong>
                  {members
                    .filter((m) => selectedPlayers.includes(m.id))
                    .map((m) => m.nickname || m.full_name)
                    .join(", ")}
                </strong>
              </div>
              {playForTags && format === "strokeplay" && (
                <div
                  style={{
                    ...styles.summaryRow,
                    background: "#f0faf4",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                >
                  <span>Bag tags</span>
                  <strong style={{ color: "#1d6b3a" }}>
                    🏷️ Playing for tags
                  </strong>
                </div>
              )}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.navRow}>
              <button style={styles.backBtn} onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                style={{ ...styles.nextBtn, background: "#1d6b3a" }}
                disabled={loading}
                onClick={startRound}
              >
                {loading ? "Starting..." : "Start round 🥏"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  steps: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "1.25rem",
  },
  stepItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    opacity: 0.4,
    flex: 1,
  },
  stepActive: { opacity: 1 },
  stepDone: { opacity: 0.7 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1d6b3a",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
  },
  stepLabel: { fontSize: 11, color: "#374151", fontWeight: 500 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "1.25rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: "0 0 1rem",
    color: "#1a2e1a",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: "1rem",
  },
  listItem: {
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    width: "100%",
  },
  listItemActive: { borderColor: "#1d6b3a", background: "#f0faf4" },
  sub: { fontSize: 13, color: "#6b7280" },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    margin: "1rem 0 6px",
  },
  select: {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 15,
    background: "#fff",
    marginBottom: 4,
  },
  formatRow: { display: "flex", gap: 8, marginBottom: 4 },
  formatBtn: {
    flex: 1,
    padding: "0.625rem",
    borderRadius: 8,
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 15,
  },
  formatBtnActive: {
    borderColor: "#1d6b3a",
    background: "#f0faf4",
    color: "#1d6b3a",
  },
  nextBtn: {
    padding: "0.75rem 1.5rem",
    background: "#1d6b3a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
  backBtn: {
    padding: "0.75rem 1rem",
    background: "transparent",
    color: "#374151",
    border: "1.5px solid #e5e7eb",
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 15,
    cursor: "pointer",
  },
  navRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "1rem",
  },
  summary: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: "1.5rem",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 15,
    borderBottom: "1px solid #f3f4f6",
    paddingBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 0,
    marginBottom: "0.75rem",
  },
  youBadge: {
    fontSize: 11,
    background: "#dcfce7",
    color: "#15803d",
    padding: "1px 6px",
    borderRadius: 4,
    marginLeft: 6,
  },
  tagBadge: { fontSize: 12, color: "#1d6b3a", fontWeight: 600 },
  empty: { color: "#6b7280", fontSize: 14 },
  error: { color: "#dc2626", fontSize: 14 },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#f0faf4",
    borderRadius: 10,
    padding: "0.875rem",
    marginBottom: "0.75rem",
    cursor: "pointer",
    border: "1.5px solid #bbf7d0",
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    background: "#d1d5db",
    position: "relative",
    flexShrink: 0,
    transition: "background 0.2s",
  },
  toggleOn: { background: "#1d6b3a" },
  toggleThumb: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  toggleThumbOn: { left: 22 },
  toggleLabel: { fontSize: 14, fontWeight: 600, color: "#1a2e1a" },
  toggleSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
};
