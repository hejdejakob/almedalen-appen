import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimitApi } from '@/lib/rate-limit';

// Schema-API för "Följ en person genom Almedalen 2026".
// Tre lägen:
//   ?q=<namn>            → sök personer (matchningar med antal 2026-pass)
//   ?id=<speaker_id>     → en persons fulla 2026-schema (pass + plats + arrangör + medverkande)
//   ?browse=1&...filter  → vänd på det: events som matchar dag/tid/plats/ämne + vilka som är där

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const YEAR = 2026;

async function fetchAll(table: string, columns: string, filter?: (q: any) => any) {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

const EVENT_COLS =
  'id, title, description, start_time, end_time, day_of_week, location_name, lat, lng, event_type, topic_pdf_original, secondary_topic, url';

type Sess = {
  eventId: number;
  title: string;
  description: string | null;
  start: string | null;
  end: string | null;
  day: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  eventType: string | null;
  topic: string | null;
  url: string | null;
  arrangers: string[];
  coSpeakers: { id: number; name: string }[];
};

function shapeEvent(e: any, arrangers: string[] = [], coSpeakers: { id: number; name: string }[] = []): Sess {
  return {
    eventId: e.id,
    title: e.title,
    description: e.description || null,
    start: e.start_time,
    end: e.end_time,
    day: e.day_of_week,
    location: e.location_name,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    eventType: e.event_type,
    topic: e.topic_pdf_original || e.secondary_topic || null,
    url: e.url,
    arrangers,
    coSpeakers,
  };
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
  const q = searchParams.get('q');
  const browse = searchParams.get('browse');

  try {
    if (id) {
      return NextResponse.json(await getSchedule(parseInt(id, 10)));
    } else if (browse) {
      return NextResponse.json(await browseEvents(searchParams));
    } else if (q !== null) {
      return NextResponse.json(await searchPeople(q));
    }
    return NextResponse.json({ error: 'Ange ?q=, ?id= eller ?browse=1' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Schedule API error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Något gick fel. Försök igen senare.' }, { status: 500 });
  }
}

// ── Sök personer (namn) med antal 2026-pass ───────────────────────────────
async function searchPeople(query: string) {
  const term = query.trim();
  if (term.length < 2) return { matches: [] };

  const { data: speakers, error } = await supabase
    .from('speakers')
    .select('id, name, title, org_name')
    .ilike('name', `%${term.slice(0, 120)}%`)
    .limit(25);
  if (error) throw new Error(error.message);
  if (!speakers || speakers.length === 0) return { matches: [] };

  const ids = speakers.map((s: any) => s.id);
  const links = await fetchAll('event_speakers', 'speaker_id, event_id', (qb) => qb.in('speaker_id', ids));
  if (links.length === 0) return { matches: [] };

  // begränsa till 2026-events
  const eventIds = [...new Set(links.map((l: any) => l.event_id))];
  const ev2026 = await fetchAll('events', 'id', (qb) => qb.in('id', eventIds).eq('year', YEAR));
  const ev2026Set = new Set(ev2026.map((e: any) => e.id));

  const countByName: Record<number, number> = {};
  for (const l of links) {
    if (ev2026Set.has(l.event_id)) countByName[l.speaker_id] = (countByName[l.speaker_id] || 0) + 1;
  }

  const matches = speakers
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      title: s.title || null,
      org: s.org_name || null,
      sessions2026: countByName[s.id] || 0,
    }))
    .filter((s: any) => s.sessions2026 > 0)
    .sort((a: any, b: any) => b.sessions2026 - a.sessions2026)
    .slice(0, 25);

  return { matches };
}

// ── En persons fulla 2026-schema ──────────────────────────────────────────
async function getSchedule(speakerId: number) {
  const { data: speakerRows } = await supabase
    .from('speakers')
    .select('id, name, title, org_name')
    .eq('id', speakerId)
    .limit(1);
  const speaker = speakerRows?.[0] || null;

  const myLinks = await fetchAll('event_speakers', 'event_id', (qb) => qb.eq('speaker_id', speakerId));
  const myEventIds = [...new Set(myLinks.map((l: any) => l.event_id))];
  if (myEventIds.length === 0) return { speaker, sessions: [] };

  const events = await fetchAll('events', EVENT_COLS, (qb) => qb.in('id', myEventIds).eq('year', YEAR));
  if (events.length === 0) return { speaker, sessions: [] };
  const evIds = events.map((e: any) => e.id);

  // arrangörer + medverkande för identitetskontext
  const [eventArrangers, allLinks] = await Promise.all([
    fetchAll('event_arrangers', 'event_id, arranger_id, is_primary', (qb) => qb.in('event_id', evIds)),
    fetchAll('event_speakers', 'event_id, speaker_id', (qb) => qb.in('event_id', evIds)),
  ]);
  const arrIds = [...new Set(eventArrangers.map((a: any) => a.arranger_id))];
  const coIds = [...new Set(allLinks.map((l: any) => l.speaker_id))].filter((x) => x !== speakerId);
  const [arrangers, coSpeakers] = await Promise.all([
    arrIds.length ? fetchAll('arrangers', 'id, name', (qb) => qb.in('id', arrIds)) : Promise.resolve([]),
    coIds.length ? fetchAll('speakers', 'id, name', (qb) => qb.in('id', coIds)) : Promise.resolve([]),
  ]);
  const arrName = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const coName = new Map(coSpeakers.map((s: any) => [s.id, s.name]));

  const arrByEvent = new Map<number, string[]>();
  for (const a of eventArrangers) {
    const list = arrByEvent.get(a.event_id) || [];
    const nm = arrName.get(a.arranger_id);
    if (nm) (a.is_primary ? list.unshift(nm) : list.push(nm));
    arrByEvent.set(a.event_id, list);
  }
  const coByEvent = new Map<number, { id: number; name: string }[]>();
  for (const l of allLinks) {
    if (l.speaker_id === speakerId) continue;
    const list = coByEvent.get(l.event_id) || [];
    const nm = coName.get(l.speaker_id);
    if (nm) list.push({ id: l.speaker_id, name: nm });
    coByEvent.set(l.event_id, list);
  }

  const sessions = events
    .map((e: any) => shapeEvent(e, arrByEvent.get(e.id) || [], (coByEvent.get(e.id) || []).slice(0, 10)))
    .sort((a: Sess, b: Sess) => (a.start || '').localeCompare(b.start || ''));

  return { speaker, totalSessions: sessions.length, sessions };
}

// ── Vänd på det: events som matchar filter + vilka som är där ──────────────
async function browseEvents(p: URLSearchParams) {
  const day = p.get('day');          // "onsdag"
  const fromT = p.get('from');       // "13:00"
  const toT = p.get('to');           // "15:00"
  const loc = p.get('location');     // delsträng
  const topic = p.get('topic');      // topic_pdf_original delsträng
  const type = p.get('event_type');
  const limit = Math.min(parseInt(p.get('limit') || '60', 10), 150);

  // undvik att hämta hela programmet utan filter
  if (!day && !fromT && !toT && !loc && !topic && !type) {
    return { count: 0, events: [], hint: 'Lägg till minst ett filter (dag, tid, plats eller ämne).' };
  }

  let events = await fetchAll('events', EVENT_COLS, (qb) => {
    let x = qb.eq('year', YEAR);
    if (day) x = x.eq('day_of_week', day);
    if (loc) x = x.ilike('location_name', `%${loc.slice(0, 80)}%`);
    if (topic) x = x.ilike('topic_pdf_original', `%${topic.slice(0, 80)}%`);
    if (type) x = x.eq('event_type', type);
    return x;
  });

  // tidsfilter på klockslag i SVENSK tid (events lagras i UTC; 13:00 UTC = 15:00 lokalt)
  const hm = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }) : '';
  if (fromT) events = events.filter((e: any) => hm(e.start_time) >= fromT);
  if (toT) events = events.filter((e: any) => hm(e.start_time) <= toT);

  events.sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));
  events = events.slice(0, limit);
  const evIds = events.map((e: any) => e.id);

  const links = evIds.length ? await fetchAll('event_speakers', 'event_id, speaker_id', (qb) => qb.in('event_id', evIds)) : [];
  const spIds = [...new Set(links.map((l: any) => l.speaker_id))];
  const speakers = spIds.length ? await fetchAll('speakers', 'id, name', (qb) => qb.in('id', spIds)) : [];
  const spName = new Map(speakers.map((s: any) => [s.id, s.name]));
  const byEvent = new Map<number, { id: number; name: string }[]>();
  for (const l of links) {
    const list = byEvent.get(l.event_id) || [];
    const nm = spName.get(l.speaker_id);
    if (nm) list.push({ id: l.speaker_id, name: nm });
    byEvent.set(l.event_id, list);
  }

  const results = events.map((e: any) => ({
    ...shapeEvent(e),
    speakers: (byEvent.get(e.id) || []).slice(0, 12),
    speakerCount: (byEvent.get(e.id) || []).length,
  }));
  return { count: results.length, events: results };
}
