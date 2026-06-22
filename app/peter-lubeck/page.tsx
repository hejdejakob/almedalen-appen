import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import PeterLubeckView from './PeterLubeckView';
import type { PersonSched, Panel } from './PeterLubeckView';

// Publik, AVGRÄNSAD kundvy för Peter Lübeck / Game Habitat (samma mönster som
// /better-shelter): namngivna målpersoner + deras veckoschema + kuraterade pass.
// Datan hämtas server-side (service-role-nyckeln lämnar aldrig servern). Sidan
// ligger utanför middleware-matchern → ej lösenordsgatad. noindex.
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Peter Lübeck i Almedalen 2026',
  description: 'Beslutsfattare att träffa och rekommenderade pass för att driva en nationell strategi för dataspel och ett dataspelsinstitut.',
  robots: { index: false, follow: false },
};

const YEAR = 2026;

// Målpersoner: kultur-/näringsministerkandidater + de mest dataspels-engagerade
// ledamöterna tvärs partierna. id resolvat mot talardatan (null = ej i 2026-programmet).
const PEOPLE: { name: string; id: number | null; role: string }[] = [
  { name: 'Mats Berglund', id: 4908, role: 'MP · ordförande kulturutskottet — drev kunskapsöversikten om dataspel' },
  { name: 'Rickard Nordin', id: 5822, role: 'C · 1:e vice partiledare — motionär för dataspelsinstitut, e-sportprofil' },
  { name: 'Björn Wiechel', id: 1420, role: 'S · kulturpolitisk talesperson — kulturministerkandidat' },
  { name: 'Amanda Lind', id: 1903, role: 'MP · språkrör, fd kulturminister — motionär nationell strategi' },
  { name: 'Alice Bah Kuhnke', id: 17889, role: 'MP · fd kulturminister — tung kulturröst' },
  { name: 'Lawen Redar', id: 10203, role: 'S · fd kulturpolitisk talesperson — drev S:s spelmotion' },
  { name: 'Vasiliki Tsouplaki', id: 1652, role: 'V · kulturpolitisk talesperson — medinitiativtagare statlig utredning' },
  { name: 'Anne-Li Sjölund', id: 2817, role: 'C · motionär för nationell spelstrategi' },
  { name: 'Catarina Deremar', id: 1397, role: 'C · kulturpolitisk talesperson' },
  { name: 'Fredrik Olovsson', id: 5872, role: 'S · närings- och energipolitisk talesperson — näringsministerkandidat' },
  { name: 'Anders Ådahl', id: 6004, role: 'C · näringspolitisk talesperson' },
  { name: 'Per Strömbäck', id: 2539, role: 'Dataspelsbranschen · talesperson (allierad, nationell branschröst)' },
  { name: 'Parisa Liljestrand', id: null, role: 'M · kulturminister (sittande) — avgör regeringens linje' },
  { name: 'Peter Ollén', id: null, role: 'M · ledamot kulturutskottet — regeringssidans spel-vän' },
];

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EVENT_COLS = 'id, title, start_time, end_time, day_of_week, location_name, lat, lng, event_type, topic_pdf_original, url, year';

type VenueIdx = { exact: Record<string, { lat: number; lng: number }>; base: Record<string, { lat: number; lng: number }> };
function loadVenues(): VenueIdx {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'venue-coordinates.json'), 'utf8'));
    const exact: Record<string, { lat: number; lng: number }> = {};
    const base: Record<string, { lat: number; lng: number }> = {};
    for (const [k, v] of Object.entries<any>(d)) {
      base[k] = { lat: v.lat, lng: v.lng };
      for (const loc of v.locations || []) exact[loc] = { lat: v.lat, lng: v.lng };
    }
    return { exact, base };
  } catch { return { exact: {}, base: {} }; }
}
function coordsFor(loc: string | null, lat: any, lng: any, v: VenueIdx): { lat: number; lng: number } | null {
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  if (!loc) return null;
  if (v.exact[loc]) return v.exact[loc];
  return v.base[loc.split(',')[0].trim()] || null;
}

const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function inAll(table: string, sel: string, col: string, vals: number[]) {
  const out: any[] = [];
  for (const c of chunk(vals, 80)) {
    const { data, error } = await db.from(table).select(sel).in(col, c).limit(100000);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
  }
  return out;
}

function arrByEventMap(eventArrangers: any[], arrName: Map<number, string>) {
  const m = new Map<number, string[]>();
  for (const a of eventArrangers) {
    const list = m.get(a.event_id) || [];
    const nm = arrName.get(a.arranger_id);
    if (nm) (a.is_primary ? list.unshift(nm) : list.push(nm));
    m.set(a.event_id, list);
  }
  return m;
}

async function getPerson(p: { name: string; id: number | null; role: string }, v: VenueIdx): Promise<PersonSched> {
  if (!p.id) return { name: p.name, role: p.role, found: false, title: null, org: null, sessions: [] };
  const { data: sp } = await db.from('speakers').select('id, name, title, org_name').eq('id', p.id).limit(1);
  const speaker = sp?.[0];
  const links = await inAll('event_speakers', 'event_id', 'speaker_id', [p.id]);
  const evIds = [...new Set(links.map((l) => l.event_id))] as number[];
  const base = { name: p.name, role: p.role, found: true, title: speaker?.title || null, org: speaker?.org_name || null };
  if (!evIds.length) return { ...base, sessions: [] };

  const events = (await inAll('events', EVENT_COLS, 'id', evIds)).filter((e) => e.year === YEAR);
  if (!events.length) return { ...base, sessions: [] };
  const ids2026 = events.map((e) => e.id);
  const eventArrangers = await inAll('event_arrangers', 'event_id, arranger_id, is_primary', 'event_id', ids2026);
  const arrIds = [...new Set(eventArrangers.map((a) => a.arranger_id))] as number[];
  const arrangers = arrIds.length ? await inAll('arrangers', 'id, name', 'id', arrIds) : [];
  const arrByEvent = arrByEventMap(eventArrangers, new Map(arrangers.map((a) => [a.id, a.name])));

  const sessions = events.map((e) => {
    const c = coordsFor(e.location_name, e.lat, e.lng, v);
    return {
      eventId: e.id, title: e.title, start: e.start_time, end: e.end_time, day: e.day_of_week,
      location: e.location_name, lat: c?.lat ?? null, lng: c?.lng ?? null,
      eventType: e.event_type, topic: e.topic_pdf_original || null, url: e.url,
      arrangers: arrByEvent.get(e.id) || [],
    };
  }).sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  return { ...base, sessions };
}

// Kuraterade pass-rekommendationer (eventId + redaktionellt). Live event-detaljer
// hämtas så att tider/talarantal håller sig aktuella.
const PANELS_FILE = path.join(process.cwd(), 'source', 'pl_panels.json');
async function getPanels(v: VenueIdx): Promise<Panel[]> {
  let curated: any[] = [];
  try { curated = JSON.parse(fs.readFileSync(PANELS_FILE, 'utf8')); } catch { return []; }
  if (!curated.length) return [];
  const eventIds = curated.map((c) => c.eventId);
  const events = await inAll('events', EVENT_COLS, 'id', eventIds);
  const evById = new Map(events.map((e: any) => [e.id, e]));
  const eventArrangers = await inAll('event_arrangers', 'event_id, arranger_id, is_primary', 'event_id', eventIds);
  const arrIds = [...new Set(eventArrangers.map((a: any) => a.arranger_id))] as number[];
  const arrangers = arrIds.length ? await inAll('arrangers', 'id, name', 'id', arrIds) : [];
  const arrByEvent = arrByEventMap(eventArrangers, new Map(arrangers.map((a: any) => [a.id, a.name])));
  const links = await inAll('event_speakers', 'event_id, speaker_id', 'event_id', eventIds);
  const cntByEvent = new Map<number, number>();
  for (const l of links) cntByEvent.set(l.event_id, (cntByEvent.get(l.event_id) || 0) + 1);

  const panels: Panel[] = curated.map((c) => {
    const e: any = evById.get(c.eventId) || {};
    return {
      eventId: c.eventId, title: e.title || c.title || '', day: e.day_of_week || null,
      start: e.start_time || null, end: e.end_time || null, location: e.location_name || null,
      arrangers: arrByEvent.get(c.eventId) || [], speakerCount: cntByEvent.get(c.eventId) || 0,
      url: e.url || null, niche: c.niche, fit: c.fit, tier: c.tier, angle: c.angle,
    };
  }).filter((p) => p.title);
  panels.sort((a, b) => (b.fit - a.fit));
  return panels;
}

export default async function PeterLubeckPage() {
  const venues = loadVenues();
  const [people, panels] = await Promise.all([
    Promise.all(PEOPLE.map((p) => getPerson(p, venues))),
    getPanels(venues),
  ]);
  return <PeterLubeckView people={people} panels={panels} />;
}
