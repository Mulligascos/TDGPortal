import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";
import Layout from "../../components/shared/Layout";

export default function AdminEvents() {
  const [tab, setTab] = useState("events");

  return (
    <Layout title="Events & tournaments">
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        {["events", "tournaments"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: 20,
              border: "1.5px solid",
              borderColor: tab === t ? "#1d6b3a" : "#e5e7eb",
              background: tab === t ? "#f0faf4" : "#fff",
              color: tab === t ? "#1d6b3a" : "#6b7280",
              fontWeight: tab === t ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "events" ? <EventsTab /> : <TournamentsTab />}
    </Layout>
  );
}

// ── Events Tab (existing functionality) ──────────────────
function EventsTab() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    course_id: "",
    layout_id: "",
    format: "strokeplay",
    event_date: "",
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadEvents();
    supabase
      .from("courses")
      .select("*")
      .order("name")
      .then(({ data }) => setCourses(data ?? []));
  }, []);

  useEffect(() => {
    if (!form.course_id) {
      setLayouts([]);
      return;
    }
    supabase
      .from("layouts")
      .select("*")
      .eq("course_id", form.course_id)
      .order("layout_name")
      .then(({ data }) => setLayouts(data ?? []));
  }, [form.course_id]);

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select("*, courses(name), layouts(layout_name)")
      .order("event_date", { ascending: true });
    setEvents(data ?? []);
  }

  function startNew() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      course_id: "",
      layout_id: "",
      format: "strokeplay",
      event_date: "",
    });
    setShowForm(true);
    setError(null);
  }

  function startEdit(ev) {
    setEditing(ev.id);
    setForm({
      name: ev.name,
      description: ev.description ?? "",
      course_id: ev.course_id ?? "",
      layout_id: ev.layout_id ?? "",
      format: ev.format ?? "strokeplay",
      event_date: ev.event_date ? ev.event_date.slice(0, 16) : "",
    });
    setShowForm(true);
    setError(null);
    window.scrollTo(0, 0);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      description: form.description || null,
      course_id: form.course_id || null,
      layout_id: form.layout_id || null,
      format: form.format,
      event_date: form.event_date,
    };
    if (editing) {
      const { error } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editing);
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Event updated!");
    } else {
      const { error } = await supabase
        .from("events")
        .insert({ ...payload, created_by: user.id });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Event created!");
    }
    setShowForm(false);
    setEditing(null);
    setForm({
      name: "",
      description: "",
      course_id: "",
      layout_id: "",
      format: "strokeplay",
      event_date: "",
    });
    loadEvents();
  }

  async function deleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", id);
    loadEvents();
  }

  const upcoming = events.filter((e) => new Date(e.event_date) >= new Date());
  const past = events.filter((e) => new Date(e.event_date) < new Date());
  const inp = {
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: `1.5px solid ${t.inputBorder}`,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    background: t.input,
    color: t.text,
    fontFamily: "inherit",
  };

  return (
    <div>
      {success && (
        <div
          style={{
            background: t.successLight,
            color: t.success,
            padding: "0.75rem 1rem",
            borderRadius: 8,
            marginBottom: "0.75rem",
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={() => setSuccess(null)}
        >
          {success} ✕
        </div>
      )}
      {error && (
        <div
          style={{
            background: t.dangerLight,
            color: t.danger,
            padding: "0.75rem 1rem",
            borderRadius: 8,
            marginBottom: "0.75rem",
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={() => setError(null)}
        >
          {error} ✕
        </div>
      )}

      <button
        style={{
          padding: "0.625rem 1.25rem",
          background: t.accent,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: "0.75rem",
        }}
        onClick={() => (showForm && !editing ? setShowForm(false) : startNew())}
      >
        {showForm && !editing ? "Cancel" : "+ New event"}
      </button>

      {showForm && (
        <form
          onSubmit={save}
          style={{
            background: t.card,
            borderRadius: 12,
            padding: "1.25rem",
            marginBottom: "1rem",
            boxShadow: t.shadow,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h3
            style={{
              margin: "0 0 0.25rem",
              fontSize: 16,
              fontWeight: 600,
              color: t.text,
            }}
          >
            {editing ? "Edit event" : "New event"}
          </h3>
          <label style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}>
            Event name
          </label>
          <input
            style={inp}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Club Championship Round 1"
          />
          <label style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}>
            Date & time
          </label>
          <input
            style={inp}
            type="datetime-local"
            required
            value={form.event_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, event_date: e.target.value }))
            }
          />
          <label style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}>
            Course
          </label>
          <select
            style={inp}
            value={form.course_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                course_id: e.target.value,
                layout_id: "",
              }))
            }
          >
            <option value="">Select course (optional)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {form.course_id && (
            <>
              <label
                style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}
              >
                Layout
              </label>
              <select
                style={inp}
                value={form.layout_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, layout_id: e.target.value }))
                }
              >
                <option value="">Select layout</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.layout_name}
                  </option>
                ))}
              </select>
            </>
          )}
          <label style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}>
            Format
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {["strokeplay", "matchplay"].map((f) => (
              <button
                key={f}
                type="button"
                style={{
                  flex: 1,
                  padding: "0.625rem",
                  borderRadius: 8,
                  border: `1.5px solid ${form.format === f ? t.accent : t.border}`,
                  background: form.format === f ? t.accentLight : t.card,
                  color: form.format === f ? t.accentText : t.textSub,
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 14,
                }}
                onClick={() => setForm((p) => ({ ...p, format: f }))}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <label style={{ fontSize: 13, fontWeight: 500, color: t.textSub }}>
            Description
          </label>
          <textarea
            style={{ ...inp, minHeight: 80, resize: "vertical" }}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Any extra details..."
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              style={{
                padding: "0.625rem 1.25rem",
                background: t.cardAlt,
                color: t.text,
                border: `1.5px solid ${t.border}`,
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "0.625rem 1.25rem",
                background: t.accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {editing ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      )}

      {upcoming.length === 0 && past.length === 0 && !showForm && (
        <p style={{ color: t.textSub }}>No events yet.</p>
      )}
      {upcoming.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0.75rem 0 0.5rem",
            }}
          >
            Upcoming
          </div>
          {upcoming.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onEdit={startEdit}
              onDelete={deleteEvent}
              t={t}
            />
          ))}
        </>
      )}
      {past.length > 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: t.textSub,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0.75rem 0 0.5rem",
            }}
          >
            Past
          </div>
          {past.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onEdit={startEdit}
              onDelete={deleteEvent}
              t={t}
              past
            />
          ))}
        </>
      )}
    </div>
  );
}

function EventCard({ ev, onEdit, onDelete, t, past }) {
  const d = new Date(ev.event_date);
  return (
    <div
      style={{
        background: t.card,
        borderRadius: 12,
        padding: "1rem",
        marginBottom: 10,
        boxShadow: t.shadow,
        opacity: past ? 0.7 : 1,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 16, color: t.text }}>
        {ev.name}
      </div>
      <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>
        {d.toLocaleDateString("en-NZ", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}{" "}
        ·{" "}
        {d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}
      </div>
      {ev.courses && (
        <div style={{ fontSize: 12, color: t.textSub }}>
          {ev.courses.name}
          {ev.layouts ? ` · ${ev.layouts.layout_name}` : ""} · {ev.format}
        </div>
      )}
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
      <div
        style={{
          display: "flex",
          gap: 6,
          borderTop: `1px solid ${t.borderCard}`,
          paddingTop: 8,
          marginTop: 8,
        }}
      >
        <button
          style={{
            padding: "4px 10px",
            background: t.cardAlt,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            color: t.text,
          }}
          onClick={() => onEdit(ev)}
        >
          ✏️ Edit
        </button>
        <button
          style={{
            padding: "4px 10px",
            background: t.dangerLight,
            border: `1px solid ${t.danger}`,
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            color: t.danger,
          }}
          onClick={() => onDelete(ev.id)}
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

// ── Tournaments Tab ───────────────────────────────────────
function TournamentsTab() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [tournaments, setTournaments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    const { data } = await supabase
      .from("tournaments")
      .select("*, tournament_rounds(id), tournament_players(id)")
      .order("start_date", { ascending: false });
    setTournaments(data ?? []);
  }

  function startNew() {
    setEditing(null);
    setShowForm(true);
    window.scrollTo(0, 0);
  }

  return (
    <div>
      <button
        style={{
          padding: "0.625rem 1.25rem",
          background: t.accent,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: "0.75rem",
        }}
        onClick={() => (showForm && !editing ? setShowForm(false) : startNew())}
      >
        {showForm && !editing ? "Cancel" : "+ New tournament"}
      </button>

      {showForm && (
        <TournamentForm
          editing={editing}
          t={t}
          userId={user.id}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            loadTournaments();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {tournaments.length === 0 && !showForm && (
        <p style={{ color: t.textSub }}>No tournaments yet.</p>
      )}

      {tournaments.map((tournament) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          t={t}
          onEdit={() => {
            setEditing(tournament);
            setShowForm(true);
            window.scrollTo(0, 0);
          }}
          onDeleted={loadTournaments}
        />
      ))}
    </div>
  );
}

// ── Tournament Form ───────────────────────────────────────
function TournamentForm({ editing, t, userId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: editing?.name ?? "",
    description: editing?.description ?? "",
    start_date: editing?.start_date ?? "",
    end_date: editing?.end_date ?? "",
    format: editing?.format ?? "strokeplay",
    status: editing?.status ?? "draft",
  });
  const [divisions, setDivisions] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [courses, setCourses] = useState([]);
  const [layoutMap, setLayoutMap] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const tournamentId = editing?.id ?? null;

  useEffect(() => {
    supabase
      .from("courses")
      .select("*")
      .order("name")
      .then(({ data }) => setCourses(data ?? []));
    if (tournamentId) {
      supabase
        .from("tournament_divisions")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("display_order")
        .then(({ data }) => setDivisions(data ?? []));
      supabase
        .from("tournament_rounds")
        .select("*, courses(name), layouts(layout_name)")
        .eq("tournament_id", tournamentId)
        .order("round_number")
        .then(({ data }) => setRounds(data ?? []));
    }
  }, [tournamentId]);

  async function loadLayouts(courseId, roundIdx) {
    if (layoutMap[courseId]) return;
    const { data } = await supabase
      .from("layouts")
      .select("*")
      .eq("course_id", courseId)
      .order("layout_name");
    setLayoutMap((prev) => ({ ...prev, [courseId]: data ?? [] }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description || null,
      start_date: form.start_date,
      end_date: form.end_date,
      format: form.format,
      status: form.status,
    };

    let tid = tournamentId;
    if (editing) {
      const { error } = await supabase
        .from("tournaments")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", tournamentId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("tournaments")
        .insert({ ...payload, created_by: userId })
        .select()
        .single();
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      tid = data.id;
    }

    // Save divisions
    await supabase
      .from("tournament_divisions")
      .delete()
      .eq("tournament_id", tid);
    if (divisions.length > 0) {
      await supabase
        .from("tournament_divisions")
        .insert(
          divisions.map((d, i) => ({
            tournament_id: tid,
            name: d.name,
            display_order: i,
          })),
        );
    }

    // Save rounds
    await supabase.from("tournament_rounds").delete().eq("tournament_id", tid);
    if (rounds.length > 0) {
      await supabase.from("tournament_rounds").insert(
        rounds.map((r, i) => ({
          tournament_id: tid,
          round_number: i + 1,
          course_id: r.course_id || null,
          layout_id: r.layout_id || null,
          scheduled_date: r.scheduled_date,
          round_id: r.round_id || null,
        })),
      );
    }

    setSaving(false);
    onSaved();
  }

  function addDivision() {
    setDivisions((prev) => [...prev, { name: "", id: `new-${Date.now()}` }]);
  }

  function updateDivision(idx, name) {
    setDivisions((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, name } : d)),
    );
  }

  function removeDivision(idx) {
    setDivisions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRound() {
    setRounds((prev) => [
      ...prev,
      {
        course_id: "",
        layout_id: "",
        scheduled_date: "",
        id: `new-${Date.now()}`,
      },
    ]);
  }

  function updateRound(idx, field, value) {
    setRounds((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === "course_id") {
          updated.layout_id = "";
          loadLayouts(value, idx);
        }
        return updated;
      }),
    );
  }

  function removeRound(idx) {
    setRounds((prev) => prev.filter((_, i) => i !== idx));
  }

  const inp = {
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: `1.5px solid ${t.inputBorder}`,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    background: t.input,
    color: t.text,
    fontFamily: "inherit",
  };
  const lbl = { fontSize: 13, fontWeight: 500, color: t.textSub };
  const sectionHead = {
    fontSize: 13,
    fontWeight: 700,
    color: t.text,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "1rem 0 0.5rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };
  const addBtn = {
    padding: "3px 10px",
    background: t.accentLight,
    color: t.accentText,
    border: `1.5px solid ${t.accent}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <form
      onSubmit={save}
      style={{
        background: t.card,
        borderRadius: 12,
        padding: "1.25rem",
        marginBottom: "1rem",
        boxShadow: t.shadow,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h3
        style={{
          margin: "0 0 0.25rem",
          fontSize: 16,
          fontWeight: 600,
          color: t.text,
        }}
      >
        {editing ? `Edit — ${editing.name}` : "New tournament"}
      </h3>

      {error && (
        <div
          style={{
            background: t.dangerLight,
            color: t.danger,
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Basic info */}
      <label style={lbl}>Tournament name</label>
      <input
        style={inp}
        required
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="e.g. 2025 Club Championship"
      />

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Start date</label>
          <input
            style={inp}
            type="date"
            required
            value={form.start_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, start_date: e.target.value }))
            }
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>End date</label>
          <input
            style={inp}
            type="date"
            required
            value={form.end_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, end_date: e.target.value }))
            }
          />
        </div>
      </div>

      <label style={lbl}>Format</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["strokeplay", "matchplay"].map((f) => (
          <button
            key={f}
            type="button"
            style={{
              flex: 1,
              padding: "0.625rem",
              borderRadius: 8,
              border: `1.5px solid ${form.format === f ? t.accent : t.border}`,
              background: form.format === f ? t.accentLight : t.card,
              color: form.format === f ? t.accentText : t.textSub,
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
            }}
            onClick={() => setForm((p) => ({ ...p, format: f }))}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <label style={lbl}>Description</label>
      <textarea
        style={{ ...inp, minHeight: 70, resize: "vertical" }}
        value={form.description}
        onChange={(e) =>
          setForm((f) => ({ ...f, description: e.target.value }))
        }
        placeholder="Tournament details, rules, prizes..."
      />

      <label style={lbl}>Status</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["draft", "published"].map((s) => (
          <button
            key={s}
            type="button"
            style={{
              flex: 1,
              padding: "0.625rem",
              borderRadius: 8,
              border: `1.5px solid ${form.status === s ? (s === "published" ? t.accent : t.warn) : t.border}`,
              background:
                form.status === s
                  ? s === "published"
                    ? t.accentLight
                    : t.warnLight
                  : t.card,
              color:
                form.status === s
                  ? s === "published"
                    ? t.accentText
                    : t.warn
                  : t.textSub,
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
            }}
            onClick={() => setForm((p) => ({ ...p, status: s }))}
          >
            {s === "draft" ? "📝 Draft" : "📢 Published"}
          </button>
        ))}
      </div>

      {/* Divisions */}
      <div style={sectionHead}>
        <span>Divisions</span>
        <button type="button" style={addBtn} onClick={addDivision}>
          + Add division
        </button>
      </div>
      {divisions.length === 0 && (
        <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
          No divisions — all players will be in one group.
        </p>
      )}
      {divisions.map((d, i) => (
        <div
          key={d.id ?? i}
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            style={{ ...inp, flex: 1 }}
            value={d.name}
            onChange={(e) => updateDivision(i, e.target.value)}
            placeholder="e.g. Open, Women's, Junior"
          />
          <button
            type="button"
            style={{
              padding: "6px 10px",
              background: t.dangerLight,
              border: `1px solid ${t.danger}`,
              borderRadius: 6,
              color: t.danger,
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={() => removeDivision(i)}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Rounds */}
      <div style={sectionHead}>
        <span>Rounds</span>
        <button type="button" style={addBtn} onClick={addRound}>
          + Add round
        </button>
      </div>
      {rounds.length === 0 && (
        <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
          No rounds added yet.
        </p>
      )}
      {rounds.map((r, i) => (
        <div
          key={r.id ?? i}
          style={{
            background: t.cardAlt,
            borderRadius: 8,
            padding: "0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            border: `1px solid ${t.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              Round {i + 1}
            </span>
            <button
              type="button"
              style={{
                padding: "2px 8px",
                background: t.dangerLight,
                border: `1px solid ${t.danger}`,
                borderRadius: 6,
                color: t.danger,
                cursor: "pointer",
                fontSize: 12,
              }}
              onClick={() => removeRound(i)}
            >
              Remove
            </button>
          </div>
          <label style={lbl}>Scheduled date & time</label>
          <input
            style={inp}
            type="datetime-local"
            value={r.scheduled_date ?? ""}
            onChange={(e) => updateRound(i, "scheduled_date", e.target.value)}
          />
          <label style={lbl}>Course</label>
          <select
            style={inp}
            value={r.course_id ?? ""}
            onChange={(e) => updateRound(i, "course_id", e.target.value)}
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {r.course_id && (
            <>
              <label style={lbl}>Layout</label>
              <select
                style={inp}
                value={r.layout_id ?? ""}
                onChange={(e) => updateRound(i, "layout_id", e.target.value)}
              >
                <option value="">Select layout</option>
                {(layoutMap[r.course_id] ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.layout_name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      ))}

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 4,
        }}
      >
        <button
          type="button"
          style={{
            padding: "0.625rem 1.25rem",
            background: t.cardAlt,
            color: t.text,
            border: `1.5px solid ${t.border}`,
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "0.625rem 1.25rem",
            background: t.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Create tournament"}
        </button>
      </div>
    </form>
  );
}

// ── Tournament Card ───────────────────────────────────────
function TournamentCard({ tournament, t, onEdit, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [divisions, setDivisions] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [members, setMembers] = useState([]);
  const [scoreboard, setScoreboard] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState({});
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    player_id: "",
    division_id: "",
  });

  async function load() {
    const [divRes, roundRes, playerRes, memberRes] = await Promise.all([
      supabase
        .from("tournament_divisions")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("display_order"),
      supabase
        .from("tournament_rounds")
        .select("*, courses(name), layouts(layout_name)")
        .eq("tournament_id", tournament.id)
        .order("round_number"),
      supabase
        .from("tournament_players")
        .select(
          "*, profiles(id, full_name, nickname), tournament_divisions(name)",
        )
        .eq("tournament_id", tournament.id),
      supabase
        .from("profiles")
        .select("id, full_name, nickname")
        .order("full_name"),
    ]);
    setDivisions(divRes.data ?? []);
    setRounds(roundRes.data ?? []);
    setPlayers(playerRes.data ?? []);
    setMembers(memberRes.data ?? []);
    await loadScoreboard(roundRes.data ?? [], playerRes.data ?? []);
  }

  async function loadScoreboard(roundList, playerList) {
    setLoadingScores(true);
    const linkedRoundIds = roundList
      .filter((r) => r.round_id)
      .map((r) => r.round_id);
    if (linkedRoundIds.length === 0) {
      setLoadingScores(false);
      return;
    }

    const { data: scores } = await supabase
      .from("scores")
      .select("player_id, strokes, round_id")
      .in("round_id", linkedRoundIds);

    // Sum strokes per player across all tournament rounds
    const totals = {};
    for (const s of scores ?? []) {
      if (!totals[s.player_id]) totals[s.player_id] = 0;
      totals[s.player_id] += s.strokes;
    }

    const board = playerList
      .map((p) => ({
        player_id: p.player_id,
        name: p.profiles?.nickname || p.profiles?.full_name,
        division: p.tournament_divisions?.name ?? "Open",
        division_id: p.division_id,
        total: totals[p.player_id] ?? null,
      }))
      .sort((a, b) => {
        if (a.total == null && b.total == null) return 0;
        if (a.total == null) return 1;
        if (b.total == null) return -1;
        return a.total - b.total;
      });

    setScoreboard(board);
    setLoadingScores(false);
  }

  async function toggle() {
    if (!expanded) await load();
    setExpanded((e) => !e);
  }

  async function deleteT() {
    if (!confirm("Delete this tournament?")) return;
    await supabase.from("tournaments").delete().eq("id", tournament.id);
    onDeleted();
  }

  async function toggleStatus() {
    const newStatus = tournament.status === "draft" ? "published" : "draft";
    await supabase
      .from("tournaments")
      .update({ status: newStatus })
      .eq("id", tournament.id);
    onDeleted(); // refresh list
  }

  async function addPlayer(e) {
    e.preventDefault();
    if (!newPlayer.player_id) return;
    const divisionId = newPlayer.division_id || divisions[0]?.id;
    if (!divisionId) {
      alert("Add at least one division first");
      return;
    }
    await supabase
      .from("tournament_players")
      .upsert({
        tournament_id: tournament.id,
        player_id: newPlayer.player_id,
        division_id: divisionId,
      });
    setNewPlayer({ player_id: "", division_id: "" });
    setAddingPlayer(false);
    await load();
  }

  async function removePlayer(playerId) {
    await supabase
      .from("tournament_players")
      .delete()
      .eq("tournament_id", tournament.id)
      .eq("player_id", playerId);
    await load();
  }

  function toggleDivision(divId) {
    setExpandedDivisions((prev) => ({ ...prev, [divId]: !prev[divId] }));
  }

  const divisionGroups = divisions.map((div) => ({
    division: div,
    players: scoreboard.filter((s) => s.division_id === div.id),
  }));
  const ungrouped = scoreboard.filter(
    (s) => !divisions.find((d) => d.id === s.division_id),
  );

  const inp = {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: `1.5px solid ${t.inputBorder}`,
    fontSize: 14,
    background: t.input,
    color: t.text,
  };

  return (
    <div
      style={{
        background: t.card,
        borderRadius: 12,
        marginBottom: 10,
        boxShadow: t.shadow,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, cursor: "pointer" }} onClick={toggle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: t.text }}>
              {tournament.name}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background:
                  tournament.status === "published"
                    ? t.successLight
                    : t.warnLight,
                color: tournament.status === "published" ? t.success : t.warn,
              }}
            >
              {tournament.status === "draft" ? "📝 Draft" : "📢 Published"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: t.textSub, marginTop: 2 }}>
            {new Date(tournament.start_date).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" → "}
            {new Date(tournament.end_date).toLocaleDateString("en-NZ", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}
            {tournament.format} · {(tournament.tournament_rounds ?? []).length}{" "}
            rounds · {(tournament.tournament_players ?? []).length} players
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <button
            style={{
              padding: "3px 8px",
              background: t.cardAlt,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              color: t.text,
            }}
            onClick={onEdit}
          >
            ✏️
          </button>
          <button
            style={{
              padding: "3px 8px",
              background:
                tournament.status === "draft" ? t.accentLight : t.warnLight,
              border: `1px solid ${tournament.status === "draft" ? t.accent : t.warn}`,
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              color: tournament.status === "draft" ? t.accentText : t.warn,
            }}
            onClick={toggleStatus}
          >
            {tournament.status === "draft" ? "Publish" : "Unpublish"}
          </button>
          <button
            style={{
              padding: "3px 8px",
              background: t.dangerLight,
              border: `1px solid ${t.danger}`,
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              color: t.danger,
            }}
            onClick={deleteT}
          >
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "1rem" }}>
          {/* Rounds */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.text,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 8,
            }}
          >
            Rounds
          </div>
          {rounds.length === 0 && (
            <p style={{ color: t.textSub, fontSize: 13 }}>
              No rounds yet — edit tournament to add rounds.
            </p>
          )}
          {rounds.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: `1px solid ${t.borderCard}`,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  Round {r.round_number}
                </div>
                <div style={{ fontSize: 12, color: t.textSub }}>
                  {r.courses?.name ?? "No course"}{" "}
                  {r.layouts ? `· ${r.layouts.layout_name}` : ""}
                  {r.scheduled_date
                    ? ` · ${new Date(r.scheduled_date).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}`
                    : ""}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: r.round_id ? t.successLight : t.cardAlt,
                  color: r.round_id ? t.success : t.textSub,
                }}
              >
                {r.round_id ? "✓ Played" : "Scheduled"}
              </span>
            </div>
          ))}

          {/* Players */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.text,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "1rem 0 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Players ({players.length})</span>
            <button
              style={{
                padding: "3px 10px",
                background: t.accentLight,
                color: t.accentText,
                border: `1.5px solid ${t.accent}`,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => setAddingPlayer((a) => !a)}
            >
              {addingPlayer ? "Cancel" : "+ Add player"}
            </button>
          </div>

          {addingPlayer && (
            <form
              onSubmit={addPlayer}
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <select
                style={{ ...inp, flex: 2 }}
                value={newPlayer.player_id}
                onChange={(e) =>
                  setNewPlayer((p) => ({ ...p, player_id: e.target.value }))
                }
              >
                <option value="">Select member</option>
                {members
                  .filter((m) => !players.find((p) => p.player_id === m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nickname || m.full_name}
                    </option>
                  ))}
              </select>
              {divisions.length > 0 && (
                <select
                  style={{ ...inp, flex: 1 }}
                  value={newPlayer.division_id}
                  onChange={(e) =>
                    setNewPlayer((p) => ({ ...p, division_id: e.target.value }))
                  }
                >
                  <option value="">Division</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                style={{
                  padding: "0.5rem 1rem",
                  background: t.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Add
              </button>
            </form>
          )}

          {players.map((p) => (
            <div
              key={p.player_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                borderBottom: `1px solid ${t.borderCard}`,
              }}
            >
              <div>
                <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
                  {p.profiles?.nickname || p.profiles?.full_name}
                </span>
                {p.tournament_divisions && (
                  <span
                    style={{ fontSize: 11, color: t.textSub, marginLeft: 8 }}
                  >
                    {p.tournament_divisions.name}
                  </span>
                )}
              </div>
              <button
                style={{
                  padding: "2px 8px",
                  background: t.dangerLight,
                  border: `1px solid ${t.danger}`,
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  color: t.danger,
                }}
                onClick={() => removePlayer(p.player_id)}
              >
                Remove
              </button>
            </div>
          ))}

          {/* Scoreboard */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.text,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "1rem 0 8px",
            }}
          >
            Scoreboard
          </div>
          {loadingScores && (
            <p style={{ color: t.textSub, fontSize: 13 }}>Loading scores...</p>
          )}

          {!loadingScores && scoreboard.length === 0 && (
            <p style={{ color: t.textSub, fontSize: 13 }}>No scores yet.</p>
          )}

          {/* Grouped by division */}
          {!loadingScores &&
            divisionGroups.map(({ division, players: divPlayers }) => (
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
                  onClick={() => toggleDivision(division.id)}
                >
                  <span>
                    {division.name} ({divPlayers.length})
                  </span>
                  <span style={{ fontSize: 12 }}>
                    {expandedDivisions[division.id] ? "▲" : "▼"}
                  </span>
                </button>
                {expandedDivisions[division.id] && (
                  <div style={{ padding: "0.5rem 0" }}>
                    {divPlayers.map((p, i) => (
                      <div
                        key={p.player_id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "24px 1fr 60px",
                          gap: 8,
                          padding: "6px 0.875rem",
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
                            fontWeight: 500,
                            color: t.text,
                          }}
                        >
                          {p.name}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: t.text,
                            textAlign: "right",
                          }}
                        >
                          {p.total ?? "—"}
                        </span>
                      </div>
                    ))}
                    {divPlayers.length === 0 && (
                      <p
                        style={{
                          padding: "0.5rem 0.875rem",
                          color: t.textSub,
                          fontSize: 13,
                          margin: 0,
                        }}
                      >
                        No players in this division.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

          {/* Ungrouped players (no division) */}
          {!loadingScores && ungrouped.length > 0 && (
            <div
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
                onClick={() => toggleDivision("ungrouped")}
              >
                <span>Open ({ungrouped.length})</span>
                <span style={{ fontSize: 12 }}>
                  {expandedDivisions["ungrouped"] ? "▲" : "▼"}
                </span>
              </button>
              {expandedDivisions["ungrouped"] && (
                <div style={{ padding: "0.5rem 0" }}>
                  {ungrouped.map((p, i) => (
                    <div
                      key={p.player_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr 60px",
                        gap: 8,
                        padding: "6px 0.875rem",
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
                        style={{ fontSize: 14, fontWeight: 500, color: t.text }}
                      >
                        {p.name}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: t.text,
                          textAlign: "right",
                        }}
                      >
                        {p.total ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
