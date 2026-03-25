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

// CHES 2024 Swedish party scores
const CHES_SCORES: Record<string, { lrecon: number; galtan: number; label: string }> = {
  V:   { lrecon: 1.89, galtan: 2.42, label: 'Vänsterpartiet' },
  SAP: { lrecon: 3.68, galtan: 4.74, label: 'Socialdemokraterna' },
  C:   { lrecon: 7.84, galtan: 2.95, label: 'Centerpartiet' },
  L:   { lrecon: 7.32, galtan: 4.47, label: 'Liberalerna' },
  M:   { lrecon: 7.89, galtan: 6.47, label: 'Moderaterna' },
  KD:  { lrecon: 7.26, galtan: 7.79, label: 'Kristdemokraterna' },
  MP:  { lrecon: 3.16, galtan: 1.95, label: 'Miljöpartiet' },
  SD:  { lrecon: 6.32, galtan: 9.00, label: 'Sverigedemokraterna' },
};

function mapOrgToParty(orgName: string): string | null {
  if (!orgName) return null;
  const lower = orgName.toLowerCase();
  if (lower.includes('moderaterna') || lower.includes('(m)') || lower.includes('moderata')) return 'M';
  if (lower.includes('socialdemokraterna') || lower.includes('(s)') || lower.startsWith('sap ') || lower === 'sap') return 'SAP';
  if (lower.includes('sverigedemokraterna') || lower.includes('(sd)')) return 'SD';
  if (lower.includes('centerpartiet') || lower.includes('(c)')) return 'C';
  if (lower.includes('vänsterpartiet') || lower.includes('(v)')) return 'V';
  if (lower.includes('liberalerna') || lower.includes('(l)') || lower.includes('folkpartiet')) return 'L';
  if (lower.includes('kristdemokraterna') || lower.includes('(kd)')) return 'KD';
  if (lower.includes('miljöpartiet') || lower.includes('(mp)')) return 'MP';
  return null;
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

  try {
    // 1. Get all politicians from speaker_classifications
    const classifications = await fetchAll('speaker_classifications', 'speaker_id, category', q =>
      q.eq('category', 'politiker')
    );
    const politicianIds = new Set(classifications.map((c: any) => c.speaker_id));

    // 2. Get speaker details (name, org_name) for politicians
    const speakers = await fetchAll('speakers', 'id, name, org_name');
    const politicianSpeakers = speakers.filter((s: any) => politicianIds.has(s.id));

    // 3. Map each politician to a party
    const speakerPartyMap = new Map<number, string>();
    for (const s of politicianSpeakers) {
      const party = mapOrgToParty(s.org_name || '');
      if (party) {
        speakerPartyMap.set(s.id, party);
      }
    }

    // 4. Get events for visible years
    const events = await fetchAll('events', 'id, year', q =>
      q.in('year', VISIBLE_YEARS)
    );
    const eventYearMap = new Map<number, number>();
    const visibleEventIds = new Set<number>();
    for (const e of events) {
      eventYearMap.set(e.id, e.year);
      visibleEventIds.add(e.id);
    }

    // 5. Get event_speakers (only for politicians with a mapped party)
    const eventSpeakers = await fetchAll('event_speakers', 'event_id, speaker_id', q =>
      q.neq('role', 'kontaktperson')
    );

    // 6. Get event_arrangers
    const eventArrangers = await fetchAll('event_arrangers', 'event_id, arranger_id');

    // 7. Get arranger info
    const arrangers = await fetchAll('arrangers', 'id, name');
    const arrangerMap = new Map<number, string>();
    for (const a of arrangers) arrangerMap.set(a.id, a.name);

    // 8. Get arranger classifications (sector)
    const arrangerClassifications = await fetchAll('arranger_classifications', 'arranger_id, sector');
    const arrangerSectorMap = new Map<number, string>();
    for (const ac of arrangerClassifications) arrangerSectorMap.set(ac.arranger_id, ac.sector);

    // Build: for each event, which politician-speakers (with party)?
    // event_id -> Set of speaker_ids (politicians with party)
    const eventPoliticians = new Map<number, Set<number>>();
    for (const es of eventSpeakers) {
      if (!visibleEventIds.has(es.event_id)) continue;
      if (!speakerPartyMap.has(es.speaker_id)) continue;
      if (!eventPoliticians.has(es.event_id)) eventPoliticians.set(es.event_id, new Set());
      eventPoliticians.get(es.event_id)!.add(es.speaker_id);
    }

    // Build: event_id -> arranger_ids
    const eventArrangerMap = new Map<number, number[]>();
    for (const ea of eventArrangers) {
      if (!visibleEventIds.has(ea.event_id)) continue;
      if (!eventArrangerMap.has(ea.event_id)) eventArrangerMap.set(ea.event_id, []);
      eventArrangerMap.get(ea.event_id)!.push(ea.arranger_id);
    }

    // For each arranger: collect unique politician-speakers and their parties
    const arrangerData = new Map<number, {
      politicianIds: Set<number>;
      partyBreakdown: Record<string, number>;
      eventCount: number;
    }>();

    for (const [eventId, politicianSet] of eventPoliticians) {
      const arrangerIds = eventArrangerMap.get(eventId);
      if (!arrangerIds) continue;

      for (const arrangerId of arrangerIds) {
        if (!arrangerData.has(arrangerId)) {
          arrangerData.set(arrangerId, {
            politicianIds: new Set(),
            partyBreakdown: {},
            eventCount: 0,
          });
        }
        const data = arrangerData.get(arrangerId)!;
        data.eventCount++;

        for (const spkId of politicianSet) {
          if (!data.politicianIds.has(spkId)) {
            data.politicianIds.add(spkId);
            const party = speakerPartyMap.get(spkId)!;
            data.partyBreakdown[party] = (data.partyBreakdown[party] || 0) + 1;
          }
        }
      }
    }

    // Calculate weighted average lrecon + galtan per arranger (min 3 unique politicians)
    const organizations: any[] = [];
    for (const [arrangerId, data] of arrangerData) {
      if (data.politicianIds.size < 3) continue;

      const name = arrangerMap.get(arrangerId);
      if (!name) continue;

      // Exclude parties themselves
      const sector = arrangerSectorMap.get(arrangerId) || null;
      if (sector === 'parti') continue;

      let totalLrecon = 0;
      let totalGaltan = 0;
      let totalWeight = 0;

      for (const [party, count] of Object.entries(data.partyBreakdown)) {
        const scores = CHES_SCORES[party];
        if (!scores) continue;
        totalLrecon += scores.lrecon * count;
        totalGaltan += scores.galtan * count;
        totalWeight += count;
      }

      if (totalWeight === 0) continue;

      organizations.push({
        id: arrangerId,
        name,
        sector,
        lrecon: Math.round((totalLrecon / totalWeight) * 100) / 100,
        galtan: Math.round((totalGaltan / totalWeight) * 100) / 100,
        politicians: data.politicianIds.size,
        events: data.eventCount,
        partyBreakdown: data.partyBreakdown,
      });
    }

    // Sort by politician count descending
    organizations.sort((a, b) => b.politicians - a.politicians);

    const parties = Object.entries(CHES_SCORES).map(([party, scores]) => ({
      party,
      lrecon: scores.lrecon,
      galtan: scores.galtan,
      label: scores.label,
    }));

    return NextResponse.json({
      organizations,
      parties,
      stats: {
        totalOrgs: organizations.length,
        totalPoliticians: speakerPartyMap.size,
      },
    });
  } catch (err: unknown) {
    console.error('GAL-TAN API error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Något gick fel. Försök igen senare.' }, { status: 500 });
  }
}
