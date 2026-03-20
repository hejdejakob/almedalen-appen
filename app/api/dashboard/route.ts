import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Years to show in frontend (2026 data exists but is incomplete)
const VISIBLE_YEARS = [2022, 2023, 2024, 2025];

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
    } else {
      return NextResponse.json({ error: 'Unknown view. Use: stats, topics, sectors, power, sentiment, speakers, network, locations, arena-network' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
