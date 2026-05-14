import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

const memberNav = [
  { to: "/", label: "Home", icon: "⛳" },
  { to: "/round/new", label: "New round", icon: "📋" },
  { to: "/history", label: "History", icon: "📊" },
  { to: "/tournaments", label: "Tournaments", icon: "🏆" },
  { to: "/bag-tags", label: "Bag tags", icon: "🏷️" },
  { to: "/reports", label: "Report", icon: "🚩" },
];

export default function Layout({ children, title }) {
  const { profile, isAdmin, signOut } = useAuth();
  const { darkMode, toggleDark } = useDarkMode();
  const location = useLocation();
  const t = getTheme(darkMode);
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: t.bg,
      }}
    >
      {/* Top bar */}
      <header
        style={{
          background: t.header,
          color: "#fff",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          Timaru Disc Golf Portal
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleDark}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "3px 7px",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              style={{
                color: "#a7f3c0",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                background: "rgba(255,255,255,0.15)",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              Admin
            </Link>
          )}
          <span style={{ fontSize: 16, opacity: 0.85 }}>
            {profile?.nickname || profile?.full_name}
          </span>
          <button
            onClick={signOut}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.4)",
              color: "#fff",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main
        style={{
          flex: 1,
          padding: "1rem",
          paddingBottom: "80px",
          maxWidth: 680,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {title && (
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: t.text,
              margin: "0 0 1.25rem",
            }}
          >
            {title}
          </h1>
        )}
        {children}
      </main>

      {/* Bottom nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: t.nav,
          borderTop: `1px solid ${t.navBorder}`,
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 0 12px",
          zIndex: 100,
        }}
      >
        {memberNav.map(({ to, label, icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                textDecoration: "none",
                color: active ? t.accentText : t.textSub,
                minWidth: 52,
              }}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f0f4f0",
  },
  header: {
    background: "#1d6b3a",
    color: "#fff",
    padding: "0.75rem 1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clubName: { fontWeight: 700, fontSize: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  adminLink: {
    color: "#a7f3c0",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    background: "rgba(255,255,255,0.15)",
    padding: "2px 8px",
    borderRadius: 4,
  },
  memberName: { fontSize: 13, opacity: 0.85 },
  signOutBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.4)",
    color: "#fff",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 12,
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: "1rem",
    paddingBottom: "80px",
    maxWidth: 680,
    width: "100%",
    margin: "0 auto",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: "#1a2e1a",
    margin: "0 0 1.25rem",
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-around",
    padding: "8px 0 12px",
    zIndex: 100,
  },
  navItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    textDecoration: "none",
    color: "#6b7280",
    minWidth: 52,
  },
  navActive: { color: "#1d6b3a" },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, fontWeight: 500 },
};
