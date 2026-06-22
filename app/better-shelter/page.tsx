import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import BetterShelterView from './BetterShelterView';
import type { PersonSched, Panel } from './BetterShelterView';

// Publik, AVGRÄNSAD vy för kunden Better Shelter. Visar ENDAST de hårdkodade
// personerna nedan — datan hämtas server-side (service-role-nyckeln lämnar
// aldrig servern), och det finns inget klient-API att enumerera mot. Sidan är
// inte gatad (ligger i PUBLIC_PATHS + utanför middleware-matchern).
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Better Shelter i Almedalen 2026',
  description: 'Schema för utvalda medverkande under Almedalsveckan 2026.',
  robots: { index: false },
};

const YEAR = 2026;

// id resolvat mot talardatan. Jesper Roos saknas i 2026-programmet (id: null).
const PEOPLE: { name: string; id: number | null }[] = [
  { name: 'Cecilia Chatterjee-Martinsen', id: 15099 },
  { name: 'Jesper Roos', id: null },
  { name: 'Jakob Wernerman', id: 16680 },
  { name: 'Thomas Frostberg', id: 2296 },
  { name: 'David Isaksson', id: 19046 },
  { name: 'Ulrika Modéer', id: 731 },
  { name: 'Birgitta Ohlsson', id: 19288 },
  { name: 'Matilda Ernkrans', id: 7313 },
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

async function getPerson(p: { name: string; id: number | null }, v: VenueIdx): Promise<PersonSched> {
  if (!p.id) return { name: p.name, found: false, title: null, org: null, sessions: [] };
  const { data: sp } = await db.from('speakers').select('id, name, title, org_name').eq('id', p.id).limit(1);
  const speaker = sp?.[0];
  const links = await inAll('event_speakers', 'event_id', 'speaker_id', [p.id]);
  const evIds = [...new Set(links.map((l) => l.event_id))] as number[];
  const base = { name: p.name, found: true, title: speaker?.title || null, org: speaker?.org_name || null };
  if (!evIds.length) return { ...base, sessions: [] };

  const events = (await inAll('events', EVENT_COLS, 'id', evIds)).filter((e) => e.year === YEAR);
  if (!events.length) return { ...base, sessions: [] };
  const ids2026 = events.map((e) => e.id);
  const eventArrangers = await inAll('event_arrangers', 'event_id, arranger_id, is_primary', 'event_id', ids2026);
  const arrIds = [...new Set(eventArrangers.map((a) => a.arranger_id))] as number[];
  const arrangers = arrIds.length ? await inAll('arrangers', 'id, name', 'id', arrIds) : [];
  const arrName = new Map(arrangers.map((a) => [a.id, a.name]));
  const arrByEvent = new Map<number, string[]>();
  for (const a of eventArrangers) {
    const list = arrByEvent.get(a.event_id) || [];
    const nm = arrName.get(a.arranger_id);
    if (nm) (a.is_primary ? list.unshift(nm) : list.push(nm));
    arrByEvent.set(a.event_id, list);
  }

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

// Kurerade panelrekommendationer (eventId + redaktionellt). Live event-detaljer
// hämtas så att tider/talarantal håller sig aktuella.
const PANELS_FILE = path.join(process.cwd(), 'source', 'bs_panels.json');
async function getPanels(): Promise<Panel[]> {
  let curated: any[] = [];
  try { curated = JSON.parse(fs.readFileSync(PANELS_FILE, 'utf8')); } catch { return []; }
  if (!curated.length) return [];
  const eventIds = curated.map((c) => c.eventId);
  const events = await inAll('events', EVENT_COLS, 'id', eventIds);
  const evById = new Map(events.map((e: any) => [e.id, e]));
  const eventArrangers = await inAll('event_arrangers', 'event_id, arranger_id, is_primary', 'event_id', eventIds);
  const arrIds = [...new Set(eventArrangers.map((a: any) => a.arranger_id))] as number[];
  const arrangers = arrIds.length ? await inAll('arrangers', 'id, name', 'id', arrIds) : [];
  const arrName = new Map(arrangers.map((a: any) => [a.id, a.name]));
  const arrByEvent = new Map<number, string[]>();
  for (const a of eventArrangers) { const l = arrByEvent.get(a.event_id) || []; const n = arrName.get(a.arranger_id); if (n) (a.is_primary ? l.unshift(n) : l.push(n)); arrByEvent.set(a.event_id, l); }
  const links = await inAll('event_speakers', 'event_id, speaker_id', 'event_id', eventIds);
  const cntByEvent = new Map<number, number>();
  for (const l of links) cntByEvent.set(l.event_id, (cntByEvent.get(l.event_id) || 0) + 1);

  const panels: Panel[] = curated.map((c) => {
    const e: any = evById.get(c.eventId) || {};
    return {
      eventId: c.eventId, title: e.title || c.title || '', day: e.day_of_week || null,
      start: e.start_time || null, end: e.end_time || null, location: e.location_name || null,
      arrangers: arrByEvent.get(c.eventId) || [], speakerCount: cntByEvent.get(c.eventId) || 0,
      url: e.url || null, niche: c.niche, fit: c.fit, room: c.room, tier: c.tier,
      angle: c.angle, pitch: c.pitch || null,
    };
  }).filter((p) => p.title);
  const rk: Record<string, number> = { hög: 3, medel: 2, låg: 1 };
  panels.sort((a, b) => (b.fit - a.fit) || ((rk[b.room] || 0) - (rk[a.room] || 0)));
  return panels;
}

export default async function BetterShelterPage() {
  const venues = loadVenues();
  const [people, panels] = await Promise.all([
    Promise.all(PEOPLE.map((p) => getPerson(p, venues))),
    getPanels(),
  ]);
  return <BetterShelterView people={people} panels={panels} />;
}
