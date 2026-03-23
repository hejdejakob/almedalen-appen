# Arenor + samarbetande aktörer i profilvyer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utöka aktörsprofilen med (1) arenor, (2) samarbetande organisationer. Utöka talarprofilen med organisationer som medverkar i personens seminarier.

**Architecture:** Extend both `/api/arrangers?id=N` and `/api/speakers?id=N` to return collaboration data. Display in existing profile views.

**Tech Stack:** Existing stack — Supabase queries, React inline styles

---

## Definitions

**Samarbetande organisationer (aktörsprofil):** Andra arrangörer vars talare medverkar i aktörens seminarier, ELLER som co-arrangerar samma event. Rangordnas efter antal gemensamma events. Exempel: om SAAB:s talare dyker upp i 4 av Försvarsmaktens seminarier → SAAB visas med "4 gemensamma seminarier".

**Organisationer (talarprofil):** Vilka organisationer (arrangörer) arrangerar de seminarier personen medverkar i. Grupperat per arrangör med antal.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/api/arrangers/route.ts` | Add `topArenas` + `coOrganizations` to profile |
| Modify | `app/api/speakers/route.ts` | Add `topOrganizations` to speaker profile |
| Modify | `app/speakers/page.tsx` | Display new sections in both profile views |

---

### Task 1: Add topArenas + coOrganizations to /api/arrangers profile

**Files:**
- Modify: `app/api/arrangers/route.ts:140-241`

- [ ] **Step 1: Extend events fetch to include location_name**

The existing events fetch (line ~150) already gets events for this arranger. Extend the select:

```tsx
const events = await fetchAll('events', 'id, year, location_name', q =>
  q.in('id', eventIds).in('year', VISIBLE_YEARS)
);
```

- [ ] **Step 2: Aggregate topArenas**

```tsx
const venueCounts: Record<string, number> = {};
for (const e of events) {
  if (e.location_name) {
    venueCounts[e.location_name] = (venueCounts[e.location_name] || 0) + 1;
  }
}
const topArenas = Object.entries(venueCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([name, count]) => ({ name, eventCount: count }));
```

- [ ] **Step 3: Compute coOrganizations**

Find other arrangers that share events with this arranger. Two sources:
1. **Co-arrangers:** Other arrangers on the same events (via `event_arrangers`)
2. **Talarnätverk:** Other arrangers whose speakers appear in this arranger's events (via `event_speakers` → `speakers.org_name` cross-referenced with `arrangers.name`)

For simplicity and reliability, use source 1 (co-arrangers via `event_arrangers`):

```tsx
// Get ALL arrangers on this arranger's events (not just this arranger)
const allEventArrangerLinks = await fetchAll('event_arrangers', 'event_id, arranger_id', q =>
  q.in('event_id', visibleEventIds)
);

// Count how many shared events each other arranger has
const coArrangerCounts: Record<number, number> = {};
for (const link of allEventArrangerLinks) {
  if (link.arranger_id === arrangerId) continue; // skip self
  coArrangerCounts[link.arranger_id] = (coArrangerCounts[link.arranger_id] || 0) + 1;
}

const topCoEntries = Object.entries(coArrangerCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

let coOrganizations: { id: number; name: string; sector: string | null; sharedEvents: number }[] = [];
if (topCoEntries.length > 0) {
  const coIds = topCoEntries.map(([id]) => parseInt(id));
  const [coArrangers, coClassifications] = await Promise.all([
    fetchAll('arrangers', 'id, name', q => q.in('id', coIds)),
    fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', coIds)),
  ]);
  const nameMap = new Map(coArrangers.map((a: any) => [a.id, a.name]));
  const sectorMap = new Map(coClassifications.map((c: any) => [c.arranger_id, c.sector]));

  coOrganizations = topCoEntries.map(([id, count]) => ({
    id: parseInt(id),
    name: nameMap.get(parseInt(id)) || 'Unknown',
    sector: sectorMap.get(parseInt(id)) || null,
    sharedEvents: count,
  }));
}
```

- [ ] **Step 4: Add to response object**

```tsx
return {
  arranger: { ... },
  perYear: ...,
  topTopics,
  topSpeakers,
  topArenas,
  coOrganizations,
};
```

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add app/api/arrangers/route.ts
git commit -m "feat: add topArenas + coOrganizations to arranger profile API"
```

---

### Task 2: Add topOrganizations to /api/speakers profile

**Files:**
- Modify: `app/api/speakers/route.ts` — the profile query (when `id` param is given)

- [ ] **Step 1: Read the speakers route profile query**

Understand how the speaker profile fetches seminars, co-panelists, etc.

- [ ] **Step 2: Compute topOrganizations**

For a speaker's events, look up which arrangers organized those events:

```tsx
// Already have the speaker's event_ids from seminars query
// Get all arrangers for those events
const eventArrangerLinks = await fetchAll('event_arrangers', 'event_id, arranger_id', q =>
  q.in('event_id', speakerEventIds)
);

// Count per arranger
const arrangerCounts: Record<number, number> = {};
for (const link of eventArrangerLinks) {
  arrangerCounts[link.arranger_id] = (arrangerCounts[link.arranger_id] || 0) + 1;
}

const topArrangerEntries = Object.entries(arrangerCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

// Fetch arranger names + sectors
const arrangerIds = topArrangerEntries.map(([id]) => parseInt(id));
const [arrangerNames, arrangerSectors] = await Promise.all([
  fetchAll('arrangers', 'id, name', q => q.in('id', arrangerIds)),
  fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', arrangerIds)),
]);

const nameMap = new Map(arrangerNames.map((a: any) => [a.id, a.name]));
const sectorMap = new Map(arrangerSectors.map((c: any) => [c.arranger_id, c.sector]));

const topOrganizations = topArrangerEntries.map(([id, count]) => ({
  id: parseInt(id),
  name: nameMap.get(parseInt(id)) || 'Unknown',
  sector: sectorMap.get(parseInt(id)) || null,
  eventCount: count,
}));
```

- [ ] **Step 3: Add topOrganizations to speaker profile response**

Add `topOrganizations` to the returned object alongside existing `speaker`, `stats`, `seminars`, `coPanelists`.

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add app/api/speakers/route.ts
git commit -m "feat: add topOrganizations to speaker profile API"
```

---

### Task 3: Display new sections in UI

**Files:**
- Modify: `app/speakers/page.tsx`

- [ ] **Step 1: Update ArrangerProfile type**

Add:
```tsx
topArenas: { name: string; eventCount: number }[];
coOrganizations: { id: number; name: string; sector: string | null; sharedEvents: number }[];
```

- [ ] **Step 2: Add "Samarbetande organisationer" section to aktörsprofil**

After the "Top speakers" section in the AktorerTab profile rendering, add a new card showing coOrganizations. Each item: name, sector color dot, shared events badge. **Clickable** → `onSelectArrangerId(org.id)` to navigate to that arranger's profile.

- [ ] **Step 3: Add "Arenor" section to aktörsprofil**

After coOrganizations, show topArenas. Each item: arena name, event count badge. Not clickable (no arena profile view).

- [ ] **Step 4: Update SpeakerProfile type**

Add:
```tsx
topOrganizations: { id: number; name: string; sector: string | null; eventCount: number }[];
```

- [ ] **Step 5: Add "Organisationer" section to talarprofil (ProfileView)**

After the "MEDPANELISTER" section in ProfileView, add a new card showing topOrganizations. Each item: name, sector dot, event count. **Clickable** → navigates to `/speakers?tab=aktorer&id=N`.

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit, push, deploy**

```bash
git add app/speakers/page.tsx app/api/arrangers/route.ts app/api/speakers/route.ts
git commit -m "feat: show co-organizations in aktör/talarprofil, arenas in aktörsprofil"
git push origin almedalen2026
vercel --prod --yes
```
