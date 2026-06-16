import type { MapPoint } from '@/components/ScheduleMap';
import VertexMap from './VertexMap';

export type Seminar = {
  event_id: number; title: string; day: string | null; start: string | null; end: string | null;
  location: string | null; lat: number | null; lng: number | null; url: string | null;
  arrangers: string[]; n_speakers: number; theme: string; theme_label: string;
  layer: 'core' | 'watch'; tier: 'prioritera' | 'bevaka'; action: string; action_label: string;
  angle: string; competitor_arranged: boolean; reform_own: boolean;
};
export type Person = {
  name: string; title: string | null; org: string | null;
  category: 'politiker' | 'tjansteman' | 'patientledare' | 'konkurrent';
  n_relevant: number; n_core: number; events: string[];
};

const TZ = 'Europe/Stockholm';
const DAY_ORDER = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const fmtTime = (iso: string | null) => { if (!iso) return '–'; try { return new Date(iso).toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); } catch { return '–'; } };
const fmtDate = (iso: string | null) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ, day: 'numeric', month: 'long' }); } catch { return ''; } };
const dayIdx = (d: string | null) => { const i = DAY_ORDER.indexOf((d || '').toLowerCase()); return i < 0 ? 99 : i; };

const THEME_ORDER = ['särläkemedel', 'atmp', 'sällsynta', 'screening', 'access'];
const THEME_COLOR: Record<string, string> = {
  'särläkemedel': '#fb531a', 'atmp': '#8a1f8a', 'sällsynta': '#2f6fdb',
  'screening': '#2e9e5b', 'access': '#a6791f',
};
const CAT_META: Record<string, { label: string; sub: string; color: string }> = {
  politiker: { label: 'Politiker', sub: 'påverkansmål att träffa', color: '#fb531a' },
  tjansteman: { label: 'Tjänstemän & beslutsfattare', sub: 'TLV, NT-rådet och andra myndigheter att förstå och träffa', color: '#2f6fdb' },
  patientledare: { label: 'Patientledare', sub: 'allierade att träffa', color: '#2e9e5b' },
  konkurrent: { label: 'Konkurrenter', sub: 'spaning, inte möten. Bevaka var de positionerar sig', color: '#8a1f1f' },
};
const CAT_ORDER = ['politiker', 'tjansteman', 'patientledare', 'konkurrent'];

export default function VertexView({ seminars, people }: { seminars: Seminar[]; people: Person[] }) {
  const core = seminars.filter((s) => s.layer === 'core');
  const watch = seminars.filter((s) => s.layer === 'watch');
  const nCompetitor = seminars.filter((s) => s.competitor_arranged).length;
  const themes = Array.from(new Set(seminars.map((s) => s.theme)));

  const mapPoints: MapPoint[] = [];
  { let n = 0; for (const s of core) { if (typeof s.lat === 'number' && typeof s.lng === 'number') { mapPoints.push({ lat: s.lat, lng: s.lng, location: s.location || '', time: `${(s.day || '').slice(0, 3)} ${fmtTime(s.start)}`, title: s.title, n: n++ }); } } }

  const coreByDay = groupByDay(core);

  return (
    <div style={{ background: '#f7f5e4', minHeight: '100vh', color: '#111' }}>
      <header style={{ background: '#000', color: '#fff', borderBottom: '4px solid #fb531a', padding: '2.4rem 0' }}>
        <div style={wrap}>
          <div style={kicker}>Almedalsveckan 2026 · Kundunderlag · Reform Society</div>
          <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2.4rem, 6vw, 4.4rem)', margin: 0, lineHeight: 0.94 }}>Vertex i Almedalen</h1>
          <p style={{ opacity: 0.78, marginTop: 14, maxWidth: 720, lineHeight: 1.5 }}>
            En prioriteringskarta över veckans seminarier inom Vertex sakområden: särläkemedel, ATMP och genterapi, sällsynta diagnoser och screening, samt access- och systemfrågorna runtomkring. Var finns frågorna på agendan, vem äger dem, och var bör Vertex vara?
          </p>
          <div style={{ display: 'flex', gap: 30, marginTop: 24, flexWrap: 'wrap' }}>
            <Stat n={core.length} label="prioritera" />
            <Stat n={watch.length} label="bevaka" />
            <Stat n={themes.length} label="teman" />
            <Stat n={nCompetitor} label="konkurrent-arr." />
            <Stat n={people.length} label="nyckelpersoner" />
          </div>
        </div>
      </header>

      <main style={wrap}>
        {mapPoints.length > 0 && (
          <section style={{ padding: '2.2rem 0 0.5rem' }}>
            <h2 style={h2}>Prioriterade pass på kartan</h2>
            <p style={lead}>De nio prioriterade passen geografiskt i Visby. Klicka på en markör för titel och tid.</p>
            <VertexMap points={mapPoints} total={core.length} />
          </section>
        )}

        {/* PRIORITERA */}
        <section style={{ padding: '2.2rem 0 1rem' }}>
          <h2 style={h2}>Prioritera under veckan</h2>
          <p style={lead}>De {core.length} passen som ligger närmast Vertex sakområden. Rekommenderad åtgärd och vinkel per pass. Dag för dag.</p>
          {coreByDay.map(([day, list]) => (
            <div key={day} style={{ marginBottom: 18 }}>
              <div style={dayHead}>{day.toUpperCase()} {fmtDate(list[0]?.start).toUpperCase()}</div>
              {list.map((s) => <SeminarCard key={s.event_id} s={s} big />)}
            </div>
          ))}
        </section>

        {/* BEVAKA per tema */}
        <section style={{ padding: '1rem 0 1rem' }}>
          <h2 style={h2}>Bevaka — per tema</h2>
          <p style={lead}>Det bredare fältet kring access, system och precisionsmedicin, där Vertex frågor förhandlas, plus screening och sällsynt-angränsande pass.</p>
          {THEME_ORDER.filter((t) => watch.some((s) => s.theme === t)).map((t) => {
            const list = watch.filter((s) => s.theme === t).sort((a, b) => dayIdx(a.day) - dayIdx(b.day) || (a.start || '').localeCompare(b.start || ''));
            return (
              <div key={t} style={{ marginBottom: 16 }}>
                <div style={{ ...themeHead, borderColor: THEME_COLOR[t] || '#000' }}>
                  <span style={{ width: 11, height: 11, background: THEME_COLOR[t] || '#000', display: 'inline-block' }} />
                  {list[0]?.theme_label || t} <span style={{ color: '#999', fontWeight: 400 }}>· {list.length}</span>
                </div>
                {list.map((s) => <SeminarCard key={s.event_id} s={s} />)}
              </div>
            );
          })}
        </section>

        {/* NYCKELPERSONER */}
        <section style={{ padding: '1.4rem 0 2rem' }}>
          <h2 style={h2}>Nyckelpersoner i Vertex frågor</h2>
          <p style={lead}>
            {people.length} personer som återkommer i de relevanta passen, sorterade i fyra grupper med olika syfte. Det är ett urval, inte en fullständig lista. Granska gärna kategoriseringen.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 8 }}>
            {CAT_ORDER.filter((c) => people.some((p) => p.category === c)).map((c) => {
              const list = people.filter((p) => p.category === c);
              const meta = CAT_META[c];
              return (
                <div key={c} style={{ ...catCard, borderTop: `4px solid ${meta.color}` }}>
                  <div style={{ fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.15rem' }}>{meta.label} <span style={{ color: '#999' }}>· {list.length}</span></div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{meta.sub}</div>
                  {list.map((p) => (
                    <div key={p.name} style={personRow}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{p.name} {p.n_core > 0 && <span title="syns i prioriterade pass" style={{ color: '#fb531a' }}>★</span>}</div>
                      <div style={{ color: '#555', fontSize: '0.78rem' }}>{[p.title, p.org].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer style={{ background: '#000', color: '#999', padding: '2.2rem 0', fontFamily: 'var(--mono)', fontSize: '0.74rem', lineHeight: 1.6 }}>
        <div style={wrap}>
          Källa: Almedalsveckans officiella program 2026. Urval, vinklar och kategorisering: Reform Society för Vertex.
          Tiderna anges i svensk tid och kan ändras. ”Konkurrent arrangerar” = pass där ett konkurrerande läkemedelsföretag står som arrangör (spaning, inte mötesmål).
        </div>
      </footer>
    </div>
  );
}

function SeminarCard({ s, big }: { s: Seminar; big?: boolean }) {
  const color = THEME_COLOR[s.theme] || '#000';
  return (
    <div style={{ ...card, boxShadow: big ? '4px 4px 0 #000' : '2px 2px 0 #000', borderLeft: `5px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 700, fontSize: big ? '1.06rem' : '0.98rem', flex: 1, minWidth: 220 }}>{s.title}</div>
        <span style={{ ...actionTag, background: s.tier === 'prioritera' ? '#fb531a' : 'transparent', color: s.tier === 'prioritera' ? '#000' : '#444', border: s.tier === 'prioritera' ? 'none' : '1px solid #bbb' }}>{s.action_label}</span>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', marginTop: 5, color: '#333' }}>
        {(s.day || '').toUpperCase()} {fmtTime(s.start)}–{fmtTime(s.end)} · 📍 {s.location || 'plats okänd'}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 3 }}>Arr: {s.arrangers.slice(0, 2).join(', ')}{s.arrangers.length > 2 ? ' m.fl.' : ''}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 6px' }}>
        <span style={{ ...miniTag, background: color, color: '#fff' }}>{s.theme_label}</span>
        {s.competitor_arranged && <span style={{ ...miniTag, background: '#8a1f1f', color: '#fff' }}>Konkurrent arrangerar · spaning</span>}
        {s.reform_own && <span style={{ ...miniTag, background: '#000', color: '#fb531a' }}>Reform Society</span>}
        {s.n_speakers > 0 && <span style={{ ...miniTag, background: '#eee', color: '#444' }}>{s.n_speakers} talare</span>}
      </div>
      <div style={{ fontSize: '0.86rem', lineHeight: 1.45, color: '#222' }}>{s.angle}</div>
      {s.url && <a href={s.url} target="_blank" rel="noopener" style={progLink}>program ↗</a>}
    </div>
  );
}

function groupByDay(list: Seminar[]): [string, Seminar[]][] {
  const g: Record<string, Seminar[]> = {};
  for (const s of list) { const d = (s.day || 'okänd').toLowerCase(); (g[d] = g[d] || []).push(s); }
  for (const d in g) g[d].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  return Object.entries(g).sort((a, b) => dayIdx(a[0]) - dayIdx(b[0]));
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '1.9rem', fontFamily: 'var(--font-formula)', lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, marginTop: 3, fontFamily: 'var(--mono)' }}>{label}</div>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '0 1.6rem' };
const kicker: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.72rem', letterSpacing: '0.12em', color: '#fb531a', textTransform: 'uppercase', marginBottom: 10 };
const h2: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: 'clamp(1.4rem, 3.4vw, 2.1rem)', margin: '0 0 0.3rem' };
const lead: React.CSSProperties = { color: '#555', fontSize: '0.9rem', maxWidth: 720, margin: '0 0 1rem', lineHeight: 1.5 };
const dayHead: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.1rem', borderBottom: '2px solid #000', paddingBottom: 3, marginBottom: 10 };
const themeHead: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.05rem', borderBottom: '2px solid', paddingBottom: 3, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 8 };
const card: React.CSSProperties = { background: '#fff', border: '2px solid #000', padding: '0.95rem 1.1rem', marginBottom: 11 };
const actionTag: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.68rem', textTransform: 'uppercase', padding: '3px 9px', whiteSpace: 'nowrap', height: 'fit-content', fontWeight: 700 };
const miniTag: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.03em', padding: '2px 7px' };
const progLink: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.7rem', color: '#fb531a', textTransform: 'uppercase', display: 'inline-block', marginTop: 7 };
const catCard: React.CSSProperties = { background: '#fff', border: '2px solid #000', boxShadow: '3px 3px 0 #000', padding: '1rem 1.1rem' };
const personRow: React.CSSProperties = { padding: '6px 0', borderBottom: '1px solid #eee' };
