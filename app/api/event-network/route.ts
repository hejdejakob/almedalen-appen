import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VISIBLE_YEARS = [2022, 2023, 2024, 2025];

// Hardcoded arranger IDs from event-org-matches.json (only those with matched_id != null)
const EVENT_ARRANGER_IDS = [
  11537, // Naturskyddsföreningen
  13611, // Försvarsförbundet
  11280, // Barncancerfonden
  10844, // Håll Sverige Rent
  11173, // IKEM
  11424, // Njurförbundet
  // 10769, // Reform Society — excluded (we're the host)
  10785, // Civil Rights Defenders
  13656, // Ideella Sverige
  11440, // Ellevio
  13488, // WaterAid
  12660, // Eneff
  10789, // Vision
  10940, // Volontärbyrån
  13027, // Better Shelter
  13354, // Epilepsiförbundet
  11713, // Stockholms Universitet
  11986, // Hjärnfonden
  11763, // Unizon
  12042, // Sveriges Skolledare
  10733, // Bris
  11425, // Läromedelsförfattarna
  11590, // 2030-sekretariatet
  10841, // Folk och Försvar
  10898, // Vattenfall
  11273, // Sobona
  13468, // Polisförbundet
  11023, // Centerpartiet
  11352, // International Rescue Committee
  11401, // Giva Sverige
  11563, // OBOS
  10822, // IF Metall
  11028, // Vänsterpartiet
  10792, // Diakonia
  12005, // Sveriges Lärare
  11010, // Kristna Fredsrörelsen
  12621, // Återvinningsindustrierna
  13312, // Gröna arbetsgivare
  11949, // Amnesty International
];

// Display names (capitalized properly)
const DISPLAY_NAMES: Record<number, string> = {
  11537: 'Naturskyddsföreningen',
  13611: 'Försvarsförbundet',
  11280: 'Barncancerfonden',
  10844: 'Håll Sverige Rent',
  11173: 'IKEM',
  11424: 'Njurförbundet',
  // 10769: 'Reform Society', — excluded
  10785: 'Civil Rights Defenders',
  13656: 'Ideella Sverige',
  11440: 'Ellevio',
  13488: 'WaterAid',
  12660: 'Eneff',
  10789: 'Vision',
  10940: 'Volontärbyrån',
  13027: 'Better Shelter',
  13354: 'Epilepsiförbundet',
  11713: 'Stockholms Universitet',
  11986: 'Hjärnfonden',
  11763: 'Unizon',
  12042: 'Sveriges Skolledare',
  10733: 'Bris',
  11425: 'Läromedelsförfattarna',
  11590: '2030-sekretariatet',
  10841: 'Folk och Försvar',
  10898: 'Vattenfall',
  11273: 'Sobona',
  13468: 'Polisförbundet',
  11023: 'Centerpartiet',
  11352: 'International Rescue Committee',
  11401: 'Giva Sverige',
  11563: 'OBOS',
  10822: 'IF Metall',
  11028: 'Vänsterpartiet',
  10792: 'Diakonia',
  12005: 'Sveriges Lärare',
  11010: 'Kristna Fredsrörelsen',
  12621: 'Återvinningsindustrierna',
  13312: 'Gröna arbetsgivare',
  11949: 'Amnesty International',
};

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

export async function GET() {
  try {
    // 1. Get arranger classifications (sector info)
    const classifications = await fetchAll(
      'arranger_classifications',
      'arranger_id, sector',
      q => q.in('arranger_id', EVENT_ARRANGER_IDS)
    );
    const sectorMap = new Map(classifications.map((c: any) => [c.arranger_id, c.sector]));

    // 2. Get all event_arrangers links for these orgs
    const eventArrangerLinks = await fetchAll(
      'event_arrangers',
      'event_id, arranger_id',
      q => q.in('arranger_id', EVENT_ARRANGER_IDS)
    );

    // 3. Get events for visible years only
    const eventIds = [...new Set(eventArrangerLinks.map((ea: any) => ea.event_id))];
    if (eventIds.length === 0) {
      return NextResponse.json({ nodes: [], edges: [], stats: { totalOrgs: 0, totalEvents: 0, totalConnections: 0, sectors: {} } });
    }

    // Fetch events in batches to filter by year
    const events = await fetchAll(
      'events',
      'id, year',
      q => q.in('id', eventIds).in('year', VISIBLE_YEARS)
    );
    const visibleEventIds = new Set(events.map((e: any) => e.id));

    // Filter event-arranger links to visible years
    const visibleLinks = eventArrangerLinks.filter((ea: any) => visibleEventIds.has(ea.event_id));

    // Build arranger -> event set mapping
    const arrangerEvents: Record<number, Set<number>> = {};
    for (const link of visibleLinks) {
      if (!arrangerEvents[link.arranger_id]) arrangerEvents[link.arranger_id] = new Set();
      arrangerEvents[link.arranger_id].add(link.event_id);
    }

    // 4. Get event_speakers for visible events (exclude kontaktperson)
    const visibleEventIdArray = [...visibleEventIds];
    const eventSpeakers = await fetchAll(
      'event_speakers',
      'event_id, speaker_id, role',
      q => q.in('event_id', visibleEventIdArray).neq('role', 'kontaktperson')
    );

    // Build event -> speaker set and arranger -> speaker set
    const arrangerSpeakers: Record<number, Set<number>> = {};
    const eventSpeakerMap: Record<number, Set<number>> = {};

    for (const es of eventSpeakers) {
      if (!eventSpeakerMap[es.event_id]) eventSpeakerMap[es.event_id] = new Set();
      eventSpeakerMap[es.event_id].add(es.speaker_id);
    }

    // Map arrangers to their speakers (via their events)
    for (const arrangerId of EVENT_ARRANGER_IDS) {
      arrangerSpeakers[arrangerId] = new Set();
      const evts = arrangerEvents[arrangerId];
      if (!evts) continue;
      for (const eventId of evts) {
        const speakers = eventSpeakerMap[eventId];
        if (speakers) {
          for (const spk of speakers) {
            arrangerSpeakers[arrangerId].add(spk);
          }
        }
      }
    }

    // 5. Fetch speaker names for resolving shared speakers
    const allSpeakerIds = new Set<number>();
    for (const spkSet of Object.values(arrangerSpeakers)) {
      for (const spk of spkSet) allSpeakerIds.add(spk);
    }
    const speakerNames = allSpeakerIds.size > 0
      ? await fetchAll('speakers', 'id, name, title, org_name', q => q.in('id', [...allSpeakerIds]))
      : [];
    const speakerNameMap = new Map(speakerNames.map((s: any) => [s.id, { name: s.name, title: s.title, org: s.org_name }]));

    // 6. Compute edges: shared speakers between pairs (with names)
    const edges: { source: number; target: number; weight: number; sharedSpeakers: { id: number; name: string; title: string | null; org: string | null }[] }[] = [];
    const ids = EVENT_ARRANGER_IDS.filter(id => arrangerEvents[id] && arrangerEvents[id].size > 0);

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = arrangerSpeakers[ids[i]];
        const b = arrangerSpeakers[ids[j]];
        if (!a || !b) continue;
        const shared: number[] = [];
        for (const spk of a) {
          if (b.has(spk)) shared.push(spk);
        }
        if (shared.length >= 1) {
          edges.push({
            source: ids[i],
            target: ids[j],
            weight: shared.length,
            sharedSpeakers: shared.map(id => {
              const sp = speakerNameMap.get(id);
              return { id, name: sp?.name || 'Okänd', title: sp?.title || null, org: sp?.org || null };
            }),
          });
        }
      }
    }

    // 7. Get top 3 topics per org
    const topTopicsMap: Record<number, string[]> = {};
    for (const arrangerId of EVENT_ARRANGER_IDS) {
      const evts = arrangerEvents[arrangerId];
      if (!evts || evts.size === 0) {
        topTopicsMap[arrangerId] = [];
        continue;
      }
      const topics = await fetchAll(
        'event_topics',
        'topic_primary',
        q => q.in('event_id', [...evts]).not('topic_primary', 'is', null)
      );
      const counts: Record<string, number> = {};
      for (const t of topics) {
        if (t.topic_primary) counts[t.topic_primary] = (counts[t.topic_primary] || 0) + 1;
      }
      topTopicsMap[arrangerId] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([topic]) => topic);
    }

    // 8. Build nodes with top speakers
    const nodes = EVENT_ARRANGER_IDS.map(id => {
      const spkIds = arrangerSpeakers[id] ? [...arrangerSpeakers[id]] : [];
      // Count how many events each speaker appears in for this org
      const spkEventCounts: Record<number, number> = {};
      const evts = arrangerEvents[id];
      if (evts) {
        for (const eventId of evts) {
          const spks = eventSpeakerMap[eventId];
          if (spks) for (const spk of spks) {
            if (spkIds.includes(spk)) spkEventCounts[spk] = (spkEventCounts[spk] || 0) + 1;
          }
        }
      }
      const topSpeakers = Object.entries(spkEventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([spkId, count]) => {
          const sp = speakerNameMap.get(parseInt(spkId));
          return { id: parseInt(spkId), name: sp?.name || 'Okänd', title: sp?.title || null, org: sp?.org || null, events: count };
        });

      return {
        id,
        name: DISPLAY_NAMES[id] || `Org ${id}`,
        sector: sectorMap.get(id) || 'övrigt',
        events: arrangerEvents[id]?.size || 0,
        totalSpeakers: spkIds.length,
        topTopics: topTopicsMap[id] || [],
        topSpeakers,
      };
    });

    // 9. Stats
    const sectorCounts: Record<string, number> = {};
    for (const node of nodes) {
      sectorCounts[node.sector] = (sectorCounts[node.sector] || 0) + 1;
    }

    const totalEvents = nodes.reduce((sum, n) => sum + n.events, 0);

    return NextResponse.json({
      nodes,
      edges,
      stats: {
        totalOrgs: EVENT_ARRANGER_IDS.length,
        totalEvents,
        totalConnections: edges.length,
        totalSharedSpeakers: edges.reduce((sum, e) => sum + e.weight, 0),
        sectors: sectorCounts,
      },
    });
  } catch (err: unknown) {
    console.error('Event network API error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Något gick fel.' }, { status: 500 });
  }
}
