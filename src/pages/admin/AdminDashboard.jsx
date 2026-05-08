import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    members: 0,
    openReports: 0,
    announcements: 0,
    events: 0,
  });
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("announcements")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("event_date", new Date().toISOString()),
    ]).then(([members, reports, announcements, events]) => {
      setStats({
        members: members.count ?? 0,
        openReports: reports.count ?? 0,
        announcements: announcements.count ?? 0,
        events: events.count ?? 0,
      });
    });
  }, []);

  const sections = [
    {
      to: "/admin/members",
      icon: "👥",
      label: "Members",
      sub: `${stats.members} total`,
      color: "#ede9fe",
      border: "#7c3aed",
      darkColor: "#1a0a35",
      darkBorder: "#7c3aed",
    },
    {
      to: "/admin/courses",
      icon: "🗺️",
      label: "Courses",
      sub: "Manage courses & layouts",
      color: "#e0f2fe",
      border: "#0284c7",
      darkColor: "#000a1a",
      darkBorder: "#0284c7",
    },
    {
      to: "/admin/bag-tags",
      icon: "🏷️",
      label: "Bag tags",
      sub: "Assign & track tags",
      color: "#dcfce7",
      border: "#16a34a",
      darkColor: "#001a0d",
      darkBorder: "#16a34a",
    },
    {
      to: "/admin/announcements",
      icon: "📣",
      label: "Announcements",
      sub: `${stats.announcements} posted`,
      color: "#fef9c3",
      border: "#ca8a04",
      darkColor: "#1a1500",
      darkBorder: "#ca8a04",
    },
    {
      to: "/admin/events",
      icon: "📅",
      label: "Events",
      sub: `${stats.events} upcoming`,
      color: "#fff7ed",
      border: "#ea580c",
      darkColor: "#1a0800",
      darkBorder: "#ea580c",
    },
    {
      to: "/admin/reports",
      icon: "🚩",
      label: "Reports",
      sub: `${stats.openReports} open`,
      color: "#fef2f2",
      border: "#dc2626",
      darkColor: "#1a0000",
      darkBorder: "#dc2626",
    },
  ];

  return (
    <Layout title="Admin panel">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem 1rem",
              borderRadius: 12,
              border: `2px solid ${darkMode ? s.darkBorder : s.border}`,
              background: darkMode ? s.darkColor : s.color,
              textDecoration: "none",
              gap: 6,
              minHeight: 110,
            }}
          >
            <div style={{ fontSize: 32 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>
              {s.label}
            </div>
            <div
              style={{ fontSize: 12, color: t.textSub, textAlign: "center" }}
            >
              {s.sub}
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}

const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const card = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem 1rem",
  borderRadius: 12,
  border: "2px solid",
  textDecoration: "none",
  gap: 6,
  minHeight: 110,
};
const icon = { fontSize: 32 };
const cardLabel = { fontWeight: 700, fontSize: 15, color: "#1a2e1a" };
const cardSub = { fontSize: 12, color: "#6b7280", textAlign: "center" };
