# Pensioner-undersida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skapa en undersida `/pensioner` som visar allt om pensionsfrågan i Almedalen — events, trender, toppaktörer, topptalare, sentiment, vilka som driver frågan.

**Architecture:** Ny API-vy `pension-deep` som söker events via nyckelord i title/description/extended_description (inte ämneskluster). Fristående sida med dark theme som `/insikter`. Inga ändringar i befintlig data eller API:er.

**Tech Stack:** Existing — Supabase, Next.js, React inline styles

---

## Varför nyckelordssök?

"Pensioner" är inte ett eget ämneskluster i taxonomin. Events om pensioner fördelas över `ekonomi_tillväxt`, `välfärd_omsorg`, `arbetsmarknad_löner` m.fl. Nyckelordssök i title + description + extended_description fångar alla 84 events (24→19→11→24→6 per år).

**Söktermer:** `pension` (fångar pension, pensionär, pensionssystem, tjänstepension, premiepension, fattigpensionär, pensionsålder etc.)

---

## Datasäkerhet

- Enbart läsning — inga writes
- Ny separat API-vy — rör ingenting befintligt
- Ny sida — inte länkad från navigation

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/api/dashboard/route.ts` | Add `pension-deep` view |
| Create | `app/pensioner/page.tsx` | Pension topic deep-dive page |

---

### Task 1: API — pension-deep view

**Files:**
- Modify: `app/api/dashboard/route.ts` — add to view switch chain + new function

Lägg till `pension-deep` i if/else-kedjan (FÖRE final else). Ny funktion `getPensionDeep()`.

- [ ] **Step 1: Add view to switch chain**

```tsx
} else if (view === 'pension-deep') {
  return NextResponse.json(await getPensionDeep());
}
```

Update error message with valid views.

- [ ] **Step 2: Implement getPensionDeep()**

```tsx
async function getPensionDeep() {
  // 1. Find all events matching "pension" in title, description, or extended_description
  const allEvents = await fetchAll('events', 'id, year, title, description, location_name');
  const pensionEvents = allEvents.filter(e =>
    VISIBLE_YEARS.includes(e.year) && (
      (e.title || '').toLowerCase().includes('pension') ||
      (e.description || '').toLowerCase().includes('pension')
    )
  );
  // Also check extended_description for events not yet matched
  const eventIds = pensionEvents.map(e => e.id);
  // For extended_description, fetch separately if needed (already in allEvents? check schema)

  const pensionEventIds = new Set(pensionEvents.map(e => e.id));

  // 2. Per year counts
  const perYear: Record<number, number> = {};
  for (const e of pensionEvents) {
    perYear[e.year] = (perYear[e.year] || 0) + 1;
  }

  // 3. Top arrangers
  const eventArrangerLinks = await fetchAll('event_arrangers', 'event_id, arranger_id');
  const arrangerCounts: Record<number, number> = {};
  for (const link of eventArrangerLinks) {
    if (!pensionEventIds.has(link.event_id)) continue;
    arrangerCounts[link.arranger_id] = (arrangerCounts[link.arranger_id] || 0) + 1;
  }
  // Resolve names + sectors for top 15

  // 4. Top speakers
  const eventSpeakerLinks = await fetchAll('event_speakers', 'event_id, speaker_id, role');
  const speakerCounts: Record<number, number> = {};
  for (const link of eventSpeakerLinks) {
    if (!pensionEventIds.has(link.event_id) || link.role === 'kontaktperson') continue;
    speakerCounts[link.speaker_id] = (speakerCounts[link.speaker_id] || 0) + 1;
  }
  // Resolve names for top 15

  // 5. Topic distribution (which ämneskluster get classified as)
  const eventTopics = await fetchAll('event_topics', 'event_id, topic_primary');
  const topicCounts: Record<string, number> = {};
  for (const t of eventTopics) {
    if (!pensionEventIds.has(t.event_id) || !t.topic_primary) continue;
    topicCounts[t.topic_primary] = (topicCounts[t.topic_primary] || 0) + 1;
  }

  // 6. Sentiment
  const sentiments = await fetchAll('event_sentiment', 'event_id, score, label');
  let sentSum = 0, sentCount = 0, pos = 0, neu = 0, neg = 0;
  for (const s of sentiments) {
    if (!pensionEventIds.has(s.event_id)) continue;
    sentSum += s.score; sentCount++;
    if (s.label === 'positiv') pos++;
    else if (s.label === 'neutral') neu++;
    else neg++;
  }

  // 7. Sector breakdown (from arrangers)
  const arrangerClassifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
  const sectorMap = new Map(arrangerClassifications.map(c => [c.arranger_id, c.sector]));
  const sectorCounts: Record<string, number> = {};
  for (const link of eventArrangerLinks) {
    if (!pensionEventIds.has(link.event_id)) continue;
    const sector = sectorMap.get(link.arranger_id);
    if (sector) sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  }

  // 8. Sample events (latest 10 with title)
  const sampleEvents = pensionEvents
    .sort((a, b) => b.year - a.year)
    .slice(0, 20)
    .map(e => ({ id: e.id, year: e.year, title: e.title }));

  return {
    totalEvents: pensionEvents.length,
    perYear,
    topArrangers, // top 15 with { id, name, sector, events }
    topSpeakers,  // top 15 with { id, name, title, org, events }
    topicDistribution, // [{ topic, count }]
    sectorBreakdown, // [{ sector, count }]
    sentiment: { avg: sentCount > 0 ? sentSum/sentCount : 0, pos, neu, neg, total: sentCount },
    sampleEvents,
  };
}
```

NOTE: The above is pseudocode. The implementer should read the existing dashboard route for patterns (fetchAll, name resolution, etc.) and write the complete function.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "feat: add pension-deep API view"
```

---

### Task 2: Pensioner-sida

**Files:**
- Create: `app/pensioner/page.tsx`

Dark theme, mobile-first, matching `/insikter` style.

- [ ] **Step 1: Create page with data fetch**

Client component that fetches `/api/dashboard?view=pension-deep`.

- [ ] **Step 2: Header**

```
PENSIONER I ALMEDALEN
84 seminarier · 2022–2025 · Vem driver pensionsfrågan?
```

- [ ] **Step 3: Trend section**

"TRENDEN" — per-year bar chart showing 24→19→11→24 pattern.
Callout: "Pensionsfrågan dippade 2024 men har gjort stark comeback 2025."

- [ ] **Step 4: Vem driver frågan? — Top arrangers**

List of top 15 arrangers with sector badges and event counts.
Clickable → `/speakers?tab=aktorer&id=N`

- [ ] **Step 5: Pensionsrösterna — Top speakers**

Top 15 speakers with name, title, org, event count.
Clickable → `/speakers?id=N`

- [ ] **Step 6: Vilka ämneskluster fångar pensioner?**

Show topic distribution — "Pension-events klassificeras som: ekonomi_tillväxt (35%), arbetsmarknad_löner (25%), välfärd_omsorg (20%)..."
Horizontal bars.

- [ ] **Step 7: Sektorer som pratar pension**

Sector breakdown bar — who drives the pension discussion?

- [ ] **Step 8: Tonläge**

Sentiment score + pos/neu/neg breakdown.
"Är pensionsdebatten optimistisk eller dyster?"

- [ ] **Step 9: Senaste seminarierna**

List of 20 latest pension events with year + title. Clickable if possible.

- [ ] **Step 10: Verify build**

Run: `npm run build`

- [ ] **Step 11: Commit, push, deploy**

```bash
git add app/pensioner/page.tsx app/api/dashboard/route.ts
git commit -m "feat: add /pensioner deep-dive page"
git push origin almedalen2026
vercel --prod --yes
```
