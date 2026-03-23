# Ämnessök + Aktörssök Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new tabs (Ämnessök, Aktörssök) to `/speakers` with backend APIs and cross-referencing navigation.

**Architecture:** Two new API endpoints + two new tab components in the existing speakers page. All views share the same profile/navigation infrastructure.

**Tech Stack:** Next.js 16, React 19, Supabase, TypeScript, inline styles (matching existing patterns)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `app/api/arrangers/route.ts` | Arranger search + profile API |
| Modify | `app/api/dashboard/route.ts` | Add `topic-detail` view |
| Modify | `app/speakers/page.tsx` | Add tabs, AmnesTab, AktorerTab components |

---

### Task 1: Add `topic-detail` API endpoint

**Files:**
- Modify: `app/api/dashboard/route.ts`

Add a new view `topic-detail` that accepts `&topic=slug` query param.

- [ ] **Step 1: Read the existing dashboard route to understand patterns**

Read `app/api/dashboard/route.ts` and note how existing views query Supabase and return data.

- [ ] **Step 2: Add topic-detail view handler**

When `view === 'topic-detail'`:

1. Get `topic` from searchParams, return 400 if missing
2. Query `topic_year_stats` for this topic (all visible years) → `perYear`
3. Query top 10 speakers: join `event_topics` → `event_speakers` → `speakers` + `speaker_classifications` where `topic_primary = topic`, group by speaker, count events, order desc, limit 10
4. Query top 10 arrangers: join `event_topics` → `event_arrangers` → `arrangers` + `arranger_classifications` where `topic_primary = topic`, group by arranger, count events, order desc, limit 10
5. Query sector breakdown: join `event_topics` → `event_arrangers` → `arranger_classifications` where `topic_primary = topic`, group by sector, count

Return:
```json
{
  "topic": "klimat_miljö_hållbarhet",
  "totalEvents": 842,
  "perYear": [{ "year": 2022, "count": 180 }],
  "topSpeakers": [{ "id", "name", "title", "org", "category", "eventCount" }],
  "topArrangers": [{ "id", "name", "sector", "eventCount" }],
  "sectorBreakdown": [{ "sector", "count" }]
}
```

- [ ] **Step 3: Add topic-detail to the allowed views list**

Update the error message that lists valid views.

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "feat: add topic-detail API view for ämnessök"
```

---

### Task 2: Create `/api/arrangers` endpoint

**Files:**
- Create: `app/api/arrangers/route.ts`

- [ ] **Step 1: Create the route file**

Model it after `/api/speakers/route.ts`. Support two modes:

**Search mode** (`?q=...&limit=30`):
```sql
SELECT a.id, a.name, ac.sector,
  SUM(ast.events_count) as total_events,
  COUNT(DISTINCT ast.year) as years_active
FROM arrangers a
LEFT JOIN arranger_classifications ac ON ac.arranger_id = a.id
LEFT JOIN arranger_stats ast ON ast.arranger_id = a.id
  AND ast.year IN (2022,2023,2024,2025)
WHERE a.name ILIKE '%query%' OR a.name_normalized ILIKE '%query%'
GROUP BY a.id, a.name, ac.sector
ORDER BY total_events DESC
LIMIT 30
```

Default (no `q`): same query without WHERE, returns top 30 by events.

**Profile mode** (`?id=N`):
```sql
-- Basic info
SELECT a.id, a.name, ac.sector, ac.sub_sector
FROM arrangers a
LEFT JOIN arranger_classifications ac ON ac.arranger_id = a.id
WHERE a.id = N

-- Per year stats
SELECT year, events_count, panel_slots_given, agenda_power_index
FROM arranger_stats WHERE arranger_id = N AND year IN (2022,2023,2024,2025)

-- Top topics (top 5)
SELECT et.topic_primary as topic, COUNT(*) as count
FROM event_arrangers ea
JOIN event_topics et ON et.event_id = ea.event_id
JOIN events e ON e.id = ea.event_id
WHERE ea.arranger_id = N AND e.year IN (2022,2023,2024,2025)
  AND et.topic_primary IS NOT NULL
GROUP BY et.topic_primary
ORDER BY count DESC LIMIT 5

-- Top speakers (top 10)
SELECT s.id, s.name, s.title, s.org_name as org,
  sc.category, COUNT(*) as shared_events
FROM event_arrangers ea
JOIN event_speakers es ON es.event_id = ea.event_id
JOIN speakers s ON s.id = es.speaker_id
LEFT JOIN speaker_classifications sc ON sc.speaker_id = s.id
JOIN events e ON e.id = ea.event_id
WHERE ea.arranger_id = N AND e.year IN (2022,2023,2024,2025)
  AND es.role != 'kontaktperson'
GROUP BY s.id, s.name, s.title, s.org_name, sc.category
ORDER BY shared_events DESC LIMIT 10
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/api/arrangers/route.ts
git commit -m "feat: add /api/arrangers endpoint for aktörssök"
```

---

### Task 3: Add Ämnessök and Aktörssök tabs to speakers page

**Files:**
- Modify: `app/speakers/page.tsx`

This is the biggest task. It adds two new tab components and wires up cross-navigation.

- [ ] **Step 1: Extend the tab system**

Update `mode` state type to `'search' | 'talarkollen' | 'amnen' | 'aktorer'`. Add the two new tabs to the tab bar. Make the tab bar horizontally scrollable on mobile:

```tsx
const [mode, setMode] = useState<'search' | 'talarkollen' | 'amnen' | 'aktorer'>(...);
```

Tab bar: add `overflowX: 'auto'` and `flexShrink: 0` on buttons for mobile scroll.

Update URL params: `?tab=amnen`, `?tab=aktorer`.

Update the dynamic header title/subtitle for each mode.

- [ ] **Step 2: Add shared types**

```tsx
type TopicOverview = {
  topic: string;
  totalEvents: number;
  latestYoY: number | null;
};

type TopicDetail = {
  topic: string;
  totalEvents: number;
  perYear: { year: number; count: number }[];
  topSpeakers: { id: number; name: string; title: string | null; org: string | null; category: string | null; eventCount: number }[];
  topArrangers: { id: number; name: string; sector: string | null; eventCount: number }[];
  sectorBreakdown: { sector: string; count: number }[];
};

type ArrangerSearchResult = {
  id: number;
  name: string;
  sector: string | null;
  totalEvents: number;
  yearsActive: number;
};

type ArrangerProfile = {
  arranger: { id: number; name: string; sector: string | null; subSector: string | null; totalEvents: number; agendaPower: number };
  perYear: { year: number; events: number; panelSlotsGiven: number }[];
  topTopics: { topic: string; count: number }[];
  topSpeakers: { id: number; name: string; title: string | null; org: string | null; category: string | null; sharedEvents: number }[];
};
```

- [ ] **Step 3: Build AmnesTab component**

Two states: grid view (default) and detail view (when a topic is selected).

**Grid view:**
- Fetch `/api/dashboard?view=topics` on mount (already returns per-topic data with totals and YoY)
- Render 21 topic cards in a grid (3 columns desktop, 2 mobile)
- Each card: topic name, total events, trend arrow with YoY %
- `onClick` → fetch topic detail and switch to detail view

**Detail view:**
- Fetch `/api/dashboard?view=topic-detail&topic={slug}`
- Show: topic name, total events, per-year bar chart (simple div-based bars), top speakers list, top arrangers list, sector breakdown bar
- Top speakers: clickable → `openProfile(id)` (existing)
- Top arrangers: clickable → navigate to aktörssök and open that profile
- Tillbaka-knapp → return to grid

- [ ] **Step 4: Build AktorerTab component**

Two states: search view (default) and profile view.

**Search view:**
- Search input (debounced, AbortController pattern from talarsök)
- Fetch `/api/arrangers` or `/api/arrangers?q=...`
- Grid of arranger cards with name, sector badge, event count
- `onClick` → load arranger profile

**Profile view:**
- Fetch `/api/arrangers?id=N`
- Show: name, sector badge, stat cards (events, years, agenda power), sparkline per year
- Top topics: list with counts, clickable → navigate to ämnessök detail
- Top speakers: list with shared events count, clickable → `openProfile(id)`
- Tillbaka-knapp → return to search

- [ ] **Step 5: Wire cross-navigation**

Add navigation functions accessible from all tabs:

```tsx
const openTopic = (topic: string) => {
  setMode('amnen');
  // AmnesTab needs to receive this and open detail view
  setSelectedTopic(topic);
  router.replace(`/speakers?tab=amnen&topic=${topic}`, { scroll: false });
};

const openArrangerProfile = (id: number) => {
  setMode('aktorer');
  setSelectedArrangerId(id);
  router.replace(`/speakers?tab=aktorer&id=${id}`, { scroll: false });
};
```

Pass `openTopic` to AktorerTab (for clicking topics) and `openArrangerProfile` to AmnesTab (for clicking arrangers).

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add app/speakers/page.tsx
git commit -m "feat: add ämnessök and aktörssök tabs with cross-navigation"
```

---

### Task 4: Verification and deploy

- [ ] **Step 1: Full build verification**

Run: `npm run build`

- [ ] **Step 2: Test API endpoints manually**

```bash
curl -s "localhost:3000/api/dashboard?view=topic-detail&topic=klimat_miljö_hållbarhet" | head -c 500
curl -s "localhost:3000/api/arrangers?q=TCO" | head -c 500
curl -s "localhost:3000/api/arrangers?id=1" | head -c 500
```

- [ ] **Step 3: Commit and push**

```bash
git push origin almedalen2026
```

- [ ] **Step 4: Deploy to Vercel**

```bash
vercel --prod --yes
```
