# Merge Talarsök + Talarkollen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine `/speakers` (search + profile) and `/talarkollen` (curated lists) into a single page at `/speakers` with a tab-based entry point, then remove `/talarkollen`.

**Architecture:** Add a top-level tab bar to the existing `/speakers` page with two modes: "Sök" (existing search) and "Talarkollen" (curated lists). The curated lists tab embeds the talarkollen content (Rising Stars / Evergreens / Hög Bredd sub-tabs + topic filter). Clicking a speaker in the curated list opens the same profile view already in `/speakers`. The `/talarkollen` route becomes a redirect.

**Tech Stack:** React 19 (client component), Next.js 16 App Router, existing APIs (`/api/speakers`, `/api/dashboard?view=speaker-guide`)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/speakers/page.tsx` | Add top-level tabs, embed talarkollen content |
| Modify | `app/talarkollen/page.tsx` | Replace with redirect to `/speakers?tab=talarkollen` |
| Modify | `app/page.tsx` | Update any links pointing to `/talarkollen` |

---

### Task 0: Fix search race condition (DONE)

**Files:**
- Modify: `app/speakers/page.tsx:159-194` (searchSpeakers + handleQueryChange)

**Root cause:** Multiple debounced fetch requests could return out of order, causing stale results to overwrite newer results. No cancellation of in-flight requests.

**Symptoms:** "Inga träffar" flashes briefly, then one result appears, then disappears, then all speakers show again.

**Fix applied:** Added `AbortController` — each new `searchSpeakers` call aborts the previous in-flight request. State updates (`setResults`, `setLoading`, `setHasSearched`) are guarded by `!controller.signal.aborted` to prevent stale responses from updating state. AbortError is caught silently.

- [x] Added `abortRef = useRef<AbortController | null>(null)`
- [x] Each `searchSpeakers` call aborts previous controller before creating new one
- [x] `fetch` receives `{ signal: controller.signal }`
- [x] State updates guarded by `!controller.signal.aborted`
- [x] Build verified

---

### Task 1: Add top-level tab navigation to `/speakers`

**Files:**
- Modify: `app/speakers/page.tsx:137-143` (SpeakersPage wrapper)
- Modify: `app/speakers/page.tsx:145-245` (SpeakersContent — add tab state + conditional render)

- [ ] **Step 1: Add tab state and URL sync**

In `SpeakersContent`, add a `mode` state driven by the `tab` search param:

```tsx
const initialTab = searchParams.get('tab');
const [mode, setMode] = useState<'search' | 'talarkollen'>(
  initialTab === 'talarkollen' ? 'talarkollen' : 'search'
);

const switchMode = (m: 'search' | 'talarkollen') => {
  setMode(m);
  router.replace(m === 'talarkollen' ? '/speakers?tab=talarkollen' : '/speakers', { scroll: false });
  // Reset sub-views when switching mode
  setProfile(null);
  setEventDetail(null);
};
```

- [ ] **Step 2: Add tab bar UI below header**

Insert a tab bar between the `<header>` and `<main>` in `SpeakersContent`:

```tsx
{/* Top-level mode tabs — only show when not in profile/event detail */}
{!profile && !eventDetail && (
  <div style={{
    maxWidth: '1400px',
    margin: '0 auto',
    padding: isMobile ? '0.75rem 1rem 0' : '1rem 2rem 0',
    display: 'flex',
    gap: 0,
    borderBottom: '2px solid #ddd',
    backgroundColor: '#f7f5e4',
  }}>
    {([
      { key: 'search' as const, label: 'Talarsök' },
      { key: 'talarkollen' as const, label: 'Talarkollen' },
    ]).map(tab => (
      <button
        key={tab.key}
        onClick={() => switchMode(tab.key)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.75rem 1.25rem',
          fontSize: '0.95rem',
          fontWeight: mode === tab.key ? 700 : 500,
          color: mode === tab.key ? '#000' : '#666',
          borderBottom: mode === tab.key ? '3px solid #ff6632' : '3px solid transparent',
          marginBottom: '-2px',
          fontFamily: 'var(--body-text)',
        }}
      >
        {tab.label}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Conditionally render search vs talarkollen in main**

Wrap the existing search content in `{mode === 'search' && (...)}` and add `{mode === 'talarkollen' && <TalarkollenTab onOpenProfile={openProfile} />}`.

- [ ] **Step 4: Update header to be dynamic**

Change the header title/subtitle based on mode:

```tsx
<h1 ...>
  {mode === 'talarkollen' ? 'TALARKOLLEN' : 'TALARSÖK'}
</h1>
<p ...>
  {mode === 'talarkollen'
    ? 'Vem ska du ha på scen?'
    : 'Sök bland 16 509 paneldeltagare från Almedalsveckan 2022–2025'}
</p>
```

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: Build succeeds (TalarkollenTab doesn't exist yet — this step may fail, that's fine, proceed to Task 2)

- [ ] **Step 6: Commit**

```bash
git add app/speakers/page.tsx
git commit -m "feat: add top-level tab navigation for search/talarkollen modes"
```

---

### Task 2: Create TalarkollenTab component inside speakers page

**Files:**
- Modify: `app/speakers/page.tsx` — add TalarkollenTab component

- [ ] **Step 1: Port types and constants from talarkollen**

Add these to `app/speakers/page.tsx` (above TalarkollenTab). Reuse `formatTopic` which already exists in the file — just add the missing pieces:

```tsx
// --- Talarkollen types & constants ---

interface TalarkollenEntry {
  id: number;
  name: string;
  title: string | null;
  org_name: string | null;
  totalPanels: number;
  years: number[];
  uniqueArrangers: number;
  breadth: number;
  topTopics: { topic: string; count: number }[];
  minYear: number;
  maxYear: number;
}

interface TalarkollenData {
  rising_stars: TalarkollenEntry[];
  evergreens: TalarkollenEntry[];
  high_breadth: TalarkollenEntry[];
}

const ALL_YEARS = [2022, 2023, 2024, 2025];

const TALARKOLLEN_TOPICS = [
  'arbetsmarknad_löner', 'välfärd_omsorg', 'hälsa_sjukvård',
  'skola_utbildning_forskning', 'klimat_miljö_hållbarhet', 'energi',
  'bostäder_samhällsbyggnad', 'transport_infrastruktur', 'ekonomi_tillväxt',
  'skatter_offentliga_finanser', 'näringsliv_innovation', 'digitalisering_ai',
  'försvar_säkerhet', 'demokrati_rättsstat', 'integration_migration',
  'eu_utrikespolitik', 'jämställdhet_mångfald', 'media_kommunikation',
  'kultur_idrott', 'barn_ungdom', 'övrigt',
];

const TOPIC_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#6a4c93', '#1982c4', '#ff595e', '#8ac926',
];

function topicColor(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = ((hash << 5) - hash) + topic.charCodeAt(i);
  return TOPIC_COLORS[Math.abs(hash) % TOPIC_COLORS.length];
}

type TalarkollenTabKey = 'rising_stars' | 'evergreens' | 'high_breadth';
```

- [ ] **Step 2: Build the TalarkollenTab component**

Port the talarkollen rendering logic, but wire `onOpenProfile` to navigate into the shared profile view:

```tsx
function TalarkollenTab({ onOpenProfile }: { onOpenProfile: (id: number) => void }) {
  const [data, setData] = useState<TalarkollenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TalarkollenTabKey>('rising_stars');
  const [topicFilter, setTopicFilter] = useState<string>('');

  useEffect(() => {
    fetch('/api/dashboard?view=speaker-guide')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const speakers: TalarkollenEntry[] = data ? data[activeTab] : [];
  const filtered = topicFilter
    ? speakers.filter(s => s.topTopics.some(t => t.topic === topicFilter))
    : speakers;

  const TABS: { key: TalarkollenTabKey; label: string }[] = [
    { key: 'rising_stars', label: 'Rising Stars' },
    { key: 'evergreens', label: 'Evergreens' },
    { key: 'high_breadth', label: 'Hög Bredd' },
  ];

  // ... render sub-tabs, topic filter, and speaker cards
  // Each card: onClick={() => onOpenProfile(speaker.id)}
}
```

The card rendering should be ported from the existing `SpeakerCard` in talarkollen, but with `onClick={() => onOpenProfile(speaker.id)}` to open the full profile view.

- [ ] **Step 3: Add intro text and tab descriptions**

Port the intro paragraph and per-tab descriptions from talarkollen:

```tsx
<p style={{ fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem', color: '#333' }}>
  Almedalens 16&nbsp;000+ talare har olika profiler. Vissa är evergreens som dyker upp varje år,
  andra är nya röster på väg upp. Här hittar du rätt panelist för ditt seminarium.
</p>
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: Build succeeds, no type errors

- [ ] **Step 5: Commit**

```bash
git add app/speakers/page.tsx
git commit -m "feat: embed talarkollen curated lists in speakers page"
```

---

### Task 3: Redirect `/talarkollen` and update links

**Files:**
- Modify: `app/talarkollen/page.tsx` — replace with redirect
- Modify: `app/page.tsx` — update any `/talarkollen` links

- [ ] **Step 1: Replace talarkollen page with redirect**

Replace the entire content of `app/talarkollen/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function TalarkollenRedirect() {
  redirect('/speakers?tab=talarkollen');
}
```

Remove the `'use client'` directive — this is a server component redirect.

- [ ] **Step 2: Update links on the homepage**

Search `app/page.tsx` for any links to `/talarkollen` and update them to `/speakers?tab=talarkollen`.

- [ ] **Step 3: Verify build and navigation**

Run: `npm run build`
Expected: Build succeeds. Navigating to `/talarkollen` redirects to `/speakers?tab=talarkollen`.

- [ ] **Step 4: Commit**

```bash
git add app/talarkollen/page.tsx app/page.tsx
git commit -m "feat: redirect /talarkollen to /speakers?tab=talarkollen, update links"
```

---

### Task 4: Clean up

**Files:**
- Modify: `app/speakers/page.tsx` — final review

- [ ] **Step 1: Verify profile navigation works from both tabs**

Manually verify (or check code paths):
1. Search tab → click speaker → profile loads
2. Talarkollen tab → click speaker → same profile loads
3. Back button from profile returns to the correct tab

- [ ] **Step 2: Verify the "Tillbaka" link in header goes to homepage**

The header currently has `← Dashboard` linking to `/`. Keep this.

- [ ] **Step 3: Final build**

Run: `npm run build`
Expected: Clean build, no warnings

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final cleanup after merging speaker pages"
```
