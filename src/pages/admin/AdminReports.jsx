import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

const TYPE_LABELS = {
  hazard: "⚠️ Hazard",
  lost_disc: "💿 Lost disc",
  found_disc: "🟢 Found disc",
  suggestion: "💡 Suggestion",
};

const STATUS_COLOURS = {
  open: { background: "#fef9c3", color: "#a16207" },
  in_progress: { background: "#e0f2fe", color: "#0369a1" },
  resolved: { background: "t.succesLight", color: "t.success" },
};

export default function AdminReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("open");
  const [updating, setUpdating] = useState(null);
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);

  useEffect(() => {
    loadReports();
  }, [filter]);

  async function loadReports() {
    let query = supabase
      .from("reports")
      .select("*, courses(name), profiles!reports_reported_by_fkey(full_name)")
      .order("created_at", { ascending: false });

    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setReports(data ?? []);
  }

  async function updateStatus(report, status) {
    setUpdating(report.id);
    await supabase
      .from("reports")
      .update({
        status,
        resolved_by: status === "resolved" ? user.id : null,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      })
      .eq("id", report.id);
    setUpdating(null);
    loadReports();
  }

  async function deleteReport(id) {
    if (!confirm("Delete this report?")) return;
    await supabase.from("reports").delete().eq("id", id);
    loadReports();
  }

  const counts = { open: 0, in_progress: 0, resolved: 0 };
  reports.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status]++;
  });

  const tabs = {
    display: "flex",
    gap: 6,
    marginBottom: "1rem",
    flexWrap: "wrap",
  };
  const tab = {
    padding: "0.4rem 0.875rem",
    borderRadius: 20,
    border: "1.5px solid t.border",
    background: "#fff",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    color: t.textSub,
  };
  const tabActive = {
    borderColor: "#1d6b3a",
    background: "#f0faf4",
    color: "#1d6b3a",
    fontWeight: 700,
  };
  const card = {
    background: "#fff",
    borderRadius: 12,
    padding: "1rem",
    marginBottom: 10,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  };
  const cardHeader = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  };
  const cardLeft = {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  };
  const typeBadge = {
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
    background: "#f3f4f6",
    color: "#374151",
  };
  const statusBadge = {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 4,
  };
  const cardDate = { fontSize: 12, color: "#9ca3af" };
  const cardBody = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
  };
  const cardMeta = { fontSize: 13, color: t.textSub };
  const cardDesc = {
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.5,
    marginTop: 4,
  };
  const cardActions = {
    display: "flex",
    gap: 6,
    borderTop: "1px solid #f3f4f6",
    paddingTop: 8,
    flexWrap: "wrap",
  };
  const actionBtn = {
    padding: "4px 10px",
    background: "#f9fafb",
    border: "1px solid t.border",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#374151",
  };

  return (
    <Layout title="Reports">
      {/* Filter tabs */}
      <div style={tabs}>
        {["open", "in_progress", "resolved", "all"].map((s) => (
          <button
            key={s}
            style={{ ...tab, ...(filter === s ? tabActive : {}) }}
            onClick={() => setFilter(s)}
          >
            {s === "in_progress"
              ? "In progress"
              : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {reports.length === 0 && (
        <p style={{ color: t.textSub }}>
          No {filter === "all" ? "" : filter} reports.
        </p>
      )}

      {reports.map((r) => (
        <div key={r.id} style={card}>
          {/* Header */}
          <div style={cardHeader}>
            <div style={cardLeft}>
              <span style={typeBadge}>{TYPE_LABELS[r.type] ?? r.type}</span>
              <span style={{ ...statusBadge, ...STATUS_COLOURS[r.status] }}>
                {r.status === "in_progress"
                  ? "In progress"
                  : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
              </span>
            </div>
            <div style={cardDate}>
              {new Date(r.created_at).toLocaleDateString("en-NZ", {
                day: "numeric",
                month: "short",
              })}
            </div>
          </div>

          {/* Details */}
          <div style={cardBody}>
            {r.courses && (
              <div style={cardMeta}>
                📍 {r.courses.name}
                {r.hole_number ? ` · Hole ${r.hole_number}` : ""}
              </div>
            )}
            <div style={cardMeta}>👤 {r.profiles?.full_name ?? "Unknown"}</div>
            <div style={cardDesc}>{r.description}</div>
          </div>

          {/* Actions */}
          <div style={cardActions}>
            {r.status !== "open" && (
              <button
                style={actionBtn}
                disabled={updating === r.id}
                onClick={() => updateStatus(r, "open")}
              >
                Mark open
              </button>
            )}
            {r.status !== "in_progress" && (
              <button
                style={{ ...actionBtn, ...STATUS_COLOURS.in_progress }}
                disabled={updating === r.id}
                onClick={() => updateStatus(r, "in_progress")}
              >
                In progress
              </button>
            )}
            {r.status !== "resolved" && (
              <button
                style={{ ...actionBtn, ...STATUS_COLOURS.resolved }}
                disabled={updating === r.id}
                onClick={() => updateStatus(r, "resolved")}
              >
                ✓ Resolved
              </button>
            )}
            <button
              style={{ ...actionBtn, color: "t.danger", marginLeft: "auto" }}
              onClick={() => deleteReport(r.id)}
            >
              🗑 Delete
            </button>
          </div>
        </div>
      ))}
    </Layout>
  );
}
