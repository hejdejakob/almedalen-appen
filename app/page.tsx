'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BubbleController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Bubble } from 'react-chartjs-2';
import dynamic from 'next/dynamic';
import Footer from '@/components/Footer';

const SankeyChart = dynamic(() => import('@/components/SankeyChart'), { ssr: false });
const NetworkGraph = dynamic(() => import('@/components/NetworkGraph'), { ssr: false });
const VisbyMap = dynamic(() => import('@/components/VisbyMap'), { ssr: false });
const ArenaNetwork = dynamic(() => import('@/components/ArenaNetwork'), { ssr: false });

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, BubbleController, Title, Tooltip, Legend, Filler
);

// Register zoom plugin on client only
if (typeof window !== 'undefined') {
  import('chartjs-plugin-zoom').then((mod) => {
    ChartJS.register(mod.default);
  });
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

const SECTOR_COLORS: Record<string, string> = {
  näringsliv: '#e63946',
  konsult_pr: '#457b9d',
  arbetsgivar_branschorg: '#2a9d8f',
  fackförbund: '#e9c46a',
  civilsamhälle: '#f4a261',
  tänketank_stiftelse: '#264653',
  offentlig_sektor: '#6a4c93',
  parti: '#1982c4',
  media: '#ff595e',
  akademi: '#8ac926',
};

function trendColor(pct: number): string {
  if (pct >= 50) return '#1a7a3a';
  if (pct >= 10) return '#2a9d8f';
  if (pct <= -10) return '#e63946';
  return '#c9a227';
}

function trendBg(pct: number): string {
  if (pct >= 50) return 'rgba(26, 122, 58, 0.12)';
  if (pct >= 10) return 'rgba(42, 157, 143, 0.1)';
  if (pct <= -10) return 'rgba(230, 57, 70, 0.1)';
  return 'rgba(201, 162, 39, 0.1)';
}

function formatTopicLabel(topic: string): string {
  const label = topic.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const SECTOR_LABELS: Record<string, string> = {
  näringsliv: 'Näringsliv',
  konsult_pr: 'Konsult & PR',
  arbetsgivar_branschorg: 'Arbetsgivar-/branschorg',
  fackförbund: 'Fackförbund',
  civilsamhälle: 'Civilsamhälle',
  tänketank_stiftelse: 'tankesmedja & stiftelse',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

type DashboardData = {
  topics: any | null;
  topicDeep: any | null;
  power: any | null;
  sectors: any | null;
  sentiment: any | null;
  speakers: any | null;
  network: any | null;
  locations: any | null;
  arenaNetwork: any | null;
};

type Stats = {
  events: number;
  arrangers: number;
  speakers: number;
  eventSpeakerLinks: number;
  topicsClassified: number;
  sentimentAnalyzed: number;
  eventsPerYear: { year: number; count: number }[];
};

function AnimatedNumber({ target, duration = 1800 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) return;
    startTime.current = null;
    const step = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return <>{value.toLocaleString('sv-SE')}</>;
}

function LoadingScreen({ stats, progress, loadingStage, isMobile }: { stats: Stats | null; progress: number; loadingStage: string; isMobile?: boolean }) {
  const stages = [
    'Hämtar databasstatistik',
    'Laddar ämneskluster',
    'Beräknar agendakraft',
    'Klassificerar sektorer',
    'Analyserar sentiment',
    'Kartlägger talare',
    'Bygger nätverksgraf',
    'Laddar Visbykarta',
    'Bygger arenanätverk',
    'Klart',
  ];

  return (
    <div style={{
      backgroundColor: '#000',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
    }}>
      <div style={{ width: '100%', maxWidth: '700px', padding: isMobile ? '1rem' : '2rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(2.5rem, 6vw, 4rem)',
          margin: '0 0 0.5rem 0',
          letterSpacing: '0.05em',
        }}>
          ALMEDALSDATA
        </h1>
        <div style={{
          width: '60px',
          height: '4px',
          backgroundColor: '#ff6632',
          marginBottom: '2.5rem',
        }} />

        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: isMobile ? '1rem' : '1.5rem 2rem',
            marginBottom: '2.5rem',
          }}>
            {[
              { label: 'Seminarier', value: stats.events },
              { label: 'Arrangörer', value: stats.arrangers },
              { label: 'Paneldeltagare', value: stats.speakers },
              { label: 'Medverkanden', value: stats.eventSpeakerLinks },
              { label: 'Ämnesklassificeringar', value: stats.topicsClassified },
              { label: 'Sentimentanalyser', value: stats.sentimentAnalyzed },
            ].map((item) => (
              <div key={item.label}>
                <div style={{
                  fontFamily: 'var(--font-formula)',
                  fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                  color: '#ff6632',
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}>
                  <AnimatedNumber target={item.value} />
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: '0.25rem',
                  fontFamily: '"Space Mono", monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {stats && stats.eventsPerYear.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '3px',
            height: '48px',
            marginBottom: '2rem',
          }}>
            {stats.eventsPerYear.map((yData) => {
              const maxCount = Math.max(...stats.eventsPerYear.map(y => y.count));
              const heightPct = (yData.count / maxCount) * 100;
              return (
                <div key={yData.year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: '100%',
                    height: `${heightPct * 0.48}px`,
                    backgroundColor: '#ff6632',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.7 + (heightPct / 100) * 0.3,
                    transition: 'height 1s ease-out',
                  }} />
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: '4px',
                    fontFamily: '"Space Mono", monospace',
                  }}>
                    {yData.year}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Progress bar */}
        <div style={{
          height: '2px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '1px',
          overflow: 'hidden',
          marginBottom: '1rem',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: '#ff6632',
            transition: 'width 0.4s ease-out',
          }} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontFamily: '"Space Mono", monospace',
            color: 'rgba(255,255,255,0.4)',
          }}>
            {loadingStage}
          </span>
          <span style={{
            fontSize: '0.75rem',
            fontFamily: '"Space Mono", monospace',
            color: 'rgba(255,255,255,0.3)',
          }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const [data, setData] = useState<DashboardData>({
    topics: null, topicDeep: null, power: null, sectors: null, sentiment: null, speakers: null, network: null, locations: null, arenaNetwork: null,
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Hämtar databasstatistik');

  useEffect(() => {
    async function loadData() {
      // Step 1: fetch stats first (fast)
      try {
        const statsRes = await fetch('/api/dashboard?view=stats');
        const statsData = await statsRes.json();
        setStats(statsData);
        setProgress(10);
        setLoadingStage('Laddar ämneskluster');
      } catch { /* continue */ }

      // Step 2: fetch all views in parallel, updating progress as each resolves
      const views = [
        { name: 'topics', label: 'Beräknar agendakraft', pct: 18 },
        { name: 'topic-deep', label: 'Analyserar ämnesdjup', pct: 30 },
        { name: 'power', label: 'Klassificerar sektorer', pct: 40 },
        { name: 'sectors', label: 'Analyserar sentiment', pct: 50 },
        { name: 'sentiment', label: 'Kartlägger talare', pct: 60 },
        { name: 'speakers', label: 'Bygger nätverksgraf', pct: 70 },
        { name: 'network', label: 'Laddar Visbykarta', pct: 78 },
        { name: 'locations', label: 'Bygger arenanätverk', pct: 90 },
        { name: 'arena-network', label: 'Klart', pct: 100 },
      ];

      const results: Record<string, any> = {};
      const promises = views.map(async (view) => {
        const res = await fetch(`/api/dashboard?view=${view.name}`);
        const json = await res.json();
        results[view.name] = json;
        setProgress(view.pct);
        setLoadingStage(view.label);
      });

      await Promise.all(promises);

      // Brief pause to show the completed state
      await new Promise(r => setTimeout(r, 400));

      setData({
        topics: results.topics || null,
        topicDeep: results['topic-deep'] || null,
        power: results.power || null,
        sectors: results.sectors || null,
        sentiment: results.sentiment || null,
        speakers: results.speakers || null,
        network: results.network || null,
        locations: results.locations || null,
        arenaNetwork: results['arena-network'] || null,
      });
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return <LoadingScreen stats={stats} progress={progress} loadingStage={loadingStage} isMobile={isMobile} />;
  }

  return (
    <div style={{ backgroundColor: '#f7f5e4', minHeight: '100vh' }}>
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: isMobile ? '1.25rem 0' : '2rem 0',
        borderBottom: '4px solid #ff6632',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '0 1rem' : '0 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: 0 }}>
              ALMEDALSDATA
            </h1>
          </div>
          <p style={{ fontSize: isMobile ? '0.85rem' : '1.1rem', opacity: 0.7, marginTop: '0.5rem' }}>
            {stats
              ? isMobile
                ? `${stats.events.toLocaleString('sv-SE')} events | ${stats.speakers.toLocaleString('sv-SE')} paneldeltagare | 2022–2026`
                : `${stats.events.toLocaleString('sv-SE')} events | ${stats.arrangers.toLocaleString('sv-SE')} arrangörer | ${stats.speakers.toLocaleString('sv-SE')} paneldeltagare | ${stats.eventSpeakerLinks.toLocaleString('sv-SE')} medverkanden | 2022–2026`
              : 'Laddar...'}
          </p>
          {!isMobile && (
            <p style={{ fontSize: '0.85rem', opacity: 0.5, marginTop: '0.75rem', maxWidth: '800px', lineHeight: '1.5' }}>
              Samtliga seminarier, paneler och programpunkter från Almedalsveckan 2022 till 2026, samlade i en databas.
              Data för 2025 och 2026 är hämtad direkt från Almedalsveckans webbkalendarium. Data för 2022 till 2024
              är extraherad ur de officiella programkatalogerna i PDF-format. Arrangörer har normaliserats och
              deduplicerats så att samma organisation räknas som en entitet oavsett namnvarianter mellan åren.
            </p>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '1rem' : '2rem' }}>

        {/* SECTION 1: Makt & utrymme */}
        {data.power && <PowerView data={data.power} sectors={data.sectors} isMobile={isMobile} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: isMobile ? '2rem 0' : '3rem 0' }} />

        {/* SECTION 1b: Visbykarta */}
        {data.locations?.venues?.length > 0 && <LocationsView data={data.locations} isMobile={isMobile} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: isMobile ? '2rem 0' : '3rem 0' }} />

        {/* SECTION 2: Ämnen & trender */}
        {data.topics && <TopicsView data={data.topics} topicDeep={data.topicDeep} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: isMobile ? '2rem 0' : '3rem 0' }} />

        {/* SECTION 3: Sentiment & ton */}
        {data.sentiment && <SentimentView data={data.sentiment} isMobile={isMobile} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: isMobile ? '2rem 0' : '3rem 0' }} />

        {/* SECTION 4: Nätverk */}
        {data.network && <NetworkView data={data.network} isMobile={isMobile} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: isMobile ? '2rem 0' : '3rem 0' }} />

        {/* SECTION 4b: Arenanätverk */}
        {data.arenaNetwork && <ArenaNetworkView data={data.arenaNetwork} isMobile={isMobile} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: isMobile ? '2rem 0' : '3rem 0' }} />

        {/* SECTION 5: A-listan */}
        {data.speakers && <SpeakersView data={data.speakers} isMobile={isMobile} />}

      </main>

      <Footer />
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h2 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', marginBottom: '0.5rem' }}>
        {title}
      </h2>
      <p style={{ color: '#555', marginBottom: '1rem', fontSize: '1.05rem' }}>
        {subtitle}
      </p>
    </>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      backgroundColor: '#fff',
      padding: isMobile ? '1rem' : '2rem',
      borderRadius: '8px',
      border: '2px solid #000',
      boxShadow: isMobile ? '2px 2px 0 #000' : '4px 4px 0 #000',
      ...style,
    }}>
      {children}
    </div>
  );
}

function AgendakraftChart({ datasets, isMobile }: { datasets: any[]; isMobile?: boolean }) {
  // Compute data ranges for zoom presets
  const allPoints = datasets.flatMap(ds => ds.data);
  const maxX = Math.max(...allPoints.map((d: any) => d.x), 10);
  const maxY = Math.max(...allPoints.map((d: any) => d.y), 10);

  const ZOOM_PRESETS = [
    { label: 'Alla', xMax: maxX * 1.1, yMax: maxY * 1.1 },
    { label: 'Mellanskiktet', xMax: Math.min(maxX * 0.4, 80), yMax: Math.min(maxY * 0.4, 80) },
    { label: 'Klustret', xMax: Math.min(maxX * 0.15, 30), yMax: Math.min(maxY * 0.15, 30) },
  ];

  const [zoomLevel, setZoomLevel] = useState(0);

  const currentZoom = ZOOM_PRESETS[zoomLevel];

  return (
    <div style={{ height: isMobile ? '350px' : '500px', position: 'relative' }}>
      <Bubble data={{ datasets }} options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        scales: {
          x: {
            title: { display: true, text: 'Egna seminarier', font: { weight: 'bold' as const } },
            min: 0,
            max: currentZoom.xMax,
          },
          y: {
            title: { display: true, text: 'Medverkan i andras event', font: { weight: 'bold' as const } },
            min: 0,
            max: currentZoom.yMax,
          },
        },
        plugins: {
          legend: {
            position: isMobile ? 'bottom' as const : 'right' as const,
            labels: { boxWidth: 12, font: { size: isMobile ? 10 : 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const d = ctx.raw;
                return [
                  d.name,
                  `Egna event: ${d.x}`,
                  `I andras paneler: ${d.y}`,
                  `Agendakraft: ${d.power}`,
                  `Panelplatser givna: ${d.given}`,
                ];
              },
            },
          },
        },
      }} />
      <div style={{
        position: 'absolute',
        top: '0.5rem',
        left: '0.5rem',
        display: 'flex',
        gap: '0.3rem',
      }}>
        {ZOOM_PRESETS.map((preset, i) => (
          <button
            key={preset.label}
            onClick={() => setZoomLevel(i)}
            style={{
              padding: '0.3rem 0.7rem',
              border: zoomLevel === i ? '2px solid #ff6632' : '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: zoomLevel === i ? '#ff6632' : '#fff',
              color: zoomLevel === i ? '#fff' : '#666',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PowerView({ data, sectors, isMobile }: { data: any; sectors: any; isMobile?: boolean }) {
  const arrangers = data.arrangers;

  // Group arrangers by sector for bubble chart datasets
  const bySector: Record<string, any[]> = {};
  for (const a of arrangers) {
    if (!bySector[a.sector]) bySector[a.sector] = [];
    bySector[a.sector].push(a);
  }

  // Find max agendaPower for scaling bubble radius
  const maxPower = Math.max(...arrangers.map((a: any) => a.agendaPower));

  const bubbleDatasets = Object.entries(bySector).map(([sector, arr]) => ({
    label: SECTOR_LABELS[sector] || sector,
    data: arr.map((a: any) => ({
      x: a.totalEvents,
      y: a.panelSlotsReceived,
      r: Math.max(3, (a.agendaPower / maxPower) * 30),
      name: a.name,
      power: a.agendaPower,
      given: a.panelSlotsGiven,
    })),
    backgroundColor: (SECTOR_COLORS[sector] || '#ccc') + 'AA',
    borderColor: SECTOR_COLORS[sector] || '#ccc',
    borderWidth: 1,
  }));

  // Stacked area chart — sector balance over time (normalized %)
  const sectorAreaDatasets = sectors?.sectors?.map((s: any) => ({
    label: SECTOR_LABELS[s.sector] || s.sector,
    data: s.valuesNormalized,
    backgroundColor: (SECTOR_COLORS[s.sector] || '#ccc') + 'CC',
    borderColor: SECTOR_COLORS[s.sector] || '#ccc',
    borderWidth: 1,
    fill: true,
  })) || [];

  return (
    <section>
      <SectionHeader title="MAKT & UTRYMME" subtitle="Vem tar plats i Almedalen? Agendakraft per organisation och sektor." />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Det här avsnittet kartlägger hur utrymmet i Almedalen fördelas mellan organisationer och sektorer.
        Grunden är ett agendakraftindex som kombinerar tre dimensioner: hur många egna seminarier en organisation
        arrangerar, hur många panelplatser den ger till externa talare och hur ofta organisationens egna
        representanter dyker upp i andras programpunkter. Tanken är att fånga inte bara vem som syns, utan
        vem som faktiskt styr agendan genom att bjuda in, bli inbjuden eller båda. Sektorklassificeringen
        bygger på en taxonomi med tio huvudsektorer och drygt fyrtio undersektorer. Varje arrangör har
        klassificerats utifrån organisationsnamn och verksamhetsbeskrivning. Klassificeringar med låg
        tillförlitlighet (under 0,8) har granskats manuellt.
      </p>

      <Card style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Agendakraft: topp 100 organisationer</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
          Varje bubbla är en organisation. Positionen på x-axeln visar hur många egna seminarier organisationen
          har arrangerat totalt under perioden. Positionen på y-axeln visar hur ofta organisationens representanter
          har medverkat i andras programpunkter. Bubblans storlek motsvarar agendakraftindexet, som väger samman
          båda dimensionerna plus antalet panelplatser organisationen gett till externa talare. Organisationer högt
          upp till höger är agendasättare i dubbel bemärkelse: de arrangerar mycket och syns dessutom ofta hos andra.
          Färgen anger sektor enligt klassificeringen i teckenförklaringen.
        </p>
        <AgendakraftChart datasets={bubbleDatasets} isMobile={isMobile} />
      </Card>

      <Card>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Sektorbalans över tid</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
          Grafen visar varje sektors andel av det totala antalet seminarier per år, normaliserat till 100 procent.
          Syftet är att synliggöra strukturella förskjutningar: tar näringslivet en allt större del av Almedalen,
          eller växer civilsamhället? Eftersom det totala antalet seminarier varierar mellan åren säger absoluta
          tal mindre om maktbalansen än relativa andelar. Varje seminarium räknas under den sektor som dess
          primära arrangör tillhör. Seminarier med flera arrangörer från olika sektorer räknas under den
          arrangör som står som huvudarrangör.
        </p>
        <div style={{ height: isMobile ? '300px' : '400px' }}>
          <Line data={{
            labels: sectors?.years || [],
            datasets: sectorAreaDatasets,
          }} options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { title: { display: true, text: 'År' } },
              y: {
                stacked: true,
                min: 0,
                max: 100,
                title: { display: true, text: '% av event' },
              },
            },
            plugins: {
              legend: {
                position: isMobile ? 'bottom' as const : 'right' as const,
                labels: { boxWidth: 12, font: { size: isMobile ? 10 : 11 } },
              },
              tooltip: {
                mode: 'index' as const,
                callbacks: {
                  label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
                },
              },
            },
          }} />
        </div>
      </Card>
    </section>
  );
}

function TopicsView({ data, topicDeep }: { data: any; topicDeep: any }) {
  const years = data.years;
  const topics = data.topics;
  const [showElectionFilter, setShowElectionFilter] = useState(false);

  // Calculate overall % change (first year to last year) for sorting
  const topicsWithChange = topics.map((t: any) => {
    const firstCount = t.years.find((y: any) => y.year === years[0])?.event_count || 0;
    const lastCount = t.years.find((y: any) => y.year === years[years.length - 1])?.event_count || 0;
    const overallChange = firstCount > 0
      ? Math.round(((lastCount - firstCount) / firstCount) * 1000) / 10
      : lastCount > 0 ? 100 : 0;
    return { ...t, overallChange };
  });

  // Sort by % change (strongest growth first)
  const sortedTopics = [...topicsWithChange].sort((a: any, b: any) => b.overallChange - a.overallChange);

  // Valårseffekt: election years are 2022 (val sep 2022) — compare with non-election years
  const electionYears = [2022];
  const nonElectionYears = years.filter((y: number) => !electionYears.includes(y));

  const electionData = showElectionFilter ? topicsWithChange.map((t: any) => {
    const electionAvg = electionYears.reduce((s: number, y: number) => {
      return s + (t.years.find((yr: any) => yr.year === y)?.event_count || 0);
    }, 0) / electionYears.length;
    const nonElectionAvg = nonElectionYears.reduce((s: number, y: number) => {
      return s + (t.years.find((yr: any) => yr.year === y)?.event_count || 0);
    }, 0) / nonElectionYears.length;
    const diff = nonElectionAvg > 0
      ? Math.round(((electionAvg - nonElectionAvg) / nonElectionAvg) * 1000) / 10
      : 0;
    return { topic: t.topic, electionAvg: Math.round(electionAvg), nonElectionAvg: Math.round(nonElectionAvg), diff };
  }).sort((a: any, b: any) => b.diff - a.diff) : [];

  return (
    <section>
      <SectionHeader title="ÄMNEN & TRENDER" subtitle="Hur Almedalens ämneslandskap förändrats 2022–2025" />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Alla seminarier har klassificerats i 21 ämneskluster. För data från 2022 till 2024, där de officiella
        PDF-katalogerna redan innehöll ämnestaggar, har de ursprungliga taggarna kartlagts mot vår taxonomi.
        För 2025 och 2026 har varje seminarium klassificerats utifrån titel och beskrivning. Taxonomin är
        låst under hela analysperioden för att garantera jämförbarhet mellan åren. Procentuella förändringar
        i trendkorten beräknas som skillnaden mellan första och sista året i serien, dividerat med
        första årets värde.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700 }}>Trending topics</h3>
        <button
          onClick={() => setShowElectionFilter(!showElectionFilter)}
          style={{
            padding: '0.4rem 1rem',
            border: '2px solid #000',
            borderRadius: '4px',
            backgroundColor: showElectionFilter ? '#000' : '#fff',
            color: showElectionFilter ? '#fff' : '#000',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {showElectionFilter ? 'Visa trender' : 'Valårseffekt'}
        </button>
      </div>

      {showElectionFilter ? (
        <Card>
          <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
            Tabellen jämför det genomsnittliga antalet seminarier per ämne under valår (2022, då riksdagsvalet
            hölls i september) med genomsnittet under övriga år. En positiv skillnad innebär att ämnet får
            oproportionerligt stort utrymme under valår, vilket kan tyda på att det drivs av den politiska
            konjunkturen snarare än av långsiktiga frågor. Negativ skillnad pekar på att ämnet är mer av
            vardagsfråga som tappar uppmärksamhet när valrörelsen dominerar agendan.
          </p>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '3px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Ämne</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Valår (snitt)</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Icke-valår (snitt)</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Skillnad</th>
              </tr>
            </thead>
            <tbody>
              {electionData.map((d: any) => (
                <tr key={d.topic} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{formatTopicLabel(d.topic)}</td>
                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{d.electionAvg}</td>
                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{d.nonElectionAvg}</td>
                  <td style={{
                    textAlign: 'center',
                    padding: '0.6rem 0.5rem',
                    fontWeight: 700,
                    color: trendColor(d.diff),
                  }}>
                    {d.diff > 0 ? '+' : ''}{d.diff}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '1rem' }}>
          {sortedTopics.map((t: any) => {
            const sparkData = years.map((y: number) => t.years.find((yr: any) => yr.year === y)?.event_count || 0);

            return (
              <Card key={t.topic} style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{formatTopicLabel(t.topic)}</strong>
                  <span style={{
                    color: trendColor(t.overallChange),
                    fontWeight: 700,
                    fontSize: '0.95rem',
                  }}>
                    {t.overallChange > 0 ? '+' : ''}{t.overallChange}%
                  </span>
                </div>
                <div style={{ height: '60px' }}>
                  <Line data={{
                    labels: years,
                    datasets: [{
                      data: sparkData,
                      borderColor: trendColor(t.overallChange),
                      backgroundColor: trendBg(t.overallChange),
                      fill: true,
                      tension: 0.3,
                      pointRadius: 3,
                      borderWidth: 2,
                    }],
                  }} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { display: false },
                      y: { display: false, min: 0 },
                    },
                  }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t.totalEvents} events</span>
                  <span>sentiment: {t.avgSentiment.toFixed(2)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Vem äger frågan? Sektor × ämne */}
      {topicDeep?.sectorByTopic && (
        <>
          <h3 style={{ fontWeight: 700, marginTop: '2.5rem', marginBottom: '0.5rem' }}>Vem äger frågan?</h3>
          <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5', maxWidth: '900px' }}>
            Varje stapel visar vilka sektorer som arrangerar seminarier inom respektive ämne.
            Förändringar mellan åren visar om nya aktörer tar över eller om samma sektorer behåller greppet.
            Hovra över en del av stapeln för att se sektor, antal och andel.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {Object.entries(SECTOR_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: SECTOR_COLORS[key] }} />
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '1rem' }}>
            {topicDeep.sectorByTopic.map((item: any) => (
              <Card key={item.topic} style={{ padding: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                  {formatTopicLabel(item.topic)}
                </strong>
                {topicDeep.years.map((year: number) => {
                  const yearTotal = item.sectors.reduce((sum: number, s: any) => {
                    const yData = s.years.find((y: any) => y.year === year);
                    return sum + (yData?.count || 0);
                  }, 0);
                  if (yearTotal === 0) return null;
                  return (
                    <div key={year} style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.65rem', color: '#999', width: '32px', flexShrink: 0 }}>{year}</span>
                      <div style={{ flex: 1, display: 'flex', height: '16px', borderRadius: '2px', overflow: 'hidden', cursor: 'default' }}>
                        {item.sectors.map((s: any) => {
                          const yData = s.years.find((y: any) => y.year === year);
                          const count = yData?.count || 0;
                          if (count === 0) return null;
                          const pct = (count / yearTotal) * 100;
                          return (
                            <div
                              key={s.sector}
                              title={`${SECTOR_LABELS[s.sector] || s.sector}: ${count} event (${Math.round(pct)}%)`}
                              style={{
                                width: `${pct}%`,
                                backgroundColor: SECTOR_COLORS[s.sector] || '#ccc',
                                minWidth: pct > 3 ? '2px' : '0',
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                            />
                          );
                        })}
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#999', width: '28px', textAlign: 'right', flexShrink: 0 }}>{yearTotal}</span>
                    </div>
                  );
                })}
              </Card>
            ))}
          </div>
        </>
      )}

    </section>
  );
}

function NewVsReturningView({ data, years }: { data: any[]; years: number[] }) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  return (
    <>
      <h3 style={{ fontWeight: 700, marginTop: '2.5rem', marginBottom: '0.5rem' }}>Nya vs återkommande aktörer</h3>
      <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5', maxWidth: '900px' }}>
        Drivs ett ämnes tillväxt av att nya arrangörer ansluter eller av att befintliga gör mer?
        Mörk färg visar återkommande arrangörer (aktiva även tidigare år), ljus visar nykomlingar.
        Klicka på en stapel för att se vilka organisationer som är nya respektive återkommande det året.
      </p>
      <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: '#264653', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}/>Återkommande</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: '#f4a261', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}/>Nya</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '1rem' }}>
        {data.map((item: any) => {
          const maxTotal = Math.max(...item.years.map((y: any) => y.total));
          const isExpanded = expandedTopic === item.topic;
          return (
            <Card key={item.topic} style={{ padding: '1rem' }}>
              <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                {formatTopicLabel(item.topic)}
              </strong>
              {item.years.map((y: any) => {
                const isYearExpanded = isExpanded && expandedYear === y.year;
                return (
                  <div key={y.year}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', marginBottom: '3px', cursor: 'pointer' }}
                      onClick={() => {
                        if (isYearExpanded) {
                          setExpandedTopic(null);
                          setExpandedYear(null);
                        } else {
                          setExpandedTopic(item.topic);
                          setExpandedYear(y.year);
                        }
                      }}
                    >
                      <span style={{ fontSize: '0.65rem', color: isYearExpanded ? '#ff6632' : '#999', width: '32px', flexShrink: 0, fontWeight: isYearExpanded ? 700 : 400 }}>{y.year}</span>
                      <div style={{ flex: 1, display: 'flex', height: '16px', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          title={`Återkommande: ${y.returning}`}
                          style={{
                            width: `${maxTotal > 0 ? (y.returning / maxTotal) * 100 : 0}%`,
                            backgroundColor: '#264653',
                          }}
                        />
                        <div
                          title={`Nya: ${y.new}`}
                          style={{
                            width: `${maxTotal > 0 ? (y.new / maxTotal) * 100 : 0}%`,
                            backgroundColor: '#f4a261',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#999', width: '24px', textAlign: 'right', flexShrink: 0 }}>
                        {y.total}
                      </span>
                    </div>
                    {isYearExpanded && y.arrangers && (
                      <div style={{
                        margin: '0.25rem 0 0.5rem 32px',
                        padding: '0.5rem',
                        backgroundColor: '#f9f8f0',
                        borderRadius: '4px',
                        border: '1px solid #eee',
                        maxHeight: '250px',
                        overflowY: 'auto',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.4rem' }}>
                          {y.new} nya, {y.returning} återkommande
                        </div>
                        {y.arrangers.map((a: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.2rem 0',
                            borderBottom: i < y.arrangers.length - 1 ? '1px solid #f0efe6' : 'none',
                            fontSize: '0.75rem',
                          }}>
                            <div style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: a.isNew ? '#f4a261' : '#264653',
                              flexShrink: 0,
                            }} />
                            <div style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: SECTOR_COLORS[a.sector] || '#ccc',
                              flexShrink: 0,
                            }} />
                            <span style={{ flex: 1, fontWeight: a.isNew ? 600 : 400, color: a.isNew ? '#000' : '#666' }}>
                              {a.name}
                            </span>
                            <span style={{ color: '#999', fontSize: '0.65rem', flexShrink: 0 }}>
                              {a.events} event
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function SentimentView({ data, isMobile }: { data: any; isMobile?: boolean }) {
  const { yearData, heatmap } = data;

  const lineData = {
    labels: yearData.map((y: any) => y.year.toString()),
    datasets: [{
      label: 'Genomsnittligt sentiment',
      data: yearData.map((y: any) => y.avgScore),
      borderColor: '#ff6632',
      backgroundColor: 'rgba(255, 102, 50, 0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 8,
      pointBackgroundColor: yearData.map((y: any) =>
        y.avgScore > 0 ? '#2a9d8f' : y.avgScore < -0.1 ? '#e63946' : '#e9c46a'
      ),
      pointBorderColor: '#000',
      pointBorderWidth: 2,
      borderWidth: 3,
    }],
  };

  const labelData = {
    labels: yearData.map((y: any) => y.year.toString()),
    datasets: [
      { label: 'Positiv', data: yearData.map((y: any) => y.labels.positiv || 0), backgroundColor: '#2a9d8f' },
      { label: 'Neutral', data: yearData.map((y: any) => y.labels.neutral || 0), backgroundColor: '#e9c46a' },
      { label: 'Negativ', data: yearData.map((y: any) => y.labels.negativ || 0), backgroundColor: '#e63946' },
    ],
  };

  return (
    <section>
      <SectionHeader title="SENTIMENT & TON" subtitle="Almedalens emotionella puls: har debatten blivit mörkare eller ljusare?" />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Sentimentanalysen bygger på en genomgång av samtliga seminariebeskrivningar och titlar. Varje
        seminarium har fått en poäng på en skala från minus ett (utpräglat negativt) till plus ett
        (utpräglat positivt), samt en klassificering som positivt, neutralt eller negativt. Analysen
        fångar den språkliga tonen i hur seminariet presenteras, inte nödvändigtvis deltagarnas åsikter.
        Ett seminarium om arbetslöshet kan beskrivas i hoppfulla eller alarmerande termer, och det är
        den skillnaden som mäts. Genomsnittspoängen per år ger en bild av den övergripande retoriska
        riktningen i Almedalens program.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '2rem', marginBottom: '2rem' }}>
        <Card>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Sentimentindex per år</h3>
          <div style={{ height: isMobile ? '250px' : '300px' }}>
            <Line data={lineData} options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { min: -0.3, max: 0.1, title: { display: true, text: 'Snittpoäng (-1 till +1)' } },
              },
              plugins: { legend: { display: false } },
            }} />
          </div>
        </Card>

        <Card>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Fördelning pos / neutral / neg</h3>
          <div style={{ height: isMobile ? '250px' : '300px' }}>
            <Bar data={labelData} options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { stacked: true },
                y: { stacked: true, title: { display: true, text: 'Antal event' } },
              },
              plugins: { legend: { position: 'top' as const } },
            }} />
          </div>
        </Card>
      </div>

      <Card>
        <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Sektor-heatmap</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: '1.5' }}>
          Tabellen visar genomsnittlig sentimentpoäng per sektor och år. Gröna celler innebär att sektorns
          seminarier i snitt har en positivt laddad ton, röda att tonen är mer problemorienterad eller
          alarmerande. Värdet är ett genomsnitt av alla seminarier vars primärarrangör tillhör den aktuella
          sektorn. Skillnader mellan sektorer kan avspegla verkliga retoriska strategier: vissa aktörer
          använder Almedalen för att lyfta möjligheter och lösningar, andra för att uppmärksamma kriser
          och brister. Jämförelser över tid inom samma sektor är mer tillförlitliga än jämförelser
          mellan sektorer, eftersom språkbruk och ämnesval varierar systematiskt mellan branscher.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '3px solid #000', fontWeight: 700 }}>Sektor</th>
                {[2022, 2023, 2024, 2025].map(y => (
                  <th key={y} style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '3px solid #000', fontWeight: 700 }}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.sort((a: any, b: any) => {
                const aAvg = a.years.reduce((s: number, y: any) => s + y.avgSentiment, 0) / a.years.length;
                const bAvg = b.years.reduce((s: number, y: any) => s + y.avgSentiment, 0) / b.years.length;
                return bAvg - aAvg;
              }).map((row: any) => (
                <tr key={row.sector}>
                  <td style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #eee', fontWeight: 600 }}>
                    {SECTOR_LABELS[row.sector] || row.sector}
                  </td>
                  {[2022, 2023, 2024, 2025, 2026].map(y => {
                    const yd = row.years.find((yr: any) => yr.year === y);
                    const val = yd?.avgSentiment ?? null;
                    const bg = val === null ? '#f0f0f0'
                      : val > 0.05 ? `rgba(42, 157, 143, ${Math.min(Math.abs(val) * 3, 0.8)})`
                      : val < -0.05 ? `rgba(230, 57, 70, ${Math.min(Math.abs(val) * 3, 0.8)})`
                      : 'rgba(233, 196, 106, 0.3)';
                    return (
                      <td key={y} style={{
                        textAlign: 'center',
                        padding: '0.6rem',
                        borderBottom: '1px solid #eee',
                        backgroundColor: bg,
                        color: val !== null && Math.abs(val) > 0.15 ? '#fff' : '#333',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}>
                        {val !== null ? val.toFixed(2) : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function NetworkView({ data, isMobile }: { data: any; isMobile?: boolean }) {
  return (
    <section>
      <SectionHeader title="NÄTVERK & PANELKARTLÄGGNING" subtitle="Organisationer kopplade genom delade paneldeltagare." />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Nätverksgrafen visar hur organisationer hänger ihop genom gemensamma paneldeltagare. Två organisationer
        kopplas samman om minst en person har medverkat i bådas seminarier under perioden. Ju tjockare linje,
        desto fler delade talare. Nodernas storlek motsvarar antalet seminarier organisationen arrangerat och
        färgen anger sektor. Organisationer som hamnar nära varandra i grafen delar många paneldeltagare och
        rör sig i samma kretsar. Isolerade noder i utkanten saknar starka kopplingar till övriga. De 80 största
        arrangörerna visas, med de 300 starkaste kopplingarna (minst två delade talare). Talare har identifierats
        genom namnutvinning ur seminariebeskrivningar (2022 till 2024) samt direkt från programsidornas
        deltagarlistor (2025).
      </p>

      <Card>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {Object.entries(SECTOR_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: SECTOR_COLORS[key] }} />
              {label}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
          Topp 80 arrangörer, {data.edges?.length || 0} kopplingar. Dra noder för att utforska. Zooma med scrollhjul.
        </p>
        <div style={{ height: isMobile ? '400px' : '600px' }}>
          <NetworkGraph nodes={data.nodes} edges={data.edges} height={isMobile ? 400 : 600} />
        </div>
      </Card>
    </section>
  );
}

function LocationsView({ data, isMobile }: { data: any; isMobile?: boolean }) {
  const venues = data.venues;

  return (
    <section>
      <SectionHeader title="VISBYKARTA" subtitle="Geografisk maktfördelning — vem har ringmurszonen vs utkanten?" />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Kartan visar Almedalsveckans arenor i Visby innerstad. Varje cirkel representerar en plats där seminarier
        hållits under perioden 2022 till 2025. Cirkelns storlek motsvarar antalet seminarier på platsen och färgen
        anger den dominerande sektorn bland arrangörerna. Klicka på en cirkel för att se platsens namn, antal
        seminarier, sektorsfördelning och de största arrangörerna. De 50 mest använda platserna visas.
      </p>

      <Card>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {Object.entries(SECTOR_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: SECTOR_COLORS[key] }} />
              {label}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
          {venues.length} platser, {venues.reduce((s: number, v: any) => s + v.eventCount, 0).toLocaleString('sv-SE')} seminarier. Klicka på en cirkel för detaljer. Zooma med scrollhjul.
        </p>
        <VisbyMap venues={venues} height={isMobile ? 400 : 600} />
      </Card>
    </section>
  );
}

function ArenaNetworkView({ data, isMobile }: { data: any; isMobile?: boolean }) {
  const { arenaNodes, orgNodes, edges } = data;

  return (
    <section>
      <SectionHeader title="ARENOR & ORGANISATIONER" subtitle="Vilka organisationer använder vilka arenor? Bipartit nätverksgraf." />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Grafen visar kopplingen mellan Almedalens arenor och de organisationer som arrangerar seminarier där.
        De större noderna med streckad ring representerar arenor — ju fler unika arrangörer, desto större nod.
        De mindre noderna är organisationer, färgade efter sektor. En koppling (linje) innebär att organisationen
        arrangerat minst två seminarier på arenan under perioden 2022 till 2025. Arenor med många kopplingar till
        organisationer från olika sektorer fungerar som mötesplatser som samlar breda delar av samhället.
        Hovra över en arena för att se vilka organisationer som använder den, eller hovra över en organisation
        för att se vilka arenor den verkar på.
      </p>

      <Card>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {Object.entries(SECTOR_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: SECTOR_COLORS[key] }} />
              {label}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px dashed #ff6632', backgroundColor: '#fff' }} />
            Arena
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
          {arenaNodes?.length || 0} arenor, {orgNodes?.length || 0} organisationer, {edges?.length || 0} kopplingar.
          Dra noder för att utforska. Zooma med scrollhjul.
        </p>
        <div style={{ height: isMobile ? '450px' : '700px' }}>
          <ArenaNetwork arenaNodes={arenaNodes} orgNodes={orgNodes} edges={edges} height={isMobile ? 450 : 700} />
        </div>
      </Card>
    </section>
  );
}

const SPEAKER_CATEGORY_LABELS: Record<string, string> = {
  politiker: 'Politiker',
  näringsliv: 'Näringsliv',
  konsult_pr: 'Konsult & PR',
  facklig: 'Facklig',
  arbetsgivar_branschorg: 'Arbetsgivar/bransch',
  civilsamhälle: 'Civilsamhälle',
  media: 'Media',
  akademi: 'Akademi',
  offentlig_sektor: 'Offentlig sektor',
};

const SPEAKER_CATEGORY_COLORS: Record<string, string> = {
  politiker: '#1982c4',
  näringsliv: '#e63946',
  konsult_pr: '#457b9d',
  facklig: '#e9c46a',
  arbetsgivar_branschorg: '#2a9d8f',
  civilsamhälle: '#f4a261',
  media: '#ff595e',
  akademi: '#8ac926',
  offentlig_sektor: '#6a4c93',
};

function SpeakersView({ data, isMobile }: { data: any; isMobile?: boolean }) {
  const speakers = data.speakers;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = selectedCategory
    ? speakers.filter((s: any) => s.category === selectedCategory)
    : speakers;

  const categories = Object.keys(SPEAKER_CATEGORY_LABELS);

  return (
    <section>
      <SectionHeader title="A-LISTAN" subtitle="Almedalens mest aktiva deltagare, rankade efter volym, kontinuitet och bredd." />
      <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: '1.6', marginBottom: '2rem', maxWidth: '900px' }}>
        Listan visar de mest aktiva paneldeltagarna under perioden 2022 till 2025.
        Rankningen baseras i första hand på totalt antal medverkanden. Kolumnen &quot;År aktiv&quot; visar hur många av
        de fyra åren personen förekommer i materialet, vilket ger en bild av kontinuitet. Varje person har
        klassificerats i en av tio yrkeskategorier utifrån titel och organisationstillhörighet. Använd flikarna
        för att filtrera på kategori. För 2022 till 2024 är medverkande identifierade genom namnutvinning ur
        seminariebeskrivningar och deltagarfält i PDF-katalogerna. För 2025 är medverkande hämtade direkt
        från programsidorna.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            padding: '0.4rem 0.9rem',
            border: '2px solid #000',
            borderRadius: '20px',
            backgroundColor: selectedCategory === null ? '#000' : '#fff',
            color: selectedCategory === null ? '#fff' : '#000',
            fontWeight: 600,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Alla
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            style={{
              padding: '0.4rem 0.9rem',
              border: `2px solid ${SPEAKER_CATEGORY_COLORS[cat]}`,
              borderRadius: '20px',
              backgroundColor: selectedCategory === cat ? SPEAKER_CATEGORY_COLORS[cat] : '#fff',
              color: selectedCategory === cat ? '#fff' : SPEAKER_CATEGORY_COLORS[cat],
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {SPEAKER_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <Card>
        {isMobile ? (
          <div>
            {filtered.slice(0, 50).map((s: any, i: number) => (
              <div key={s.id} style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #eee',
                backgroundColor: i < 3 ? 'rgba(255, 102, 50, 0.05)' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <span style={{ color: i < 3 ? '#ff6632' : '#999', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{i + 1}.</span>
                    <a href={`/speakers?id=${s.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                      {s.name}
                    </a>
                  </div>
                  <span style={{
                    backgroundColor: '#ff6632',
                    color: '#fff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    flexShrink: 0,
                  }}>{s.totalPanels}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '1.5rem', flexWrap: 'wrap' }}>
                  {s.category && (
                    <span style={{
                      backgroundColor: SPEAKER_CATEGORY_COLORS[s.category] || '#ccc',
                      color: '#fff',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                    }}>
                      {SPEAKER_CATEGORY_LABELS[s.category] || s.category}
                    </span>
                  )}
                  <span style={{ color: '#666', fontSize: '0.75rem' }}>
                    {[s.title, s.org].filter(Boolean).join(', ') || '–'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '3px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>#</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Namn</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Kategori</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Titel</th>
                <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Organisation</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Paneler</th>
                <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>År aktiv</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((s: any, i: number) => (
                <tr key={s.id} style={{
                  borderBottom: '1px solid #eee',
                  backgroundColor: i < 3 ? 'rgba(255, 102, 50, 0.05)' : 'transparent',
                }}>
                  <td style={{ padding: '0.6rem 0.5rem', color: i < 3 ? '#ff6632' : '#999', fontWeight: 700, fontSize: '1rem' }}>{i + 1}</td>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                    <a href={`/speakers?id=${s.id}`} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid #ccc' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6632'; e.currentTarget.style.borderColor = '#ff6632'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit'; e.currentTarget.style.borderColor = '#ccc'; }}
                    >
                      {s.name}
                    </a>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    {s.category && (
                      <span style={{
                        backgroundColor: SPEAKER_CATEGORY_COLORS[s.category] || '#ccc',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {SPEAKER_CATEGORY_LABELS[s.category] || s.category}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: '#666', fontSize: '0.85rem' }}>{s.title || '–'}</td>
                  <td style={{ padding: '0.6rem 0.5rem', color: '#666', fontSize: '0.85rem' }}>{s.org || '–'}</td>
                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>
                    <span style={{
                      backgroundColor: '#ff6632',
                      color: '#fff',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}>{s.totalPanels}</span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontWeight: 600 }}>{s.yearsActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
