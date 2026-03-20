// Builds aggregate tables: arranger_stats, speaker_stats, topic_year_stats
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAll(table, columns, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function buildArrangerStats() {
  console.log('Building arranger_stats...');

  const events = await fetchAll('events', 'id, year');
  const eventYear = new Map(events.map(e => [e.id, e.year]));

  const links = await fetchAll('event_arrangers', 'arranger_id, event_id, is_primary');

  // Group links by event to determine sole vs co-arranger vs hosted
  const eventArrangers = new Map(); // event_id -> [{arranger_id, is_primary}]
  for (const link of links) {
    if (!eventArrangers.has(link.event_id)) eventArrangers.set(link.event_id, []);
    eventArrangers.get(link.event_id).push(link);
  }

  // Count events per arranger per year with role distinction
  const stats = new Map(); // key: arranger_id_year

  for (const link of links) {
    const year = eventYear.get(link.event_id);
    if (!year) continue;
    const key = `${link.arranger_id}_${year}`;
    if (!stats.has(key)) {
      stats.set(key, {
        arranger_id: link.arranger_id,
        year,
        events_count: 0,
        panel_slots_given: 0,
        panel_slots_received: 0,
      });
    }
    const s = stats.get(key);

    const coArrangers = eventArrangers.get(link.event_id) || [];
    if (link.is_primary) {
      // Primary arranger: full credit
      s.events_count++;
      s.panel_slots_given++;
    } else {
      // Non-primary (hosted/arena): 0.3 credit for events_count
      s.events_count += 0.3;
      s.panel_slots_received++;
    }
  }

  // Agenda power index: weighted events + primary bonus
  // panel_slots_given already counts only primary links
  const rows = [...stats.values()].map(s => ({
    ...s,
    events_count: Math.round(s.events_count),
    agenda_power_index: Math.round((s.events_count + s.panel_slots_given * 0.5) * 10) / 10,
  }));

  console.log(`  ${rows.length} arranger-year combos`);

  // Upsert in batches
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('arranger_stats')
      .upsert(batch, { onConflict: 'arranger_id,year' });
    if (error) console.error('  Error:', error.message);
  }
  console.log('  Done.');
}

async function buildSpeakerStats() {
  console.log('Building speaker_stats...');

  const events = await fetchAll('events', 'id, year');
  const eventYear = new Map(events.map(e => [e.id, e.year]));

  // Exclude kontaktperson — they are event organizers, not actual panelists
  const links = await fetchAll('event_speakers', 'speaker_id, event_id', q => q.neq('role', 'kontaktperson'));
  const eventArrangers = await fetchAll('event_arrangers', 'event_id, arranger_id');

  // Map event -> arrangers
  const eventToArrangers = new Map();
  for (const ea of eventArrangers) {
    if (!eventToArrangers.has(ea.event_id)) eventToArrangers.set(ea.event_id, new Set());
    eventToArrangers.get(ea.event_id).add(ea.arranger_id);
  }

  // Build per speaker per year
  const stats = new Map();
  const speakerYears = new Map(); // speaker_id -> Set of years

  for (const link of links) {
    const year = eventYear.get(link.event_id);
    if (!year) continue;

    const key = `${link.speaker_id}_${year}`;
    if (!stats.has(key)) {
      stats.set(key, {
        speaker_id: link.speaker_id,
        year,
        panel_count: 0,
        arrangers: new Set(),
      });
    }
    const s = stats.get(key);
    s.panel_count++;

    // Track unique arrangers
    const arrangers = eventToArrangers.get(link.event_id);
    if (arrangers) {
      for (const a of arrangers) s.arrangers.add(a);
    }

    // Track years active
    if (!speakerYears.has(link.speaker_id)) speakerYears.set(link.speaker_id, new Set());
    speakerYears.get(link.speaker_id).add(year);
  }

  const rows = [...stats.values()].map(s => {
    const yearsActive = speakerYears.get(s.speaker_id)?.size || 1;
    const uniqueArrangers = s.arrangers.size;
    // Breadth score: combines unique arrangers and years active
    const breadthScore = uniqueArrangers * 0.7 + yearsActive * 0.3;
    return {
      speaker_id: s.speaker_id,
      year: s.year,
      panel_count: s.panel_count,
      unique_arrangers: uniqueArrangers,
      years_active: yearsActive,
      breadth_score: Math.round(breadthScore * 100) / 100,
    };
  });

  console.log(`  ${rows.length} speaker-year combos`);

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('speaker_stats')
      .upsert(batch, { onConflict: 'speaker_id,year' });
    if (error) console.error('  Error:', error.message);
  }
  console.log('  Done.');
}

async function buildTopicYearStats() {
  console.log('Building topic_year_stats...');

  const events = await fetchAll('events', 'id, year');
  const eventYear = new Map(events.map(e => [e.id, e.year]));

  const topics = await fetchAll('event_topics', 'event_id, topic_primary');
  const sentiment = await fetchAll('event_sentiment', 'event_id, score');
  const eventArrangers = await fetchAll('event_arrangers', 'event_id, arranger_id');

  // Map event -> sentiment score
  const eventSentiment = new Map(sentiment.map(s => [s.event_id, s.score]));

  // Map event -> arrangers
  const eventToArrangers = new Map();
  for (const ea of eventArrangers) {
    if (!eventToArrangers.has(ea.event_id)) eventToArrangers.set(ea.event_id, []);
    eventToArrangers.get(ea.event_id).push(ea.arranger_id);
  }

  // Get arranger names
  const arrangers = await fetchAll('arrangers', 'id, name');
  const arrangerNames = new Map(arrangers.map(a => [a.id, a.name]));

  // Build per topic per year
  const stats = new Map();

  for (const t of topics) {
    const year = eventYear.get(t.event_id);
    if (!year || !t.topic_primary) continue;

    const key = `${t.topic_primary}_${year}`;
    if (!stats.has(key)) {
      stats.set(key, {
        topic: t.topic_primary,
        year,
        event_count: 0,
        sentiments: [],
        arrangerCounts: {},
      });
    }
    const s = stats.get(key);
    s.event_count++;

    const sent = eventSentiment.get(t.event_id);
    if (sent !== undefined) s.sentiments.push(sent);

    const arrIds = eventToArrangers.get(t.event_id) || [];
    for (const aid of arrIds) {
      s.arrangerCounts[aid] = (s.arrangerCounts[aid] || 0) + 1;
    }
  }

  // Calculate YoY change and top arrangers
  const topicsByYear = new Map(); // topic -> { year -> count }
  for (const s of stats.values()) {
    if (!topicsByYear.has(s.topic)) topicsByYear.set(s.topic, {});
    topicsByYear.get(s.topic)[s.year] = s.event_count;
  }

  const rows = [...stats.values()].map(s => {
    const avgSentiment = s.sentiments.length > 0
      ? Math.round((s.sentiments.reduce((a, b) => a + b, 0) / s.sentiments.length) * 1000) / 1000
      : null;

    // YoY change
    const prevYear = topicsByYear.get(s.topic)?.[s.year - 1];
    const yoyChange = prevYear
      ? Math.round(((s.event_count - prevYear) / prevYear) * 1000) / 10
      : null;

    // Top 5 arrangers
    const topArr = Object.entries(s.arrangerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ name: arrangerNames.get(parseInt(id)) || 'Unknown', count }));

    return {
      topic: s.topic,
      year: s.year,
      event_count: s.event_count,
      yoy_change_pct: yoyChange,
      avg_sentiment: avgSentiment,
      top_arrangers: topArr,
    };
  });

  console.log(`  ${rows.length} topic-year combos`);

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('topic_year_stats')
      .upsert(batch, { onConflict: 'topic,year' });
    if (error) console.error('  Error:', error.message);
  }
  console.log('  Done.');
}

async function main() {
  await buildArrangerStats();
  await buildSpeakerStats();
  await buildTopicYearStats();

  // Verify
  for (const table of ['arranger_stats', 'speaker_stats', 'topic_year_stats']) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`${table}: ${count} rows`);
  }
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
