import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Layout from "../../components/shared/Layout";

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "member",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  async function createMember(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (form.role === "admin") {
      setTimeout(async () => {
        await supabase
          .from("profiles")
          .update({ role: "admin" })
          .eq("email", form.email);
      }, 1500);
    }

    setSuccess(
      `${form.full_name} added. They can now sign in with their email and password.`,
    );
    setForm({ full_name: "", email: "", password: "", role: "member" });
    setShowForm(false);
    setLoading(false);
    setTimeout(loadMembers, 1000);
  }

  async function toggleRole(member) {
    const newRole = member.role === "admin" ? "member" : "admin";
    await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", member.id);
    loadMembers();
  }

  async function deleteMember(member) {
    if (!confirm(`Remove ${member.full_name} from the club?`)) return;
    await supabase.from("profiles").delete().eq("id", member.id);
    loadMembers();
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    return Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  }

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
        onClick={() => {
          setShowForm((s) => !s);
          setError(null);
        }}
      >
        {showForm ? "Cancel" : "+ Add member"}
      </button>

      {showForm && (
        <form onSubmit={createMember} style={formCard}>
          <h3 style={formTitle}>New member</h3>

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

          <label style={lbl}>Email</label>
          <input
            style={inp}
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="jane@example.com"
          />

          <label style={lbl}>Password</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inp, flex: 1 }}
              required
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder="Min 6 characters"
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

          <button type="submit" disabled={loading} style={submitBtn}>
            {loading ? "Creating…" : "Create member"}
          </button>
        </form>
      )}

      <div style={{ marginTop: "0.5rem" }}>
        {members.length === 0 && (
          <p style={{ color: "#6b7280" }}>No members yet.</p>
        )}
        {members.map((m) => (
          <div key={m.id} style={memberCard}>
            <div style={cardLeft}>
              <div style={avatar}>{m.full_name?.charAt(0).toUpperCase()}</div>
              <div>
                <div style={nameStyle}>{m.full_name}</div>
                <div style={emailStyle}>{m.email}</div>
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
              <button style={roleToggle} onClick={() => toggleRole(m)}>
                {m.role === "admin" ? "→ Member" : "→ Admin"}
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
};
const genBtn = {
  padding: "0.625rem 0.875rem",
  background: "#f3f4f6",
  border: "1.5px solid #d1d5db",
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
const submitBtn = {
  padding: "0.75rem",
  background: "#1d6b3a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 4,
};
const memberCard = {
  background: "#fff",
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
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: 16,
  flexShrink: 0,
};
const nameStyle = {
  fontWeight: 600,
  fontSize: 15,
  color: "#1a2e1a",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const emailStyle = { fontSize: 12, color: "#6b7280" };
const tagStyle = { fontSize: 12, color: "#1d6b3a", fontWeight: 600 };
const roleBadge = {
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 4,
};
const adminBadge = { background: "#ede9fe", color: "#7c3aed" };
const memberBadge = { background: "#f3f4f6", color: "#6b7280" };
const roleToggle = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 4,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  color: "#374151",
  whiteSpace: "nowrap",
};
const deleteBtn = {
  padding: "2px 6px",
  background: "#fff",
  border: "1px solid #fca5a5",
  borderRadius: 6,
  fontSize: 13,
  cursor: "pointer",
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
