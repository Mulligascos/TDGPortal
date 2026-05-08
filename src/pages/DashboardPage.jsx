// ── DashboardPage ─────────────────────────────────────────
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import Layout from "../components/shared/Layout";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [recentRounds, setRecentRounds] = useState([]);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setAnnouncements(data ?? []));

    if (profile) {
      supabase
        .from("round_players")
        .select(
          "rounds(id, played_at, status, format, courses(name), layouts(layout_name))",
        )
        .eq("player_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }) =>
          setRecentRounds(data?.map((r) => r.rounds).filter(Boolean) ?? []),
        );
    }
  }, [profile]);

  return (
    <Layout
      title={`G'day, ${profile?.nickname || profile?.full_name?.split(" ")[0] || "Mate"} 👋`}
    >
      {/* Quick actions */}
      <Link to="/round/new" style={styles.bigCta}>
        <span style={styles.ctaIcon}>🥏</span>
        <div>
          <div style={styles.ctaTitle}>Start a new round</div>
          <div style={styles.ctaSub}>Strokeplay or matchplay</div>
        </div>
        <span style={styles.ctaArrow}>→</span>
      </Link>

      {profile?.bag_tag_number && (
        <div style={styles.tagCard}>
          <span style={styles.tagIcon}>🏷️</span>
          <div>
            <div style={styles.tagLabel}>Your bag tag</div>
            <div style={styles.tagNum}>#{profile.bag_tag_number}</div>
          </div>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <>
          <div style={styles.sectionHead}>
            <span>Latest news</span>
            <Link to="/news" style={styles.seeAll}>
              See all →
            </Link>
          </div>
          {announcements.map((a) => (
            <div key={a.id} style={styles.newsCard}>
              {a.pinned && <span style={styles.pinBadge}>📌 Pinned</span>}
              <div style={styles.newsTitle}>{a.title}</div>
              <div style={styles.newsBody}>
                {a.body.slice(0, 120)}
                {a.body.length > 120 ? "…" : ""}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Recent rounds */}
      {recentRounds.length > 0 && (
        <>
          <div style={styles.sectionHead}>
            <span>Recent rounds</span>
            <Link to="/history" style={styles.seeAll}>
              See all →
            </Link>
          </div>
          {recentRounds.map((r) => (
            <Link key={r.id} to={`/round/${r.id}`} style={styles.roundCard}>
              <div>
                <div style={styles.roundCourse}>{r.courses?.name}</div>
                <div style={styles.roundSub}>
                  {r.layouts?.layout_name} · {r.format}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={styles.roundDate}>
                  {new Date(r.played_at).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <div
                  style={{
                    ...styles.statusBadge,
                    ...(r.status === "complete"
                      ? styles.statusDone
                      : styles.statusProg),
                  }}
                >
                  {r.status === "complete" ? "Complete" : "In progress"}
                </div>
              </div>
            </Link>
          ))}
        </>
      )}
    </Layout>
  );
}

const styles = {
  bigCta: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#1d6b3a",
    color: "#fff",
    padding: "1rem 1.25rem",
    borderRadius: 12,
    textDecoration: "none",
    marginBottom: "0.75rem",
  },
  ctaIcon: { fontSize: 32 },
  ctaTitle: { fontWeight: 700, fontSize: 17 },
  ctaSub: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  ctaArrow: { marginLeft: "auto", fontSize: 20, opacity: 0.7 },
  tagCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#fff",
    borderRadius: 10,
    padding: "0.875rem 1rem",
    marginBottom: "1rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  tagIcon: { fontSize: 28 },
  tagLabel: { fontSize: 12, color: "#6b7280" },
  tagNum: { fontSize: 22, fontWeight: 800, color: "#1d6b3a" },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: "0.5rem",
  },
  seeAll: {
    fontSize: 13,
    color: "#1d6b3a",
    textDecoration: "none",
    fontWeight: 500,
  },
  newsCard: {
    background: "#fff",
    borderRadius: 10,
    padding: "0.875rem 1rem",
    marginBottom: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  pinBadge: {
    fontSize: 11,
    color: "#92400e",
    background: "#fef3c7",
    padding: "1px 6px",
    borderRadius: 4,
    marginBottom: 4,
    display: "inline-block",
  },
  newsTitle: {
    fontWeight: 600,
    fontSize: 15,
    color: "#1a2e1a",
    marginBottom: 4,
  },
  newsBody: { fontSize: 14, color: "#6b7280", lineHeight: 1.4 },
  roundCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff",
    borderRadius: 10,
    padding: "0.875rem 1rem",
    marginBottom: 8,
    textDecoration: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  roundCourse: { fontWeight: 600, fontSize: 15, color: "#1a2e1a" },
  roundSub: { fontSize: 13, color: "#6b7280", textTransform: "capitalize" },
  roundDate: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 6px",
    borderRadius: 4,
  },
  statusDone: { background: "#dcfce7", color: "#15803d" },
  statusProg: { background: "#fef9c3", color: "#a16207" },
};
