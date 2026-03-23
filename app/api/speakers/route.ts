import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimitApi } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const id = searchParams.get('id');
  const eventId = searchParams.get('event');
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);

  try {
    if (eventId) {
      return NextResponse.json(await getEventDetail(parseInt(eventId)));
    } else if (id) {
      return NextResponse.json(await getSpeakerProfile(parseInt(id)));
    } else {
      return NextResponse.json(await searchSpeakers(q || '', limit));
    }
  } catch (err: unknown) {
    console.error("Speakers API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Något gick fel. Försök igen senare." }, { status: 500 });
  }
}

async function searchSpeakers(query: string, limit: number) {
  let speakerIds: number[] = [];

  if (query.trim()) {
    // Try full-text search on search_vector column first
    const tsQuery = query.trim().split(/\s+/).map(w => w + ':*').join(' & ');
    const { data: ftsResults, error: ftsError } = await supabase
      .from('speakers')
      .select('id')
      .textSearch('search_vector', tsQuery, { config: 'swedish' })
      .limit(limit);

    if (!ftsError && ftsResults && ftsResults.length > 0) {
      speakerIds = ftsResults.map((r: any) => r.id);
    } else {
      // Fallback to ILIKE on name (handles substrings FTS misses, or if search_vector not yet created)
      const { data: ilikeResults } = await supabase
        .from('speakers')
        .select('id')
        .ilike('name', `%${query.trim()}%`)
        .limit(limit);
      if (ilikeResults) {
        speakerIds = ilikeResults.map((r: any) => r.id);
      }
    }
  }

  // Get speaker stats to sort by totalPanels
  const stats = await fetchAll('speaker_stats', 'speaker_id, year, panel_count, unique_arrangers, years_active, breadth_score');
  const totals: Record<number, { panels: number; years: Set<number>; breadth: number }> = {};
  for (const s of stats) {
    if (!VISIBLE_YEARS.includes(s.year)) continue;
    if (!totals[s.speaker_id]) totals[s.speaker_id] = { panels: 0, years: new Set(), breadth: 0 };
    totals[s.speaker_id].panels += s.panel_count;
    totals[s.speaker_id].years.add(s.year);
    totals[s.speaker_id].breadth = Math.max(totals[s.speaker_id].breadth, s.breadth_score);
  }

  let resultIds: number[];
  if (query.trim()) {
    // Sort found speakers by panels
    resultIds = speakerIds
      .sort((a, b) => (totals[b]?.panels || 0) - (totals[a]?.panels || 0))
      .slice(0, limit);
  } else {
    // No query: top speakers by panels
    resultIds = Object.entries(totals)
      .sort((a, b) => b[1].panels - a[1].panels)
      .slice(0, limit)
      .map(([id]) => parseInt(id));
  }

  if (resultIds.length === 0) return { speakers: [] };

  // Get speaker details + classifications
  const [speakers, classifications] = await Promise.all([
    fetchAll('speakers', 'id, name, title, org_name'),
    fetchAll('speaker_classifications', 'speaker_id, category'),
  ]);
  const nameMap = new Map(speakers.map((s: any) => [s.id, s]));
  const categoryMap = new Map(classifications.map((c: any) => [c.speaker_id, c.category]));

  const results = resultIds.map(id => {
    const sp = nameMap.get(id);
    const t = totals[id];
    return {
      id,
      name: sp?.name || 'Unknown',
      title: sp?.title || null,
      org: sp?.org_name || null,
      category: categoryMap.get(id) || null,
      totalPanels: t?.panels || 0,
      yearsActive: t?.years.size || 0,
    };
  });

  return { speakers: results };
}

async function getSpeakerProfile(speakerId: number) {
  // Basic info
  const { data: speaker } = await supabase
    .from('speakers')
    .select('id, name, title, org_name, first_seen_year')
    .eq('id', speakerId)
    .single();

  if (!speaker) throw new Error('Speaker not found');

  // Classification
  const { data: classification } = await supabase
    .from('speaker_classifications')
    .select('category')
    .eq('speaker_id', speakerId)
    .single();

  // Stats per year
  const { data: yearStats } = await supabase
    .from('speaker_stats')
    .select('year, panel_count, unique_arrangers, years_active, breadth_score')
    .eq('speaker_id', speakerId)
    .in('year', VISIBLE_YEARS)
    .order('year');

  // Events via event_speakers
  const { data: eventLinks } = await supabase
    .from('event_speakers')
    .select('event_id, role')
    .eq('speaker_id', speakerId);

  const eventIds = (eventLinks || []).map((el: any) => el.event_id);

  // Fetch events, topics, arrangers in parallel
  const [events, topics, eventArrangers, arrangers, arrangerClassifications] = await Promise.all([
    eventIds.length > 0
      ? fetchAll('events', 'id, year, title, location_name', q => q.in('id', eventIds).in('year', VISIBLE_YEARS))
      : Promise.resolve([]),
    eventIds.length > 0
      ? fetchAll('event_topics', 'event_id, topic_primary', q => q.in('event_id', eventIds))
      : Promise.resolve([]),
    eventIds.length > 0
      ? fetchAll('event_arrangers', 'event_id, arranger_id', q => q.in('event_id', eventIds))
      : Promise.resolve([]),
    fetchAll('arrangers', 'id, name'),
    fetchAll('arranger_classifications', 'arranger_id, sector'),
  ]);

  const topicMap = new Map(topics.map((t: any) => [t.event_id, t.topic_primary]));
  const arrangerMap = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const arrangerSectorMap = new Map(arrangerClassifications.map((c: any) => [c.arranger_id, c.sector]));

  // Map event -> primary arranger
  const eventArrangerMap = new Map<number, { name: string; sector: string | null }>();
  for (const ea of eventArrangers) {
    if (!eventArrangerMap.has(ea.event_id)) {
      eventArrangerMap.set(ea.event_id, {
        name: arrangerMap.get(ea.arranger_id) || 'Unknown',
        sector: arrangerSectorMap.get(ea.arranger_id) || null,
      });
    }
  }

  const visibleEventIds = new Set(events.map((e: any) => e.id));

  const seminars = events
    .map((e: any) => ({
      id: e.id,
      year: e.year,
      title: e.title,
      topic: topicMap.get(e.id) || null,
      arranger: eventArrangerMap.get(e.id)?.name || null,
      arrangerSector: eventArrangerMap.get(e.id)?.sector || null,
    }))
    .sort((a: any, b: any) => b.year - a.year || a.title.localeCompare(b.title));

  // Top organizations: count arrangers for visible events only
  const arrangerCounts: Record<number, number> = {};
  for (const ea of eventArrangers) {
    if (!visibleEventIds.has(ea.event_id)) continue;
    arrangerCounts[ea.arranger_id] = (arrangerCounts[ea.arranger_id] || 0) + 1;
  }
  const topArrangerEntries = Object.entries(arrangerCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 10);
  const topOrganizations = topArrangerEntries.map(([id, count]) => ({
    id: parseInt(id),
    name: arrangerMap.get(parseInt(id)) || 'Unknown',
    sector: arrangerSectorMap.get(parseInt(id)) || null,
    eventCount: count,
  }));

  // Top topics: aggregate from topicMap for visible events
  const topicCounts: Record<string, number> = {};
  for (const e of events) {
    const topic = topicMap.get(e.id);
    if (topic) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  // Top arenas: aggregate from events location_name
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

  // Co-panelists: find speakers sharing at least 2 events
  const coPanelists = await getCoPanelists(speakerId, Array.from(visibleEventIds));

  // Aggregate stats
  const totalPanels = (yearStats || []).reduce((sum: number, s: any) => sum + s.panel_count, 0);
  const totalArrangers = Math.max(...(yearStats || []).map((s: any) => s.unique_arrangers), 0);
  const maxBreadth = Math.max(...(yearStats || []).map((s: any) => s.breadth_score), 0);

  return {
    speaker: {
      ...speaker,
      category: classification?.category || null,
    },
    stats: {
      totalPanels,
      yearsActive: (yearStats || []).length,
      uniqueArrangers: totalArrangers,
      breadthScore: maxBreadth,
      perYear: yearStats || [],
    },
    seminars,
    coPanelists,
    topOrganizations,
    topTopics,
    topArenas,
  };
}

async function getCoPanelists(speakerId: number, eventIds: number[]) {
  if (eventIds.length === 0) return [];

  // Get all speakers for these events
  const eventSpeakers = await fetchAll('event_speakers', 'event_id, speaker_id', q =>
    q.in('event_id', eventIds).neq('speaker_id', speakerId)
  );

  // Count shared events per co-panelist
  const sharedCounts: Record<number, number> = {};
  for (const es of eventSpeakers) {
    sharedCounts[es.speaker_id] = (sharedCounts[es.speaker_id] || 0) + 1;
  }

  // Filter to those with 2+ shared events, sort by count
  const topCoPanelists = Object.entries(sharedCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (topCoPanelists.length === 0) return [];

  const coIds = topCoPanelists.map(([id]) => parseInt(id));

  const [speakers, classifications] = await Promise.all([
    fetchAll('speakers', 'id, name, title, org_name', q => q.in('id', coIds)),
    fetchAll('speaker_classifications', 'speaker_id, category', q => q.in('speaker_id', coIds)),
  ]);

  const speakerMap = new Map(speakers.map((s: any) => [s.id, s]));
  const categoryMap = new Map(classifications.map((c: any) => [c.speaker_id, c.category]));

  return topCoPanelists.map(([id, count]) => {
    const sp = speakerMap.get(parseInt(id));
    return {
      id: parseInt(id),
      name: sp?.name || 'Unknown',
      title: sp?.title || null,
      org: sp?.org_name || null,
      category: categoryMap.get(parseInt(id)) || null,
      sharedCount: count,
    };
  });
}

async function getEventDetail(eventId: number) {
  // Fetch event + related data in parallel
  const [eventRes, topicRes, sentimentRes, eventSpeakers, eventArrangerLinks] = await Promise.all([
    supabase.from('events').select('id, year, title, description, extended_description, start_time, end_time, day_of_week, location_name, lat, lng, event_type, url').eq('id', eventId).single(),
    supabase.from('event_topics').select('topic_primary, topic_secondary, keywords').eq('event_id', eventId).single(),
    supabase.from('event_sentiment').select('score, label, urgency_score, framing').eq('event_id', eventId).single(),
    fetchAll('event_speakers', 'speaker_id, role', q => q.eq('event_id', eventId)),
    fetchAll('event_arrangers', 'arranger_id, is_primary', q => q.eq('event_id', eventId)),
  ]);

  if (!eventRes.data) throw new Error('Event not found');

  const speakerIds = eventSpeakers.map((es: any) => es.speaker_id);
  const arrangerIds = eventArrangerLinks.map((ea: any) => ea.arranger_id);

  // Fetch speaker and arranger details
  const [speakers, speakerClassifications, arrangers, arrangerClassifications] = await Promise.all([
    speakerIds.length > 0
      ? fetchAll('speakers', 'id, name, title, org_name', q => q.in('id', speakerIds))
      : Promise.resolve([]),
    speakerIds.length > 0
      ? fetchAll('speaker_classifications', 'speaker_id, category', q => q.in('speaker_id', speakerIds))
      : Promise.resolve([]),
    arrangerIds.length > 0
      ? fetchAll('arrangers', 'id, name', q => q.in('id', arrangerIds))
      : Promise.resolve([]),
    arrangerIds.length > 0
      ? fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', arrangerIds))
      : Promise.resolve([]),
  ]);

  const speakerMap = new Map(speakers.map((s: any) => [s.id, s]));
  const spCategoryMap = new Map(speakerClassifications.map((c: any) => [c.speaker_id, c.category]));
  const roleMap = new Map(eventSpeakers.map((es: any) => [es.speaker_id, es.role]));
  const arrangerNameMap = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const arrangerSectorMap = new Map(arrangerClassifications.map((c: any) => [c.arranger_id, c.sector]));

  return {
    event: eventRes.data,
    topic: topicRes.data || null,
    sentiment: sentimentRes.data || null,
    speakers: speakerIds.map((id: number) => {
      const sp = speakerMap.get(id);
      return {
        id,
        name: sp?.name || 'Unknown',
        title: sp?.title || null,
        org: sp?.org_name || null,
        category: spCategoryMap.get(id) || null,
        role: roleMap.get(id) || null,
      };
    }).sort((a: any, b: any) => {
      // kontaktperson last
      if (a.role === 'kontaktperson' && b.role !== 'kontaktperson') return 1;
      if (b.role === 'kontaktperson' && a.role !== 'kontaktperson') return -1;
      return a.name.localeCompare(b.name);
    }),
    arrangers: arrangerIds.map((id: number) => ({
      id,
      name: arrangerNameMap.get(id) || 'Unknown',
      sector: arrangerSectorMap.get(id) || null,
      isPrimary: eventArrangerLinks.find((ea: any) => ea.arranger_id === id)?.is_primary || false,
    })),
  };
}
