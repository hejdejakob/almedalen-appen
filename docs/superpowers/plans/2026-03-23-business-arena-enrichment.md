# Business Arena arrangörs-enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identifiera de faktiska arrangörerna för Business Arena-events genom AI-parsning av beskrivningar, och ADDERA (inte ersätta) korrekta arrangörskopplingar.

**Architecture:** Fristående Node.js-script som (1) exporterar BA-events, (2) skickar till Claude Sonnet för analys, (3) matchar mot befintliga arrangörer, (4) genererar en review-fil, (5) efter manuell review applicerar ändringarna. ALDRIG direkt databas-skrivning utan review-steg.

**Tech Stack:** Node.js script, @anthropic-ai/sdk (Sonnet), Supabase JS client

---

## Datasäkerhet — ICKE-FÖRHANDLINGSBARA REGLER

1. **ALDRIG ta bort** befintliga `event_arrangers`-kopplingar — bara ADDERA nya
2. **ALDRIG skapa** nya arrangörer automatiskt — bara matcha mot befintliga i `arrangers`-tabellen
3. **Alla ändringar** skrivs först till en JSON review-fil som granskas manuellt
4. **Dubblettkoll** innan insert — kontrollera att kopplingen inte redan finns
5. **Confidence < 0.8** → flaggas för manuell review, appliceras INTE automatiskt
6. **Dry-run mode** som default — scriptet skriver INGENTING utan explicit `--apply` flagga

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `scripts/ba-enrichment-export.js` | Export BA events + speakers till JSON |
| Create | `scripts/ba-enrichment-analyze.js` | Sonnet-analys → review-fil |
| Create | `scripts/ba-enrichment-apply.js` | Applicera godkända ändringar |
| Output | `tmp/ba-events-export.json` | Exporterad data |
| Output | `tmp/ba-enrichment-review.json` | Review-fil med föreslagna ändringar |
| Output | `tmp/ba-enrichment-applied.json` | Logg över applicerade ändringar |

---

### Task 1: Export Business Arena events

**Files:**
- Create: `scripts/ba-enrichment-export.js`

- [ ] **Step 1: Create export script**

```js
// scripts/ba-enrichment-export.js
// Exports all Business Arena events with descriptions and linked speakers
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Get all events at Business Arena locations
  const { data: events } = await supabase
    .from('events')
    .select('id, year, title, description, extended_description, location_name')
    .or('location_name.ilike.%Business Arena%')
    .in('year', [2022, 2023, 2024, 2025]);

  console.log(`Found ${events.length} Business Arena events`);

  // 2. Get speakers for these events
  const eventIds = events.map(e => e.id);
  const { data: eventSpeakers } = await supabase
    .from('event_speakers')
    .select('event_id, speaker_id, role')
    .in('event_id', eventIds);

  const speakerIds = [...new Set(eventSpeakers.map(es => es.speaker_id))];
  const { data: speakers } = await supabase
    .from('speakers')
    .select('id, name, org_name, title')
    .in('id', speakerIds);

  const speakerMap = new Map(speakers.map(s => [s.id, s]));

  // 3. Get existing arrangers for these events
  const { data: existingLinks } = await supabase
    .from('event_arrangers')
    .select('event_id, arranger_id')
    .in('event_id', eventIds);

  const arrangerIds = [...new Set(existingLinks.map(l => l.arranger_id))];
  const { data: arrangers } = await supabase
    .from('arrangers')
    .select('id, name')
    .in('id', arrangerIds);

  const arrangerMap = new Map(arrangers.map(a => [a.id, a.name]));

  // 4. Build enriched export
  const result = events.map(e => {
    const eSpeakers = eventSpeakers
      .filter(es => es.event_id === e.id)
      .map(es => {
        const sp = speakerMap.get(es.speaker_id);
        return { role: es.role, name: sp?.name, org: sp?.org_name, title: sp?.title };
      });

    const eArrangers = existingLinks
      .filter(l => l.event_id === e.id)
      .map(l => ({ id: l.arranger_id, name: arrangerMap.get(l.arranger_id) }));

    return {
      id: e.id,
      year: e.year,
      title: e.title,
      description: e.description,
      extended_description: e.extended_description,
      location_name: e.location_name,
      current_arrangers: eArrangers,
      speakers: eSpeakers,
    };
  });

  writeFileSync('tmp/ba-events-export.json', JSON.stringify(result, null, 2));
  console.log(`Exported to tmp/ba-events-export.json`);
}

main().catch(console.error);
```

- [ ] **Step 2: Run export**

```bash
mkdir -p tmp
node scripts/ba-enrichment-export.js
```

Expected: `tmp/ba-events-export.json` with ~96 events

- [ ] **Step 3: Commit**

```bash
git add scripts/ba-enrichment-export.js
git commit -m "feat: add Business Arena event export script"
```

---

### Task 2: Sonnet analysis script

**Files:**
- Create: `scripts/ba-enrichment-analyze.js`

- [ ] **Step 1: Create analysis script**

The script reads the export, sends batches to Sonnet, and writes a review file.

```js
// scripts/ba-enrichment-analyze.js
// Analyzes BA events with Claude Sonnet to identify actual arrangers
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import 'dotenv/config';

const anthropic = new Anthropic();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getAllArrangers() {
  const rows = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('arrangers').select('id, name, name_normalized').range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function analyzeBatch(events, arrangerNames) {
  const prompt = `Du analyserar seminarier från Business Arena i Almedalen.
Business Arena är en eventplats/konferensarena. De listas som "arrangör" i källdatan,
men de faktiska arrangörerna är oftast andra organisationer som hyr in sig.

Analysera varje seminarium nedan. Baserat på titeln, beskrivningen och medverkande,
identifiera den FAKTISKA arrangören (inte Business Arena).

Ledtrådar:
- Beskrivningen kan säga "X presenterar", "arrangeras av X", "X bjuder in"
- Talarnas organisationer kan avslöja arrangören (t.ex. om alla talare är från Skanska → troligen Skanska)
- Om en organisation explicit nämns som presentatör i beskrivningen, prioritera det
- Om det är oklart, svara "unknown"

KÄNDA ARRANGÖRER I DATABASEN (matcha mot dessa om möjligt):
${arrangerNames.slice(0, 500).join(', ')}

Svara i JSON-format:
[
  {
    "event_id": <number>,
    "identified_arranger": "<name or 'unknown'>",
    "confidence": <0.0-1.0>,
    "reasoning": "<kort förklaring>"
  }
]

SEMINARIER:
${JSON.stringify(events.map(e => ({
  event_id: e.id,
  title: e.title,
  description: e.description,
  extended_description: e.extended_description?.slice(0, 300),
  speakers: e.speakers.filter(s => s.role !== 'kontaktperson').map(s => ({
    name: s.name, org: s.org, title: s.title
  }))
})), null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const events = JSON.parse(readFileSync('tmp/ba-events-export.json', 'utf-8'));
  const allArrangers = await getAllArrangers();
  const arrangerNames = allArrangers.map(a => a.name);

  // Build name→id lookup (case-insensitive)
  const nameLookup = new Map();
  for (const a of allArrangers) {
    nameLookup.set(a.name.toLowerCase(), a.id);
    if (a.name_normalized) nameLookup.set(a.name_normalized.toLowerCase(), a.id);
  }

  console.log(`Analyzing ${events.length} events against ${allArrangers.length} known arrangers...`);

  // Process in batches of 15
  const results = [];
  for (let i = 0; i < events.length; i += 15) {
    const batch = events.slice(i, i + 15);
    console.log(`Batch ${Math.floor(i/15) + 1}/${Math.ceil(events.length/15)}...`);
    try {
      const batchResults = await analyzeBatch(batch, arrangerNames);
      results.push(...batchResults);
    } catch (err) {
      console.error(`Batch error:`, err.message);
      // Mark all in batch as unknown
      for (const e of batch) {
        results.push({ event_id: e.id, identified_arranger: 'unknown', confidence: 0, reasoning: 'batch_error' });
      }
    }
    // Rate limit
    if (i + 15 < events.length) await new Promise(r => setTimeout(r, 1000));
  }

  // Match identified arrangers to database IDs
  const review = results.map(r => {
    const event = events.find(e => e.id === r.event_id);
    const existingArrangerIds = (event?.current_arrangers || []).map(a => a.id);

    let matchedId = null;
    let matchedName = null;
    if (r.identified_arranger && r.identified_arranger !== 'unknown') {
      // Try exact match (case-insensitive)
      matchedId = nameLookup.get(r.identified_arranger.toLowerCase()) || null;
      matchedName = r.identified_arranger;

      // Try partial match if no exact match
      if (!matchedId) {
        const searchLower = r.identified_arranger.toLowerCase();
        for (const [name, id] of nameLookup) {
          if (name.includes(searchLower) || searchLower.includes(name)) {
            matchedId = id;
            matchedName = name;
            break;
          }
        }
      }
    }

    const isDuplicate = matchedId && existingArrangerIds.includes(matchedId);

    return {
      event_id: r.event_id,
      event_title: event?.title || '',
      event_year: event?.year || null,
      current_arrangers: event?.current_arrangers || [],
      identified_arranger: r.identified_arranger,
      matched_arranger_id: matchedId,
      matched_arranger_name: matchedName,
      confidence: r.confidence,
      reasoning: r.reasoning,
      is_duplicate: isDuplicate,
      action: isDuplicate ? 'SKIP_DUPLICATE'
        : !matchedId ? 'SKIP_NO_MATCH'
        : r.confidence < 0.8 ? 'NEEDS_REVIEW'
        : 'ADD',
    };
  });

  // Summary
  const actions = { ADD: 0, SKIP_DUPLICATE: 0, SKIP_NO_MATCH: 0, NEEDS_REVIEW: 0 };
  for (const r of review) actions[r.action]++;
  console.log('\nSummary:');
  console.log(`  ADD (auto):        ${actions.ADD}`);
  console.log(`  NEEDS_REVIEW:      ${actions.NEEDS_REVIEW}`);
  console.log(`  SKIP_NO_MATCH:     ${actions.SKIP_NO_MATCH}`);
  console.log(`  SKIP_DUPLICATE:    ${actions.SKIP_DUPLICATE}`);
  console.log(`  Total:             ${review.length}`);

  writeFileSync('tmp/ba-enrichment-review.json', JSON.stringify(review, null, 2));
  console.log(`\nReview file: tmp/ba-enrichment-review.json`);
  console.log('NEXT: Review the file manually, then run ba-enrichment-apply.js --apply');
}

main().catch(console.error);
```

- [ ] **Step 2: Run analysis**

```bash
node scripts/ba-enrichment-analyze.js
```

Expected: `tmp/ba-enrichment-review.json` with proposed changes. Console shows summary.

- [ ] **Step 3: MANUAL REVIEW — user reviews tmp/ba-enrichment-review.json**

The user should:
1. Open `tmp/ba-enrichment-review.json`
2. Check all entries with `action: "ADD"` — are they correct?
3. Check entries with `action: "NEEDS_REVIEW"` — change action to `ADD` or `SKIP`
4. Optionally change any `ADD` to `SKIP` if incorrect

- [ ] **Step 4: Commit**

```bash
git add scripts/ba-enrichment-analyze.js
git commit -m "feat: add Business Arena Sonnet analysis script"
```

---

### Task 3: Apply reviewed changes

**Files:**
- Create: `scripts/ba-enrichment-apply.js`

- [ ] **Step 1: Create apply script**

```js
// scripts/ba-enrichment-apply.js
// Applies reviewed enrichment changes to the database
// REQUIRES --apply flag to actually write. Default is dry-run.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dryRun = !process.argv.includes('--apply');

async function main() {
  const review = JSON.parse(readFileSync('tmp/ba-enrichment-review.json', 'utf-8'));
  const toAdd = review.filter(r => r.action === 'ADD' && r.matched_arranger_id);

  console.log(`${dryRun ? 'DRY RUN — ' : ''}Processing ${toAdd.length} additions...`);

  const applied = [];
  const errors = [];

  for (const entry of toAdd) {
    // Double-check: does this link already exist?
    const { data: existing } = await supabase
      .from('event_arrangers')
      .select('event_id')
      .eq('event_id', entry.event_id)
      .eq('arranger_id', entry.matched_arranger_id)
      .single();

    if (existing) {
      console.log(`  SKIP (already exists): event ${entry.event_id} → arranger ${entry.matched_arranger_id}`);
      applied.push({ ...entry, result: 'SKIP_EXISTS' });
      continue;
    }

    if (dryRun) {
      console.log(`  WOULD ADD: event ${entry.event_id} (${entry.event_title}) → ${entry.matched_arranger_name} (${entry.matched_arranger_id})`);
      applied.push({ ...entry, result: 'DRY_RUN' });
    } else {
      const { error } = await supabase
        .from('event_arrangers')
        .insert({ event_id: entry.event_id, arranger_id: entry.matched_arranger_id, is_primary: false });

      if (error) {
        console.error(`  ERROR: event ${entry.event_id} → ${entry.matched_arranger_name}: ${error.message}`);
        errors.push({ ...entry, error: error.message });
      } else {
        console.log(`  ADDED: event ${entry.event_id} (${entry.event_title}) → ${entry.matched_arranger_name}`);
        applied.push({ ...entry, result: 'ADDED' });
      }
    }
  }

  writeFileSync('tmp/ba-enrichment-applied.json', JSON.stringify({ applied, errors, dryRun }, null, 2));
  console.log(`\n${dryRun ? 'DRY RUN complete' : 'Applied'}:`);
  console.log(`  Additions: ${applied.filter(a => a.result === 'ADDED' || a.result === 'DRY_RUN').length}`);
  console.log(`  Skipped (exists): ${applied.filter(a => a.result === 'SKIP_EXISTS').length}`);
  console.log(`  Errors: ${errors.length}`);
  if (dryRun) console.log('\nTo apply for real: node scripts/ba-enrichment-apply.js --apply');
}

main().catch(console.error);
```

- [ ] **Step 2: Dry-run first**

```bash
node scripts/ba-enrichment-apply.js
```

Expected: Shows what WOULD be added without touching database.

- [ ] **Step 3: Apply for real (after user approval)**

```bash
node scripts/ba-enrichment-apply.js --apply
```

Expected: Inserts new `event_arrangers` rows with `is_primary: false`. Business Arena remains as co-arranger.

- [ ] **Step 4: Commit**

```bash
git add scripts/ba-enrichment-apply.js
git commit -m "feat: add Business Arena enrichment apply script"
```

---

### Task 4: Verify data integrity

- [ ] **Step 1: Count check**

```bash
# Before apply: note total event_arrangers count
# After apply: verify count increased by expected amount
# Verify no existing rows were modified or deleted
```

- [ ] **Step 2: Spot-check in UI**

Visit Business Arena in arenaguiden — should now show varied arrangers instead of only "Business Arena".

- [ ] **Step 3: Verify no other views broke**

Check `/speakers`, `/dashboard`, `/arenaguiden` — all should still work.
