import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimitApi } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 2026 inkluderat: arranger_stats innehåller 2026 och kundvyn ska visa årets pass.
// (Endast arrangörsvyn — dashboard/galtan/nätverk lämnas på avslutade år tills vidare.)
const VISIBLE_YEARS = [2022, 2023, 2024, 2025, 2026];

// CHES 2024 Swedish party scores
const CHES_SCORES: Record<string, { lrecon: number; galtan: number }> = {
  V:   { lrecon: 1.89, galtan: 2.42 },
  SAP: { lrecon: 3.68, galtan: 4.74 },
  C:   { lrecon: 7.84, galtan: 2.95 },
  L:   { lrecon: 7.32, galtan: 4.47 },
  M:   { lrecon: 7.89, galtan: 6.47 },
  KD:  { lrecon: 7.26, galtan: 7.79 },
  MP:  { lrecon: 3.16, galtan: 1.95 },
  SD:  { lrecon: 6.32, galtan: 9.00 },
};

function matchParty(orgName: string | null | undefined): string | null {
  if (!orgName) return null;
  const lower = orgName.toLowerCase();
  if (/moderaterna|\(m\)|moderata/.test(lower)) return 'M';
  if (/socialdemokraterna|\(s\)\s|socialdemokrat/.test(lower)) return 'SAP';
  if (/sverigedemokraterna|\(sd\)/.test(lower)) return 'SD';
  if (/centerpartiet|\(c\)/.test(lower)) return 'C';
  if (/vänsterpartiet|\(v\)/.test(lower)) return 'V';
  if (/liberalerna|\(l\)|folkpartiet/.test(lower)) return 'L';
  if (/kristdemokraterna|\(kd\)/.test(lower)) return 'KD';
  if (/miljöpartiet|\(mp\)/.test(lower)) return 'MP';
  return null;
}

function buildPoliticalProfile(
  politicianSpeakerIds: number[],
  speakerOrgMap: Map<number, string | null>,
): { parties: Record<string, number>; lrecon: number; galtan: number; totalPoliticians: number } | null {
  const parties: Record<string, number> = {};
  let total = 0;
  const uniqueIds = [...new Set(politicianSpeakerIds)];

  for (const sid of uniqueIds) {
    const party = matchParty(speakerOrgMap.get(sid));
    if (party) {
      parties[party] = (parties[party] || 0) + 1;
      total++;
    }
  }

  if (total < 2) return null;

  let lreconSum = 0, galtanSum = 0;
  for (const [party, count] of Object.entries(parties)) {
    const scores = CHES_SCORES[party];
    if (scores) {
      lreconSum += scores.lrecon * count;
      galtanSum += scores.galtan * count;
    }
  }

  return {
    parties,
    lrecon: Math.round((lreconSum / total) * 100) / 100,
    galtan: Math.round((galtanSum / total) * 100) / 100,
    totalPoliticians: total,
  };
}

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
      { error: 'For many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);

  try {
    if (id) {
      return NextResponse.json(await getArrangerProfile(parseInt(id)));
    } else {
      return NextResponse.json(await searchArrangers(q || '', limit));
    }
  } catch (err: unknown) {
    console.error("Arrangers API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Något gick fel. Försök igen senare." }, { status: 500 });
  }
}

async function searchArrangers(query: string, limit: number) {
  // Get all arranger stats for visible years
  const stats = await fetchAll('arranger_stats', 'arranger_id, year, events_count', q =>
    q.in('year', VISIBLE_YEARS)
  );

  // Aggregate per arranger
  const totals: Record<number, { events: number; years: Set<number> }> = {};
  for (const s of stats) {
    if (!totals[s.arranger_id]) totals[s.arranger_id] = { events: 0, years: new Set() };
    totals[s.arranger_id].events += s.events_count;
    totals[s.arranger_id].years.add(s.year);
  }

  // Filter to arrangers with events > 0
  let candidateIds: number[];

  if (query.trim()) {
    // Search by name — sanitize input to prevent PostgREST filter injection
    const sanitized = query.trim().slice(0, 200).replace(/[%_\\,;()]/g, '');
    const { data: nameResults } = await supabase
      .from('arrangers')
      .select('id')
      .or(`name.ilike.%${sanitized}%,name_normalized.ilike.%${sanitized}%`)
      .limit(500);

    const matchedIds = new Set((nameResults || []).map((r: any) => r.id));

    // Only include those with events
    candidateIds = Array.from(matchedIds)
      .filter(id => totals[id] && totals[id].events > 0)
      .sort((a, b) => (totals[b]?.events || 0) - (totals[a]?.events || 0))
      .slice(0, limit);
  } else {
    // No query: top arrangers by events
    candidateIds = Object.entries(totals)
      .filter(([, t]) => t.events > 0)
      .sort((a, b) => b[1].events - a[1].events)
      .slice(0, limit)
      .map(([id]) => parseInt(id));
  }

  if (candidateIds.length === 0) return { arrangers: [] };

  // Get arranger names and classifications
  const [arrangers, classifications] = await Promise.all([
    fetchAll('arrangers', 'id, name', q => q.in('id', candidateIds)),
    fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', candidateIds)),
  ]);

  const nameMap = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const sectorMap = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));

  const results = candidateIds.map(id => ({
    id,
    name: nameMap.get(id) || 'Unknown',
    sector: sectorMap.get(id) || null,
    totalEvents: totals[id]?.events || 0,
    yearsActive: totals[id]?.years.size || 0,
  }));

  return { arrangers: results };
}

async function getArrangerProfile(arrangerId: number) {
  // 1. Basic info
  const [arrangerRes, classificationRes] = await Promise.all([
    supabase.from('arrangers').select('id, name').eq('id', arrangerId).single(),
    supabase.from('arranger_classifications').select('sector, sub_sector').eq('arranger_id', arrangerId).single(),
  ]);

  if (!arrangerRes.data) throw new Error('Arranger not found');

  // 2. Per year stats
  const { data: yearStats } = await supabase
    .from('arranger_stats')
    .select('year, events_count, panel_slots_given, agenda_power_index')
    .eq('arranger_id', arrangerId)
    .in('year', VISIBLE_YEARS)
    .order('year');

  const totalEvents = (yearStats || []).reduce((sum: number, s: any) => sum + (s.events_count || 0), 0);
  const agendaPower = (yearStats || []).reduce((sum: number, s: any) => sum + (s.agenda_power_index || 0), 0);

  // 3. Get all events for this arranger (fetched once, reused below)
  const eventArrangerLinks = await fetchAll('event_arrangers', 'event_id, is_primary', q =>
    q.eq('arranger_id', arrangerId)
  );
  const eventIds = eventArrangerLinks.map((ea: any) => ea.event_id);
  // is_primary === false ⇒ medarrangör; annars huvudarrangör. (Datan länkar varje
  // org till sina egna OCH sina samarrangerade pass, med is_primary som markör.)
  const isHuvudByEvent = new Map<number, boolean>(
    eventArrangerLinks.map((ea: any) => [ea.event_id, ea.is_primary !== false])
  );

  let visibleEventIds: number[] = [];
  let topTopics: { topic: string; count: number }[] = [];
  let topArenas: { name: string; eventCount: number }[] = [];
  let seminars: { id: number; year: number; title: string; topic: string | null; location: string | null; role: string }[] = [];
  if (eventIds.length > 0) {
    // Filter to visible years, include location_name for arena aggregation
    const events = await fetchAll('events', 'id, year, location_name, title', q =>
      q.in('id', eventIds).in('year', VISIBLE_YEARS)
    );
    visibleEventIds = events.map((e: any) => e.id);

    if (visibleEventIds.length > 0) {
      const topics = await fetchAll('event_topics', 'event_id, topic_primary', q =>
        q.in('event_id', visibleEventIds).not('topic_primary', 'is', null)
      );

      // Build topic map for seminars list
      const topicMap = new Map<number, string>();
      for (const t of topics) {
        if (t.topic_primary) {
          topicMap.set(t.event_id, t.topic_primary);
        }
      }

      // Count by topic
      const topicCounts: Record<string, number> = {};
      for (const t of topics) {
        if (t.topic_primary) {
          topicCounts[t.topic_primary] = (topicCounts[t.topic_primary] || 0) + 1;
        }
      }

      topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

      // Build seminars list
      seminars = events
        .map((e: any) => ({
          id: e.id,
          year: e.year,
          title: e.title,
          topic: topicMap.get(e.id) || null,
          location: e.location_name || null,
          role: isHuvudByEvent.get(e.id) === false ? 'medarrangör' : 'arrangör',
        }))
        .sort((a: any, b: any) => b.year - a.year || a.title.localeCompare(b.title));
    }

    // Top arenas (venues)
    const venueCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.location_name) {
        venueCounts[e.location_name] = (venueCounts[e.location_name] || 0) + 1;
      }
    }
    topArenas = Object.entries(venueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, eventCount: count }));
  }

  // 4. Top speakers (10)
  let topSpeakers: any[] = [];
  if (visibleEventIds.length > 0) {
      const eventSpeakerLinks = await fetchAll('event_speakers', 'event_id, speaker_id, role', q =>
        q.in('event_id', visibleEventIds).neq('role', 'kontaktperson')
      );

      // Count shared events per speaker
      const speakerCounts: Record<number, number> = {};
      for (const es of eventSpeakerLinks) {
        speakerCounts[es.speaker_id] = (speakerCounts[es.speaker_id] || 0) + 1;
      }

      const topSpeakerEntries = Object.entries(speakerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (topSpeakerEntries.length > 0) {
        const speakerIds = topSpeakerEntries.map(([id]) => parseInt(id));

        const [speakers, speakerClassifications] = await Promise.all([
          fetchAll('speakers', 'id, name, title, org_name', q => q.in('id', speakerIds)),
          fetchAll('speaker_classifications', 'speaker_id, category', q => q.in('speaker_id', speakerIds)),
        ]);

        const speakerMap = new Map(speakers.map((s: any) => [s.id, s]));
        const categoryMap = new Map(speakerClassifications.map((c: any) => [c.speaker_id, c.category]));

        topSpeakers = topSpeakerEntries.map(([id, count]) => {
          const sp = speakerMap.get(parseInt(id));
          return {
            id: parseInt(id),
            name: sp?.name || 'Unknown',
            title: sp?.title || null,
            org: sp?.org_name || null,
            category: categoryMap.get(parseInt(id)) || null,
            sharedEvents: count,
          };
        });
      }
  }

  // 4b. Political profile: identify politiker among ALL speakers for this arranger's events
  let politicalProfile: { parties: Record<string, number>; lrecon: number; galtan: number; totalPoliticians: number } | null = null;
  if (visibleEventIds.length > 0) {
    const allEventSpeakerLinks = await fetchAll('event_speakers', 'speaker_id', q =>
      q.in('event_id', visibleEventIds)
    );
    const allSpeakerIds = [...new Set(allEventSpeakerLinks.map((es: any) => es.speaker_id))];

    if (allSpeakerIds.length > 0) {
      const politicianClassifications = await fetchAll('speaker_classifications', 'speaker_id, category', q =>
        q.in('speaker_id', allSpeakerIds).eq('category', 'politiker')
      );
      const politicianIds = politicianClassifications.map((c: any) => c.speaker_id);

      if (politicianIds.length > 0) {
        const politicianSpeakers = await fetchAll('speakers', 'id, org_name', q =>
          q.in('id', politicianIds)
        );
        const orgMap = new Map(politicianSpeakers.map((s: any) => [s.id, s.org_name]));
        politicalProfile = buildPoliticalProfile(politicianIds, orgMap);
      }
    }
  }

  // 5. Co-organizations (other arrangers sharing events)
  let coOrganizations: { id: number; name: string; sector: string | null; sharedEvents: number }[] = [];
  if (visibleEventIds.length > 0) {
    const allEventArrangerLinks = await fetchAll('event_arrangers', 'event_id, arranger_id', q =>
      q.in('event_id', visibleEventIds)
    );

    const coArrangerCounts: Record<number, number> = {};
    for (const link of allEventArrangerLinks) {
      if (link.arranger_id === arrangerId) continue;
      coArrangerCounts[link.arranger_id] = (coArrangerCounts[link.arranger_id] || 0) + 1;
    }

    const topCoEntries = Object.entries(coArrangerCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 15);

    if (topCoEntries.length > 0) {
      const coIds = topCoEntries.map(([id]) => parseInt(id));

      const [coArrangers, coClassifications] = await Promise.all([
        fetchAll('arrangers', 'id, name', q => q.in('id', coIds)),
        fetchAll('arranger_classifications', 'arranger_id, sector', q => q.in('arranger_id', coIds)),
      ]);

      const coNameMap = new Map(coArrangers.map((a: any) => [a.id, a.name]));
      const coSectorMap = new Map(coClassifications.map((c: any) => [c.arranger_id, c.sector]));

      coOrganizations = topCoEntries.map(([id, count]) => ({
        id: parseInt(id),
        name: coNameMap.get(parseInt(id)) || 'Unknown',
        sector: coSectorMap.get(parseInt(id)) || null,
        sharedEvents: count as number,
      }));
    }
  }

  return {
    arranger: {
      id: arrangerRes.data.id,
      name: arrangerRes.data.name,
      sector: classificationRes.data?.sector || null,
      subSector: classificationRes.data?.sub_sector || null,
      totalEvents,
      agendaPower,
    },
    perYear: (yearStats || []).map((s: any) => ({
      year: s.year,
      events: s.events_count,
      panelSlotsGiven: s.panel_slots_given || 0,
    })),
    seminars,
    topTopics,
    topSpeakers,
    topArenas,
    coOrganizations,
    politicalProfile,
  };
}
