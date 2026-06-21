import fs from 'fs';
import path from 'path';
import PeterLubeckView from './PeterLubeckView';
import type { Seminar, Person } from './PeterLubeckView';

// Publik, AVGRÄNSAD kundvy för Peter Lübeck / Game Habitat (mönster som /vertex, /eli-lilly).
// Förbyggd, deterministisk data: scripts/peter_lubeck/build_peter_lubeck.py.
// force-static, noindex, utanför middleware-matchern (ej lösenordsgatad).
export const dynamic = 'force-static';
export const metadata = {
  title: 'Peter Lübeck i Almedalen 2026',
  description: 'Underlag för att driva en nationell strategi för dataspel och ett svenskt dataspelsinstitut i Almedalen.',
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

export default function PeterLubeckPage() {
  const venues = loadVenues();
  const seminars = readJson<Seminar[]>('source/peter_lubeck_seminars.json', []).map((s) => {
    const c = coordsFor(s.location, s.lat, s.lng, venues);
    return { ...s, lat: c.lat, lng: c.lng };
  });
  const people = readJson<Person[]>('source/peter_lubeck_people.json', []);
  return <PeterLubeckView seminars={seminars} people={people} />;
}
