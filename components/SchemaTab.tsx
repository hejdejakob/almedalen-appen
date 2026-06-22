'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MapPoint } from './ScheduleMap';

const ScheduleMap = dynamic(() => import('./ScheduleMap'), { ssr: false });

// ── Typer ──────────────────────────────────────────────────────────────────
type Match = { id: number; name: string; title: string | null; org: string | null; sessions2026: number };
type Session = {
  eventId: number; title: string; description: string | null;
  start: string | null; end: string | null; day: string | null; location: string | null;
  lat: number | null; lng: number | null; eventType: string | null; topic: string | null; url: string | null;
  arrangers: string[]; coSpeakers: { id: number; name: string }[];
};
type Schedule = { speaker: { id: number; name: string; title: string | null; org_name: string | null } | null; totalSessions: number; sessions: Session[] };
type BrowseEvent = Session & { speakers: { id: number; name: string }[]; speakerCount: number };

const DAY_ORDER = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const TZ = 'Europe/Stockholm';

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth < bp);
    c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c);
  }, [bp]);
  return m;
}

// ── Tid/datum i svensk tid (lagras som UTC i DB) ─────────────────────────────
const fmtTime = (iso: string | null) => {
  if (!iso) return '–';
  try { return new Date(iso).toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); } catch { return '–'; }
};
const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ, day: 'numeric', month: 'long' }); } catch { return ''; }
};
const dayHeader = (day: string | null, iso: string | null) =>
  `${(day || '').toUpperCase()}${iso ? ' ' + fmtDate(iso).toUpperCase() : ''}`;
// minuter sedan midnatt i svensk tid
const minsOfDay = (iso: string | null) => {
  if (!iso) return null;
  const hm = new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

// ── Färg per ämne (mjuk) ─────────────────────────────────────────────────────
const TOPIC_COLOR: Record<string, string> = {
  'Klimat/miljö': '#02bb4a', 'Säkerhet/försvar': '#264653', 'Vård/omsorg': '#e63946',
  'Skola/utbildning': '#1982c4', 'Ekonomi': '#9e8c58', 'Arbetsmarknad': '#457b9d',
  'Demokrati': '#6a4c93', 'Digitalisering': '#8671ff', 'Energi': '#f4a261',
};
const topicColor = (t: string | null) => (t && TOPIC_COLOR[t]) || '#aaa9ab';

// ── Komponent ────────────────────────────────────────────────────────────────
export default function SchemaTab() {
  const isMobile = useIsMobile();
  const [sub, setSub] = useState<'person' | 'browse'>('person');

  // venue-koordinater (för platser utan rå lat/lng)
  const venueIdx = useRef<{ exact: Record<string, { lat: number; lng: number }>; base: Record<string, { lat: number; lng: number }> }>({ exact: {}, base: {} });
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    fetch('/venue-coordinates.json', { signal: ctrl.signal }).then((r) => r.json()).then((d: Record<string, { lat: number; lng: number; locations: string[] }>) => {
      const exact: Record<string, { lat: number; lng: number }> = {};
      const base: Record<string, { lat: number; lng: number }> = {};
      for (const [k, v] of Object.entries(d)) {
        base[k] = { lat: v.lat, lng: v.lng };
        for (const loc of v.locations || []) exact[loc] = { lat: v.lat, lng: v.lng };
      }
      venueIdx.current = { exact, base };
    }).catch(() => {}).finally(() => clearTimeout(t));
  }, []);
  const resolveCoords = useCallback((s: Session): { lat: number; lng: number } | null => {
    if (typeof s.lat === 'number' && typeof s.lng === 'number') return { lat: s.lat, lng: s.lng };
    if (!s.location) return null;
    const ex = venueIdx.current.exact[s.location];
    if (ex) return ex;
    const baseKey = s.location.split(',')[0].trim();
    return venueIdx.current.base[baseKey] || null;
  }, []);

  // ── Personsök ──────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState<Schedule | null>(null);
  const [loadingSel, setLoadingSel] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<any>(null);

  const runSearch = useCallback(async (qy: string) => {
    if (abortRef.current) abortRef.current.abort();
    const c = new AbortController(); abortRef.current = c;
    if (qy.trim().length < 2) { setMatches([]); setSearching(false); return; }
    setSearching(true); setErr(null);
    try {
      const res = await fetch(`/api/schedule?q=${encodeURIComponent(qy.trim())}`, { signal: c.signal });
      if (!res.ok) throw new Error(`Sökningen misslyckades (${res.status}).`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMatches(data.matches || []);
    } catch (e: any) { if (e?.name !== 'AbortError') { setMatches([]); setErr(e?.message || 'Något gick fel.'); } }
    setSearching(false);
  }, []);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  const loadSchedule = useCallback(async (id: number): Promise<Schedule | null> => {
    const res = await fetch(`/api/schedule?id=${id}`);
    if (!res.ok) throw new Error(`Kunde inte ladda schemat (${res.status}).`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }, []);
  const selectPerson = async (id: number) => {
    setLoadingSel(true); setSel(null); setErr(null);
    try { setSel(await loadSchedule(id)); } catch (e: any) { setErr(e?.message || 'Något gick fel.'); } finally { setLoadingSel(false); }
  };

  // ── Bevakningslista ──────────────────────────────────────────────────────────
  const [watch, setWatch] = useState<{ id: number; name: string }[]>([]);
  const [watchData, setWatchData] = useState<Record<number, Schedule>>({});
  const [compare, setCompare] = useState(false);
  useEffect(() => {
    try { const w = JSON.parse(localStorage.getItem('schemaWatch') || '[]'); if (Array.isArray(w)) setWatch(w); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('schemaWatch', JSON.stringify(watch)); } catch {} }, [watch]);
  const isWatched = (id: number) => watch.some((w) => w.id === id);
  const toggleWatch = async (p: { id: number; name: string }) => {
    if (isWatched(p.id)) { setWatch((w) => w.filter((x) => x.id !== p.id)); return; }
    setWatch((w) => [...w, p]);
    if (!watchData[p.id]) { try { const s = await loadSchedule(p.id); if (s) setWatchData((d) => ({ ...d, [p.id]: s })); } catch {} }
  };
  useEffect(() => { // ladda saknade scheman för jämförelse
    if (!compare) return;
    watch.forEach(async (w) => { if (!watchData[w.id]) { try { const s = await loadSchedule(w.id); if (s) setWatchData((d) => ({ ...d, [w.id]: s })); } catch {} } });
  }, [compare, watch, watchData, loadSchedule]);

  // ── Bläddra (dag/tid/plats/ämne) ─────────────────────────────────────────────
  const [bf, setBf] = useState({ day: '', from: '', to: '', location: '', topic: '' });
  const [browseRes, setBrowseRes] = useState<BrowseEvent[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const runBrowse = async () => {
    setBrowsing(true); setBrowseRes(null);
    const p = new URLSearchParams({ browse: '1' });
    if (bf.day) p.set('day', bf.day);
    if (bf.from) p.set('from', bf.from);
    if (bf.to) p.set('to', bf.to);
    if (bf.location) p.set('location', bf.location);
    if (bf.topic) p.set('topic', bf.topic);
    try {
      const res = await fetch(`/api/schedule?${p}`);
      if (!res.ok) throw new Error(`Sökningen misslyckades (${res.status}).`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setBrowseRes(d.events || []);
    } catch (e: any) { setBrowseRes([]); setErr(e?.message || 'Något gick fel.'); }
    setBrowsing(false);
  };

  return (
    <div>
      {/* under-lägen (marginal/bredd ärvs från <main> i page.tsx) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {([['person', 'Sök person'], ['browse', 'Bläddra dag/plats/ämne']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)} style={chipStyle(sub === k)}>{label}</button>
        ))}
        {watch.length > 0 && (
          <button onClick={() => setCompare((c) => !c)} style={{ ...chipStyle(compare), marginLeft: 'auto' }}>
            ★ Bevakning ({watch.length}){compare ? ' ▴' : ' ▾'}
          </button>
        )}
      </div>

      {err && <div style={errBar}>⚠ {err}</div>}

      {/* Bevaknings-jämförelse */}
      {compare && watch.length > 0 && (
        <CompareView watch={watch} data={watchData} onRemove={(id) => toggleWatch(watch.find((w) => w.id === id)!)} isMobile={isMobile} />
      )}

      {/* PERSON-LÄGE */}
      {sub === 'person' && (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök person – t.ex. en minister eller talesperson…"
            style={inputStyle(isMobile)}
          />
          {!sel && (
            <div style={{ marginTop: '1rem' }}>
              {searching && <div style={hint}>Söker…</div>}
              {!searching && query.trim().length >= 2 && matches.length === 0 && <div style={hint}>Inga 2026-träffar på «{query}».</div>}
              <div style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {matches.map((m) => (
                  <div key={m.id} style={card} onClick={() => selectPerson(m.id)}
                    onMouseEnter={(e) => lift(e, true)} onMouseLeave={(e) => lift(e, false)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{m.name}</div>
                      <div style={sessBadge}>{m.sessions2026} pass</div>
                    </div>
                    <div style={{ color: '#555', fontSize: '0.85rem', marginTop: 2 }}>
                      {[m.title, m.org].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); toggleWatch({ id: m.id, name: m.name }); }}
                      style={watchBtn(isWatched(m.id))}>{isWatched(m.id) ? '★ Bevakas' : '☆ Följ'}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingSel && <div style={hint}>Laddar schema…</div>}
          {sel && !loadingSel && (
            <PersonSchedule
              sched={sel} isMobile={isMobile} resolveCoords={resolveCoords}
              onBack={() => setSel(null)}
              watched={sel.speaker ? isWatched(sel.speaker.id) : false}
              onToggleWatch={() => sel.speaker && toggleWatch({ id: sel.speaker.id, name: sel.speaker.name })}
              onOpenPerson={selectPerson}
            />
          )}
        </>
      )}

      {/* BLÄDDRA-LÄGE */}
      {sub === 'browse' && (
        <BrowseView bf={bf} setBf={setBf} run={runBrowse} browsing={browsing} res={browseRes} isMobile={isMobile} onOpenPerson={(id) => { setSub('person'); selectPerson(id); }} />
      )}
    </div>
  );
}

// ── En persons schema ────────────────────────────────────────────────────────
function PersonSchedule({ sched, isMobile, resolveCoords, onBack, onToggleWatch, watched, onOpenPerson }: {
  sched: Schedule; isMobile: boolean; resolveCoords: (s: Session) => { lat: number; lng: number } | null;
  onBack: () => void; onOpenProfile?: (id: number) => void; onToggleWatch: () => void; watched: boolean; onOpenPerson: (id: number) => void;
}) {
  const sessions = sched.sessions;
  const now = Date.now();
  const live = sessions.find((s) => s.start && s.end && new Date(s.start).getTime() <= now && now <= new Date(s.end).getTime());
  const next = sessions.filter((s) => s.start && new Date(s.start).getTime() > now).sort((a, b) => (a.start! < b.start! ? -1 : 1))[0];

  // gruppera per dag
  const byDay = useMemo(() => {
    const g: Record<string, Session[]> = {};
    for (const s of sessions) { const d = s.day || 'okänd'; (g[d] = g[d] || []).push(s); }
    for (const d in g) g[d].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    return Object.entries(g).sort((a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]));
  }, [sessions]);

  // krock-detektion per dag
  const overlapIds = useMemo(() => {
    const set = new Set<number>();
    for (const [, list] of byDay) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.start && a.end && b.start && new Date(b.start) < new Date(a.end) && new Date(b.start) >= new Date(a.start)) { set.add(a.eventId); set.add(b.eventId); }
      }
    }
    return set;
  }, [byDay]);

  const mapPoints: MapPoint[] = useMemo(() => sessions.map((s, i) => {
    const c = resolveCoords(s);
    return c ? { lat: c.lat, lng: c.lng, location: s.location || '', time: fmtTime(s.start), title: s.title, n: i } : null;
  }).filter(Boolean) as MapPoint[], [sessions, resolveCoords]);

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button onClick={onBack} style={backBtn}>← Tillbaka till sök</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginTop: '0.75rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.8rem,4vw,2.8rem)', margin: 0 }}>{sched.speaker?.name}</h2>
          <div style={{ color: '#555', marginTop: 2 }}>{[sched.speaker?.title, sched.speaker?.org_name].filter(Boolean).join(' · ') || '—'}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: '#000', marginTop: 6 }}>{sched.totalSessions} pass i Almedalen 2026</div>
        </div>
        <button onClick={onToggleWatch} style={watchBtn(watched)}>{watched ? '★ Bevakas' : '☆ Följ person'}</button>
      </div>

      {sessions.length === 0 ? (
        <div style={emptyState}>Inga registrerade pass i Almedalen 2026 för {sched.speaker?.name || 'personen'}. Hen kan ha medverkat tidigare år, eller saknas i 2026-programmet.</div>
      ) : (
      <>
      {/* live / härnäst */}
      <div style={statusBar}>
        {live ? (
          <span><b style={{ color: '#fb531a' }}>● PÅGÅR NU:</b> {fmtTime(live.start)}–{fmtTime(live.end)} · {live.location} · {live.title}</span>
        ) : next ? (
          <span><b>HÄRNÄST:</b> {(next.day || '').toUpperCase()} {fmtTime(next.start)} · {next.location} · {next.title}</span>
        ) : (
          <span>Inga kommande pass (veckan kan vara slut eller schemat saknar tider).</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: '1.5rem', marginTop: '1.25rem', alignItems: 'start' }}>
        {/* agenda */}
        <div>
          {byDay.map(([day, list]) => (
            <div key={day} style={{ marginBottom: '1.5rem' }}>
              <div style={dayHead}>{dayHeader(day, list[0]?.start)}</div>
              {list.map((s) => {
                const isLive = live?.eventId === s.eventId;
                const isNext = next?.eventId === s.eventId;
                return (
                  <div key={s.eventId} style={sessRow(isLive, isNext)}>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', minWidth: 92 }}>
                      {fmtTime(s.start)}<br /><span style={{ color: '#888', fontWeight: 400 }}>{fmtTime(s.end)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>{s.title}</div>
                      <div style={{ color: '#444', fontSize: '0.82rem', marginTop: 2 }}>📍 {s.location || 'plats okänd'}</div>
                      {s.arrangers.length > 0 && <div style={{ color: '#666', fontSize: '0.78rem', marginTop: 2 }}>Arr: {s.arrangers.slice(0, 2).join(', ')}{s.arrangers.length > 2 ? ' m.fl.' : ''}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.topic && <span style={{ ...topicChip, background: topicColor(s.topic) }}>{s.topic}</span>}
                        {overlapIds.has(s.eventId) && <span style={clashChip}>⚠ krock</span>}
                        {s.url && <a href={s.url} target="_blank" rel="noopener" style={progLink} onClick={(e) => e.stopPropagation()}>program ↗</a>}
                      </div>
                      {s.coSpeakers.length > 0 && (
                        <div style={{ fontSize: '0.76rem', color: '#777', marginTop: 5 }}>
                          Med: {s.coSpeakers.slice(0, 4).map((c, i) => (
                            <span key={c.id}>{i > 0 ? ', ' : ''}<span style={coLink} onClick={() => onOpenPerson(c.id)}>{c.name}</span></span>
                          ))}{s.coSpeakers.length > 4 ? ` +${s.coSpeakers.length - 4}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* karta */}
        <div style={{ position: isMobile ? 'static' : 'sticky', top: 16 }}>
          <div style={{ fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.2rem', marginBottom: 8 }}>Var hen är</div>
          {mapPoints.length > 0 ? <ScheduleMap points={mapPoints} height={isMobile ? 320 : 460} /> : <div style={hint}>Inga platser kunde placeras på kartan.</div>}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ── Jämförelse av bevakade personer ──────────────────────────────────────────
function CompareView({ watch, data, onRemove, isMobile }: { watch: { id: number; name: string }[]; data: Record<number, Schedule>; onRemove: (id: number) => void; isMobile: boolean }) {
  // gemensamma lediga fönster per dag (08:00–18:00) över alla bevakade med laddat schema
  const loaded = watch.filter((w) => data[w.id]);
  const freeByDay = useMemo(() => {
    const DAY_START = 8 * 60, DAY_END = 18 * 60;
    const out: { day: string; windows: string[] }[] = [];
    for (const day of DAY_ORDER) {
      const busies: [number, number][][] = [];
      let anyDay = false;
      for (const w of loaded) {
        const sess = data[w.id].sessions.filter((s) => s.day === day && s.start && s.end);
        if (sess.length) anyDay = true;
        busies.push(sess.map((s) => [minsOfDay(s.start)!, minsOfDay(s.end)!] as [number, number]));
      }
      if (!anyDay) continue;
      // ledigt = [DAY_START,DAY_END] minus union av allas pass
      const free: [number, number][] = [[DAY_START, DAY_END]];
      for (const personBusy of busies) for (const [bs, be] of personBusy) {
        for (let i = free.length - 1; i >= 0; i--) {
          const [fs, fe] = free[i];
          if (be <= fs || bs >= fe) continue;
          free.splice(i, 1);
          if (bs > fs) free.splice(i, 0, [fs, bs]);
          if (be < fe) free.splice(i, 0, [be, fe]);
        }
      }
      const windows = free.filter(([s, e]) => e - s >= 30).map(([s, e]) => `${pad(s)}–${pad(e)}`);
      if (windows.length) out.push({ day, windows });
    }
    return out;
  }, [loaded, data]);

  return (
    <div style={{ border: '2px solid #000', boxShadow: '4px 4px 0 #000', background: '#fff', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.3rem', marginBottom: 8 }}>Bevakning – jämför</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {watch.map((w) => (
          <span key={w.id} style={{ background: '#000', color: '#fff', padding: '4px 10px', fontSize: '0.85rem', display: 'inline-flex', gap: 6 }}>
            {w.name}{!data[w.id] ? ' …' : ''}<span style={{ cursor: 'pointer', color: '#fb531a', fontWeight: 700 }} onClick={() => onRemove(w.id)}>×</span>
          </span>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>
        <div style={{ marginBottom: 6, color: '#000' }}>Gemensamma lediga fönster (08–18, alla bevakade samtidigt lediga ≥30 min):</div>
        {freeByDay.length === 0 ? <div style={{ color: '#666' }}>Inga gemensamma fönster hittade (eller scheman laddas…).</div> :
          freeByDay.map((f) => (
            <div key={f.day} style={{ marginBottom: 4 }}>
              <b style={{ textTransform: 'uppercase' }}>{f.day}:</b> {f.windows.map((w) => <span key={w} style={freeChip}>{w}</span>)}
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Bläddra ──────────────────────────────────────────────────────────────────
function BrowseView({ bf, setBf, run, browsing, res, isMobile, onOpenPerson }: {
  bf: any; setBf: (f: any) => void; run: () => void; browsing: boolean; res: BrowseEvent[] | null; isMobile: boolean; onOpenPerson: (id: number) => void;
}) {
  const set = (k: string, v: string) => setBf({ ...bf, [k]: v });
  return (
    <div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', marginBottom: 14 }}>
        <select value={bf.day} onChange={(e) => set('day', e.target.value)} style={fieldStyle}>
          <option value="">Alla dagar</option>
          {DAY_ORDER.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input value={bf.from} onChange={(e) => set('from', e.target.value)} placeholder="från 13:00" style={fieldStyle} />
        <input value={bf.to} onChange={(e) => set('to', e.target.value)} placeholder="till 15:00" style={fieldStyle} />
        <input value={bf.location} onChange={(e) => set('location', e.target.value)} placeholder="plats t.ex. Hamnplan" style={fieldStyle} />
        <input value={bf.topic} onChange={(e) => set('topic', e.target.value)} placeholder="ämne t.ex. Klimat" style={fieldStyle} />
      </div>
      <button onClick={run} style={{ ...chipStyle(true), padding: '10px 22px' }}>Sök pass</button>
      <div style={{ marginTop: 16 }}>
        {browsing && <div style={hint}>Söker…</div>}
        {res && res.length === 0 && <div style={hint}>Inga pass matchade filtret.</div>}
        {res && res.map((e) => (
          <div key={e.eventId} style={{ ...sessRow(false, false), borderLeft: `4px solid ${topicColor(e.topic)}` }}>
            <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', minWidth: 110 }}>
              {(e.day || '').slice(0, 3).toUpperCase()} {fmtTime(e.start)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              <div style={{ color: '#444', fontSize: '0.82rem', marginTop: 2 }}>📍 {e.location}</div>
              <div style={{ fontSize: '0.78rem', color: '#666', marginTop: 4 }}>
                {e.speakers.slice(0, 8).map((s, i) => <span key={s.id}>{i > 0 ? ', ' : ''}<span style={coLink} onClick={() => onOpenPerson(s.id)}>{s.name}</span></span>)}
                {e.speakerCount > 8 ? ` +${e.speakerCount - 8}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── stil-helpers ─────────────────────────────────────────────────────────────
const pad = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function lift(e: any, on: boolean) { e.currentTarget.style.transform = on ? 'translate(-2px,-2px)' : 'none'; e.currentTarget.style.boxShadow = on ? '5px 5px 0 #000' : '3px 3px 0 #000'; }
const chipStyle = (active: boolean): React.CSSProperties => ({ border: '2px solid #000', background: active ? '#fb531a' : '#fff', color: '#000', fontFamily: 'var(--mono)', textTransform: 'uppercase', fontSize: '0.8rem', padding: '8px 14px', cursor: 'pointer', fontWeight: active ? 700 : 400 });
const inputStyle = (m: boolean): React.CSSProperties => ({ width: '100%', padding: m ? '0.75rem 1rem' : '1rem 1.5rem', fontSize: m ? '1rem' : '1.3rem', border: '3px solid #000', background: '#fff', boxShadow: '4px 4px 0 #000', fontFamily: 'var(--body-text)' });
const fieldStyle: React.CSSProperties = { padding: '0.6rem 0.8rem', border: '2px solid #000', background: '#fff', fontFamily: 'var(--body-text)', fontSize: '0.9rem' };
const card: React.CSSProperties = { background: '#fff', padding: '1rem 1.1rem', border: '2px solid #000', boxShadow: '3px 3px 0 #000', cursor: 'pointer', transition: 'transform .1s, box-shadow .1s' };
const sessBadge: React.CSSProperties = { background: '#fb531a', color: '#000', fontFamily: 'var(--mono)', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', whiteSpace: 'nowrap', height: 'fit-content' };
const watchBtn = (on: boolean): React.CSSProperties => ({ marginTop: 10, border: '2px solid #000', background: on ? '#000' : '#fff', color: on ? '#fff' : '#000', fontFamily: 'var(--mono)', fontSize: '0.75rem', textTransform: 'uppercase', padding: '5px 12px', cursor: 'pointer' });
const hint: React.CSSProperties = { color: '#666', fontFamily: 'var(--mono)', fontSize: '0.85rem', padding: '0.75rem 0' };
const backBtn: React.CSSProperties = { border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '0.8rem', color: '#000', textTransform: 'uppercase', padding: 0 };
const statusBar: React.CSSProperties = { marginTop: 14, background: '#000', color: '#fff', padding: '0.7rem 1rem', fontFamily: 'var(--mono)', fontSize: '0.85rem' };
const dayHead: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.25rem', borderBottom: '2px solid #000', paddingBottom: 4, marginBottom: 10 };
const sessRow = (live: boolean, next: boolean): React.CSSProperties => ({ display: 'flex', gap: 14, padding: '0.85rem', marginBottom: 8, background: live ? '#fff0eb' : next ? '#fffaf2' : '#fff', border: '2px solid #000', borderLeft: live ? '6px solid #fb531a' : '2px solid #000' });
const topicChip: React.CSSProperties = { color: '#000', fontFamily: 'var(--mono)', fontSize: '0.68rem', padding: '1px 7px', textTransform: 'uppercase' };
const clashChip: React.CSSProperties = { background: '#000', color: '#fb531a', fontFamily: 'var(--mono)', fontSize: '0.68rem', padding: '1px 7px', textTransform: 'uppercase', fontWeight: 700 };
const freeChip: React.CSSProperties = { display: 'inline-block', background: '#d3efc8', color: '#033a23', padding: '1px 8px', margin: '0 4px 4px 0', fontSize: '0.8rem' };
const progLink: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.72rem', color: '#fb531a', textTransform: 'uppercase' };
const coLink: React.CSSProperties = { color: '#1982c4', cursor: 'pointer', textDecoration: 'underline' };
const errBar: React.CSSProperties = { background: '#610000', color: '#fff', padding: '0.7rem 1rem', fontFamily: 'var(--mono)', fontSize: '0.85rem', marginBottom: '1rem' };
const emptyState: React.CSSProperties = { background: '#fff', border: '2px solid #000', boxShadow: '4px 4px 0 #000', padding: '1.5rem', marginTop: '1rem', fontFamily: 'var(--mono)', fontSize: '0.9rem', color: '#333' };
