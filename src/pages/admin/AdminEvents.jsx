import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

export default function AdminEvents() {
  const { user } = useAuth();
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
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);

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

  return (
    <Layout title="Events">
      {success && (
        <div style={successBox} onClick={() => setSuccess(null)}>
          {success} ✕
        </div>
      )}
      {error && (
        <div style={errorBox} onClick={() => setError(null)}>
          {error} ✕
        </div>
      )}

      <button
        style={addBtn}
        onClick={() => (showForm && !editing ? setShowForm(false) : startNew())}
      >
        {showForm && !editing ? "Cancel" : "+ New event"}
      </button>

      {showForm && (
        <form onSubmit={save} style={formCard}>
          <h3 style={formTitle}>{editing ? "Edit event" : "New event"}</h3>

          <label style={lbl}>Event name</label>
          <input
            style={inp}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Club Championship Round 1"
          />

          <label style={lbl}>Date & time</label>
          <input
            style={inp}
            type="datetime-local"
            required
            value={form.event_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, event_date: e.target.value }))
            }
          />

          <label style={lbl}>Course</label>
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
              <label style={lbl}>Layout</label>
              <select
                style={inp}
                value={form.layout_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, layout_id: e.target.value }))
                }
              >
                <option value="">Select layout (optional)</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.layout_name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label style={lbl}>Format</label>
          <div style={formatRow}>
            {["strokeplay", "matchplay"].map((f) => (
              <button
                key={f}
                type="button"
                style={{
                  ...formatBtn,
                  ...(form.format === f ? formatBtnActive : {}),
                }}
                onClick={() => setForm((p) => ({ ...p, format: f }))}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <label style={lbl}>Description</label>
          <textarea
            style={{ ...inp, minHeight: 80, resize: "vertical" }}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Any extra details, meeting point, prizes, etc."
          />

          <div style={btnRow}>
            <button
              type="button"
              style={cancelBtn}
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" style={submitBtn}>
              {editing ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      )}

      {upcoming.length === 0 && past.length === 0 && !showForm && (
        <p style={{ color: "#6b7280" }}>No events yet.</p>
      )}

      {upcoming.length > 0 && (
        <>
          <div style={sectionHead}>Upcoming</div>
          {upcoming.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onEdit={startEdit}
              onDelete={deleteEvent}
            />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <div style={sectionHead}>Past</div>
          {past.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onEdit={startEdit}
              onDelete={deleteEvent}
              past
            />
          ))}
        </>
      )}
    </Layout>
  );
}

function EventCard({ ev, onEdit, onDelete, past }) {
  const d = new Date(ev.event_date);
  return (
    <div style={{ ...card, opacity: past ? 0.7 : 1 }}>
      <div style={cardTop}>
        <div style={{ flex: 1 }}>
          <div style={cardTitle}>{ev.name}</div>
          <div style={cardMeta}>
            {d.toLocaleDateString("en-NZ", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}
            {d.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {ev.courses && (
            <div style={cardMeta}>
              {ev.courses.name}
              {ev.layouts ? ` · ${ev.layouts.layout_name}` : ""} · {ev.format}
            </div>
          )}
          {ev.description && <div style={cardDesc}>{ev.description}</div>}
        </div>
      </div>
      <div style={cardActions}>
        <button style={actionBtn} onClick={() => onEdit(ev)}>
          ✏️ Edit
        </button>
        <button
          style={{ ...actionBtn, color: "#dc2626" }}
          onClick={() => onDelete(ev.id)}
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

const addBtn = {
  padding: "0.625rem 1.25rem",
  background: "#1d6b3a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  marginBottom: "0.75rem",
};
const formCard = {
  background: "#fff",
  borderRadius: 12,
  padding: "1.25rem",
  marginBottom: "1rem",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const formTitle = {
  margin: "0 0 0.25rem",
  fontSize: 16,
  fontWeight: 600,
  color: "#1a2e1a",
};
const lbl = { fontSize: 13, fontWeight: 500, color: "#374151" };
const inp = {
  padding: "0.625rem 0.75rem",
  borderRadius: 8,
  border: "1.5px solid #d1d5db",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  fontFamily: "inherit",
};
const formatRow = { display: "flex", gap: 8 };
const formatBtn = {
  flex: 1,
  padding: "0.625rem",
  borderRadius: 8,
  border: "1.5px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 14,
};
const formatBtnActive = {
  borderColor: "#1d6b3a",
  background: "#f0faf4",
  color: "#1d6b3a",
};
const btnRow = { display: "flex", gap: 8, justifyContent: "flex-end" };
const submitBtn = {
  padding: "0.625rem 1.25rem",
  background: "#1d6b3a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
const cancelBtn = {
  padding: "0.625rem 1.25rem",
  background: "#f3f4f6",
  color: "#374151",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
const sectionHead = {
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0.75rem 0 0.5rem",
};
const card = {
  background: "#fff",
  borderRadius: 12,
  padding: "1rem",
  marginBottom: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};
const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 6,
};
const cardTitle = { fontWeight: 700, fontSize: 16, color: "#1a2e1a" };
const cardMeta = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 2,
  textTransform: "capitalize",
};
const cardDesc = {
  fontSize: 13,
  color: "#374151",
  marginTop: 6,
  lineHeight: 1.5,
};
const cardActions = {
  display: "flex",
  gap: 6,
  borderTop: "1px solid #f3f4f6",
  paddingTop: 8,
  marginTop: 4,
};
const actionBtn = {
  padding: "4px 10px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  color: "#374151",
};
const successBox = {
  background: "#dcfce7",
  color: "#15803d",
  padding: "0.75rem 1rem",
  borderRadius: 8,
  marginBottom: "0.75rem",
  fontSize: 14,
  cursor: "pointer",
};
const errorBox = {
  background: "#fef2f2",
  color: "#dc2626",
  padding: "0.75rem 1rem",
  borderRadius: 8,
  marginBottom: "0.75rem",
  fontSize: 14,
  cursor: "pointer",
};
