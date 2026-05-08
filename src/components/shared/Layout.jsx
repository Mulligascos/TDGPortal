import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const memberNav = [
  { to: "/", label: "Home", icon: "⛳" },
  { to: "/round/new", label: "New round", icon: "📋" },
  { to: "/history", label: "History", icon: "📊" },
  { to: "/bag-tags", label: "Bag tags", icon: "🏷️" },
  { to: "/news", label: "News", icon: "📣" },
  { to: "/reports", label: "Report", icon: "🚩" },
];

export default function Layout({ children, title }) {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();

  return (
    <div style={styles.shell}>
      {/* Top bar */}
      <header style={styles.header}>
        <span style={styles.clubName}>🥏 Timaru Disc Golf</span>
        <div style={styles.headerRight}>
          {isAdmin && (
            <Link to="/admin" style={styles.adminLink}>
              Admin
            </Link>
          )}
          <span style={styles.memberName}>
            {profile?.nickname || profile?.full_name}
          </span>
          <button onClick={signOut} style={styles.signOutBtn}>
            Sign out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main style={styles.main}>
        {title && <h1 style={styles.pageTitle}>{title}</h1>}
        {children}
      </main>

      {/* Bottom nav */}
      <nav style={styles.bottomNav}>
        {memberNav.map(({ to, label, icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              style={{ ...styles.navItem, ...(active ? styles.navActive : {}) }}
            >
              <span style={styles.navIcon}>{icon}</span>
              <span style={styles.navLabel}>{label}</span>
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
