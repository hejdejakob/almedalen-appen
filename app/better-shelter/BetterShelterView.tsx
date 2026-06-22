'use client';
import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { MapPoint } from '@/components/ScheduleMap';

const ScheduleMap = dynamic(() => import('@/components/ScheduleMap'), { ssr: false });

export type Session = {
  eventId: number; title: string; start: string | null; end: string | null; day: string | null;
  location: string | null; lat: number | null; lng: number | null; eventType: string | null;
  topic: string | null; url: string | null; arrangers: string[];
};
export type PersonSched = { name: string; found: boolean; title: string | null; org: string | null; sessions: Session[] };
export type Panel = {
  eventId: number; title: string; day: string | null; start: string | null; end: string | null;
  location: string | null; arrangers: string[]; speakerCount: number; url: string | null;
  niche: string; fit: number; room: string; tier: string; angle: string; pitch: string | null;
};

const TZ = 'Europe/Stockholm';
const DAY_ORDER = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const fmtTime = (iso: string | null) => { if (!iso) return '–'; try { return new Date(iso).toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); } catch { return '–'; } };
const fmtDate = (iso: string | null) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ, day: 'numeric', month: 'long' }); } catch { return ''; } };

export default function BetterShelterView({ people, panels = [] }: { people: PersonSched[]; panels?: Panel[] }) {
  const totalSessions = people.reduce((a, p) => a + p.sessions.length, 0);
  const withSchedule = people.filter((p) => p.sessions.length > 0).length;

  const mapPoints: MapPoint[] = useMemo(() => {
    const pts: MapPoint[] = [];
    let n = 0;
    for (const p of people) for (const s of p.sessions) {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        pts.push({ lat: s.lat, lng: s.lng, location: s.location || '', time: `${fmtTime(s.start)} · ${p.name.split(' ')[0]}`, title: s.title, n: n++ });
      }
    }
    return pts;
  }, [people]);

  return (
    <div style={{ background: '#f7f5e4', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: '#000', color: '#fff', borderBottom: '4px solid #fb531a', padding: '2rem 0' }}>
        <div style={wrap}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', letterSpacing: '0.12em', color: '#fb531a', textTransform: 'uppercase', marginBottom: 8 }}>Almedalsveckan 2026 · Urval</div>
          <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2.2rem, 6vw, 4rem)', margin: 0, lineHeight: 0.95 }}>Better Shelter i Almedalen</h1>
          <p style={{ opacity: 0.7, marginTop: 12, maxWidth: 640 }}>Var de utvalda medverkande är under veckan — dag för dag, med tid och plats. Tider i svensk tid.</p>
          <div style={{ display: 'flex', gap: 32, marginTop: 22, fontFamily: 'var(--mono)' }}>
            <div><div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-formula)' }}>{withSchedule}</div><div style={statLbl}>medverkande</div></div>
            <div><div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-formula)' }}>{totalSessions}</div><div style={statLbl}>pass totalt</div></div>
          </div>
        </div>
      </header>

      <main style={wrap}>
        {/* Karta */}
        {mapPoints.length > 0 && (
          <section style={{ padding: '2rem 0 1rem' }}>
            <h2 style={h2}>Karta</h2>
            <ScheduleMap points={mapPoints} height={420} />
          </section>
        )}

        {/* Per person */}
        <section style={{ padding: '1rem 0 3rem' }}>
          {people.map((p) => (
            <div key={p.name} style={personCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ ...h2, margin: 0 }}>{p.name}</h2>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: '#fb531a' }}>{p.sessions.length > 0 ? `${p.sessions.length} pass` : ''}</span>
              </div>
              {(p.title || p.org) && <div style={{ color: '#555', marginTop: 2, fontSize: '0.9rem' }}>{[p.title, p.org].filter(Boolean).join(' · ')}</div>}

              {!p.found ? (
                <div style={note}>Hittades inte i 2026-programmet (ingen registrerad medverkan).</div>
              ) : p.sessions.length === 0 ? (
                <div style={note}>Inga registrerade pass i Almedalen 2026.</div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  {groupByDay(p.sessions).map(([day, list]) => (
                    <div key={day} style={{ marginBottom: 14 }}>
                      <div style={dayHead}>{`${day.toUpperCase()} ${fmtDate(list[0]?.start).toUpperCase()}`}</div>
                      {list.map((s) => (
                        <div key={s.eventId} style={sessRow}>
                          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.85rem', minWidth: 96 }}>
                            {fmtTime(s.start)}<br /><span style={{ color: '#999', fontWeight: 400 }}>{fmtTime(s.end)}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{s.title}</div>
                            <div style={{ color: '#444', fontSize: '0.82rem', marginTop: 2 }}>📍 {s.location || 'plats okänd'}</div>
                            {s.arrangers.length > 0 && <div style={{ color: '#666', fontSize: '0.78rem', marginTop: 2 }}>Arr: {s.arrangers.slice(0, 2).join(', ')}{s.arrangers.length > 2 ? ' m.fl.' : ''}</div>}
                            {s.url && <a href={s.url} target="_blank" rel="noopener" style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: '#fb531a', textTransform: 'uppercase' }}>program ↗</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        {panels.length > 0 && (
          <section style={{ padding: '0 0 3rem' }}>
            <h2 style={h2}>Rekommenderade paneler för vd:n</h2>
            <p style={{ color: '#555', marginBottom: 18, fontSize: '0.9rem', maxWidth: 660 }}>Pass i 2026-programmet där Better Shelters vd skulle passa — humanitärt förankrade, med utrymme att kliva in. Rankade efter matchning.</p>
            <PanelList panels={panels.filter((p) => p.tier === 'topp')} label="Toppförslag" />
            <PanelList panels={panels.filter((p) => p.tier === 'bubblare')} label="Bubblare" />
          </section>
        )}
      </main>

      <footer style={{ background: '#000', color: '#999', padding: '2rem 0', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
        <div style={wrap}>Källa: Almedalsveckans officiella program. Urval och sammanställning: Reform Society. Tider i svensk tid och kan ändras.</div>
      </footer>
    </div>
  );
}

function groupByDay(sessions: Session[]): [string, Session[]][] {
  const g: Record<string, Session[]> = {};
  for (const s of sessions) { const d = s.day || 'okänd'; (g[d] = g[d] || []).push(s); }
  for (const d in g) g[d].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  return Object.entries(g).sort((a, b) => DAY_ORDER.indexOf(a[0]) - DAY_ORDER.indexOf(b[0]));
}

function PanelList({ panels, label }: { panels: Panel[]; label: string }) {
  if (!panels.length) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={panelLabel}>{label} · {panels.length}</div>
      {panels.map((p) => (
        <div key={p.eventId} style={panelCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 700, fontSize: '1.02rem', flex: 1, minWidth: 200 }}>{p.title}</div>
            <span style={nicheTag}>{p.niche} · fit {p.fit}/5</span>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', marginTop: 4 }}>
            {(p.day || '').toUpperCase()} {fmtTime(p.start)}–{fmtTime(p.end)} · {p.location || 'plats okänd'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#555', marginTop: 2 }}>
            Arrangör (att pitcha): {p.arrangers.slice(0, 2).join(', ') || '—'} · {p.speakerCount} talare nu · utrymme {p.room}
          </div>
          <div style={{ fontSize: '0.88rem', marginTop: 8 }}>{p.angle}</div>
          {p.pitch && <div style={panelPitch}>Pitch: {p.pitch}</div>}
          {p.url && <a href={p.url} target="_blank" rel="noopener" style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: '#fb531a', textTransform: 'uppercase', display: 'inline-block', marginTop: 6 }}>program ↗</a>}
        </div>
      ))}
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '0 2rem' };
const statLbl: React.CSSProperties = { fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', opacity: 0.6, marginTop: 4 };
const h2: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: 'clamp(1.3rem, 3vw, 1.9rem)', margin: '0 0 0.5rem' };
const personCard: React.CSSProperties = { background: '#fff', border: '2px solid #000', boxShadow: '4px 4px 0 #000', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' };
const note: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.82rem', color: '#777', marginTop: 12, padding: '0.6rem 0.8rem', background: '#f7f5e4', border: '1px solid #e0dcc8' };
const dayHead: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.05rem', borderBottom: '2px solid #000', paddingBottom: 3, marginBottom: 8 };
const sessRow: React.CSSProperties = { display: 'flex', gap: 14, padding: '0.7rem', marginBottom: 6, background: '#f7f5e4', border: '1px solid #e0dcc8' };
const panelLabel: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.1rem', marginBottom: 10, borderBottom: '2px solid #fb531a', paddingBottom: 3, display: 'inline-block' };
const panelCard: React.CSSProperties = { background: '#fff', border: '2px solid #000', boxShadow: '3px 3px 0 #000', padding: '1rem 1.2rem', marginBottom: 12 };
const nicheTag: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.68rem', textTransform: 'uppercase', background: '#fb531a', color: '#000', padding: '2px 8px', whiteSpace: 'nowrap', height: 'fit-content' };
const panelPitch: React.CSSProperties = { fontSize: '0.82rem', color: '#444', marginTop: 5, fontStyle: 'italic', borderLeft: '3px solid #fb531a', paddingLeft: 8 };
