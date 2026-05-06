# Disc Golf Club App

React + Supabase + Vercel. Free tier throughout.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**
3. Paste the entire contents of `supabase/schema.sql` and run it
4. Go to **Settings → API** and copy your Project URL and anon key

## 2. Local development

```bash
# Clone / download this project, then:
cp .env.example .env.local
# Edit .env.local and paste your Supabase URL and anon key

npm install
npm run dev
```

Open http://localhost:5173

## 3. Make yourself an admin

1. Sign up in the app using your email (magic link)
2. Click the link in your email
3. In Supabase → SQL Editor, run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, add these environment variables:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

Or set them in the Vercel dashboard under Project → Settings → Environment Variables.

---

## Phase 1 features (built)
- Magic link login (no passwords)
- New round: course → layout → starting hole → players → scorecard
- Live scoring: strokeplay with par tracking and relative score display
- Hole wrapping (start any hole, 2-loop 9-hole support)
- Round history
- Bag tag leaderboard
- News & announcements
- Hazard / lost disc / suggestion reports

## Phase 2 (coming next)
- Full admin panel: members, courses, layouts, bag tag assignment
- Events & tournaments
- Matchplay scoring
- Push notifications

---

## Key files

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Full DB schema + RLS policies |
| `src/lib/supabase.js` | Supabase client |
| `src/lib/scoring.js` | Hole ordering, par lookup, score calc |
| `src/hooks/useAuth.jsx` | Auth context (session, profile, role) |
| `src/pages/NewRoundPage.jsx` | 4-step round creation flow |
| `src/pages/ScorecardPage.jsx` | Live scoring UI |
