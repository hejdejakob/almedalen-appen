import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { rateLimitApi } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Years to show in frontend (2026 data exists but is incomplete)
const VISIBLE_YEARS = [2022, 2023, 2024, 2025, 2026]; // 2026 komplett klassat → med i trender

async function fetchAll(table: string, columns: string, filter?: (q: any) => any) {
  const rows: any[] = [];
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

export async function GET(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const { allowed, retryAfterMs } = rateLimitApi(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'För många anrop. Försök igen senare.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view');

  try {
    if (view === 'stats') {
      return NextResponse.json(await getStats());
    } else if (view === 'topics') {
      return NextResponse.json(await getTopicTrends());
    } else if (view === 'sectors') {
      return NextResponse.json(await getSectorBalance());
    } else if (view === 'power') {
      return NextResponse.json(await getAgendaPower());
    } else if (view === 'sentiment') {
      return NextResponse.json(await getSentimentPulse());
    } else if (view === 'speakers') {
      return NextResponse.json(await getTopSpeakers());
    } else if (view === 'network') {
      return NextResponse.json(await getNetwork());
    } else if (view === 'locations') {
      return NextResponse.json(await getLocations());
    } else if (view === 'topic-deep') {
      return NextResponse.json(await getTopicDeep());
    } else if (view === 'arena-network') {
      return NextResponse.json(await getArenaNetwork());
    } else if (view === 'arena-guide') {
      return NextResponse.json(await getArenaGuide());
    } else if (view === 'speaker-guide') {
      return NextResponse.json(await getSpeakerGuide());
    } else if (view === 'topic-detail') {
      const topic = searchParams.get('topic');
      if (!topic) {
        return NextResponse.json({ error: 'Missing required parameter: topic' }, { status: 400 });
      }
      return NextResponse.json(await getTopicDetail(topic));
    } else if (view === 'arena-detail') {
      const arena = searchParams.get('arena');
      if (!arena) return NextResponse.json({ error: 'Missing arena parameter' }, { status: 400 });
      return NextResponse.json(await getArenaDetail(arena));
    } else if (view === 'pension-deep') {
      return NextResponse.json(await getPensionDeep());
    } else {
      return NextResponse.json({ error: 'Unknown view. Use: stats, topics, sectors, power, sentiment, speakers, network, locations, arena-network, arena-guide, speaker-guide, topic-detail, arena-detail, pension-deep' }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("Dashboard API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Något gick fel. Försök igen senare." }, { status: 500 });
  }
}

async function getStats() {
  const [eventsRes, arrangersRes, speakersRes, eventSpeakersRes, topicsRes, sentimentRes] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('arrangers').select('id', { count: 'exact', head: true }),
    supabase.from('speakers').select('id', { count: 'exact', head: true }),
    supabase.from('event_speakers').select('event_id', { count: 'exact', head: true }),
    supabase.from('event_topics').select('event_id', { count: 'exact', head: true }),
    supabase.from('event_sentiment').select('event_id', { count: 'exact', head: true }),
  ]);

  // Events per year
  const eventsData = await fetchAll('events', 'year');
  const perYear: Record<number, number> = {};
  for (const e of eventsData) {
    perYear[e.year] = (perYear[e.year] || 0) + 1;
  }

  return {
    events: eventsRes.count || 0,
    arrangers: arrangersRes.count || 0,
    speakers: speakersRes.count || 0,
    eventSpeakerLinks: eventSpeakersRes.count || 0,
    topicsClassified: topicsRes.count || 0,
    sentimentAnalyzed: sentimentRes.count || 0,
    eventsPerYear: Object.entries(perYear)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year),
  };
}

async function getTopicTrends() {
  const { data } = await supabase
    .from('topic_year_stats')
    .select('topic, year, event_count, yoy_change_pct, avg_sentiment, top_arrangers')
    .order('year', { ascending: true });

  // Group by topic, filtering to visible years
  const byTopic: Record<string, any[]> = {};
  for (const row of data || []) {
    if (!VISIBLE_YEARS.includes(row.year)) continue;
    if (!byTopic[row.topic]) byTopic[row.topic] = [];
    byTopic[row.topic].push(row);
  }

  // Sort topics by total volume
  const topics = Object.entries(byTopic)
    .map(([topic, years]) => ({
      topic,
      years,
      totalEvents: years.reduce((s, y) => s + y.event_count, 0),
      latestYoY: years.find(y => y.year === 2024)?.yoy_change_pct ?? null,
      avgSentiment: years.reduce((s, y) => s + (y.avg_sentiment || 0), 0) / years.length,
    }))
    .sort((a, b) => b.totalEvents - a.totalEvents);

  return { topics, years: VISIBLE_YEARS };
}

async function getSectorBalance() {
  const classifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
  const links = await fetchAll('event_arrangers', 'arranger_id, event_id');
  const events = await fetchAll('events', 'id, year');

  const eventYear = new Map(events.map((e: any) => [e.id, e.year]));
  const arrangerSector = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));

  // Count events per sector per year
  const counts: Record<string, Record<number, number>> = {};
  for (const link of links) {
    const year = eventYear.get(link.event_id);
    const sector = arrangerSector.get(link.arranger_id);
    if (!year || !sector || !VISIBLE_YEARS.includes(year)) continue;
    if (!counts[sector]) counts[sector] = {};
    counts[sector][year] = (counts[sector][year] || 0) + 1;
  }

  const years = VISIBLE_YEARS;

  // Calculate totals per year for normalization
  const yearTotals: Record<number, number> = {};
  for (const yearCounts of Object.values(counts)) {
    for (const y of years) {
      yearTotals[y] = (yearTotals[y] || 0) + (yearCounts[y] || 0);
    }
  }

  const sectors = Object.entries(counts)
    .map(([sector, yearCounts]) => ({
      sector,
      values: years.map(y => yearCounts[y] || 0),
      valuesNormalized: years.map(y => {
        const total = yearTotals[y] || 1;
        return Math.round(((yearCounts[y] || 0) / total) * 1000) / 10;
      }),
      total: Object.values(yearCounts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return { sectors, years };
}

async function getAgendaPower() {
  // Top 100 arrangers by total agenda power
  const stats = await fetchAll('arranger_stats', 'arranger_id, year, events_count, panel_slots_given, panel_slots_received, agenda_power_index');

  // Aggregate across visible years only
  const totals: Record<number, { events: number; given: number; received: number; power: number; years: Set<number> }> = {};
  for (const s of stats) {
    if (!VISIBLE_YEARS.includes(s.year)) continue;
    if (!totals[s.arranger_id]) totals[s.arranger_id] = { events: 0, given: 0, received: 0, power: 0, years: new Set() };
    totals[s.arranger_id].events += s.events_count;
    totals[s.arranger_id].given += s.panel_slots_given || 0;
    totals[s.arranger_id].received += s.panel_slots_received || 0;
    totals[s.arranger_id].power += s.agenda_power_index;
    totals[s.arranger_id].years.add(s.year);
  }

  const topIds = Object.entries(totals)
    .sort((a, b) => b[1].power - a[1].power)
    .slice(0, 100);

  // Get arranger names and sectors
  const arrangers = await fetchAll('arrangers', 'id, name');
  const classifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
  const nameMap = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const sectorMap = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));

  const result = topIds.map(([id, data]) => ({
    id: parseInt(id),
    name: nameMap.get(parseInt(id)) || 'Unknown',
    sector: sectorMap.get(parseInt(id)) || 'unknown',
    totalEvents: data.events,
    panelSlotsGiven: data.given,
    panelSlotsReceived: data.received,
    agendaPower: Math.round(data.power * 10) / 10,
    yearsActive: data.years.size,
  }));

  return { arrangers: result };
}

async function getSentimentPulse() {
  const sentiment = await fetchAll('event_sentiment', 'event_id, score, label, framing, urgency_score');
  const events = await fetchAll('events', 'id, year');
  const eventYear = new Map(events.map((e: any) => [e.id, e.year]));

  // Per year averages
  const years: Record<number, { scores: number[]; labels: Record<string, number>; framings: Record<string, number> }> = {};
  for (const s of sentiment) {
    const year = eventYear.get(s.event_id);
    if (!year || !VISIBLE_YEARS.includes(year)) continue;
    if (!years[year]) years[year] = { scores: [], labels: {}, framings: {} };
    years[year].scores.push(s.score);
    years[year].labels[s.label] = (years[year].labels[s.label] || 0) + 1;
    years[year].framings[s.framing] = (years[year].framings[s.framing] || 0) + 1;
  }

  const yearData = Object.entries(years)
    .map(([year, data]) => ({
      year: parseInt(year),
      avgScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 1000) / 1000,
      avgUrgency: 0,
      labels: data.labels,
      framings: data.framings,
      eventCount: data.scores.length,
    }))
    .sort((a, b) => a.year - b.year);

  // Sector sentiment heatmap
  const classifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
  const links = await fetchAll('event_arrangers', 'arranger_id, event_id');
  const arrangerSector = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));
  const eventSentiment = new Map(sentiment.map((s: any) => [s.event_id, s.score]));

  const sectorYearSentiment: Record<string, Record<number, number[]>> = {};
  for (const link of links) {
    const sector = arrangerSector.get(link.arranger_id);
    const year = eventYear.get(link.event_id);
    const score = eventSentiment.get(link.event_id);
    if (!sector || !year || score === undefined || !VISIBLE_YEARS.includes(year)) continue;
    if (!sectorYearSentiment[sector]) sectorYearSentiment[sector] = {};
    if (!sectorYearSentiment[sector][year]) sectorYearSentiment[sector][year] = [];
    sectorYearSentiment[sector][year].push(score);
  }

  const heatmap = Object.entries(sectorYearSentiment).map(([sector, yearData]) => ({
    sector,
    years: Object.entries(yearData)
      .map(([year, scores]) => ({
        year: parseInt(year),
        avgSentiment: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000,
        count: scores.length,
      }))
      .sort((a, b) => a.year - b.year),
  }));

  return { yearData, heatmap };
}

async function getTopSpeakers() {
  const stats = await fetchAll('speaker_stats', 'speaker_id, year, panel_count, unique_arrangers, years_active, breadth_score');

  // Aggregate across visible years
  const totals: Record<number, { panels: number; arrangers: Set<number>; years: Set<number>; breadth: number }> = {};
  for (const s of stats) {
    if (!VISIBLE_YEARS.includes(s.year)) continue;
    if (!totals[s.speaker_id]) totals[s.speaker_id] = { panels: 0, arrangers: new Set(), years: new Set(), breadth: 0 };
    totals[s.speaker_id].panels += s.panel_count;
    totals[s.speaker_id].years.add(s.year);
    totals[s.speaker_id].breadth = Math.max(totals[s.speaker_id].breadth, s.breadth_score);
  }

  const topIds = Object.entries(totals)
    .sort((a, b) => b[1].panels - a[1].panels)
    .slice(0, 1000);

  // Get speaker names and classifications
  const [speakers, classifications] = await Promise.all([
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('speaker_classifications', 'speaker_id, category'),
  ]);
  const nameMap = new Map(speakers.map((s: any) => [s.id, s]));
  const categoryMap = new Map(classifications.map((c: any) => [c.speaker_id, c.category]));

  const result = topIds.map(([id, data]) => {
    const sp = nameMap.get(parseInt(id));
    return {
      id: parseInt(id),
      name: sp?.name || 'Unknown',
      title: sp?.title || null,
      org: sp?.org_name || null,
      totalPanels: data.panels,
      yearsActive: data.years.size,
      breadthScore: data.breadth,
      category: categoryMap.get(parseInt(id)) || null,
    };
  });

  return { speakers: result };
}

async function getNetwork() {
  // Build org-to-org network via shared panel participants
  // Two orgs are connected if the same speaker appeared in events by both orgs
  const eventSpeakers = await fetchAll('event_speakers', 'event_id, speaker_id', q => q.neq('role', 'kontaktperson'));
  const eventArrangers = await fetchAll('event_arrangers', 'event_id, arranger_id');
  const events = await fetchAll('events', 'id, year');
  const eventYear = new Map(events.map((e: any) => [e.id, e.year]));

  // Filter to visible years
  const visibleEvents = new Set(events.filter((e: any) => VISIBLE_YEARS.includes(e.year)).map((e: any) => e.id));

  // Map event -> primary arranger
  const eventToArranger = new Map<number, number>();
  for (const ea of eventArrangers) {
    if (!visibleEvents.has(ea.event_id)) continue;
    // Use first arranger per event
    if (!eventToArranger.has(ea.event_id)) {
      eventToArranger.set(ea.event_id, ea.arranger_id);
    }
  }

  // Map speaker -> set of arranger_ids they appeared with
  const speakerToArrangers = new Map<number, Set<number>>();
  for (const es of eventSpeakers) {
    if (!visibleEvents.has(es.event_id)) continue;
    const arrId = eventToArranger.get(es.event_id);
    if (!arrId) continue;
    if (!speakerToArrangers.has(es.speaker_id)) speakerToArrangers.set(es.speaker_id, new Set());
    speakerToArrangers.get(es.speaker_id)!.add(arrId);
  }

  // Count shared speakers between arranger pairs
  // Only consider arrangers that have at least some events (top 100 by event count)
  const arrangerEventCount = new Map<number, number>();
  for (const [, arrId] of eventToArranger) {
    arrangerEventCount.set(arrId, (arrangerEventCount.get(arrId) || 0) + 1);
  }

  const topArrangerIds = new Set(
    [...arrangerEventCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([id]) => id)
  );

  const edgeCounts = new Map<string, number>();
  for (const [, arrangerSet] of speakerToArrangers) {
    const arr = [...arrangerSet].filter(a => topArrangerIds.has(a));
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = arr[i] < arr[j] ? `${arr[i]}_${arr[j]}` : `${arr[j]}_${arr[i]}`;
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      }
    }
  }

  // Get arranger names and sectors
  const arrangers = await fetchAll('arrangers', 'id, name');
  const classifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
  const nameMap = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const sectorMap = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));

  // Build nodes
  const nodes = [...topArrangerIds].map(id => ({
    id,
    name: nameMap.get(id) || 'Unknown',
    sector: sectorMap.get(id) || 'unknown',
    events: arrangerEventCount.get(id) || 0,
  }));

  // Build edges (only those with weight >= 2 to reduce noise)
  const edges = [...edgeCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([key, count]) => {
      const [s, t] = key.split('_').map(Number);
      return { source: s, target: t, weight: count };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 300);

  return { nodes, edges };
}

async function getTopicDeep() {
  // Fetch all needed data
  const [eventTopics, eventArrangerLinks, classifications, events, arrangerStats] = await Promise.all([
    fetchAll('event_topics', 'event_id, topic_primary'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
    fetchAll('events', 'id, year'),
    fetchAll('arranger_stats', 'arranger_id, year, events_count'),
  ]);

  const eventYear = new Map(events.map((e: any) => [e.id, e.year]));
  const arrangerSector = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));

  // Map event -> primary arranger
  const eventArranger = new Map<number, number>();
  for (const link of eventArrangerLinks) {
    if (!eventArranger.has(link.event_id)) eventArranger.set(link.event_id, link.arranger_id);
  }

  // Map event -> topic
  const eventTopic = new Map<number, string>();
  for (const et of eventTopics) {
    if (!eventTopic.has(et.event_id)) eventTopic.set(et.event_id, et.topic_primary);
  }

  // --- DATA 1: Topic × Sector × Year (for sector-colored alluvial) ---
  const topicSectorYear: Record<string, Record<string, Record<number, number>>> = {};
  for (const event of events) {
    if (!VISIBLE_YEARS.includes(event.year)) continue;
    const topic = eventTopic.get(event.id);
    const arrId = eventArranger.get(event.id);
    if (!topic || !arrId) continue;
    const sector = arrangerSector.get(arrId) || 'unknown';

    if (!topicSectorYear[topic]) topicSectorYear[topic] = {};
    if (!topicSectorYear[topic][sector]) topicSectorYear[topic][sector] = {};
    topicSectorYear[topic][sector][event.year] = (topicSectorYear[topic][sector][event.year] || 0) + 1;
  }

  // Sort topics by total volume, take top 12
  const topicTotals = Object.entries(topicSectorYear).map(([topic, sectors]) => {
    const total = Object.values(sectors).reduce((sum, years) =>
      sum + Object.values(years).reduce((s, c) => s + c, 0), 0);
    return { topic, total };
  }).sort((a, b) => b.total - a.total);

  const top12Topics = new Set(topicTotals.slice(0, 12).map(t => t.topic));

  const sectorByTopic = topicTotals
    .filter(t => top12Topics.has(t.topic))
    .map(({ topic }) => ({
      topic,
      sectors: Object.entries(topicSectorYear[topic]).map(([sector, years]) => ({
        sector,
        years: VISIBLE_YEARS.map(y => ({ year: y, count: years[y] || 0 })),
        total: Object.values(years).reduce((s, c) => s + c, 0),
      })).sort((a, b) => b.total - a.total),
    }));

  // --- DATA 2: Topic co-occurrence (arrangers doing multiple topics) ---
  // Map arranger -> set of topics
  const arrangerTopics: Record<number, Set<string>> = {};
  for (const event of events) {
    if (!VISIBLE_YEARS.includes(event.year)) continue;
    const topic = eventTopic.get(event.id);
    const arrId = eventArranger.get(event.id);
    if (!topic || !arrId || !top12Topics.has(topic)) continue;
    if (!arrangerTopics[arrId]) arrangerTopics[arrId] = new Set();
    arrangerTopics[arrId].add(topic);
  }

  // Count co-occurrences
  const coOccurrence: Record<string, Record<string, number>> = {};
  for (const topics of Object.values(arrangerTopics)) {
    const topicArr = [...topics];
    for (let i = 0; i < topicArr.length; i++) {
      for (let j = i + 1; j < topicArr.length; j++) {
        const [a, b] = [topicArr[i], topicArr[j]].sort();
        if (!coOccurrence[a]) coOccurrence[a] = {};
        coOccurrence[a][b] = (coOccurrence[a][b] || 0) + 1;
      }
    }
  }

  // Flatten to edges, filter to significant ones (min 5 shared arrangers)
  const topicEdges = Object.entries(coOccurrence).flatMap(([a, targets]) =>
    Object.entries(targets)
      .filter(([, count]) => count >= 5)
      .map(([b, count]) => ({ source: a, target: b, weight: count }))
  ).sort((a, b) => b.weight - a.weight).slice(0, 50);

  // --- DATA 3: New vs returning arrangers per topic per year (with names) ---
  const arrangers = await fetchAll('arrangers', 'id, name');
  const arrangerName = new Map(arrangers.map((a: any) => [a.id, a.name]));

  // Track which arrangers appeared in each topic each year, with event counts
  const topicYearArrangers: Record<string, Record<number, Map<number, number>>> = {};
  for (const event of events) {
    if (!VISIBLE_YEARS.includes(event.year)) continue;
    const topic = eventTopic.get(event.id);
    const arrId = eventArranger.get(event.id);
    if (!topic || !arrId || !top12Topics.has(topic)) continue;
    if (!topicYearArrangers[topic]) topicYearArrangers[topic] = {};
    if (!topicYearArrangers[topic][event.year]) topicYearArrangers[topic][event.year] = new Map();
    const map = topicYearArrangers[topic][event.year];
    map.set(arrId, (map.get(arrId) || 0) + 1);
  }

  const newVsReturning = Object.entries(topicYearArrangers).map(([topic, yearArrangers]) => {
    const years = VISIBLE_YEARS.map((year, yi) => {
      const currentMap = yearArrangers[year] || new Map<number, number>();
      const previousSet = new Set<number>();
      for (let pi = 0; pi < yi; pi++) {
        const prevYear = VISIBLE_YEARS[pi];
        if (yearArrangers[prevYear]) {
          for (const id of yearArrangers[prevYear].keys()) previousSet.add(id);
        }
      }

      const arrangersDetail = [...currentMap.entries()]
        .map(([id, count]) => ({
          name: arrangerName.get(id) || 'Okänd',
          sector: arrangerSector.get(id) || 'unknown',
          events: count,
          isNew: !previousSet.has(id),
        }))
        .sort((a, b) => {
          // New first, then by event count
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
          return b.events - a.events;
        });

      const returning = arrangersDetail.filter(a => !a.isNew).length;
      const newCount = arrangersDetail.filter(a => a.isNew).length;

      return {
        year,
        total: currentMap.size,
        returning,
        new: newCount,
        arrangers: arrangersDetail,
      };
    });
    return { topic, years };
  });

  return {
    sectorByTopic,
    newVsReturning,
    years: VISIBLE_YEARS,
  };
}

async function getLocations() {
  // Load venue coordinates from JSON file
  const coordsPath = join(process.cwd(), 'public', 'venue-coordinates.json');
  if (!existsSync(coordsPath)) {
    return { venues: [], error: 'venue-coordinates.json not found. Run: node geocode-venues.js' };
  }
  const venueCoords: Record<string, { lat: number; lng: number; locations: string[] }> =
    JSON.parse(readFileSync(coordsPath, 'utf8'));

  // Build reverse lookup: original location_name -> normalized key
  const locationToNorm = new Map<string, string>();
  for (const [norm, data] of Object.entries(venueCoords)) {
    for (const loc of data.locations) {
      locationToNorm.set(loc, norm);
    }
  }

  // Fetch events, event_arrangers, arranger_classifications, arrangers
  const events = await fetchAll('events', 'id, year, location_name');
  const links = await fetchAll('event_arrangers', 'event_id, arranger_id');
  const classifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
  const arrangers = await fetchAll('arrangers', 'id, name');

  const arrangerSector = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));
  const arrangerName = new Map(arrangers.map((a: any) => [a.id, a.name]));

  // Map event_id -> arranger_ids
  const eventArrangers = new Map<number, number[]>();
  for (const link of links) {
    if (!eventArrangers.has(link.event_id)) eventArrangers.set(link.event_id, []);
    eventArrangers.get(link.event_id)!.push(link.arranger_id);
  }

  // Aggregate by normalized venue
  const venueAgg: Record<string, {
    eventCount: number;
    sectors: Record<string, number>;
    arrangerCounts: Record<number, number>;
  }> = {};

  for (const event of events) {
    if (!event.location_name || !VISIBLE_YEARS.includes(event.year)) continue;
    const norm = locationToNorm.get(event.location_name);
    if (!norm) continue;

    if (!venueAgg[norm]) venueAgg[norm] = { eventCount: 0, sectors: {}, arrangerCounts: {} };
    venueAgg[norm].eventCount++;

    const arrIds = eventArrangers.get(event.id) || [];
    for (const arrId of arrIds) {
      const sector = arrangerSector.get(arrId);
      if (sector) {
        venueAgg[norm].sectors[sector] = (venueAgg[norm].sectors[sector] || 0) + 1;
      }
      venueAgg[norm].arrangerCounts[arrId] = (venueAgg[norm].arrangerCounts[arrId] || 0) + 1;
    }
  }

  // Build response, top 50 venues by event count
  const venues = Object.entries(venueAgg)
    .sort(([, a], [, b]) => b.eventCount - a.eventCount)
    .slice(0, 50)
    .map(([norm, agg]) => {
      const coords = venueCoords[norm];
      const sectorEntries = Object.entries(agg.sectors).sort(([, a], [, b]) => b - a);
      const topArrangerIds = Object.entries(agg.arrangerCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => parseInt(id));

      return {
        name: norm,
        lat: coords.lat,
        lng: coords.lng,
        eventCount: agg.eventCount,
        sectors: agg.sectors,
        primarySector: sectorEntries[0]?.[0] || 'unknown',
        topArrangers: topArrangerIds.map(id => arrangerName.get(id) || 'Unknown'),
      };
    });

  return { venues };
}

// --- Arena Network ---

// Arena name overrides: [substring to match, canonical arena name]
// Order matters — first match wins. More specific matches before generic ones.
const ARENA_OVERRIDES: [string, string][] = [
  // --- Folkhälsodalen (S:t Hansplan 2 + S:t Hansgatan 18) ---
  ['Folkhälsodalen', 'Folkhälsodalen'],
  ['S:t Hans Café', 'Folkhälsodalen'],
  ['S:t Hansplan 2', 'Folkhälsodalen'],
  ['S:t Hansgatan 18', 'Folkhälsodalen'],

  // --- Uppsala universitet / Campus Gotland (B/D/E-huset) ---
  ['Uppsala universitet', 'Uppsala universitet (Campus Gotland)'],
  ['Uppsala Universitet', 'Uppsala universitet (Campus Gotland)'],
  ['Science Park Gotland', 'Science Park Gotland'],

  // --- Dagens industri-komplexet (Strandvägen 4.x) ---
  ['Dagens industri', 'Dagens industris arena'],
  ['Strandvägen 4.1', 'Dagens industris arena'],
  ['Strandvägen 4.2', 'Dagens industris arena'],
  ['Strandvägen 4.3', 'Dagens industris arena'],
  ['Strandvägen 4.4', 'Dagens industris arena'],
  ['Strandvägen 4.6', 'Dagens industris arena'],
  ['Strands veranda', 'Dagens industris arena'],
  ['Strandvägen 4,', 'Dagens industris arena'],

  // --- Donnersgatan 6 = Hansaplatsen ---
  ['Hansaplatsen', 'Hansaplatsen'],
  ['Hansascenen', 'Hansaplatsen'],
  ['Donnersgatan 6', 'Hansaplatsen'],

  // --- Donnersgatan / Expressens scen ---
  ['Expressens scen', 'Expressens scen'],

  // --- Wisby Strand Congress & Event (Donnersgatan 2) ---
  ['Wisby Strand', 'Wisby Strand Congress & Event'],
  ['Techarena', 'Wisby Strand Congress & Event'],
  ['Donnersgatan 2', 'Wisby Strand Congress & Event'],

  // --- Donnerska huset (Donners plats 1) ---
  ['Donnerska huset', 'Donnerska huset'],
  ['Civilsamhällesarenan', 'Donnerska huset'],
  ['Donners plats 1', 'Donnerska huset'],

  // --- Clarion Hotel Wisby (Strandgatan 6) ---
  ['Clarion Hotel Wisby', 'Clarion Hotel Wisby'],
  ['Strandgatan 6', 'Clarion Hotel Wisby'],

  // --- Gotlands museum (Strandgatan 14 + Mellangatan 19) ---
  ['Gotlands museum', 'Gotlands museum'],
  ['SäkerhetsArenan', 'Gotlands museum'],
  ['Strandgatan 14', 'Gotlands museum'],
  ['Mellangatan 19', 'Gotlands museum'],

  // --- Almedalsbiblioteket (Cramérgatan 5) ---
  ['Almedalsbiblioteket', 'Almedalsbiblioteket'],
  ['Östersjödagarna', 'Almedalsbiblioteket'],
  ['Cramérgatan 5', 'Almedalsbiblioteket'],

  // --- Fartyg ---
  ['Teaterskeppet', 'Teaterskeppet'],
  ['Hållbarhetsarenan', 'Teaterskeppet'],
  ['Elida', 'Elida'],
  ['Belos', 'Belos'],

  // --- TCO-landet (Strandgatan 19) ---
  ['TCO-landet', 'TCO-landet'],
  ['Strandgatan 19', 'TCO-landet'],

  // --- Arena Energi (S:ta Katarinagatan 6) ---
  ['Arena Energi', 'Arena Energi'],
  ['S:ta Katarinagatan 6', 'Arena Energi'],

  // --- Kårhuset Rindi / Handelslandet (Donnersgatan 1) ---
  ['Kårhuset Rindi', 'Kårhuset Rindi'],
  ['Handelslandet', 'Kårhuset Rindi'],
  ['Donnersgatan 1', 'Kårhuset Rindi'],
  ['Donnergatan 1', 'Kårhuset Rindi'],

  // --- Supper / Business Arena (Strandgatan 9) ---
  ['Supper', 'Supper / Business Arena'],
  ['Business Arena', 'Supper / Business Arena'],
  ['Strandgatan 9', 'Supper / Business Arena'],

  // --- Vårdklockans kyrka (Adelsgatan 43) ---
  ['Vårdklockans kyrka', 'Vårdklockans kyrka'],
  ['Adelsgatan 43', 'Vårdklockans kyrka'],

  // --- Fastighetshubben (Adelsgatan 25) ---
  ['Fastighetshubben', 'Fastighetshubben'],
  ['Svefas innergård', 'Fastighetshubben'],
  ['Adelsgatan 25', 'Fastighetshubben'],

  // --- Ukrainska Hubben (Hamnplan plats 207) ---
  ['Ukrainska Hubben', 'Ukrainska Hubben'],

  // --- Björkanderska huset (Skeppsbron 24) ---
  ['Björkanderska', 'Björkanderska huset'],
  ['Joda Bar', 'Björkanderska huset'],
  ['Skeppsbron 24', 'Björkanderska huset'],

  // --- Katolska kyrkan (S:t Drottensgatan 12) ---
  ['Katolska kyrkan', 'Katolska kyrkan'],
  ['S:t Drottensgatan 12', 'Katolska kyrkan'],

  // --- Maritima Mötesplatsen (Hamngatan 1) ---
  ['Maritim Mötesplats', 'Maritima Mötesplatsen'],
  ['Hamngatan 1', 'Maritima Mötesplatsen'],

  // --- Svenskt Näringslivs trädgård (Hamngatan 3) ---
  ['Svenskt Näringsliv', 'Svenskt Näringslivs trädgård'],
  ['Hamngatan 3', 'Svenskt Näringslivs trädgård'],

  // --- Lunds universitet (Hästgatan 13) ---
  ['Hästgatan 13', 'Lunds universitet'],

  // --- PwC:s trädgård (Hästgatan 9) ---
  ['Hästgatan 9', 'PwC:s trädgård'],

  // --- Skandias trädgård (Strandgatan 27) ---
  ['Skandias trädgård', 'Skandias trädgård'],
  ['Strandgatan 27', 'Skandias trädgård'],

  // --- Värdshuset Lindgården (Strandgatan 26) ---
  ['Lindgården', 'Värdshuset Lindgården'],
  ['Strandgatan 26', 'Värdshuset Lindgården'],

  // --- Gotland Soldathem (Klinttorget 4) ---
  ['Gotland Soldathem', 'Gotland Soldathem'],
  ['Klinttorget 4', 'Gotland Soldathem'],

  // --- Mediescenen (Mellangatan 7) ---
  ['Mediescenen', 'Mediescenen'],
  ['Mellangatan 7', 'Mediescenen'],

  // --- Länsteatern (Bredgatan 10) ---
  ['Länsteatern', 'Länsteatern'],
  ['Bredgatan 10', 'Länsteatern'],

  // --- Bolaget (Stora Torget 16) ---
  ['Bolaget', 'Bolaget'],
  ['Stora Torget 16', 'Bolaget'],

  // --- Fenomenalen (Skeppsbron 6) ---
  ['Fenomenalen', 'Fenomenalen'],
  ['Skeppsbron 6', 'Fenomenalen'],

  // --- Best Western Strand Hotel (Strandgatan 34) ---
  ['Best Western Strand', 'Best Western Strand Hotel'],
  ['Strandgatan 34', 'Best Western Strand Hotel'],

  // --- S:t Hansskolan (S:t Hansgatan 32) ---
  ['S:t Hansskolan', 'S:t Hansskolan'],
  ['S:t Hansgatan 32', 'S:t Hansskolan'],

  // --- Altinget Arena (Strandgatan 16) ---
  ['Altinget Arena', 'Altinget Arena'],
  ['Strandgatan 16', 'Altinget Arena'],

  // --- Bulhuset (Hamnplan 5) ---
  ['Bulhuset', 'Bulhuset'],
  ['Hamnplan 5', 'Bulhuset'],

  // --- Samhällsbyggararenan (Hästgatan 4) ---
  ['Samhällsbyggararenan', 'Samhällsbyggararenan'],
  ['Hästgatan 4', 'Samhällsbyggararenan'],

  // --- 2030-arenan (Hästgatan 12) ---
  ['2030-arenan', '2030-arenan'],
  ['Hästgatan 12', '2030-arenan'],

  // --- Strandgatan 20 (Lif) ---
  ['Strandgatan 20', 'Lif-huset'],

  // --- Sverigearenan ---
  ['Sverigearenan', 'Sverigearenan'],

  // --- Vårdarenan ---
  ['Vårdarenan', 'Vårdarenan'],

  // --- Övriga namngivna ---
  ['S:ta Karins kyrkoruin', 'S:ta Karins kyrkoruin'],
  ['S:ta Maria domkyrka', 'S:ta Maria domkyrka'],
  ['Folkets Bio', 'Folkets Bio'],

  // --- Catch-all arena clusters (MUST be last — after all specific sub-rules) ---

  // Hamnplan tältarenor (371 events, tält H200-H246)
  // NOTE: comes after Bulhuset (Hamnplan 5) and Ukrainska Hubben rules
  ['Hamnplan, plats', 'Hamnplan (tältarenorna)'],
  ['Hamnplan, H', 'Hamnplan (tältarenorna)'],
  ['Hamnplan 6', 'Hamnplan (tältarenorna)'],

  // Strandvägen (övrigt utanför DI 4.x — Mötesplats Jönköping etc)
  ['Strandvägen, ', 'Strandvägen (övriga)'],
  ['Strandvägen,', 'Strandvägen (övriga)'],

  // Cramérgatan (utanför Uppsala universitet & Almedalsbiblioteket)
  ['Cramérgatan', 'Cramérgatan (övriga)'],

  // Hamngatan (utanför Maritima Mötesplatsen & Svenskt Näringsliv)
  ['Hamngatan, ', 'Hamngatan (övriga)'],
  ['Hamngatan,', 'Hamngatan (övriga)'],

  // Donnersgatan (utanför Hansaplatsen, Wisby Strand, Kårhuset Rindi)
  ['Donnersgatan', 'Donnersgatan (övriga)'],

  // Almedalen scen/mötestält/Partitorget
  ['Almedalen, scen', 'Almedalen (stora scenen)'],
  ['Almedalen, mötestält', 'Almedalen (mötestält)'],
  ['Partitorget', 'Partitorget'],

  // Named venues without existing overrides
  ['Fordonsexpo', 'Fordonsexpo'],
  ['SpelAlmedalen', 'SpelAlmedalen'],
  ['Strandgatan 1b', 'SpelAlmedalen'],
  ['Volters gränd 8', 'Swedbank och Sparbankernas hus'],
  ['Sparbankernas hus', 'Swedbank och Sparbankernas hus'],
  ['Mellangatan 27', 'Mellangatan 27'],
  ['Slottsterrassen', 'Slottsterrassen'],
  ['Fiskargränd 5', 'Fiskargränd 5'],
  ['Strandgatan 22', 'Strandgatan 22'],
  ['Klockgränd 4', 'Klockgränd 4'],
  ['Klosterbrunnsgatan 5', 'Klosterbrunnsgatan 5'],
  ['Södra kyrkogatan 3', 'Södra kyrkogatan 3'],
  ['S:t Hansgatan 21', 'S:t Hansgatan 21'],
  ['Novgorodgränd 1', 'Novgorodgränd 1'],
  ['Kronstallgränd 4', 'Kronstallgränd 4'],
  ['Korsgatan 4', 'Korsgatan 4'],
  ['Mellangatan 9', 'Mellangatan 9'],

  // --- Additional venues (to reach 85%+ coverage) ---

  // Tranhusgatan venues
  ['Tranhusgatan 6', 'Tranhusgatan 6 (S:t Clemens ruin)'],
  ['S:t Clemens ruin', 'Tranhusgatan 6 (S:t Clemens ruin)'],
  ['Tranhusgatan', 'Tranhusgatan (övriga)'],

  // Kilgränd
  ['Kilgränd 1', 'Kilgränd 1'],
  ['Kilgränd', 'Kilgränd (övriga)'],

  // Mellangatan (utanför Mediescenen 7 och Gotlands museum 19)
  ['Mellangatan 54', 'Mellangatan 54 (Bryggarsalen)'],
  ['Bryggarsalen', 'Mellangatan 54 (Bryggarsalen)'],
  ['Mellangatan 1', 'Mellangatan 1'],
  ['Mellangatan 21', 'Mellangatan 21'],
  ['Mellangatan 56', 'Mellangatan 56'],
  ['Mellangatan', 'Mellangatan (övriga)'],

  // Hästgatan (utanför Hästgatan 13, 9, 4, 12)
  ['Hästgatan 2', 'Hästgatan 2'],
  ['Hästgatan 1', 'Hästgatan 1'],
  ['Hästgatan', 'Hästgatan (övriga)'],

  // Donnersplats / Talarplats
  ['Talarplats, Donnersplats', 'Donnersplats (Talarplats)'],
  ['Donnersplats, Talarplats', 'Donnersplats (Talarplats)'],
  ['Talarplats, Donners plats', 'Donnersplats (Talarplats)'],
  ['Donnersplats', 'Donnersplats'],
  ['Donners plats 3', 'Donners plats 3'],

  // Ryska gränd
  ['Ryska gränd 18', 'Ryska gränd 18 (Grafikgruppen)'],
  ['Grafikgruppen', 'Ryska gränd 18 (Grafikgruppen)'],
  ['Ryska gränd', 'Ryska gränd (övriga)'],

  // Kapitelhusgården / S:t Drottensgatan 8
  ['S:t Drottensgatan 8', 'Kapitelhusgården'],
  ['Kapitelhusgården', 'Kapitelhusgården'],
  ['Körsbärsdalen', 'Kapitelhusgården'],

  // Södra Kyrkogatan
  ['Södra Kyrkogatan 15', 'Södra Kyrkogatan 15'],
  ['Södra kyrkogatan 15', 'Södra Kyrkogatan 15'],
  ['Södra Kyrkogatan 11', 'Södra Kyrkogatan 11'],
  ['Södra kyrkogatan 11', 'Södra Kyrkogatan 11'],
  ['Södra Kyrkogatan 7', 'Södra Kyrkogatan 7'],
  ['Södra kyrkogatan 7', 'Södra Kyrkogatan 7'],
  ['Södra Kyrkogatan', 'Södra Kyrkogatan (övriga)'],
  ['Södra kyrkogatan', 'Södra Kyrkogatan (övriga)'],

  // Klosterbrunnsgatan
  ['Klosterbrunnsgatan 3', 'Klosterbrunnsgatan 3'],

  // Södertorg
  ['Södertorg 12', 'Södertorg 12'],
  ['Södertorg', 'Södertorg (övriga)'],

  // Trappgränd / S:t Hansgatan
  ['Trappgränd 4', 'Trappgränd 4'],
  ['S:t Hansgatan 24', 'S:t Hansgatan 24'],
  ['S:t Hansgatan 22', 'S:t Hansgatan 22'],
  ['S:t Hansgatan 16', 'S:t Hansgatan 16'],
  ['S:t Hansgatan 9', 'S:t Hansgatan 9'],
  ['S:t Hansgatan', 'S:t Hansgatan (övriga)'],

  // Kinbergs plats
  ['Kinbergs plats 5', 'Kinbergs plats 5'],
  ['Kinbergs plats 3', 'Kinbergs plats 3'],
  ['Kinbergs plats', 'Kinbergs plats (övriga)'],

  // Blockgränd
  ['Blockgränd 6', 'Blockgränd 6'],
  ['Blockgränd', 'Blockgränd (övriga)'],

  // Almedalen (estradvagnen och övriga)
  ['Almedalen, Estradvagnen', 'Almedalen (Estradvagnen)'],
  ['Estradvagnen', 'Almedalen (Estradvagnen)'],
  ['Almedalen', 'Almedalen (övriga)'],

  // Norra Kyrkogatan / Församlingshuset
  ['Norra Kyrkogatan 2', 'Norra Kyrkogatan 2 (Församlingshuset)'],
  ['Norra kyrkogatan 2', 'Norra Kyrkogatan 2 (Församlingshuset)'],
  ['Församlingshuset Domkyrkan', 'Norra Kyrkogatan 2 (Församlingshuset)'],
  ['Norra Kyrkogatan', 'Norra Kyrkogatan (övriga)'],

  // Donners plats 3
  // (already added above)

  // Specksrum
  ['Specksrum 4', 'Specksrum 4'],
  ['Specksrum 5', 'Specksrum 5'],
  ['Specksrum', 'Specksrum (övriga)'],

  // Birgers Gränd
  ['Birgers Gränd 4', 'Birgers Gränd 4'],
  ['Birgers gränd 9', 'Birgers gränd 9'],
  ['Birgers Gränd', 'Birgers Gränd (övriga)'],
  ['Birgers gränd', 'Birgers Gränd (övriga)'],

  // Rostockergränd
  ['Rostockergränd 4', 'Rostockergränd 4'],
  ['Rostockergränd', 'Rostockergränd (övriga)'],

  // Berggränd
  ['Berggränd 6', 'Berggränd 6'],
  ['AI Swedens trädgård', 'Berggränd 6'],
  ['Berggränd', 'Berggränd (övriga)'],

  // Tage Cervins gata / Sveriges Radio
  ['Tage Cervins gata', 'Tage Cervins gata (Sveriges Radio)'],
  ['Sveriges Radio', 'Tage Cervins gata (Sveriges Radio)'],

  // Strandvägen 1 (Kallis) and Strandvägen 8
  ['Strandvägen 1', 'Strandvägen 1 (Kallis)'],
  ['Kallis', 'Strandvägen 1 (Kallis)'],
  ['Strandvägen 8', 'Strandvägen 8 (Almedalens Hotell)'],
  ['Almedalens Hotell', 'Strandvägen 8 (Almedalens Hotell)'],
  ['Strandvägen', 'Strandvägen (övriga)'],

  // Syskongatan / S:t Drotten kyrkoruin
  ['Syskongatan 1', 'Syskongatan 1 (S:t Drotten)'],
  ['S:t Drotten', 'Syskongatan 1 (S:t Drotten)'],

  // Wallers plats
  ['Wallers plats 3', 'Wallers plats 3'],
  ['Strykjärnshuset', 'Wallers plats 3'],
  ['Wallers plats', 'Wallers plats (övriga)'],

  // Biskopsgatan
  ['Biskopsgatan 1A', 'Biskopsgatan 1A'],
  ['Biskopsgatan', 'Biskopsgatan (övriga)'],

  // Skeppargatan
  ['Skeppargatan 24', 'Skeppargatan 24'],
  ['Skeppargatan', 'Skeppargatan (övriga)'],

  // Fartyg (utanför Teaterskeppet, Elida, Belos)
  ['Michael Sars', 'Fartyg (Michael Sars)'],
  ['fartyg', 'Fartyg (övriga)'],

  // Strandgatan 1 (övriga, utanför Strandgatan 1b SpelAlmedalen)
  ['Strandgatan 1', 'Strandgatan 1'],

  // Plats meddelas senare / Annan plats (okänd plats)
  ['Plats meddelas senare', 'Okänd plats'],
  ['Annan plats', 'Okänd plats'],
];

function normalizeVenue(locationName: string): string {
  for (const [keyword, canonical] of ARENA_OVERRIDES) {
    if (locationName.includes(keyword)) return canonical;
  }
  return locationName
    .replace(/,\s*plats\s+\d+/gi, '')
    .replace(/,\s*(sal|lokal|rum)\s+\S+/gi, '')
    .replace(/,\s*[A-Z]\d{2,4}/g, '')
    .replace(/,\s*\d+$/g, '')
    .trim();
}

async function getArenaNetwork() {
  const [events, eventArrangerLinks, classifications, arrangers] = await Promise.all([
    fetchAll('events', 'id, year, location_name'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
    fetchAll('arrangers', 'id, name'),
  ]);

  const arrangerSector = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));
  const arrangerName = new Map(arrangers.map((a: any) => [a.id, a.name]));

  // Map event_id → arranger_ids
  const eventToArrangers = new Map<number, number[]>();
  for (const link of eventArrangerLinks) {
    if (!eventToArrangers.has(link.event_id)) eventToArrangers.set(link.event_id, []);
    eventToArrangers.get(link.event_id)!.push(link.arranger_id);
  }

  // Aggregate: arena → { arranger_id → eventCount }
  const arenaArrangers: Record<string, Record<number, number>> = {};
  const arenaTotalEvents: Record<string, number> = {};

  for (const event of events) {
    if (!event.location_name || !VISIBLE_YEARS.includes(event.year)) continue;
    const arena = normalizeVenue(event.location_name);
    if (!arena || arena === 'Annan plats' || arena === 'Plats meddelas senare') continue;

    arenaTotalEvents[arena] = (arenaTotalEvents[arena] || 0) + 1;
    const arrIds = eventToArrangers.get(event.id) || [];
    for (const arrId of arrIds) {
      if (!arenaArrangers[arena]) arenaArrangers[arena] = {};
      arenaArrangers[arena][arrId] = (arenaArrangers[arena][arrId] || 0) + 1;
    }
  }

  // Top 30 arenas by unique arrangers
  const topArenas = Object.entries(arenaArrangers)
    .map(([arena, arrCounts]) => ({
      arena,
      uniqueArrangers: Object.keys(arrCounts).length,
      totalEvents: arenaTotalEvents[arena] || 0,
      arrangerCounts: arrCounts,
    }))
    .sort((a, b) => b.uniqueArrangers - a.uniqueArrangers)
    .slice(0, 30);

  // Collect all org IDs that appear in edges (with 2+ events at an arena)
  const connectedOrgIds = new Set<number>();
  const edges: { source: string; target: number; weight: number }[] = [];

  for (const a of topArenas) {
    const arenaId = `arena_${a.arena}`;
    for (const [arrIdStr, count] of Object.entries(a.arrangerCounts)) {
      if (count < 2) continue;
      const arrId = parseInt(arrIdStr);
      connectedOrgIds.add(arrId);
      edges.push({ source: arenaId, target: arrId, weight: count });
    }
  }

  // Build arena nodes
  const arenaNodes = topArenas.map(a => ({
    id: `arena_${a.arena}`,
    name: a.arena,
    type: 'arena' as const,
    uniqueArrangers: a.uniqueArrangers,
    totalEvents: a.totalEvents,
  }));

  // Build org nodes
  const orgNodes = [...connectedOrgIds].map(id => ({
    id,
    name: arrangerName.get(id) || 'Unknown',
    type: 'org' as const,
    sector: arrangerSector.get(id) || 'unknown',
  }));

  return { arenaNodes, orgNodes, edges };
}

// --- Arena Guide ---

const EXCLUDED_ARENAS = new Set([
  'Okänd plats',
  'Annan plats',
  'Plats meddelas senare',
]);

async function getArenaGuide() {
  const [events, eventArrangerLinks, classifications] = await Promise.all([
    fetchAll('events', 'id, year, location_name'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
  ]);

  const arrangerSector = new Map(classifications.map((c: any) => [c.arranger_id, c.sector as string]));

  // Map event_id → arranger_ids
  const eventToArrangers = new Map<number, number[]>();
  for (const link of eventArrangerLinks) {
    if (!eventToArrangers.has(link.event_id)) eventToArrangers.set(link.event_id, []);
    eventToArrangers.get(link.event_id)!.push(link.arranger_id);
  }

  // Aggregate per arena
  const arenaData: Record<string, {
    totalEvents: number;
    arrangerIds: Set<number>;
    sectorCounts: Record<string, number>;
    yearCounts: Record<number, number>;
  }> = {};

  for (const event of events) {
    if (!event.location_name || !VISIBLE_YEARS.includes(event.year)) continue;
    const arena = normalizeVenue(event.location_name);
    if (!arena || EXCLUDED_ARENAS.has(arena)) continue;

    if (!arenaData[arena]) {
      arenaData[arena] = {
        totalEvents: 0,
        arrangerIds: new Set(),
        sectorCounts: {},
        yearCounts: {},
      };
    }

    const agg = arenaData[arena];
    agg.totalEvents += 1;
    agg.yearCounts[event.year] = (agg.yearCounts[event.year] || 0) + 1;

    const arrIds = eventToArrangers.get(event.id) || [];
    for (const arrId of arrIds) {
      agg.arrangerIds.add(arrId);
      const sector = arrangerSector.get(arrId);
      if (sector) {
        agg.sectorCounts[sector] = (agg.sectorCounts[sector] || 0) + 1;
      }
    }
  }

  const results = Object.entries(arenaData)
    .map(([name, agg]) => {
      const sectorEntries = Object.entries(agg.sectorCounts).sort((a, b) => b[1] - a[1]);
      const totalSectorEvents = sectorEntries.reduce((s, [, n]) => s + n, 0);
      const dominantSector = sectorEntries[0]?.[0] || 'unknown';
      const dominantCount = sectorEntries[0]?.[1] || 0;
      const dominantPct = totalSectorEvents > 0 ? Math.round((dominantCount / totalSectorEvents) * 100) : 0;
      const sectorDiversity = sectorEntries.length;

      let type: 'pluralistic' | 'mixed' | 'dominated';
      if (dominantPct < 35) type = 'pluralistic';
      else if (dominantPct > 60) type = 'dominated';
      else type = 'mixed';

      return {
        name,
        totalEvents: agg.totalEvents,
        uniqueArrangers: agg.arrangerIds.size,
        sectorBreakdown: agg.sectorCounts,
        dominantSector,
        dominantPct,
        sectorDiversity,
        yearlyEvents: agg.yearCounts,
        type,
      };
    })
    .sort((a, b) => b.totalEvents - a.totalEvents)
    .slice(0, 40);

  return { arenas: results };
}

// --- Arena Detail ---

async function getArenaDetail(arenaName: string) {
  const [events, eventArrangerLinks, eventSpeakerLinks, eventTopics, arrangers, arrangerClassifications, speakers, speakerClassifications] = await Promise.all([
    fetchAll('events', 'id, year, location_name'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('event_speakers', 'event_id, speaker_id, role'),
    fetchAll('event_topics', 'event_id, topic_primary'),
    fetchAll('arrangers', 'id, name'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('speaker_classifications', 'speaker_id, category'),
  ]);

  // Filter events to this arena in visible years
  const arenaEventIds = new Set<number>();
  const perYear: Record<number, number> = {};
  for (const event of events) {
    if (!event.location_name || !VISIBLE_YEARS.includes(event.year)) continue;
    const normalized = normalizeVenue(event.location_name);
    if (normalized !== arenaName) continue;
    arenaEventIds.add(event.id);
    perYear[event.year] = (perYear[event.year] || 0) + 1;
  }

  const totalEvents = arenaEventIds.size;

  // Lookup maps
  const arrangerMap = new Map(arrangers.map((a: any) => [a.id, a]));
  const sectorMap = new Map(arrangerClassifications.map((c: any) => [c.arranger_id, c.sector]));
  const speakerMap = new Map(speakers.map((s: any) => [s.id, s]));
  const categoryMap = new Map(speakerClassifications.map((c: any) => [c.speaker_id, c.category]));

  // Top arrangers
  const arrangerCounts: Record<number, number> = {};
  for (const ea of eventArrangerLinks) {
    if (!arenaEventIds.has(ea.event_id)) continue;
    arrangerCounts[ea.arranger_id] = (arrangerCounts[ea.arranger_id] || 0) + 1;
  }

  const topArrangers = Object.entries(arrangerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => {
      const arr = arrangerMap.get(parseInt(id));
      return {
        id: parseInt(id),
        name: arr?.name || 'Unknown',
        sector: sectorMap.get(parseInt(id)) || null,
        eventCount: count,
      };
    });

  // Top topics
  const topicCounts: Record<string, number> = {};
  for (const et of eventTopics) {
    if (!arenaEventIds.has(et.event_id)) continue;
    if (!et.topic_primary) continue;
    topicCounts[et.topic_primary] = (topicCounts[et.topic_primary] || 0) + 1;
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  // Top speakers (excluding kontaktperson)
  const speakerCounts: Record<number, number> = {};
  for (const es of eventSpeakerLinks) {
    if (!arenaEventIds.has(es.event_id)) continue;
    if (es.role === 'kontaktperson') continue;
    speakerCounts[es.speaker_id] = (speakerCounts[es.speaker_id] || 0) + 1;
  }

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

  // Sector breakdown
  const sectorCounts: Record<string, number> = {};
  for (const ea of eventArrangerLinks) {
    if (!arenaEventIds.has(ea.event_id)) continue;
    const sector = sectorMap.get(ea.arranger_id) || 'unknown';
    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  }

  const sectorBreakdown = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  return {
    arena: arenaName,
    totalEvents,
    perYear,
    topArrangers,
    topTopics,
    topSpeakers,
    sectorBreakdown,
  };
}

// --- Speaker Guide ---

async function getSpeakerGuide() {
  const [speakerStats, speakers, eventSpeakers, eventTopics, events] = await Promise.all([
    fetchAll('speaker_stats', 'speaker_id, year, panel_count, unique_arrangers, breadth_score'),
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('event_speakers', 'event_id, speaker_id'),
    fetchAll('event_topics', 'event_id, topic_primary'),
    fetchAll('events', 'id, year'),
  ]);

  // Build lookup maps
  const speakerMap = new Map<number, { name: string; title: string | null; org_name: string | null }>(
    speakers.map((s: any) => [s.id, { name: s.name, title: s.title, org_name: s.org_name }])
  );

  const eventYear = new Map<number, number>(
    events.map((e: any) => [e.id, e.year])
  );

  // Only count topics from visible years
  const eventTopicMap = new Map<number, string>();
  for (const et of eventTopics) {
    if (!eventTopicMap.has(et.event_id)) {
      eventTopicMap.set(et.event_id, et.topic_primary);
    }
  }

  // speaker_id -> [event_id] (only visible years)
  const speakerEvents = new Map<number, number[]>();
  for (const es of eventSpeakers) {
    const year = eventYear.get(es.event_id);
    if (!year || !VISIBLE_YEARS.includes(year)) continue;
    if (!speakerEvents.has(es.speaker_id)) speakerEvents.set(es.speaker_id, []);
    speakerEvents.get(es.speaker_id)!.push(es.event_id);
  }

  // Aggregate speaker_stats per speaker across years
  const statsMap = new Map<number, {
    totalPanels: number;
    maxYear: number;
    minYear: number;
    years: number[];
    maxUniqueArrangers: number;
    maxBreadth: number;
  }>();

  for (const row of speakerStats) {
    if (!VISIBLE_YEARS.includes(row.year)) continue;
    if (!statsMap.has(row.speaker_id)) {
      statsMap.set(row.speaker_id, {
        totalPanels: 0,
        maxYear: row.year,
        minYear: row.year,
        years: [],
        maxUniqueArrangers: 0,
        maxBreadth: 0,
      });
    }
    const s = statsMap.get(row.speaker_id)!;
    s.totalPanels += row.panel_count || 0;
    if (row.year > s.maxYear) s.maxYear = row.year;
    if (row.year < s.minYear) s.minYear = row.year;
    if (!s.years.includes(row.year)) s.years.push(row.year);
    if ((row.unique_arrangers || 0) > s.maxUniqueArrangers) s.maxUniqueArrangers = row.unique_arrangers;
    if ((row.breadth_score || 0) > s.maxBreadth) s.maxBreadth = row.breadth_score;
  }

  // Build topic profile per speaker
  function getTopTopics(speakerId: number): { topic: string; count: number }[] {
    const eventIds = speakerEvents.get(speakerId) || [];
    const topicCounts: Record<string, number> = {};
    for (const eid of eventIds) {
      const topic = eventTopicMap.get(eid);
      if (topic) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
    return Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  // Build full speaker objects
  interface SpeakerEntry {
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

  const allSpeakers: SpeakerEntry[] = [];
  for (const [speakerId, stats] of statsMap.entries()) {
    const info = speakerMap.get(speakerId);
    if (!info) continue;
    allSpeakers.push({
      id: speakerId,
      name: info.name,
      title: info.title,
      org_name: info.org_name,
      totalPanels: stats.totalPanels,
      years: stats.years.sort(),
      uniqueArrangers: stats.maxUniqueArrangers,
      breadth: stats.maxBreadth,
      topTopics: getTopTopics(speakerId),
      minYear: stats.minYear,
      maxYear: stats.maxYear,
    });
  }

  // Categorize
  const rising_stars = allSpeakers
    .filter(s => s.minYear >= 2024 && s.totalPanels >= 3)
    .sort((a, b) => b.totalPanels - a.totalPanels)
    .slice(0, 30);

  const evergreens = allSpeakers
    .filter(s => s.totalPanels >= 15)
    .sort((a, b) => b.totalPanels - a.totalPanels)
    .slice(0, 30);

  const high_breadth = allSpeakers
    .filter(s => s.uniqueArrangers >= 5 && s.totalPanels < 15)
    .sort((a, b) => b.uniqueArrangers - a.uniqueArrangers)
    .slice(0, 30);

  return { rising_stars, evergreens, high_breadth };
}

async function getTopicDetail(topic: string) {
  // Ämnesvyn ska visa 2026 (topic_year_stats har 2026). Lokalt år-set så att
  // resten av dashboard-endpointen (trendsidorna) lämnas på avslutade år.
  const TOPIC_YEARS = VISIBLE_YEARS; // global VISIBLE_YEARS inkluderar nu 2026
  // 1. perYear from topic_year_stats
  const perYearData = await fetchAll('topic_year_stats', 'topic, year, event_count', q =>
    q.eq('topic', topic).in('year', TOPIC_YEARS)
  );
  const perYear = perYearData
    .map((r: any) => ({ year: r.year, count: r.event_count }))
    .sort((a: any, b: any) => a.year - b.year);
  const totalEvents = perYear.reduce((sum: number, r: any) => sum + r.count, 0);

  // Fetch shared data
  const [eventTopics, eventSpeakerLinks, eventArrangerLinks, events, speakers, speakerClassifications, arrangers, arrangerClassifications] = await Promise.all([
    fetchAll('event_topics', 'event_id, topic_primary', q => q.eq('topic_primary', topic)),
    fetchAll('event_speakers', 'event_id, speaker_id, role'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('events', 'id, year'),
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('speaker_classifications', 'speaker_id, category'),
    fetchAll('arrangers', 'id, name'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
  ]);

  const eventYear = new Map(events.map((e: any) => [e.id, e.year]));
  const visibleEventIds = new Set(
    events.filter((e: any) => TOPIC_YEARS.includes(e.year)).map((e: any) => e.id)
  );

  // Event IDs matching this topic in visible years
  const topicEventIds = new Set(
    eventTopics
      .filter((et: any) => visibleEventIds.has(et.event_id))
      .map((et: any) => et.event_id)
  );

  // 2. topSpeakers
  const speakerCounts: Record<number, number> = {};
  for (const es of eventSpeakerLinks) {
    if (!topicEventIds.has(es.event_id)) continue;
    if (es.role === 'kontaktperson') continue;
    speakerCounts[es.speaker_id] = (speakerCounts[es.speaker_id] || 0) + 1;
  }

  const speakerMap = new Map(speakers.map((s: any) => [s.id, s]));
  const categoryMap = new Map(speakerClassifications.map((c: any) => [c.speaker_id, c.category]));

  const topSpeakers = Object.entries(speakerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
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

  // 3. topArrangers
  const arrangerCounts: Record<number, number> = {};
  for (const ea of eventArrangerLinks) {
    if (!topicEventIds.has(ea.event_id)) continue;
    arrangerCounts[ea.arranger_id] = (arrangerCounts[ea.arranger_id] || 0) + 1;
  }

  const arrangerMap = new Map(arrangers.map((a: any) => [a.id, a]));
  const sectorMap = new Map(arrangerClassifications.map((c: any) => [c.arranger_id, c.sector]));

  const topArrangers = Object.entries(arrangerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([id, count]) => {
      const arr = arrangerMap.get(parseInt(id));
      return {
        id: parseInt(id),
        name: arr?.name || 'Unknown',
        sector: sectorMap.get(parseInt(id)) || null,
        eventCount: count,
      };
    });

  // 4. sectorBreakdown
  const sectorCounts: Record<string, number> = {};
  for (const ea of eventArrangerLinks) {
    if (!topicEventIds.has(ea.event_id)) continue;
    const sector = sectorMap.get(ea.arranger_id) || 'unknown';
    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  }

  const sectorBreakdown = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  return {
    topic,
    totalEvents,
    perYear,
    topSpeakers,
    topArrangers,
    sectorBreakdown,
  };
}

async function getPensionDeep() {
  // Fetch all needed data in parallel
  const [events, eventSpeakerLinks, eventArrangerLinks, speakers, speakerClassifications, arrangers, arrangerClassifications, eventTopics, sentimentData] = await Promise.all([
    fetchAll('events', 'id, year, title, description'),
    fetchAll('event_speakers', 'event_id, speaker_id, role'),
    fetchAll('event_arrangers', 'event_id, arranger_id'),
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('speaker_classifications', 'speaker_id, category'),
    fetchAll('arrangers', 'id, name'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
    fetchAll('event_topics', 'event_id, topic_primary'),
    fetchAll('event_sentiment', 'event_id, score, label'),
  ]);

  // Filter events mentioning "pension" in title or description, visible years only
  const pensionEvents = events.filter((e: any) => {
    if (!VISIBLE_YEARS.includes(e.year)) return false;
    const title = (e.title || '').toLowerCase();
    const desc = (e.description || '').toLowerCase();
    return title.includes('pension') || desc.includes('pension');
  });

  const pensionEventIds = new Set(pensionEvents.map((e: any) => e.id));

  // totalEvents
  const totalEvents = pensionEvents.length;

  // perYear
  const perYearMap: Record<number, number> = {};
  for (const e of pensionEvents) {
    perYearMap[e.year] = (perYearMap[e.year] || 0) + 1;
  }
  const perYear = VISIBLE_YEARS.map(y => ({ year: y, count: perYearMap[y] || 0 }));

  // topArrangers (15)
  const arrangerCounts: Record<number, number> = {};
  for (const ea of eventArrangerLinks) {
    if (!pensionEventIds.has(ea.event_id)) continue;
    arrangerCounts[ea.arranger_id] = (arrangerCounts[ea.arranger_id] || 0) + 1;
  }

  const arrangerMap = new Map(arrangers.map((a: any) => [a.id, a]));
  const sectorMap = new Map(arrangerClassifications.map((c: any) => [c.arranger_id, c.sector]));

  const topArrangers = Object.entries(arrangerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, count]) => {
      const arr = arrangerMap.get(parseInt(id));
      return {
        id: parseInt(id),
        name: arr?.name || 'Unknown',
        sector: sectorMap.get(parseInt(id)) || null,
        eventCount: count,
      };
    });

  // topSpeakers (15) — exclude kontaktperson
  const speakerCounts: Record<number, number> = {};
  for (const es of eventSpeakerLinks) {
    if (!pensionEventIds.has(es.event_id)) continue;
    if (es.role === 'kontaktperson') continue;
    speakerCounts[es.speaker_id] = (speakerCounts[es.speaker_id] || 0) + 1;
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

  // topicDistribution
  const topicEventMap = new Map(eventTopics.map((et: any) => [et.event_id, et.topic_primary]));
  const topicCounts: Record<string, number> = {};
  for (const e of pensionEvents) {
    const topic = topicEventMap.get(e.id);
    if (topic) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }
  const topicDistribution = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // sectorBreakdown
  const sectorCounts: Record<string, number> = {};
  for (const ea of eventArrangerLinks) {
    if (!pensionEventIds.has(ea.event_id)) continue;
    const sector = sectorMap.get(ea.arranger_id) || 'unknown';
    sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
  }
  const sectorBreakdown = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  // sentiment
  const sentimentMap = new Map(sentimentData.map((s: any) => [s.event_id, s]));
  let scoreSum = 0;
  let pos = 0;
  let neu = 0;
  let neg = 0;
  let sentimentTotal = 0;
  for (const e of pensionEvents) {
    const s = sentimentMap.get(e.id);
    if (!s) continue;
    sentimentTotal++;
    scoreSum += s.score;
    if (s.label === 'positiv') pos++;
    else if (s.label === 'neutral') neu++;
    else if (s.label === 'negativ') neg++;
  }
  const sentiment = {
    avg: sentimentTotal > 0 ? Math.round((scoreSum / sentimentTotal) * 1000) / 1000 : 0,
    pos,
    neu,
    neg,
    total: sentimentTotal,
  };

  // sampleEvents (20 latest)
  const sampleEvents = pensionEvents
    .sort((a: any, b: any) => b.year - a.year)
    .slice(0, 20)
    .map((e: any) => ({ id: e.id, year: e.year, title: e.title }));

  // Network: top 20 arrangers as nodes, edges = shared speakers on pension events
  const top20Ids = topArrangers.slice(0, 20).map((a: any) => a.id);
  const arrangerPensionSpeakers: Record<number, Set<number>> = {};
  for (const arrId of top20Ids) {
    arrangerPensionSpeakers[arrId] = new Set();
  }
  for (const ea of eventArrangerLinks) {
    if (!pensionEventIds.has(ea.event_id) || !arrangerPensionSpeakers[ea.arranger_id]) continue;
    const spks = eventSpeakerLinks.filter((es: any) => es.event_id === ea.event_id && es.role !== 'kontaktperson');
    for (const es of spks) {
      arrangerPensionSpeakers[ea.arranger_id].add(es.speaker_id);
    }
  }
  const networkEdges: { source: number; target: number; weight: number }[] = [];
  for (let i = 0; i < top20Ids.length; i++) {
    for (let j = i + 1; j < top20Ids.length; j++) {
      const a = arrangerPensionSpeakers[top20Ids[i]];
      const b = arrangerPensionSpeakers[top20Ids[j]];
      let shared = 0;
      for (const spk of a) { if (b.has(spk)) shared++; }
      if (shared >= 1) networkEdges.push({ source: top20Ids[i], target: top20Ids[j], weight: shared });
    }
  }
  const networkNodes = topArrangers.slice(0, 20).map((a: any) => ({
    id: a.id, name: a.name, sector: a.sector, events: a.eventCount,
  }));

  return {
    totalEvents,
    perYear,
    topArrangers,
    topSpeakers,
    topicDistribution,
    sectorBreakdown,
    sentiment,
    sampleEvents,
    network: { nodes: networkNodes, edges: networkEdges },
  };
}
