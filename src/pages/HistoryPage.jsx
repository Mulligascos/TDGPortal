export function HistoryPage() {
  const { user } = useAuth();
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get all round IDs this player participated in
      const { data: participated } = await supabase
        .from("round_players")
        .select("round_id")
        .eq("player_id", user.id);

      if (!participated || participated.length === 0) {
        setLoading(false);
        return;
      }

      const roundIds = participated.map((r) => r.round_id);

      // Fetch full round details
      const { data, error } = await supabase
        .from("rounds")
        .select(
          "id, played_at, status, format, starting_hole, play_for_tags, courses(name), layouts(layout_name, number_of_holes, loops)",
        )
        .in("id", roundIds)
        .order("played_at", { ascending: false });

      if (error) console.error("History error:", error);
      setRounds(data ?? []);
      setLoading(false);
    }
    load();
  }, [user.id]);

  return (
    <Layout title="My history">
      {loading && <p style={{ color: t.textSub }}>Loading...</p>}
      {!loading && rounds.length === 0 && (
        <p style={{ color: t.textSub }}>No rounds yet. Start one!</p>
      )}
      {rounds.map((r) => (
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
              {r.layouts?.layout_name} · {r.format} · Start hole{" "}
              {r.starting_hole}
            </div>
            {r.play_for_tags && (
              <div style={{ fontSize: 11, color: t.accentText, marginTop: 2 }}>
                🏷️ Tags played
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: t.textSub, marginBottom: 4 }}>
              {new Date(r.played_at).toLocaleDateString("en-NZ", {
                day: "numeric",
                month: "short",
                year: "numeric",
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
    </Layout>
  );
}
