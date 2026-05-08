import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", body: "", pinned: false });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    const { data } = await supabase
      .from("announcements")
      .select("*, profiles(full_name)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setAnnouncements(data ?? []);
  }

  function startNew() {
    setEditing(null);
    setForm({ title: "", body: "", pinned: false });
    setShowForm(true);
    setError(null);
  }

  function startEdit(a) {
    setEditing(a.id);
    setForm({ title: a.title, body: a.body, pinned: a.pinned });
    setShowForm(true);
    setError(null);
    window.scrollTo(0, 0);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);

    if (editing) {
      const { error } = await supabase
        .from("announcements")
        .update({
          title: form.title,
          body: form.body,
          pinned: form.pinned,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing);
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Announcement updated!");
    } else {
      const { error } = await supabase.from("announcements").insert({
        title: form.title,
        body: form.body,
        pinned: form.pinned,
        author_id: user.id,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Announcement posted!");
    }

    setForm({ title: "", body: "", pinned: false });
    setShowForm(false);
    setEditing(null);
    loadAnnouncements();
  }

  async function deleteAnnouncement(id) {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    loadAnnouncements();
  }

  async function togglePin(a) {
    await supabase
      .from("announcements")
      .update({ pinned: !a.pinned })
      .eq("id", a.id);
    loadAnnouncements();
  }

  return (
    <Layout title="Announcements">
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
        {showForm && !editing ? "Cancel" : "+ New announcement"}
      </button>

      {showForm && (
        <form onSubmit={save} style={formCard}>
          <h3 style={formTitle}>
            {editing ? "Edit announcement" : "New announcement"}
          </h3>

          <label style={lbl}>Title</label>
          <input
            style={inp}
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Club day this Saturday!"
          />

          <label style={lbl}>Message</label>
          <textarea
            style={{ ...inp, minHeight: 120, resize: "vertical" }}
            required
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Write your announcement here..."
          />

          <label style={checkRow}>
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) =>
                setForm((f) => ({ ...f, pinned: e.target.checked }))
              }
            />
            <span style={lbl}>Pin to top of news feed</span>
          </label>

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
              {editing ? "Save changes" : "Post announcement"}
            </button>
          </div>
        </form>
      )}

      {announcements.length === 0 && !showForm && (
        <p style={{ color: "#6b7280" }}>No announcements yet.</p>
      )}

      {announcements.map((a) => (
        <div key={a.id} style={announcementCard}>
          <div style={cardTop}>
            <div style={{ flex: 1 }}>
              {a.pinned && <span style={pinBadge}>📌 Pinned</span>}
              <div style={cardTitle}>{a.title}</div>
              <div style={cardMeta}>
                {a.profiles?.full_name} ·{" "}
                {new Date(a.created_at).toLocaleDateString("en-NZ", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {a.updated_at !== a.created_at && " · edited"}
              </div>
            </div>
          </div>

          <div style={cardBody}>{a.body}</div>

          <div style={cardActions}>
            <button style={actionBtn} onClick={() => togglePin(a)}>
              {a.pinned ? "📌 Unpin" : "📌 Pin"}
            </button>
            <button style={actionBtn} onClick={() => startEdit(a)}>
              ✏️ Edit
            </button>
            <button
              style={{ ...actionBtn, color: "#dc2626" }}
              onClick={() => deleteAnnouncement(a.id)}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      ))}
    </Layout>
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
const checkRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
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
const announcementCard = {
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
const pinBadge = {
  fontSize: 11,
  background: "#fef3c7",
  color: "#92400e",
  padding: "1px 6px",
  borderRadius: 4,
  marginBottom: 4,
  display: "inline-block",
};
const cardTitle = { fontWeight: 700, fontSize: 16, color: "#1a2e1a" };
const cardMeta = { fontSize: 12, color: "#9ca3af", marginTop: 2 };
const cardBody = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  margin: "0.5rem 0",
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
