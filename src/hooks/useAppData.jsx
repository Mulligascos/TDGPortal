import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const { session } = useAuth();
  const [courses, setCourses] = useState([]);
  const [layouts, setLayouts] = useState({}); // { courseId: [layout, ...] }
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) {
      setLoaded(false);
      return;
    }
    loadAll();
  }, [session]);

  async function loadAll() {
    const [coursesRes, layoutsRes, membersRes, announcementsRes, reportsRes] =
      await Promise.all([
        supabase.from("courses").select("*").order("name"),
        supabase.from("layouts").select("*").order("layout_name"),
        supabase
          .from("profiles")
          .select(
            "id, full_name, nickname, bag_tag_number, role, handicap, email",
          )
          .order("full_name"),
        supabase
          .from("announcements")
          .select("*, profiles(full_name, nickname)")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("reports")
          .select("*, courses(name)")
          .order("created_at", { ascending: false }),
      ]);

    setCourses(coursesRes.data ?? []);

    // Group layouts by course_id for easy lookup
    const layoutMap = {};
    for (const layout of layoutsRes.data ?? []) {
      if (!layoutMap[layout.course_id]) layoutMap[layout.course_id] = [];
      layoutMap[layout.course_id].push(layout);
    }
    setLayouts(layoutMap);

    setMembers(membersRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setReports(reportsRes.data ?? []);
    setLoaded(true);
  }

  // Call this to force a refresh of a specific dataset after an admin change
  async function refresh(key) {
    switch (key) {
      case "courses":
        supabase
          .from("courses")
          .select("*")
          .order("name")
          .then(({ data }) => setCourses(data ?? []));
        break;
      case "layouts":
        supabase
          .from("layouts")
          .select("*")
          .order("layout_name")
          .then(({ data }) => {
            const layoutMap = {};
            for (const layout of data ?? []) {
              if (!layoutMap[layout.course_id])
                layoutMap[layout.course_id] = [];
              layoutMap[layout.course_id].push(layout);
            }
            setLayouts(layoutMap);
          });
        break;
      case "members":
        supabase
          .from("profiles")
          .select(
            "id, full_name, nickname, bag_tag_number, role, handicap, email",
          )
          .order("full_name")
          .then(({ data }) => setMembers(data ?? []));
        break;
      case "announcements":
        supabase
          .from("announcements")
          .select("*, profiles(full_name, nickname)")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .then(({ data }) => setAnnouncements(data ?? []));
        break;
      case "reports":
        supabase
          .from("reports")
          .select("*, courses(name)")
          .order("created_at", { ascending: false })
          .then(({ data }) => setReports(data ?? []));
        break;
      default:
        await loadAll();
    }
  }

  return (
    <AppDataContext.Provider
      value={{
        courses,
        layouts,
        members,
        announcements,
        reports,
        loaded,
        refresh,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
