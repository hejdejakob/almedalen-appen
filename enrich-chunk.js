// Usage: node enrich-chunk.js <job> <chunk> <totalChunks>
// Jobs: topics, ner, sentiment
// Example: node enrich-chunk.js sentiment 3 10
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const JOB = process.argv[2] || 'sentiment';
const CHUNK = parseInt(process.argv[3]) || 1;
const TOTAL_CHUNKS = parseInt(process.argv[4]) || 10;
const BATCH_SIZE = 20;

async function fetchAll(table, columns, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data } = await q;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ============================================================
// JOB DEFINITIONS
// ============================================================

const JOBS = {
  topics: {
    system: `Du analyserar svenska Almedalsevenemang och bestämmer ämneskluster.

21 ämneskluster:
arbetsmarknad_löner, välfärd_omsorg, hälsa_sjukvård, skola_utbildning_forskning,
klimat_miljö_hållbarhet, energi, bostäder_samhällsbyggnad, transport_infrastruktur,
ekonomi_tillväxt, skatter_offentliga_finanser, näringsliv_innovation,
digitalisering_ai, försvar_säkerhet, demokrati_rättsstat,
integration_migration, eu_utrikespolitik, jämställdhet_mångfald,
media_kommunikation, kultur_idrott, barn_ungdom, övrigt

Svara med JSON-array:
[{"id": N, "topic_primary": "...", "topic_secondary": ["...", "..."], "keywords": ["...", "..."], "confidence": 0.0-1.0}]

topic_primary = det viktigaste klustret. topic_secondary = 0-2 ytterligare relevanta kluster.
keywords = 3-5 beskrivande nyckelord PÅ SVENSKA.
Svara ENBART med JSON.`,

    buildInput: (event) => ({
      id: event.id,
      title: event.title,
      description: (event.description || '').substring(0, 300),
      current_topic: event.topic_pdf_original,
    }),

    processResults: (results) => results.map(r => ({
      event_id: r.id,
      topic_primary: r.topic_primary,
      topic_secondary: r.topic_secondary || [],
      keywords: r.keywords || [],
      confidence: r.confidence || 0.8,
    })),

    table: 'event_topics',
    conflict: 'event_id',
  },

  ner: {
    system: `Du extraherar talare och panelister ur svenska Almedalsevenemang.

Läs titel och beskrivning. Identifiera NAMNGIVNA personer som deltar (inte organisationer).
Ignorera kontaktpersoner och arrangörer — fokusera på talare/panelister/moderatorer.

Svara med JSON-array:
[{"id": N, "speakers": [{"name": "Förnamn Efternamn", "title": "titel/roll", "org": "organisation", "role": "panelist|moderator|talare|okänt"}]}]

Om inga talare nämns: {"id": N, "speakers": []}
Svara ENBART med JSON.`,

    buildInput: (event) => ({
      id: event.id,
      title: event.title,
      description: (event.description || '').substring(0, 500),
      extended: (event.extended_description || '').substring(0, 500),
    }),

    processResults: null, // handled specially
    table: null,
  },

  sentiment: {
    system: `Du bedömer tonen i svenska Almedalsevenemang baserat på titel och beskrivning.

Svara med JSON-array:
[{"id": N, "score": FLOAT, "label": "...", "urgency_score": FLOAT, "framing": "...", "confidence": FLOAT}]

- score: -1.0 (mycket negativt) till 1.0 (mycket positivt). 0 = neutralt.
- label: "positiv" | "neutral" | "negativ"
- urgency_score: 0.0 (låg brådska) till 1.0 (akut/kris)
- framing: "problem" | "solution" | "neutral"
- confidence: 0.0-1.0

Svara ENBART med JSON.`,

    buildInput: (event) => ({
      id: event.id,
      title: event.title,
      description: (event.description || '').substring(0, 300),
    }),

    processResults: (results) => results.map(r => ({
      event_id: r.id,
      score: Math.max(-1, Math.min(1, r.score || 0)),
      label: ['positiv', 'neutral', 'negativ'].includes(r.label) ? r.label : 'neutral',
      urgency_score: Math.max(0, Math.min(1, r.urgency_score || 0)),
      framing: ['problem', 'solution', 'neutral'].includes(r.framing) ? r.framing : 'neutral',
      confidence: r.confidence || 0.7,
    })),

    table: 'event_sentiment',
    conflict: 'event_id',
  },
};

async function runBatch(job, events) {
  const input = events.map(job.buildInput);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: job.system,
    messages: [{ role: 'user', content: JSON.stringify(input, null, 1) }],
  });

  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON');
  return JSON.parse(match[0]);
}

async function handleNER(results, events) {
  // For each event with speakers, insert into speakers + event_speakers
  let speakerCount = 0;
  for (const r of results) {
    if (!r.speakers?.length) continue;
    const eventId = r.id;

    for (const sp of r.speakers) {
      if (!sp.name || sp.name.length < 3) continue;

      // Find or create speaker
      const normalized = sp.name.toLowerCase().trim();
      let { data: existing } = await supabase
        .from('speakers')
        .select('id')
        .eq('name_normalized', normalized)
        .limit(1);

      let speakerId;
      if (existing?.length) {
        speakerId = existing[0].id;
      } else {
        const { data: inserted } = await supabase
          .from('speakers')
          .insert({
            name: sp.name,
            name_normalized: normalized,
            title: sp.title || null,
            org_name: sp.org || null,
          })
          .select('id');
        if (inserted?.length) speakerId = inserted[0].id;
      }

      if (speakerId) {
        await supabase
          .from('event_speakers')
          .upsert({
            event_id: eventId,
            speaker_id: speakerId,
            role: sp.role || 'okänt',
            raw_mention: sp.name,
          }, { onConflict: 'event_id,speaker_id', ignoreDuplicates: true });
        speakerCount++;
      }
    }
  }
  return speakerCount;
}

async function main() {
  const job = JOBS[JOB];
  if (!job) { console.error('Unknown job:', JOB); process.exit(1); }

  // Fetch all events
  const events = await fetchAll('events', 'id, title, description, extended_description, topic_pdf_original');

  // Get already processed IDs to skip (idempotent)
  let processed = new Set();
  if (JOB === 'topics') {
    const existing = await fetchAll('event_topics', 'event_id', q => q.eq('confidence', null).or('confidence.gte.0'));
    // Actually just get all event_ids that have method sonnet
    const all = await fetchAll('event_topics', 'event_id');
    // We'll re-process all for now since existing data was rule-based
  } else if (JOB === 'sentiment') {
    const existing = await fetchAll('event_sentiment', 'event_id');
    processed = new Set(existing.map(e => e.event_id));
  }

  // Filter out already processed
  const todo = JOB === 'ner' || JOB === 'topics'
    ? events // process all
    : events.filter(e => !processed.has(e.id));

  // Split into chunk
  const chunkSize = Math.ceil(todo.length / TOTAL_CHUNKS);
  const start = (CHUNK - 1) * chunkSize;
  const end = Math.min(start + chunkSize, todo.length);
  const myChunk = todo.slice(start, end);

  console.log(`${JOB} chunk ${CHUNK}/${TOTAL_CHUNKS}: ${myChunk.length} events`);

  let done = 0;
  let errors = 0;

  for (let i = 0; i < myChunk.length; i += BATCH_SIZE) {
    const batch = myChunk.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, myChunk.length)}/${myChunk.length}`);

    try {
      const results = await runBatch(job, batch);

      if (JOB === 'ner') {
        const count = await handleNER(results, batch);
        done += count;
      } else {
        const rows = job.processResults(results);
        const { error } = await supabase
          .from(job.table)
          .upsert(rows, { onConflict: job.conflict });
        if (error) { console.error(`\nDB:`, error.message); errors++; }
        else done += rows.length;
      }
    } catch (err) {
      console.error(`\nAPI error:`, err.message?.substring(0, 100));
      errors++;
    }
  }

  console.log(`\n${JOB} chunk ${CHUNK} done: ${done} processed, ${errors} errors.`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
