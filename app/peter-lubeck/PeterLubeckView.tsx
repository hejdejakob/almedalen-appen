import type { MapPoint } from '@/components/ScheduleMap';
import PeterLubeckMap from './PeterLubeckMap';

export type Seminar = {
  event_id: number; title: string; day: string | null; start: string | null; end: string | null;
  location: string | null; lat: number | null; lng: number | null; url: string | null;
  arrangers: string[]; n_speakers: number; theme: string; theme_label: string;
  layer: 'core' | 'watch' | 'target'; tier: string; action: string; action_label: string; angle: string;
};
export type Person = {
  name: string; title: string | null; org: string | null;
  category: string;
  note: string | null; n_core: number;
};

const TZ = 'Europe/Stockholm';
const DAY_ORDER = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const fmtTime = (iso: string | null) => { if (!iso) return '–'; try { return new Date(iso).toLocaleTimeString('sv-SE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); } catch { return '–'; } };
const fmtDate = (iso: string | null) => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ, day: 'numeric', month: 'long' }); } catch { return ''; } };
const dayIdx = (d: string | null) => { const i = DAY_ORDER.indexOf((d || '').toLowerCase()); return i < 0 ? 99 : i; };

const THEME_ORDER = ['strategi', 'regional', 'talang', 'konkurrenskraft', 'kultur'];
const THEME_COLOR: Record<string, string> = {
  'strategi': '#fb531a', 'regional': '#2f6fdb', 'talang': '#2e9e5b',
  'konkurrenskraft': '#8a1f8a', 'kultur': '#a6791f', 'politiker': '#000',
};
const CAT_META: Record<string, { label: string; sub: string; color: string }> = {
  kulturminister: { label: 'Kulturminister-kandidater', sub: 'C/S/MP + sittande — strategins kulturhem', color: '#fb531a' },
  naringsminister: { label: 'Näringsminister-kandidater', sub: 'C/S/MP + sittande — exportnäringsvinkeln', color: '#8a1f8a' },
  champions: { label: 'Extra intresserade', sub: 'dataspels-vänner tvärs partierna — dina naturliga allierade i riksdagen', color: '#2e9e5b' },
  allierade: { label: 'Allierade & ekosystem', sub: 'branschvänner att samordna budskapet med (kompisar med alla)', color: '#2f6fdb' },
  beslutsfattare: { label: 'Myndigheter', sub: 'näringsvägen in i staten — bearbeta', color: '#a6791f' },
};
const CAT_ORDER = ['kulturminister', 'naringsminister', 'champions', 'allierade', 'beslutsfattare'];

export default function PeterLubeckView({ seminars, people }: { seminars: Seminar[]; people: Person[] }) {
  const core = seminars.filter((s) => s.layer === 'core');
  const watch = seminars.filter((s) => s.layer === 'watch');
  const targets = seminars.filter((s) => s.layer === 'target');
  const themes = Array.from(new Set([...core, ...watch].map((s) => s.theme)));
  const nPol = people.filter((p) => ['kulturminister', 'naringsminister', 'champions'].includes(p.category)).length;
  const nAlly = people.filter((p) => p.category === 'allierade').length;

  // Kartan = SpelAlmedalen-navet (prioritera) + målpolitiker-nålar runt om i Visby.
  const mapItems = [...core, ...targets];
  const mapPoints: MapPoint[] = [];
  { let n = 0; for (const s of mapItems) { if (typeof s.lat === 'number' && typeof s.lng === 'number') { mapPoints.push({ lat: s.lat, lng: s.lng, location: s.location || '', time: `${(s.day || '').slice(0, 3)} ${fmtTime(s.start)}`, title: s.title, n: n++ }); } } }

  const coreByDay = groupByDay(core);

  return (
    <div style={{ background: '#f7f5e4', minHeight: '100vh', color: '#111' }}>
      <header style={{ background: '#000', color: '#fff', borderBottom: '4px solid #fb531a', padding: '2.4rem 0' }}>
        <div style={wrap}>
          <div style={kicker}>Almedalsveckan 2026 · Kundunderlag · Reform Society</div>
          <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2.4rem, 6vw, 4.4rem)', margin: 0, lineHeight: 0.94 }}>Peter Lübeck i Almedalen</h1>
          <p style={{ opacity: 0.78, marginTop: 14, maxWidth: 740, lineHeight: 1.5 }}>
            Ett underlag för ditt huvudsyfte: att driva frågan om en nationell strategi för dataspel och, i förlängningen, ett svenskt dataspelsinstitut. Var du bör vara under SpelAlmedalen, vilka politiker du behöver träffa, och vilka allierade som bär samma budskap.
          </p>
          <div style={{ display: 'flex', gap: 30, marginTop: 24, flexWrap: 'wrap' }}>
            <Stat n={core.length} label="prioritera" />
            <Stat n={watch.length} label="bevaka" />
            <Stat n={themes.length} label="teman" />
            <Stat n={nPol} label="politiker att påverka" />
            <Stat n={nAlly} label="allierade" />
          </div>
        </div>
      </header>

      <main style={wrap}>
        {/* LÄGET I FRÅGAN */}
        <section style={{ padding: '1.8rem 0 0.4rem' }}>
          <div style={{ background: '#000', color: '#fff', borderLeft: '5px solid #fb531a', padding: '1.1rem 1.3rem' }}>
            <div style={{ fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.15rem', marginBottom: 6 }}>Läget i frågan — juni 2026</div>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, opacity: 0.9 }}>
              Branschen är enig om en nationell strategi och ett dataspelsinstitut, men riksdagen har avslagit förslagen upprepat — senast i kulturutskottets betänkande KrU6 (beslut 1 april 2026). Regeringen (M/KD/L) hänvisar i stället till den befintliga strategin för kulturella och kreativa näringar. Frågan är därmed låst tills efter valet i september — vilket gör <strong style={{ color: '#fb531a' }}>Almedalen mitt i valrörelsen till exakt rätt fönster</strong> att tvinga fram besked. Region Skånes förstudie (okt 2024) föreslår dessutom institutet placerat i Skåne — din hemmaplan. Vassaste omframningen: sälj en 73-miljarders <em>exportnäring</em>, inte ”spel som kultur”.
            </p>
          </div>
        </section>

        {mapPoints.length > 0 && (
          <section style={{ padding: '1.6rem 0 0.5rem' }}>
            <h2 style={h2}>Din vecka på kartan</h2>
            <p style={lead}>SpelAlmedalen ligger samlat på <strong>Strandgatan 1b</strong> (ditt hemmaspår) — den stora markören. 🎯-markörerna visar var kultur- och näringsminister-kandidaterna syns i övriga Visby (Wiechel, Lind, Olovsson, Ådahl, Tsouplaki), så du kan planera att fånga dem.</p>
            <PeterLubeckMap points={mapPoints} total={mapItems.length} />
          </section>
        )}

        {/* PRIORITERA */}
        <section style={{ padding: '2rem 0 1rem' }}>
          <h2 style={h2}>Prioritera under veckan</h2>
          <p style={lead}>De {core.length} passen där du gör mest nytta för strategin och institutet. Rekommenderad åtgärd och din vinkel per pass. Dag för dag.</p>
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
          <p style={lead}>Det bredare SpelAlmedalen-fältet: konkurrenskraft, kultur, unga och demokrati. Bra att känna till och nätverka kring.</p>
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

        {/* PÅVERKANSUNDERLAG */}
        <section style={{ padding: '1.4rem 0 2rem' }}>
          <h2 style={h2}>Vilka du bör träffa</h2>
          <p style={lead}>
            Påverkansunderlag i tre grupper: politiker att övertyga, allierade att samordna budskapet med, och myndigheter att bearbeta. ★ = syns i ett av dina prioriterade pass.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 8 }}>
            {CAT_ORDER.filter((c) => people.some((p) => p.category === c)).map((c) => {
              const list = people.filter((p) => p.category === c);
              const meta = CAT_META[c];
              return (
                <div key={c} style={{ ...catCard, borderTop: `4px solid ${meta.color}` }}>
                  <div style={{ fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.15rem' }}>{meta.label} <span style={{ color: '#999' }}>· {list.length}</span></div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.66rem', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{meta.sub}</div>
                  {list.map((p) => (
                    <div key={p.name} style={personRow}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{p.name} {p.n_core > 0 && <span title="syns i prioriterat pass" style={{ color: '#fb531a' }}>★</span>}</div>
                      <div style={{ color: '#555', fontSize: '0.78rem' }}>{[p.title, p.org].filter(Boolean).join(' · ') || '—'}</div>
                      {p.note && <div style={{ color: '#333', fontSize: '0.78rem', marginTop: 3, lineHeight: 1.4 }}>{p.note}</div>}
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
          Källa: Almedalsveckans officiella program 2026 + Reform Societys research. Urval, vinklar och påverkansunderlag: Reform Society för Peter Lübeck / Game Habitat.
          Tiderna anges i svensk tid och kan ändras. Detta är ett arbetsunderlag — stäm av talarplatser och möten direkt med arrangörerna.
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
      {s.arrangers.length > 0 && <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 3 }}>Arr: {s.arrangers.slice(0, 2).join(', ')}{s.arrangers.length > 2 ? ' m.fl.' : ''}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 6px' }}>
        <span style={{ ...miniTag, background: color, color: '#fff' }}>{s.theme_label}</span>
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
const lead: React.CSSProperties = { color: '#555', fontSize: '0.9rem', maxWidth: 740, margin: '0 0 1rem', lineHeight: 1.5 };
const dayHead: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.1rem', borderBottom: '2px solid #000', paddingBottom: 3, marginBottom: 10 };
const themeHead: React.CSSProperties = { fontFamily: 'var(--font-formula)', textTransform: 'uppercase', fontSize: '1.05rem', borderBottom: '2px solid', paddingBottom: 3, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 8 };
const card: React.CSSProperties = { background: '#fff', border: '2px solid #000', padding: '0.95rem 1.1rem', marginBottom: 11 };
const actionTag: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.68rem', textTransform: 'uppercase', padding: '3px 9px', whiteSpace: 'nowrap', height: 'fit-content', fontWeight: 700 };
const miniTag: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.03em', padding: '2px 7px' };
const progLink: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: '0.7rem', color: '#fb531a', textTransform: 'uppercase', display: 'inline-block', marginTop: 7 };
const catCard: React.CSSProperties = { background: '#fff', border: '2px solid #000', boxShadow: '3px 3px 0 #000', padding: '1rem 1.1rem' };
const personRow: React.CSSProperties = { padding: '7px 0', borderBottom: '1px solid #eee' };
