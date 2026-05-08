import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [layouts, setLayouts] = useState({});
  const [courseForm, setCourseForm] = useState({ name: "", location: "" });
  const [layoutForm, setLayoutForm] = useState({
    layout_name: "",
    number_of_holes: 9,
    loops: 1,
    par_json: "",
  });
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingLayout, setEditingLayout] = useState(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showLayoutForm, setShowLayoutForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    const { data } = await supabase.from("courses").select("*").order("name");
    setCourses(data ?? []);
  }

  async function loadLayouts(courseId) {
    const { data } = await supabase
      .from("layouts")
      .select("*")
      .eq("course_id", courseId)
      .order("layout_name");
    setLayouts((prev) => ({ ...prev, [courseId]: data ?? [] }));
  }

  function toggleCourse(courseId) {
    if (expanded === courseId) {
      setExpanded(null);
    } else {
      setExpanded(courseId);
      loadLayouts(courseId);
    }
    setShowLayoutForm(null);
    setEditingLayout(null);
  }

  function startNewCourse() {
    setEditingCourse(null);
    setCourseForm({ name: "", location: "" });
    setShowCourseForm(true);
    setError(null);
    window.scrollTo(0, 0);
  }

  function startEditCourse(course, e) {
    e.stopPropagation();
    setEditingCourse(course);
    setCourseForm({ name: course.name, location: course.location ?? "" });
    setShowCourseForm(true);
    setError(null);
    window.scrollTo(0, 0);
  }

  function cancelCourseForm() {
    setShowCourseForm(false);
    setEditingCourse(null);
    setCourseForm({ name: "", location: "" });
    setError(null);
  }

  function startNewLayout(courseId) {
    setEditingLayout(null);
    setLayoutForm({
      layout_name: "",
      number_of_holes: 9,
      loops: 1,
      par_json: "",
    });
    setShowLayoutForm(courseId);
    setError(null);
  }

  function startEditLayout(layout, e) {
    e.stopPropagation();
    setEditingLayout(layout);
    setLayoutForm({
      layout_name: layout.layout_name,
      number_of_holes: layout.number_of_holes,
      loops: layout.loops,
      par_json: layout.par_json.join(","),
    });
    setShowLayoutForm(layout.course_id);
    setError(null);
  }

  function cancelLayoutForm() {
    setShowLayoutForm(null);
    setEditingLayout(null);
    setLayoutForm({
      layout_name: "",
      number_of_holes: 9,
      loops: 1,
      par_json: "",
    });
    setError(null);
  }

  function parseParJson(str, holeCount) {
    const cleaned = str.trim();
    const arr = cleaned.startsWith("[")
      ? JSON.parse(cleaned)
      : cleaned.split(",").map((n) => parseInt(n.trim()));
    if (arr.some(isNaN)) throw new Error("invalid");
    if (arr.length !== parseInt(holeCount))
      throw new Error(`count mismatch: got ${arr.length}, need ${holeCount}`);
    return arr;
  }

  async function saveCourse(e) {
    e.preventDefault();
    setError(null);

    if (editingCourse) {
      const { error } = await supabase
        .from("courses")
        .update(courseForm)
        .eq("id", editingCourse.id);
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Course updated!");
    } else {
      const { error } = await supabase.from("courses").insert(courseForm);
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Course added!");
    }

    cancelCourseForm();
    loadCourses();
  }

  async function saveLayout(e, courseId) {
    e.preventDefault();
    setError(null);

    let parArray;
    try {
      parArray = parseParJson(layoutForm.par_json, layoutForm.number_of_holes);
    } catch (err) {
      setError(
        `Invalid par values — ${err.message}. Enter comma-separated numbers e.g. 3,4,3,3,4,3,4,3,3`,
      );
      return;
    }

    const payload = {
      layout_name: layoutForm.layout_name,
      number_of_holes: parseInt(layoutForm.number_of_holes),
      loops: parseInt(layoutForm.loops),
      par_json: parArray,
    };

    if (editingLayout) {
      const { error } = await supabase
        .from("layouts")
        .update(payload)
        .eq("id", editingLayout.id);
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Layout updated!");
    } else {
      const { error } = await supabase
        .from("layouts")
        .insert({ ...payload, course_id: courseId });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess("Layout added!");
    }

    cancelLayoutForm();
    loadLayouts(courseId);
  }

  async function deleteCourse(id, e) {
    e.stopPropagation();
    if (!confirm("Delete this course and all its layouts?")) return;
    await supabase.from("courses").delete().eq("id", id);
    loadCourses();
    setExpanded(null);
  }

  async function deleteLayout(id, courseId) {
    if (!confirm("Delete this layout?")) return;
    await supabase.from("layouts").delete().eq("id", id);
    loadLayouts(courseId);
  }

  const totalPar = (parArray, loops) =>
    parArray.reduce((a, b) => a + b, 0) * loops;

  return (
    <Layout title="Courses & layouts">
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
        onClick={() =>
          showCourseForm && !editingCourse
            ? cancelCourseForm()
            : startNewCourse()
        }
      >
        {showCourseForm && !editingCourse ? "Cancel" : "+ Add course"}
      </button>

      {showCourseForm && (
        <form onSubmit={saveCourse} style={formCard}>
          <h3 style={formTitle}>
            {editingCourse ? `Edit — ${editingCourse.name}` : "New course"}
          </h3>
          <label style={lbl}>Course name</label>
          <input
            style={inp}
            required
            value={courseForm.name}
            onChange={(e) =>
              setCourseForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="e.g. West End Park"
          />
          <label style={lbl}>Location</label>
          <input
            style={inp}
            value={courseForm.location}
            onChange={(e) =>
              setCourseForm((f) => ({ ...f, location: e.target.value }))
            }
            placeholder="e.g. Christchurch"
          />
          <div style={btnRow}>
            <button type="button" style={cancelBtn} onClick={cancelCourseForm}>
              Cancel
            </button>
            <button type="submit" style={submitBtn}>
              {editingCourse ? "Save changes" : "Save course"}
            </button>
          </div>
        </form>
      )}

      {courses.length === 0 && (
        <p style={{ color: "#6b7280" }}>No courses yet. Add one above.</p>
      )}

      {courses.map((course) => (
        <div key={course.id} style={courseCard}>
          <div style={courseHeader} onClick={() => toggleCourse(course.id)}>
            <div>
              <div style={courseName}>{course.name}</div>
              {course.location && (
                <div style={courseLoc}>{course.location}</div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                style={editBtn}
                onClick={(e) => startEditCourse(course, e)}
              >
                ✏️ Edit
              </button>
              <button
                style={deleteBtn}
                onClick={(e) => deleteCourse(course.id, e)}
              >
                🗑
              </button>
              <span style={chevron}>{expanded === course.id ? "▲" : "▼"}</span>
            </div>
          </div>

          {expanded === course.id && (
            <div style={layoutsSection}>
              <div style={layoutsHeader}>
                <span style={layoutsTitle}>Layouts</span>
                <button
                  style={addLayoutBtn}
                  onClick={() =>
                    showLayoutForm === course.id && !editingLayout
                      ? cancelLayoutForm()
                      : startNewLayout(course.id)
                  }
                >
                  {showLayoutForm === course.id && !editingLayout
                    ? "Cancel"
                    : "+ Add layout"}
                </button>
              </div>

              {showLayoutForm === course.id && (
                <form
                  onSubmit={(e) => saveLayout(e, course.id)}
                  style={layoutFormStyle}
                >
                  <h4
                    style={{
                      margin: "0 0 8px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1a2e1a",
                    }}
                  >
                    {editingLayout
                      ? `Edit — ${editingLayout.layout_name}`
                      : "New layout"}
                  </h4>

                  <label style={lbl}>Layout name</label>
                  <input
                    style={inp}
                    required
                    value={layoutForm.layout_name}
                    onChange={(e) =>
                      setLayoutForm((f) => ({
                        ...f,
                        layout_name: e.target.value,
                      }))
                    }
                    placeholder="e.g. 9 Hole, Competition, Short"
                  />

                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Number of holes</label>
                      <input
                        style={inp}
                        type="number"
                        min={1}
                        max={36}
                        required
                        value={layoutForm.number_of_holes}
                        onChange={(e) =>
                          setLayoutForm((f) => ({
                            ...f,
                            number_of_holes: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Loops</label>
                      <select
                        style={inp}
                        value={layoutForm.loops}
                        onChange={(e) =>
                          setLayoutForm((f) => ({
                            ...f,
                            loops: e.target.value,
                          }))
                        }
                      >
                        <option value={1}>1 (standard)</option>
                        <option value={2}>2 (play twice)</option>
                      </select>
                    </div>
                  </div>

                  <label style={lbl}>Par values (comma separated)</label>
                  <input
                    style={inp}
                    required
                    value={layoutForm.par_json}
                    onChange={(e) =>
                      setLayoutForm((f) => ({ ...f, par_json: e.target.value }))
                    }
                    placeholder={`${layoutForm.number_of_holes} values e.g. 3,4,3,3,4,3,4,3,3`}
                  />
                  <p style={parHint}>
                    Must have exactly {layoutForm.number_of_holes} values.
                  </p>

                  <div style={btnRow}>
                    <button
                      type="button"
                      style={cancelBtn}
                      onClick={cancelLayoutForm}
                    >
                      Cancel
                    </button>
                    <button type="submit" style={submitBtn}>
                      {editingLayout ? "Save changes" : "Save layout"}
                    </button>
                  </div>
                </form>
              )}

              {(layouts[course.id] ?? []).length === 0 && (
                <p
                  style={{
                    color: "#6b7280",
                    fontSize: 13,
                    padding: "0.5rem 0",
                  }}
                >
                  No layouts yet.
                </p>
              )}

              {(layouts[course.id] ?? []).map((layout) => (
                <div key={layout.id} style={layoutRow}>
                  <div>
                    <div style={layoutName}>{layout.layout_name}</div>
                    <div style={layoutSub}>
                      {layout.number_of_holes} holes
                      {layout.loops > 1
                        ? ` × ${layout.loops} loops = ${layout.number_of_holes * layout.loops} total`
                        : ""}
                      {" · "}Par {totalPar(layout.par_json, layout.loops)}
                    </div>
                    <div style={parDisplay}>{layout.par_json.join(" – ")}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      style={editBtn}
                      onClick={(e) => startEditLayout(layout, e)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      style={deleteBtn}
                      onClick={() => deleteLayout(layout.id, course.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
  gap: 8,
};
const formTitle = {
  margin: "0 0 0.5rem",
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
const btnRow = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: 4,
};
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
const courseCard = {
  background: "#fff",
  borderRadius: 12,
  marginBottom: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  overflow: "hidden",
};
const courseHeader = {
  padding: "1rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};
const courseName = { fontWeight: 700, fontSize: 16, color: "#1a2e1a" };
const courseLoc = { fontSize: 13, color: "#6b7280", marginTop: 2 };
const chevron = { fontSize: 12, color: "#6b7280" };
const layoutsSection = {
  borderTop: "1px solid #f3f4f6",
  padding: "0.875rem 1rem",
};
const layoutsHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.75rem",
};
const layoutsTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const addLayoutBtn = {
  padding: "4px 10px",
  background: "#f0faf4",
  color: "#1d6b3a",
  border: "1.5px solid #1d6b3a",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const layoutFormStyle = {
  background: "#f9fafb",
  borderRadius: 8,
  padding: "0.875rem",
  marginBottom: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
const layoutRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.625rem 0",
  borderBottom: "1px solid #f3f4f6",
};
const layoutName = { fontWeight: 600, fontSize: 14, color: "#1a2e1a" };
const layoutSub = { fontSize: 12, color: "#6b7280", marginTop: 2 };
const parDisplay = {
  fontSize: 11,
  color: "#9ca3af",
  marginTop: 2,
  fontFamily: "monospace",
};
const editBtn = {
  padding: "3px 10px",
  background: "#fff",
  border: "1px solid #d1d5db",
  color: "#374151",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
};
const deleteBtn = {
  padding: "3px 10px",
  background: "#fff",
  border: "1px solid #fca5a5",
  color: "#dc2626",
  borderRadius: 6,
  fontSize: 12,
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
const parHint = { fontSize: 12, color: "#6b7280", margin: 0 };
