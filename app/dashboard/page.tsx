'use client';

import { useState, useEffect } from 'react';
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

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, BubbleController, Title, Tooltip, Legend, Filler
);

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

const SECTOR_LABELS: Record<string, string> = {
  näringsliv: 'Näringsliv',
  konsult_pr: 'Konsult & PR',
  arbetsgivar_branschorg: 'Arbetsgivar-/branschorg',
  fackförbund: 'Fackförbund',
  civilsamhälle: 'Civilsamhälle',
  tänketank_stiftelse: 'Tänketank & stiftelse',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

type DashboardData = {
  topics: any | null;
  power: any | null;
  sectors: any | null;
  sentiment: any | null;
  speakers: any | null;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    topics: null, power: null, sectors: null, sentiment: null, speakers: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard?view=topics').then(r => r.json()),
      fetch('/api/dashboard?view=power').then(r => r.json()),
      fetch('/api/dashboard?view=sectors').then(r => r.json()),
      fetch('/api/dashboard?view=sentiment').then(r => r.json()),
      fetch('/api/dashboard?view=speakers').then(r => r.json()),
    ]).then(([topics, power, sectors, sentiment, speakers]) => {
      setData({ topics, power, sectors, sentiment, speakers });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#f7f5e4', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: '2rem' }}>ALMEDALSDATA</h1>
          <p style={{ marginTop: '1rem', fontSize: '1.1rem', color: '#666' }}>Laddar 9 407 events...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f7f5e4', minHeight: '100vh' }}>
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem',
        borderBottom: '4px solid #ff6632',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: 0 }}>
            ALMEDALSDATA
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.7, marginTop: '0.5rem' }}>
            9 407 events | 3 081 arrangörer | 12 566 deltagare | 2022–2026
          </p>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>

        {/* SECTION 1: Makt & utrymme */}
        {data.power && <PowerView data={data.power} sectors={data.sectors} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: '3rem 0' }} />

        {/* SECTION 2: Ämnen & trender */}
        {data.topics && <TopicsView data={data.topics} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: '3rem 0' }} />

        {/* SECTION 3: Sentiment & ton */}
        {data.sentiment && <SentimentView data={data.sentiment} />}

        <hr style={{ border: 'none', borderTop: '3px solid #000', margin: '3rem 0' }} />

        {/* SECTION 4: A-listan */}
        {data.speakers && <SpeakersView data={data.speakers} />}

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
      <p style={{ color: '#555', marginBottom: '2rem', fontSize: '1.05rem' }}>
        {subtitle}
      </p>
    </>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      padding: '2rem',
      borderRadius: '8px',
      border: '2px solid #000',
      boxShadow: '4px 4px 0 #000',
      ...style,
    }}>
      {children}
    </div>
  );
}

function PowerView({ data, sectors }: { data: any; sectors: any }) {
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

      <Card style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Agendakraft — topp 100 organisationer</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          X = egna seminarier, Y = medverkan i andras event, storlek = agendakraft-index. Färg = sektor.
        </p>
        <div style={{ height: '500px' }}>
          <Bubble data={{ datasets: bubbleDatasets }} options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: { display: true, text: 'Egna seminarier (events_count)', font: { weight: 'bold' as const } },
                beginAtZero: true,
              },
              y: {
                title: { display: true, text: 'Medverkan i andras event (panel_slots_received)', font: { weight: 'bold' as const } },
                beginAtZero: true,
              },
            },
            plugins: {
              legend: {
                position: 'right' as const,
                labels: { boxWidth: 12, font: { size: 11 } },
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
        </div>
      </Card>

      <Card>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Sektorbalans över tid</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          Andel event per sektor, normaliserat till 100% per år. Visar om Almedalen blivit mer korporativt, fackligt eller civilsamhällesdrivet.
        </p>
        <div style={{ height: '400px' }}>
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
                position: 'right' as const,
                labels: { boxWidth: 12, font: { size: 11 } },
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

function TopicsView({ data }: { data: any }) {
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

      <Card style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Ämnesflöde (alluvial)</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          Bredare ström = ämnet växer, smalare = det krymper. Topp 12 ämnen efter volym.
        </p>
        <div style={{ height: '500px' }}>
          <SankeyChart topics={topics} years={years} height={500} />
        </div>
      </Card>

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
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
            Jämför valår (2022) med icke-valår. Positiv skillnad = ämnet ökar under valår.
          </p>
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
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{d.topic.replace(/_/g, ' ')}</td>
                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{d.electionAvg}</td>
                  <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>{d.nonElectionAvg}</td>
                  <td style={{
                    textAlign: 'center',
                    padding: '0.6rem 0.5rem',
                    fontWeight: 700,
                    color: d.diff > 10 ? '#2a9d8f' : d.diff < -10 ? '#e63946' : '#666',
                  }}>
                    {d.diff > 0 ? '+' : ''}{d.diff}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {sortedTopics.map((t: any) => {
            const sparkData = years.map((y: number) => t.years.find((yr: any) => yr.year === y)?.event_count || 0);

            return (
              <Card key={t.topic} style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{t.topic.replace(/_/g, ' ')}</strong>
                  <span style={{
                    color: t.overallChange > 0 ? '#2a9d8f' : t.overallChange < 0 ? '#e63946' : '#666',
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
                      borderColor: t.overallChange > 0 ? '#2a9d8f' : t.overallChange < 0 ? '#e63946' : '#ff6632',
                      backgroundColor: t.overallChange > 0 ? 'rgba(42, 157, 143, 0.1)' : t.overallChange < 0 ? 'rgba(230, 57, 70, 0.1)' : 'rgba(255, 102, 50, 0.1)',
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
    </section>
  );
}

function SentimentView({ data }: { data: any }) {
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
      <SectionHeader title="SENTIMENT & TON" subtitle="Almedalens emotionella puls — har debatten blivit mörkare eller ljusare?" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <Card>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Sentimentindex per år</h3>
          <div style={{ height: '300px' }}>
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
          <div style={{ height: '300px' }}>
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
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
          Genomsnittligt sentiment per sektor och år. Grönt = positivt, rött = negativt.
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

function SpeakersView({ data }: { data: any }) {
  const speakers = data.speakers;

  return (
    <section>
      <SectionHeader title="A-LISTAN" subtitle="Almedalens mest aktiva deltagare — rankade efter volym, kontinuitet och bredd." />

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '3px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>#</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Namn</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Titel</th>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Organisation</th>
              <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>Paneler</th>
              <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', fontWeight: 700 }}>År aktiv</th>
            </tr>
          </thead>
          <tbody>
            {speakers.slice(0, 50).map((s: any, i: number) => (
              <tr key={s.id} style={{
                borderBottom: '1px solid #eee',
                backgroundColor: i < 3 ? 'rgba(255, 102, 50, 0.05)' : 'transparent',
              }}>
                <td style={{ padding: '0.6rem 0.5rem', color: i < 3 ? '#ff6632' : '#999', fontWeight: 700, fontSize: '1rem' }}>{i + 1}</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{s.name}</td>
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
      </Card>
    </section>
  );
}
