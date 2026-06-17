import fs from 'fs';
import path from 'path';
import EliLillyView from './EliLillyView';
import type { Seminar, Person } from './EliLillyView';

// Publik, AVGRÄNSAD kundvy för Eli Lilly (samma mönster som /vertex och /better-shelter).
// Datan är förbyggd och deterministisk: scripts/eli_lilly/build_eli_lilly.py →
// source/eli_lilly_seminars.json + source/eli_lilly_people.json. Ingen DB-access vid
// request. Sidan ligger utanför middleware-matchern → ej lösenordsgatad. noindex.
export const dynamic = 'force-static';
export const metadata = {
  title: 'Eli Lilly i Almedalen 2026',
  description: 'Prioriteringskarta över Almedalsveckans seminarier inom Eli Lillys sakområden: obesitas och Alzheimer.',
  robots: { index: false, follow: false },
};

function readJson<T>(rel: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), 'utf8')) as T; }
  catch { return fallback; }
}

type VenueIdx = { exact: Record<string, { lat: number; lng: number }>; base: Record<string, { lat: number; lng: number }> };
function loadVenues(): VenueIdx {
  const exact: Record<string, { lat: number; lng: number }> = {};
  const base: Record<string, { lat: number; lng: number }> = {};
  try {
    const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'venue-coordinates.json'), 'utf8'));
    for (const [k, v] of Object.entries<any>(d)) {
      base[k] = { lat: v.lat, lng: v.lng };
      for (const loc of v.locations || []) exact[loc] = { lat: v.lat, lng: v.lng };
    }
  } catch {}
  return { exact, base };
}
function coordsFor(loc: string | null, lat: number | null, lng: number | null, v: VenueIdx) {
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  if (!loc) return { lat: null, lng: null };
  if (v.exact[loc]) return v.exact[loc];
  const b = v.base[loc.split(',')[0].trim()];
  return b || { lat: null, lng: null };
}

export default function EliLillyPage() {
  const venues = loadVenues();
  const seminars = readJson<Seminar[]>('source/eli_lilly_seminars.json', []).map((s) => {
    const c = coordsFor(s.location, s.lat, s.lng, venues);
    return { ...s, lat: c.lat, lng: c.lng };
  });
  const people = readJson<Person[]>('source/eli_lilly_people.json', []);
  return <EliLillyView seminars={seminars} people={people} />;
}
