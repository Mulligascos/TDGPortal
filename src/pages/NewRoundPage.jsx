import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { cacheSet, cacheGet, cacheClear } from "../lib/localCache";
import Layout from "../components/shared/Layout";
import { useAppData } from "../hooks/useAppData";

const STEPS = ["Course", "Layout", "Players", "Start"];

export default function NewRoundPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tournamentState = location.state ?? null;

  const [step, setStep] = useState(0);
  const [courses, setCourses] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [members, setMembers] = useState([]);
  const [playerDivisions, setPlayerDivisions] = useState({});
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [startingHole, setStartingHole] = useState(1);
  const [format, setFormat] = useState("strokeplay");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [playForTags, setPlayForTags] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Restore saved setup from localStorage on mount ──────
  useEffect(() => {
    if (tournamentState?.prefilledFromTournament) return;
    const cached = cacheGet("newRound:setup");
    if (cached) {
      setSelectedCourse(cached.selectedCourse ?? null);
      setSelectedLayout(cached.selectedLayout ?? null);
      setStartingHole(cached.startingHole ?? 1);
      setFormat(cached.format ?? "strokeplay");
      setSelectedPlayers(cached.selectedPlayers ?? []);
      setPlayForTags(cached.playForTags ?? false);
      setStep(cached.step ?? 0);
    }
  }, []);

  // ── Persist setup to localStorage whenever key state changes ──
  useEffect(() => {
    if (!selectedCourse) return;
    cacheSet(
      "newRound:setup",
      {
        selectedCourse,
        selectedLayout,
        startingHole,
        format,
        selectedPlayers,
        playForTags,
        step,
      },
      30 * 60 * 1000,
    );
  }, [
    selectedCourse,
    selectedLayout,
    startingHole,
    format,
    selectedPlayers,
    playForTags,
    step,
  ]);

  // ── Load courses (cached) ────────────────────────────────
  useEffect(() => {
    const cached = cacheGet("courses:list");
    if (cached) {
      setCourses(cached);
    } else {
      supabase
        .from("courses")
        .select("*")
        .order("name")
        .then(({ data }) => {
          setCourses(data ?? []);
          cacheSet("courses:list", data ?? [], 10 * 60 * 1000);
        });
    }

    if (tournamentState?.prefilledFromTournament) {
      const course = {
        id: tournamentState.courseId,
        name: tournamentState.courseName,
      };
      setSelectedCourse(course);
      setFormat(tournamentState.format ?? "strokeplay");
      setStep(1);
    }
  }, []);

  // ── Load layouts when course changes (cached) ────────────
  useEffect(() => {
    if (!selectedCourse) return;
    const cacheKey = `layouts:${selectedCourse.id}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      setLayouts(cached);
      if (
        tournamentState?.prefilledFromTournament &&
        tournamentState.layoutId
      ) {
        const layout = cached.find((l) => l.id === tournamentState.layoutId);
        if (layout) {
          setSelectedLayout(layout);
          setStep(2);
        }
      }
    } else {
      supabase
        .from("layouts")
        .select("*")
        .eq("course_id", selectedCourse.id)
        .order("layout_name")
        .then(({ data }) => {
          setLayouts(data ?? []);
          cacheSet(cacheKey, data ?? [], 10 * 60 * 1000);
          if (
            tournamentState?.prefilledFromTournament &&
            tournamentState.layoutId
          ) {
            const layout = (data ?? []).find(
              (l) => l.id === tournamentState.layoutId,
            );
            if (layout) {
              setSelectedLayout(layout);
              setStep(2);
            }
          }
        });
    }
    setStartingHole(1);
  }, [selectedCourse]);

  // ── Load members when reaching players step ──────────────
  useEffect(() => {
    if (step !== 2) return;
    const cached = cacheGet("members:list");
    if (cached) {
      setMembers(cached);
      setSelectedPlayers((prev) => (prev.length ? prev : [user.id]));
    } else {
      supabase
        .from("profiles")
        .select("id, full_name, nickname, bag_tag_number")
        .order("full_name")
        .then(({ data }) => {
          setMembers(data ?? []);
          cacheSet("members:list", data ?? [], 5 * 60 * 1000);
          setSelectedPlayers((prev) => (prev.length ? prev : [user.id]));
        });
    }
  }, [step]);

  // Reset play for tags if format changes or fewer than 2 players
  useEffect(() => {
    if (format === "matchplay" || selectedPlayers.length < 2) {
      setPlayForTags(false);
    }
  }, [format, selectedPlayers]);

  function selectCourse(c) {
    setSelectedCourse(c);
    setSelectedLayout(null);
    setStep(1);
  }

  function selectLayout(l) {
    setSelectedLayout(l);
    setStartingHole(1);
    setStep(2);
  }

  function togglePlayer(id) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  const taggedSelectedCount = members.filter(
    (m) => selectedPlayers.includes(m.id) && m.bag_tag_number != null,
  ).length;

  async function startRound() {
    setLoading(true);
    setError(null);
    try {
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

      const playerRows = selectedPlayers.map((pid) => ({
        round_id: round.id,
        player_id: pid,
      }));
      const { error: playersErr } = await supabase
        .from("round_players")
        .insert(playerRows);
      if (playersErr) throw playersErr;

      if (tournamentState?.tournamentRoundId) {
        await supabase
          .from("tournament_rounds")
          .update({ round_id: round.id })
          .eq("id", tournamentState.tournamentRoundId);

        const { data: existingDivisions } = await supabase
          .from("tournament_divisions")
          .select("*")
          .eq("tournament_id", tournamentState.tournamentId);

        for (const playerId of selectedPlayers) {
          const member = members.find((m) => m.id === playerId);
          const divisionName =
            playerDivisions[playerId] || member?.default_division || "Open";

          let division = existingDivisions?.find(
            (d) => d.name === divisionName,
          );
          if (!division) {
            const { data: newDiv } = await supabase
              .from("tournament_divisions")
              .insert({
                tournament_id: tournamentState.tournamentId,
                name: divisionName,
                display_order: 0,
              })
              .select()
              .single();
            division = newDiv;
          }

          if (!division) continue;

          await supabase.from("tournament_players").upsert(
            {
              tournament_id: tournamentState.tournamentId,
              player_id: playerId,
              division_id: division.id,
            },
            { onConflict: "tournament_id,player_id" },
          );
        }
      }

      cacheClear("newRound:setup");
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
                  onClick={() => selectCourse(c)}
                >
                  <strong>{c.name}</strong>
                  {c.location && <span style={styles.sub}>{c.location}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Select layout */}
        {step === 1 && (
          <div>
            <h2 style={styles.stepTitle}>Select layout</h2>
            <p style={styles.hint}>{selectedCourse?.name}</p>
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
                  onClick={() => selectLayout(l)}
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
            <div style={styles.navRow}>
              <button style={styles.backBtn} onClick={() => setStep(0)}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Select players + starting hole + format */}
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

            {/* Search */}
            <div style={styles.searchWrap}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                style={styles.searchInput}
                type="text"
                placeholder="Search players…"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
              {playerSearch.length > 0 && (
                <button
                  style={styles.searchClear}
                  onClick={() => setPlayerSearch("")}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Scrollable player list — selected pinned to top */}
            <div style={styles.playerScroll}>
              {(() => {
                const query = playerSearch.toLowerCase();
                const matches = (m) =>
                  (m.nickname || m.full_name).toLowerCase().includes(query);

                const selected = members.filter(
                  (m) => selectedPlayers.includes(m.id) && matches(m),
                );
                const unselected = members.filter(
                  (m) => !selectedPlayers.includes(m.id) && matches(m),
                );
                const visible = [...selected, ...unselected];

                if (visible.length === 0)
                  return (
                    <p style={styles.empty}>
                      No players match "{playerSearch}"
                    </p>
                  );

                return visible.map((m) => {
                  const isSelected = selectedPlayers.includes(m.id);
                  const isMe = m.id === user.id;
                  const matchplayFull =
                    format === "matchplay" &&
                    selectedPlayers.length >= 2 &&
                    !isSelected;
                  return (
                    <button
                      key={m.id}
                      style={{
                        ...styles.listItem,
                        marginBottom: 0,
                        ...(isSelected ? styles.listItemActive : {}),
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
                });
              })()}
            </div>

            {/* Starting hole + format — moved here from layout step */}
            <div style={styles.optionsBlock}>
              <div style={styles.optionsRow}>
                <div style={{ flex: 1 }}>
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
                </div>
                <div style={{ flex: 1 }}>
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
                </div>
              </div>
            </div>

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

            {tournamentState?.prefilledFromTournament &&
              selectedPlayers.length > 0 && (
                <div
                  style={{
                    background: "#f0faf4",
                    borderRadius: 10,
                    padding: "0.875rem",
                    marginBottom: "0.75rem",
                    border: "1.5px solid #bbf7d0",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1a2e1a",
                      marginBottom: 8,
                    }}
                  >
                    🏆 Confirm tournament divisions
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}
                  >
                    Divisions default from player profiles. Change if needed.
                  </div>
                  {members
                    .filter((m) => selectedPlayers.includes(m.id))
                    .map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#1a2e1a",
                          }}
                        >
                          {m.nickname || m.full_name}
                        </span>
                        <input
                          style={{
                            width: 140,
                            padding: "0.4rem 0.625rem",
                            borderRadius: 6,
                            border: "1.5px solid #d1d5db",
                            fontSize: 13,
                            background: "#fff",
                          }}
                          value={
                            playerDivisions[m.id] ?? m.default_division ?? ""
                          }
                          onChange={(e) =>
                            setPlayerDivisions((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                          placeholder="e.g. Open"
                        />
                      </div>
                    ))}
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
              {(() => {
                const disabled =
                  format === "matchplay"
                    ? selectedPlayers.length !== 2
                    : selectedPlayers.length === 0;
                return (
                  <button
                    style={{
                      ...styles.nextBtn,
                      opacity: disabled ? 0.4 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                    disabled={disabled}
                    onClick={() => setStep(3)}
                  >
                    Next →
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* STEP 3: Confirm and start */}
        {step === 3 && (
          <div>
            <h2 style={styles.stepTitle}>Ready to start</h2>
            <div style={styles.summary}>
              {tournamentState?.prefilledFromTournament && (
                <div
                  style={{
                    ...styles.summaryRow,
                    background: "#f0faf4",
                    borderRadius: 6,
                    padding: "6px 8px",
                  }}
                >
                  <span>Tournament</span>
                  <strong style={{ color: "#1d6b3a" }}>
                    🏆 {tournamentState.tournamentName}
                  </strong>
                </div>
              )}
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
    margin: "0 0 0.25rem",
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
  optionsBlock: {
    borderTop: "1px solid #f3f4f6",
    paddingTop: "0.875rem",
    marginBottom: "0.75rem",
  },
  optionsRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    margin: "0 0 6px",
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
    fontSize: 14,
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
  searchWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    marginBottom: 8,
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    fontSize: 14,
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "0.6rem 2rem 0.6rem 2rem",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 14,
    background: "#f9fafb",
    boxSizing: "border-box",
  },
  searchClear: {
    position: "absolute",
    right: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "#9ca3af",
    padding: "2px 4px",
  },
  playerScroll: {
    maxHeight: 460,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: "0.75rem",
    paddingRight: 2,
  },
};
