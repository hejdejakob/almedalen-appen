import fs from 'fs';
import path from 'path';
import VertexView from './VertexView';
import type { Seminar, Person } from './VertexView';

// Publik, AVGRÄNSAD kundvy för Vertex (som /better-shelter och /sakerhetsarenan).
// Datan är förbyggd och deterministisk: scripts/vertex/build_vertex.py →
// source/vertex_seminars.json + source/vertex_people.json. Ingen DB-access vid
// request. Sidan ligger utanför middleware-matchern → ej lösenordsgatad. noindex.
export const dynamic = 'force-static';
export const metadata = {
  title: 'Vertex i Almedalen 2026',
  description: 'Prioriteringskarta över Almedalsveckans seminarier inom Vertex sakområden.',
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

export default function VertexPage() {
  const venues = loadVenues();
  const seminars = readJson<Seminar[]>('source/vertex_seminars.json', []).map((s) => {
    const c = coordsFor(s.location, s.lat, s.lng, venues);
    return { ...s, lat: c.lat, lng: c.lng };
  });
  const people = readJson<Person[]>('source/vertex_people.json', []);
  return <VertexView seminars={seminars} people={people} />;
}
