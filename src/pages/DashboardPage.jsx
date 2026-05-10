// ── DashboardPage ─────────────────────────────────────────
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useDarkMode } from "../hooks/useDarkMode";
import { getTheme } from "../lib/theme";
import Layout from "../components/shared/Layout";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
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
        .order("played_at", { ascending: false })
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
      <Link
        to="/round/new"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: t.accent,
          color: "#fff",
          padding: "1rem 1.25rem",
          borderRadius: 12,
          textDecoration: "none",
          marginBottom: "0.75rem",
        }}
      >
        <span style={{ fontSize: 32 }}>🥏</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Start a new round</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
            Strokeplay or matchplay
          </div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 20, opacity: 0.7 }}>
          →
        </span>
      </Link>

      {profile?.bag_tag_number && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: t.card,
            borderRadius: 10,
            padding: "0.875rem 1rem",
            marginBottom: "1rem",
            boxShadow: t.shadow,
          }}
        >
          <span style={{ fontSize: 28 }}>🏷️</span>
          <div>
            <div style={{ fontSize: 12, color: t.textSub }}>Your bag tag</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.accentText }}>
              #{profile.bag_tag_number}
            </div>
          </div>
        </div>
      )}

      {announcements.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              marginTop: "0.5rem",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              Latest news
            </span>
            <Link
              to="/news"
              style={{
                fontSize: 13,
                color: t.accentText,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              See all →
            </Link>
          </div>
          {announcements.map((a) => (
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
                    color: "#92400e",
                    background: "#fef3c7",
                    padding: "1px 6px",
                    borderRadius: 4,
                    marginBottom: 4,
                    display: "inline-block",
                  }}
                >
                  📌 Pinned
                </span>
              )}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: t.text,
                  marginBottom: 4,
                }}
              >
                {a.title}
              </div>
              <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.4 }}>
                {a.body.slice(0, 120)}
                {a.body.length > 120 ? "…" : ""}
              </div>
            </div>
          ))}
        </>
      )}

      {recentRounds.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              marginTop: "0.5rem",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>
              Recent rounds
            </span>
            <Link
              to="/history"
              style={{
                fontSize: 13,
                color: t.accentText,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              See all →
            </Link>
          </div>
          {recentRounds.map((r) => (
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
                  {r.layouts?.layout_name} · {r.format}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontSize: 13, color: t.textSub, marginBottom: 4 }}
                >
                  {new Date(r.played_at).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
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
