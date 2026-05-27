import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";
import { useAppData } from "../../hooks/useAppData";

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    nickname: "",
    email: "",
    password: "",
    role: "member",
    default_division: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const { refresh } = useAppData();

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    setMembers(data ?? []);
  }

  function startNew() {
    setEditing(null);
    setForm({
      full_name: "",
      nickname: "",
      email: "",
      password: "",
      role: "member",
      default_division: "",
    });
    setShowForm(true);
    setError(null);
    window.scrollTo(0, 0);
  }

  function startEdit(member) {
    setEditing(member);
    setForm({
      full_name: member.full_name,
      nickname: member.nickname ?? "",
      email: member.email,
      password: "",
      role: member.role,
      default_division: member.default_division ?? "",
    });
    setShowForm(true);
    setError(null);
    window.scrollTo(0, 0);
  }

  function cancel() {
    setShowForm(false);
    setEditing(null);
    setError(null);
    setForm({
      full_name: "",
      nickname: "",
      email: "",
      password: "",
      role: "member",
      default_division: "",
    });
  }

  async function createMember(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const {
      data: { session: adminSession },
    } = await supabase.auth.getSession();

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }

    setTimeout(async () => {
      await supabase
        .from("profiles")
        .update({
          nickname: form.nickname || null,
          role: form.role,
          default_division: form.default_division || null,
        })
        .eq("email", form.email);
    }, 1500);

    setSuccess(
      `${form.full_name} added. They can now sign in with their email and password.`,
    );
    cancel();
    setLoading(false);
    setTimeout(loadMembers, 2000);
  }

  async function updateMember(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        nickname: form.nickname || null,
        role: form.role,
        default_division: form.default_division || null,
      })
      .eq("id", editing.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    if (form.password) {
      setSuccess(
        `${form.full_name} updated. To change their password go to Supabase → Authentication → Users → ${form.email} → Send password reset.`,
      );
    } else {
      setSuccess(`${form.full_name} updated successfully.`);
    }

    cancel();
    setLoading(false);
    loadMembers();
  }

  async function deleteMember(member) {
    if (!confirm(`Remove ${member.full_name} from the club?`)) return;
    await supabase.from("profiles").delete().eq("id", member.id);
    loadMembers();
    refresh("members");
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    return Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  }

  const addBtn = {
    padding: "0.625rem 1.25rem",
    background: "#1d6b3a",
    color: t.card,
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    marginBottom: "0.75rem",
  };
  const formCard = {
    background: t.card,
    borderRadius: 12,
    padding: "1.25rem",
    marginBottom: "1rem",
    boxShadow: t.shadow,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
  const formTitle = {
    margin: "0 0 0.25rem",
    fontSize: 16,
    fontWeight: 600,
    color: t.text,
  };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#374151" };
  const editNote = { fontSize: 11, color: "#9ca3af", fontWeight: 400 };
  const inp = {
    padding: "0.625rem 0.75rem",
    borderRadius: 8,
    border: `1.5px solid ${t.border}`,
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    background: t.card,
  };
  const disabledInp = { background: "#f9fafb", color: "#9ca3af" };
  const genBtn = {
    padding: "0.625rem 0.875rem",
    background: "#f3f4f6",
    border: `1.5px solid ${t.border}`,
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
  };
  const pwHint = {
    fontSize: 13,
    color: "#374151",
    background: "#f0faf4",
    padding: "0.5rem 0.75rem",
    borderRadius: 6,
    lineHeight: 1.5,
  };
  const btnRow = {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  };
  const submitBtn = {
    padding: "0.625rem 1.25rem",
    background: "#1d6b3a",
    color: t.card,
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
  const memberCard = {
    background: t.card,
    borderRadius: 10,
    padding: "0.75rem 1rem",
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    gap: 8,
  };
  const cardLeft = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  };
  const cardRight = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  };
  const avatar = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1d6b3a",
    color: t.card,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  };
  const nameStyle = { fontWeight: 600, fontSize: 15, color: t.text };
  const fullNameStyle = { fontSize: 11, color: "#9ca3af" };
  const emailStyle = { fontSize: 12, color: t.textSub };
  const tagStyle = { fontSize: 12, color: "#1d6b3a", fontWeight: 600 };
  const roleBadge = {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
  };
  const adminBadge = { background: "#ede9fe", color: "#7c3aed" };
  const memberBadge = { background: "#f3f4f6", color: t.textSub };
  const editBtn = {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 4,
    border: `1px solid ${t.border}`,
    background: t.card,
    cursor: "pointer",
    color: "#374151",
  };
  const deleteBtn = {
    padding: "4px 8px",
    background: t.card,
    border: "1px solid #fca5a5",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
  };
  const successBox = {
    background: t.successLight,
    color: t.success,
    padding: "0.75rem 1rem",
    borderRadius: 8,
    marginBottom: "0.75rem",
    fontSize: 14,
    cursor: "pointer",
  };
  const errorBox = {
    background: t.dangerLight,
    color: t.danger,
    padding: "0.75rem 1rem",
    borderRadius: 8,
    marginBottom: "0.75rem",
    fontSize: 14,
    cursor: "pointer",
  };

  return (
    <Layout title="Members">
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
        onClick={() => (showForm && !editing ? cancel() : startNew())}
      >
        {showForm && !editing ? "Cancel" : "+ Add member"}
      </button>

      {showForm && (
        <form onSubmit={editing ? updateMember : createMember} style={formCard}>
          <h3 style={formTitle}>
            {editing ? `Edit — ${editing.full_name}` : "New member"}
          </h3>

          <label style={lbl}>Full name</label>
          <input
            style={inp}
            required
            value={form.full_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, full_name: e.target.value }))
            }
            placeholder="e.g. Jane Smith"
          />

          <label style={lbl}>
            Nickname{" "}
            <span style={editNote}>
              (used as display name throughout the app)
            </span>
          </label>
          <input
            style={inp}
            value={form.nickname}
            onChange={(e) =>
              setForm((f) => ({ ...f, nickname: e.target.value }))
            }
            placeholder="e.g. Janie (optional — full name used if blank)"
          />

          <label style={lbl}>
            Email {editing && <span style={editNote}>(cannot be changed)</span>}
          </label>
          <input
            style={{ ...inp, ...(editing ? disabledInp : {}) }}
            type="email"
            required
            value={form.email}
            disabled={!!editing}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="jane@example.com"
          />

          <label style={lbl}>
            {editing ? "New password " : "Password "}
            {editing && (
              <span style={editNote}>(leave blank to keep current)</span>
            )}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inp, flex: 1 }}
              required={!editing}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder={
                editing ? "Leave blank to keep current" : "Min 6 characters"
              }
            />
            <button
              type="button"
              style={genBtn}
              onClick={() =>
                setForm((f) => ({ ...f, password: generatePassword() }))
              }
            >
              Generate
            </button>
          </div>
          {form.password && (
            <div style={pwHint}>
              Password: <strong>{form.password}</strong> — share this with the
              member
            </div>
          )}

          <label style={lbl}>Role</label>
          <select
            style={inp}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>

          <label style={lbl}>
            Default division{" "}
            <span style={editNote}>(used as default for tournaments)</span>
          </label>
          <input
            style={inp}
            value={form.default_division}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_division: e.target.value }))
            }
            placeholder="e.g. Open, Women's, Junior (optional)"
          />

          <div style={btnRow}>
            <button type="button" style={cancelBtn} onClick={cancel}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={submitBtn}>
              {loading ? "Saving…" : editing ? "Save changes" : "Create member"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: "0.5rem" }}>
        {members.length === 0 && (
          <p style={{ color: t.textSub }}>No members yet.</p>
        )}
        {members.map((m) => (
          <div key={m.id} style={memberCard}>
            <div style={cardLeft}>
              <div style={avatar}>
                {(m.nickname || m.full_name)?.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={nameStyle}>{m.nickname || m.full_name}</div>
                {m.nickname && <div style={fullNameStyle}>{m.full_name}</div>}
                <div style={emailStyle}>{m.email}</div>
                {m.default_division && (
                  <div style={{ fontSize: 11, color: t.textSub }}>
                    {m.default_division}
                  </div>
                )}
              </div>
            </div>
            <div style={cardRight}>
              {m.bag_tag_number && (
                <span style={tagStyle}>🏷️ #{m.bag_tag_number}</span>
              )}
              <span
                style={{
                  ...roleBadge,
                  ...(m.role === "admin" ? adminBadge : memberBadge),
                }}
              >
                {m.role}
              </span>
              <button style={editBtn} onClick={() => startEdit(m)}>
                ✏️ Edit
              </button>
              <button style={deleteBtn} onClick={() => deleteMember(m)}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
