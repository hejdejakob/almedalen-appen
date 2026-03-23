# Arenaguiden detaljvy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gör arenakorten klickbara med en detaljvy som visar toppaktörer, toppämnen, topptalare och utökad sektorfördelning per arena. Lägg till sektorfilter i gridet.

**Architecture:** Ny API-vy `arena-detail` i dashboard route (separerad från befintlig `arena-guide` för att inte bryta befintliga konsumenter). Detaljvy renderas i samma sida genom state-hantering. Sektorfilter läggs till i befintligt filterUI.

**Tech Stack:** Existing — Next.js 16, Supabase, React inline styles

---

## Safety: Befintliga API:er som INTE får ändras

| Vy | Konsumenter | Ändring |
|---|---|---|
| `arena-guide` | `app/arenaguiden/page.tsx` | **INGEN** — response-shape orörd |
| `arena-network` | `app/dashboard/page.tsx` (ArenaNetwork) | **INGEN** |
| `topic-detail` | `app/speakers/page.tsx` (AmnesTab) | **INGEN** |

All ny funktionalitet går i en **ny vy** `arena-detail`.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/api/dashboard/route.ts` | Add `arena-detail` view (~60 lines) |
| Modify | `app/arenaguiden/page.tsx` | Add click handler, detail view, sector filter |

---

### Task 1: Add `arena-detail` API view

**Files:**
- Modify: `app/api/dashboard/route.ts` — add to the view switch chain + new function

**Rationale:** Ny separat vy istället för att utöka `arena-guide` — undviker att bryta befintliga konsumenter. Funktionen kan återanvända `normalizeVenue`, `EXCLUDED_ARENAS` och `VISIBLE_YEARS` som redan finns i filen.

- [ ] **Step 1: Add the view to the switch chain**

In the GET handler's if/else chain (around line 67-78), add before the final `else`:

```tsx
} else if (view === 'arena-detail') {
  const arena = searchParams.get('arena');
  if (!arena) return NextResponse.json({ error: 'Missing arena parameter' }, { status: 400 });
  return NextResponse.json(await getArenaDetail(arena));
}
```

Update the error message listing valid views to include `arena-detail`.

- [ ] **Step 2: Implement getArenaDetail function**

Add after `getArenaGuide` (around line 1209). The function:

1. Fetches events, event_arrangers, event_speakers, event_topics, arrangers, arranger_classifications, speakers, speaker_classifications in parallel
2. Filters events to `VISIBLE_YEARS` where `normalizeVenue(location_name) === arenaName`
3. Aggregates:
   - **topArrangers (15):** Count events per arranger, resolve name + sector
   - **topTopics (10):** Count events per topic_primary
   - **topSpeakers (15):** Count events per speaker (exclude kontaktperson), resolve name + title + org + category
   - **sectorBreakdown:** Count events per sector (from arranger classifications)
   - **perYear:** Event count per year

```tsx
async function getArenaDetail(arenaName: string) {
  const [events, eventArrangerLinks, eventSpeakerLinks, eventTopicLinks,
         arrangers, arrangerClassifications, speakers, speakerClassifications] = await Promise.all([
    fetchAll('events', 'id, year, location_name'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('event_speakers', 'event_id, speaker_id, role'),
    fetchAll('event_topics', 'event_id, topic_primary'),
    fetchAll('arrangers', 'id, name'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('speaker_classifications', 'speaker_id, category'),
  ]);

  // Filter events to this arena + visible years
  const arenaEventIds = new Set<number>();
  for (const e of events) {
    if (!e.location_name || !VISIBLE_YEARS.includes(e.year)) continue;
    const normalized = normalizeVenue(e.location_name);
    if (normalized === arenaName) arenaEventIds.add(e.id);
  }

  if (arenaEventIds.size === 0) {
    return { error: 'Arena not found', arena: arenaName };
  }

  // Per year
  const perYear: Record<number, number> = {};
  for (const e of events) {
    if (arenaEventIds.has(e.id)) {
      perYear[e.year] = (perYear[e.year] || 0) + 1;
    }
  }

  // Top arrangers
  const arrangerCounts: Record<number, number> = {};
  for (const link of eventArrangerLinks) {
    if (!arenaEventIds.has(link.event_id)) continue;
    arrangerCounts[link.arranger_id] = (arrangerCounts[link.arranger_id] || 0) + 1;
  }
  const arrangerMap = new Map(arrangers.map((a: any) => [a.id, a]));
  const sectorMap = new Map(arrangerClassifications.map((c: any) => [c.arranger_id, c.sector]));
  const topArrangers = Object.entries(arrangerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => ({
      id: parseInt(id),
      name: arrangerMap.get(parseInt(id))?.name || 'Unknown',
      sector: sectorMap.get(parseInt(id)) || null,
      eventCount: count,
    }));

  // Sector breakdown
  const sectorCounts: Record<string, number> = {};
  for (const link of eventArrangerLinks) {
    if (!arenaEventIds.has(link.event_id)) continue;
    const sector = sectorMap.get(link.arranger_id);
    if (sector) sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  }
  const sectorBreakdown = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sector, count]) => ({ sector, count }));

  // Top topics
  const topicCounts: Record<string, number> = {};
  for (const link of eventTopicLinks) {
    if (!arenaEventIds.has(link.event_id) || !link.topic_primary) continue;
    topicCounts[link.topic_primary] = (topicCounts[link.topic_primary] || 0) + 1;
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // Top speakers
  const speakerCounts: Record<number, number> = {};
  for (const link of eventSpeakerLinks) {
    if (!arenaEventIds.has(link.event_id) || link.role === 'kontaktperson') continue;
    speakerCounts[link.speaker_id] = (speakerCounts[link.speaker_id] || 0) + 1;
  }
  const speakerMap = new Map(speakers.map((s: any) => [s.id, s]));
  const categoryMap = new Map(speakerClassifications.map((c: any) => [c.speaker_id, c.category]));
  const topSpeakers = Object.entries(speakerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => {
      const sp = speakerMap.get(parseInt(id));
      return {
        id: parseInt(id),
        name: sp?.name || 'Unknown',
        title: sp?.title || null,
        org: sp?.org_name || null,
        category: categoryMap.get(parseInt(id)) || null,
        eventCount: count,
      };
    });

  return {
    arena: arenaName,
    totalEvents: arenaEventIds.size,
    perYear,
    topArrangers,
    topTopics,
    topSpeakers,
    sectorBreakdown,
  };
}
```

- [ ] **Step 3: Verify build — ensure no existing views break**

Run: `npm run build`
Expected: Clean build, all routes present including `/arenaguiden`

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "feat: add arena-detail API view for arenaguiden"
```

---

### Task 2: Make arena cards clickable + add detail view

**Files:**
- Modify: `app/arenaguiden/page.tsx`

- [ ] **Step 1: Add state and types for detail view**

Add types at top of file:

```tsx
type ArenaDetail = {
  arena: string;
  totalEvents: number;
  perYear: Record<string, number>;
  topArrangers: { id: number; name: string; sector: string | null; eventCount: number }[];
  topTopics: { topic: string; count: number }[];
  topSpeakers: { id: number; name: string; title: string | null; org: string | null; category: string | null; eventCount: number }[];
  sectorBreakdown: { sector: string; count: number }[];
};
```

Add state in the main component:

```tsx
const [selectedArena, setSelectedArena] = useState<string | null>(null);
const [arenaDetail, setArenaDetail] = useState<ArenaDetail | null>(null);
const [detailLoading, setDetailLoading] = useState(false);
```

- [ ] **Step 2: Add fetch logic for arena detail**

```tsx
const openArena = async (arenaName: string) => {
  setSelectedArena(arenaName);
  setDetailLoading(true);
  setArenaDetail(null);
  try {
    const res = await fetch(`/api/dashboard?view=arena-detail&arena=${encodeURIComponent(arenaName)}`);
    const data = await res.json();
    setArenaDetail(data);
  } catch {
    setArenaDetail(null);
  }
  setDetailLoading(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const closeArena = () => {
  setSelectedArena(null);
  setArenaDetail(null);
};
```

- [ ] **Step 3: Make ArenaCard clickable**

Add `onClick` prop to ArenaCard:

```tsx
function ArenaCard({ arena, onClick }: { arena: ArenaData; onClick: () => void }) {
```

Add to the card's root div: `onClick={onClick}`, `cursor: 'pointer'`, and hover effect (translate + shadow).

In the grid: `<ArenaCard key={arena.name} arena={arena} onClick={() => openArena(arena.name)} />`

- [ ] **Step 4: Add ArenaDetailView component**

Render when `selectedArena` is set, replacing the grid:

```tsx
{selectedArena ? (
  <ArenaDetailView
    detail={arenaDetail}
    loading={detailLoading}
    arenaName={selectedArena}
    onClose={closeArena}
  />
) : (
  /* existing grid + legend */
)}
```

The detail view shows:
- Tillbaka-knapp → `onClose()`
- Arena name as heading + total events
- Per-year bars (reuse YearSparkline pattern but larger)
- Sector breakdown as list with color dots and counts
- **Toppaktörer (15):** Cards with name, sector dot, event count. Clickable → `window.location.href = '/speakers?tab=aktorer&id=' + id`
- **Toppämnen (10):** Cards with topic name, event count. Clickable → `window.location.href = '/speakers?tab=amnen&topic=' + encodeURIComponent(topic)`
- **Topptalare (15):** Cards with name, title/org, category badge, event count. Clickable → `window.location.href = '/speakers?id=' + id`

Use existing styling patterns (card borders, SECTOR_COLORS, CATEGORY_COLORS/LABELS, hover effects).

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/arenaguiden/page.tsx
git commit -m "feat: clickable arena cards with detail view"
```

---

### Task 3: Add sector filter to arena grid

**Files:**
- Modify: `app/arenaguiden/page.tsx`

- [ ] **Step 1: Add sector filter state**

```tsx
const [sectorFilter, setSectorFilter] = useState<string>('');
```

- [ ] **Step 2: Add sector filter UI**

Add a third row of filter buttons after "Sortera:", using SECTOR_COLORS for styling:

```tsx
<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginRight: '0.25rem' }}>
    Sektor:
  </span>
  <button onClick={() => setSectorFilter('')} style={sectorFilterBtnStyle(!sectorFilter)}>
    Alla
  </button>
  {Object.entries(SECTOR_LABELS).map(([key, label]) => (
    <button
      key={key}
      onClick={() => setSectorFilter(sectorFilter === key ? '' : key)}
      style={{
        ...sectorFilterBtnStyle(sectorFilter === key),
        borderColor: sectorFilter === key ? SECTOR_COLORS[key] : '#ddd',
        backgroundColor: sectorFilter === key ? SECTOR_COLORS[key] : '#fff',
      }}
    >
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Apply sector filter to results**

Update the `filtered` computation to include sector filter:

```tsx
const filtered = arenas
  .filter(a => filterType === 'all' || a.type === filterType)
  .filter(a => !sectorFilter || (a.sectorBreakdown[sectorFilter] || 0) > 0)
  .sort(/* existing sort */);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit, push, deploy**

```bash
git add app/arenaguiden/page.tsx
git commit -m "feat: add sector filter to arenaguiden"
git push origin almedalen2026
vercel --prod --yes
```
