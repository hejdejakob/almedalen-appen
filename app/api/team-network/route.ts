import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimitApi } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RS_ARRANGER_ID = 10769;
const GORAN_SPEAKER_ID = 1495;
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
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
    );
  }

  try {
    const data = await getTeamNetwork();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('Team network API error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Något gick fel. Försök igen senare.' }, { status: 500 });
  }
}

async function getTeamNetwork() {
  // 1. Basic arranger info
  const [arrangerRes, classRes] = await Promise.all([
    supabase.from('arrangers').select('id, name').eq('id', RS_ARRANGER_ID).single(),
    supabase.from('arranger_classifications').select('sector, sub_sector').eq('arranger_id', RS_ARRANGER_ID).single(),
  ]);

  // 2. All RS events
  const eventArrangerLinks = await fetchAll('event_arrangers', 'event_id', q =>
    q.eq('arranger_id', RS_ARRANGER_ID)
  );
  const allEventIds = eventArrangerLinks.map((ea: any) => ea.event_id);

  // Get event details for visible years
  const events = allEventIds.length > 0
    ? await fetchAll('events', 'id, year, title, location_name', q =>
        q.in('id', allEventIds).in('year', VISIBLE_YEARS)
      )
    : [];
  const visibleEventIds = events.map((e: any) => e.id);

  // Per year
  const perYear: Record<string, number> = {};
  for (const e of events) {
    perYear[e.year] = (perYear[e.year] || 0) + 1;
  }

  // 3. Co-arrangers on RS events (with sectors)
  let coArrangers: { id: number; name: string; sector: string | null; sharedEvents: number }[] = [];
  if (visibleEventIds.length > 0) {
    const allLinks = await fetchAll('event_arrangers', 'event_id, arranger_id', q =>
      q.in('event_id', visibleEventIds)
    );
    const coCount: Record<number, number> = {};
    for (const link of allLinks) {
      if (link.arranger_id === RS_ARRANGER_ID) continue;
      coCount[link.arranger_id] = (coCount[link.arranger_id] || 0) + 1;
    }
    const coIds = Object.keys(coCount).map(Number);
    if (coIds.length > 0) {
      const [names, classes] = await Promise.all([
        fetchAll('arrangers', 'id, name', q => q.in('id', coIds)),
        fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', coIds)),
      ]);
      const nameMap = new Map(names.map((a: any) => [a.id, a.name]));
      const sectorMap = new Map(classes.map((c: any) => [c.arranger_id, c.sector]));
      coArrangers = coIds
        .map(id => ({
          id,
          name: nameMap.get(id) || 'Unknown',
          sector: sectorMap.get(id) || null,
          sharedEvents: coCount[id],
        }))
        .sort((a, b) => b.sharedEvents - a.sharedEvents);
    }
  }

  // 4. All speakers on RS events
  let speakers: { id: number; name: string; title: string | null; org: string | null; events: number }[] = [];
  if (visibleEventIds.length > 0) {
    const esLinks = await fetchAll('event_speakers', 'event_id, speaker_id, role', q =>
      q.in('event_id', visibleEventIds).neq('role', 'kontaktperson')
    );
    const spCount: Record<number, number> = {};
    for (const link of esLinks) {
      spCount[link.speaker_id] = (spCount[link.speaker_id] || 0) + 1;
    }
    const spIds = Object.keys(spCount).map(Number);
    if (spIds.length > 0) {
      const spData = await fetchAll('speakers', 'id, name, title, org_name', q => q.in('id', spIds));
      const spMap = new Map(spData.map((s: any) => [s.id, s]));
      speakers = spIds
        .map(id => {
          const sp = spMap.get(id);
          return {
            id,
            name: sp?.name || 'Unknown',
            title: sp?.title || null,
            org: sp?.org_name || null,
            events: spCount[id],
          };
        })
        .sort((a, b) => b.events - a.events);
    }
  }

  // 5. Topics for RS events
  let topics: { topic: string; count: number }[] = [];
  if (visibleEventIds.length > 0) {
    const topicData = await fetchAll('event_topics', 'event_id, topic_primary', q =>
      q.in('event_id', visibleEventIds).not('topic_primary', 'is', null)
    );
    const topicCounts: Record<string, number> = {};
    for (const t of topicData) {
      if (t.topic_primary) topicCounts[t.topic_primary] = (topicCounts[t.topic_primary] || 0) + 1;
    }
    topics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([topic, count]) => ({ topic, count }));
  }

  // 6. Sentiment for RS events
  let sentiment = { avg: 0, pos: 0, neu: 0, neg: 0 };
  if (visibleEventIds.length > 0) {
    const sentData = await fetchAll('event_sentiment', 'event_id, score, label', q =>
      q.in('event_id', visibleEventIds)
    );
    if (sentData.length > 0) {
      const total = sentData.length;
      const avg = sentData.reduce((s: number, d: any) => s + (d.score || 0), 0) / total;
      const pos = sentData.filter((d: any) => d.label === 'positiv').length;
      const neu = sentData.filter((d: any) => d.label === 'neutral').length;
      const neg = sentData.filter((d: any) => d.label === 'negativ').length;
      sentiment = { avg: Math.round(avg * 100) / 100, pos, neu, neg };
    }
  }

  // 7. Göran Hägglund profile — all events across all arrangers
  const goranLinks = await fetchAll('event_speakers', 'event_id', q =>
    q.eq('speaker_id', GORAN_SPEAKER_ID)
  );
  const goranEventIds = goranLinks.map((l: any) => l.event_id);

  let goranProfile: any = {
    totalPanels: 0,
    topTopics: [],
    topArrangers: [],
    perYear: {},
  };

  if (goranEventIds.length > 0) {
    const goranEvents = await fetchAll('events', 'id, year', q =>
      q.in('id', goranEventIds).in('year', VISIBLE_YEARS)
    );
    const goranVisibleIds = goranEvents.map((e: any) => e.id);
    goranProfile.totalPanels = goranVisibleIds.length;

    // Per year
    const gPerYear: Record<string, number> = {};
    for (const e of goranEvents) {
      gPerYear[e.year] = (gPerYear[e.year] || 0) + 1;
    }
    goranProfile.perYear = gPerYear;

    // Topics
    if (goranVisibleIds.length > 0) {
      const gTopics = await fetchAll('event_topics', 'event_id, topic_primary', q =>
        q.in('event_id', goranVisibleIds).not('topic_primary', 'is', null)
      );
      const gTopicCounts: Record<string, number> = {};
      for (const t of gTopics) {
        if (t.topic_primary) gTopicCounts[t.topic_primary] = (gTopicCounts[t.topic_primary] || 0) + 1;
      }
      goranProfile.topTopics = Object.entries(gTopicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, count]) => ({ topic, count }));

      // Top arrangers for Göran
      const gArrangerLinks = await fetchAll('event_arrangers', 'event_id, arranger_id', q =>
        q.in('event_id', goranVisibleIds)
      );
      const gArrangerCounts: Record<number, number> = {};
      for (const link of gArrangerLinks) {
        gArrangerCounts[link.arranger_id] = (gArrangerCounts[link.arranger_id] || 0) + 1;
      }
      const gArrangerIds = Object.keys(gArrangerCounts).map(Number);
      if (gArrangerIds.length > 0) {
        const [gNames, gClasses] = await Promise.all([
          fetchAll('arrangers', 'id, name', q => q.in('id', gArrangerIds)),
          fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', gArrangerIds)),
        ]);
        const gNameMap = new Map(gNames.map((a: any) => [a.id, a.name]));
        const gSectorMap = new Map(gClasses.map((c: any) => [c.arranger_id, c.sector]));
        goranProfile.topArrangers = gArrangerIds
          .map(id => ({
            id,
            name: gNameMap.get(id) || 'Unknown',
            sector: gSectorMap.get(id) || null,
            events: gArrangerCounts[id],
          }))
          .sort((a, b) => b.events - a.events)
          .slice(0, 15);
      }
    }
  }

  return {
    arranger: {
      name: arrangerRes.data?.name || 'Reform Society',
      totalEvents: visibleEventIds.length,
      sector: classRes.data?.sector || 'tänketank_stiftelse',
    },
    perYear,
    coArrangers,
    speakers,
    topics,
    sentiment,
    goranProfile,
  };
}
