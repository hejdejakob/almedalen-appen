# Event Page WOW Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utöka /event-sidan med fyra wow-sektioner: gemensamma ämnen, aktivitetstrender, bryggan-talare, sentimentheatmap och Visbykarta.

**Architecture:** Utöka befintlig `/api/event-network` med ny data (ADDERA, ändra inget befintligt). Lägg till nya sektioner i `app/event/page.tsx` under befintligt innehåll.

**Tech Stack:** Existing — D3 7, Leaflet + react-leaflet, Supabase, React inline styles

---

## Datasäkerhet

- Befintliga API-fält (nodes, edges, stats) ändras INTE — bara nya fält adderas
- Ingen databasmodifiering — enbart läsning
- Befintlig funktionalitet (graf, kort, drill-down) rörs INTE

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/api/event-network/route.ts` | Add 4 new fields to response |
| Modify | `app/event/page.tsx` | Add 4 new sections below existing content |

---

### Task 1: API — lägg till nya datafält

**Files:**
- Modify: `app/api/event-network/route.ts`

Addera dessa fält till API-responsen (EFTER befintliga `nodes`, `edges`, `stats`):

- [ ] **Step 1: Beräkna gemensamma ämnen (groupTopics)**

Aggregera topics över ALLA orgs i nätverket. Returnera topp 10 med antal orgs och antal events.

```tsx
// After building nodes and topTopicsMap...
const globalTopicCounts: Record<string, { orgs: number; events: number }> = {};
for (const arrangerId of EVENT_ARRANGER_IDS) {
  const evts = arrangerEvents[arrangerId];
  if (!evts) continue;
  // Get ALL topics for this org (not just top 3)
  const orgTopics = new Set<string>();
  // ... reuse the event_topics data already fetched per org
  for (const topic of Object.keys(orgTopicCounts)) { // need to preserve full counts
    orgTopics.add(topic);
    if (!globalTopicCounts[topic]) globalTopicCounts[topic] = { orgs: 0, events: 0 };
    globalTopicCounts[topic].events += orgTopicCounts[topic];
  }
  for (const topic of orgTopics) {
    globalTopicCounts[topic].orgs++;
  }
}
const groupTopics = Object.entries(globalTopicCounts)
  .sort((a, b) => b[1].orgs - a[1].orgs || b[1].events - a[1].events)
  .slice(0, 10)
  .map(([topic, data]) => ({ topic, orgs: data.orgs, events: data.events }));
```

NOTE: The existing code fetches topics per org but only keeps top 3. Refactor to keep full counts in a `orgAllTopics` map, use top 3 for nodes, full counts for groupTopics.

- [ ] **Step 2: Beräkna aktivitetstrender (highlights only)**

For each org, compute events per year. Find the most interesting changes — top 3 growers and top 3 shrinkers (by absolute change 2023→2025 or earliest→latest).

```tsx
// Get events with year for each org
const orgYearCounts: Record<number, Record<number, number>> = {};
for (const link of visibleLinks) {
  const event = events.find(e => e.id === link.event_id);
  if (!event) continue;
  if (!orgYearCounts[link.arranger_id]) orgYearCounts[link.arranger_id] = {};
  orgYearCounts[link.arranger_id][event.year] = (orgYearCounts[link.arranger_id][event.year] || 0) + 1;
}

// Find highlights
const trends = EVENT_ARRANGER_IDS
  .filter(id => arrangerEvents[id]?.size >= 2)
  .map(id => {
    const yc = orgYearCounts[id] || {};
    const years = Object.keys(yc).map(Number).sort();
    const first = yc[years[0]] || 0;
    const last = yc[years[years.length - 1]] || 0;
    const change = last - first;
    return { id, name: DISPLAY_NAMES[id], perYear: yc, change, first, last, firstYear: years[0], lastYear: years[years.length - 1] };
  })
  .filter(t => t.change !== 0)
  .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  .slice(0, 6);
```

- [ ] **Step 3: Hitta bryggan-talaren (bridgePerson)**

Find the speaker who appears in events from the MOST different orgs in the room.

```tsx
// speakerToOrgs: map speaker_id → Set of arranger_ids
const speakerToOrgs: Record<number, Set<number>> = {};
for (const arrangerId of EVENT_ARRANGER_IDS) {
  const spks = arrangerSpeakers[arrangerId];
  if (!spks) continue;
  for (const spk of spks) {
    if (!speakerToOrgs[spk]) speakerToOrgs[spk] = new Set();
    speakerToOrgs[spk].add(arrangerId);
  }
}

const bridgePersons = Object.entries(speakerToOrgs)
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, 5)
  .map(([spkId, orgSet]) => {
    const sp = speakerNameMap.get(parseInt(spkId));
    return {
      id: parseInt(spkId),
      name: sp?.name || 'Okänd',
      title: sp?.title || null,
      org: sp?.org || null,
      orgCount: orgSet.size,
      orgs: [...orgSet].map(id => DISPLAY_NAMES[id] || `Org ${id}`),
    };
  });
```

- [ ] **Step 4: Beräkna sentiment per org (sentimentMap)**

Fetch event_sentiment for all orgs' events. Compute average sentiment score per org.

```tsx
const allVisibleEventIds = [...visibleEventIds];
const sentiments = await fetchAll('event_sentiment', 'event_id, score, label', q =>
  q.in('event_id', allVisibleEventIds)
);
const sentimentByEvent = new Map(sentiments.map((s: any) => [s.event_id, { score: s.score, label: s.label }]));

const orgSentiment: Record<number, { avg: number; pos: number; neu: number; neg: number; total: number }> = {};
for (const arrangerId of EVENT_ARRANGER_IDS) {
  const evts = arrangerEvents[arrangerId];
  if (!evts) continue;
  let sum = 0, count = 0, pos = 0, neu = 0, neg = 0;
  for (const eventId of evts) {
    const s = sentimentByEvent.get(eventId);
    if (s) {
      sum += s.score;
      count++;
      if (s.label === 'positiv') pos++;
      else if (s.label === 'neutral') neu++;
      else neg++;
    }
  }
  if (count > 0) {
    orgSentiment[arrangerId] = { avg: sum / count, pos, neu, neg, total: count };
  }
}

const sentimentData = EVENT_ARRANGER_IDS
  .filter(id => orgSentiment[id])
  .map(id => ({
    id,
    name: DISPLAY_NAMES[id],
    ...orgSentiment[id],
  }))
  .sort((a, b) => b.avg - a.avg);
```

- [ ] **Step 5: Samla venue-data per org (venueMap)**

Events already have location_name. Aggregate per org → return venues with coordinates from `public/venue-coordinates.json`.

```tsx
// Read venue coordinates (at build time or inline)
// Actually: return raw venue names per org. The frontend will match against venue-coordinates.json.
const orgVenues: Record<number, Record<string, number>> = {};
for (const arrangerId of EVENT_ARRANGER_IDS) {
  const evts = arrangerEvents[arrangerId];
  if (!evts) continue;
  orgVenues[arrangerId] = {};
  for (const eventId of evts) {
    const event = events.find(e => e.id === eventId);
    if (event?.location_name) {
      orgVenues[arrangerId][event.location_name] = (orgVenues[arrangerId][event.location_name] || 0) + 1;
    }
  }
}

// Aggregate ALL venues across all orgs
const allVenues: Record<string, { events: number; orgs: number }> = {};
for (const arrangerId of EVENT_ARRANGER_IDS) {
  const venues = orgVenues[arrangerId] || {};
  for (const [venue, count] of Object.entries(venues)) {
    if (!allVenues[venue]) allVenues[venue] = { events: 0, orgs: 0 };
    allVenues[venue].events += count;
    allVenues[venue].orgs++;
  }
}
const venueData = Object.entries(allVenues)
  .sort((a, b) => b[1].events - a[1].events)
  .slice(0, 20)
  .map(([name, data]) => ({ name, ...data }));
```

- [ ] **Step 6: Addera alla nya fält till response**

```tsx
return NextResponse.json({
  nodes,    // existing
  edges,    // existing
  stats,    // existing
  // NEW:
  groupTopics,
  trends,
  bridgePersons,
  sentimentData,
  venueData,
});
```

- [ ] **Step 7: Verify build**

Run: `npm run build`

- [ ] **Step 8: Commit**

```bash
git add app/api/event-network/route.ts
git commit -m "feat: add groupTopics, trends, bridgePersons, sentiment, venues to event API"
```

---

### Task 2: UI — gemensamma ämnen + bryggan + trender

**Files:**
- Modify: `app/event/page.tsx`

Add three new sections below the existing org cards grid.

- [ ] **Step 1: Add types for new API data**

```tsx
type GroupTopic = { topic: string; orgs: number; events: number };
type TrendItem = { id: number; name: string; perYear: Record<number, number>; change: number; first: number; last: number; firstYear: number; lastYear: number };
type BridgePerson = { id: number; name: string; title: string | null; org: string | null; orgCount: number; orgs: string[] };
type SentimentItem = { id: number; name: string; avg: number; pos: number; neu: number; neg: number; total: number };
type VenueItem = { name: string; events: number; orgs: number };
```

- [ ] **Step 2: Add "NI ÄGER DESSA FRÅGOR" section**

After the org cards grid. Show top 10 topics as horizontal bars:
- Bar width proportional to number of orgs
- Label: topic name + "X organisationer, Y seminarier"
- Dark cards, orange accent on bars
- Header: "NI ÄGER DESSA FRÅGOR" in Formula Condensed

- [ ] **Step 3: Add "PERSONEN SOM BINDER ER SAMMAN" section**

Show top 5 bridge persons. Each as a card:
- Name (large), title, org
- "Medverkat hos X av era organisationer"
- List of which orgs (comma-separated)
- Hero treatment for #1 (bigger, accent border)

- [ ] **Step 4: Add "TRENDER" section**

Show the 6 highlights (top growers + shrinkers):
- Each: org name, sparkline (2022→2025), change indicator
- Green for growth, red for decline
- Only show orgs with >= 2 events (skip noise)

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/event/page.tsx
git commit -m "feat: add group topics, bridge persons, trends to /event"
```

---

### Task 3: UI — sentimentheatmap

**Files:**
- Modify: `app/event/page.tsx`

- [ ] **Step 1: Add "SENTIMENT" section**

Show a horizontal heatmap / sorted list:
- Each org as a row: name + colored bar from red (−1) through yellow (0) to green (+1)
- Sort by sentiment score (most positive at top)
- Show actual score number
- Label the extremes: "Mest optimistisk" / "Mest pessimistisk"
- Only show orgs that have sentiment data (total > 0)

Style:
- Background: #1a1a1a card
- Color scale: `#e63946` (negative) → `#e9c46a` (neutral) → `#2a9d8f` (positive)
- Interpolate with: `const sentimentColor = (score) => score > 0 ? interpolate('#e9c46a', '#2a9d8f', Math.min(score * 5, 1)) : interpolate('#e9c46a', '#e63946', Math.min(-score * 5, 1))`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/event/page.tsx
git commit -m "feat: add sentiment heatmap to /event"
```

---

### Task 4: UI — Visbykarta

**Files:**
- Modify: `app/event/page.tsx`

- [ ] **Step 1: Add "VAR I VISBY?" section with Leaflet map**

The app already uses Leaflet + react-leaflet (installed). Venue coordinates are in `public/venue-coordinates.json`.

Dynamic import Leaflet (SSR-safe):
```tsx
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false });
```

OR: use the same pattern as `VisbyMap.tsx` component (check how it's done there).

Map setup:
- Center: Visby [57.638, 18.294]
- Zoom: 15
- Dark tiles: CartoDB dark_all (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- Circle markers at venue positions, sized by event count, colored #ff6632
- Tooltip on hover: venue name + "X events från era organisationer"
- Height: 400px mobile, 500px desktop

Fetch `venue-coordinates.json`, match against `venueData` venue names.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit, push, deploy**

```bash
git add app/event/page.tsx
git commit -m "feat: add Visby map to /event page"
git push origin almedalen2026
vercel --prod --yes
```
