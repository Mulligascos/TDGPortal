import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🥏</div>
        <h1 style={styles.title}>Disc Golf Club</h1>

        {sent ? (
          <div style={styles.sentBox}>
            <div style={styles.sentIcon}>📬</div>
            <p style={styles.sentText}>Check your email</p>
            <p style={styles.sentSub}>
              We sent a sign-in link to <strong>{email}</strong>. Tap it to
              continue — the link expires in 1 hour.
            </p>
            <p style={styles.sentSub2}>
              Wrong address?{" "}
              <button style={styles.linkBtn} onClick={() => setSent(false)}>
                Try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <p style={styles.intro}>
              Enter your email and we'll send you a sign-in link. New members
              are set up by the club admin.
            </p>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} style={styles.btn}>
              {loading ? "Sending…" : "Email me a sign-in link"}
            </button>
            <p style={styles.hint}>No password needed — works on any device.</p>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f4f0",
    padding: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
    textAlign: "center",
  },
  logo: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: 600,
    margin: "0 0 2rem",
    color: "#1a2e1a",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "left",
  },
  label: { fontSize: 14, fontWeight: 500, color: "#374151" },
  input: {
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "1.5px solid #d1d5db",
    fontSize: 16,
    outline: "none",
  },
  btn: {
    padding: "0.875rem",
    borderRadius: 8,
    background: "#1d6b3a",
    color: "#fff",
    fontWeight: 600,
    fontSize: 16,
    border: "none",
    cursor: "pointer",
    marginTop: 4,
  },
  error: { color: "#dc2626", fontSize: 14, margin: 0 },
  hint: { fontSize: 13, color: "#6b7280", textAlign: "center", margin: 0 },
  sentBox: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
  },
  sentIcon: { fontSize: 40 },
  sentText: { fontSize: 20, fontWeight: 600, color: "#1d6b3a", margin: 0 },
  sentSub: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 1.5,
    margin: 0,
    textAlign: "center",
  },
  sentSub2: { fontSize: 13, color: "#6b7280", margin: 0 },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#1d6b3a",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "underline",
    padding: 0,
  },
  intro: { fontSize: 14, color: "#6b7280", margin: "0 0 4px", lineHeight: 1.5 },
};
