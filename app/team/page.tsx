'use client';

import { useEffect, useState } from 'react';

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
  arbetsgivar_branschorg: 'Arbetsgivar/bransch',
  fackförbund: 'Fackförbund',
  civilsamhälle: 'Civilsamhälle',
  tänketank_stiftelse: 'Tankesmedja',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

const TOPIC_LABELS: Record<string, string> = {
  arbetsmarknad_löner: 'Arbetsmarknad',
  välfärd_omsorg: 'Välfärd',
  hälsa_sjukvård: 'Hälsa & sjukvård',
  skola_utbildning_forskning: 'Utbildning',
  klimat_miljö_hållbarhet: 'Klimat & miljö',
  energi: 'Energi',
  bostäder_samhällsbyggnad: 'Bostäder',
  transport_infrastruktur: 'Transport',
  ekonomi_tillväxt: 'Ekonomi',
  skatter_offentliga_finanser: 'Skatter',
  näringsliv_innovation: 'Innovation',
  digitalisering_ai: 'AI & digitalisering',
  försvar_säkerhet: 'Försvar & säkerhet',
  demokrati_rättsstat: 'Demokrati',
  integration_migration: 'Integration',
  eu_utrikespolitik: 'EU & utrikes',
  jämställdhet_mångfald: 'Jämställdhet',
  media_kommunikation: 'Media',
  kultur_idrott: 'Kultur & idrott',
  barn_ungdom: 'Barn & ungdom',
  övrigt: 'Övrigt',
};

type CoArranger = { id: number; name: string; sector: string | null; sharedEvents: number };
type Speaker = { id: number; name: string; title: string | null; org: string | null; events: number };
type TopicCount = { topic: string; count: number };
type GoranArranger = { id: number; name: string; sector: string | null; events: number };

type TeamData = {
  arranger: { name: string; totalEvents: number; sector: string };
  perYear: Record<string, number>;
  coArrangers: CoArranger[];
  speakers: Speaker[];
  topics: TopicCount[];
  sentiment: { avg: number; pos: number; neu: number; neg: number };
  goranProfile: {
    totalPanels: number;
    topTopics: TopicCount[];
    topArrangers: GoranArranger[];
    perYear: Record<string, number>;
  };
};

// RS team members (from data file, filtered to actual RS staff)
const RS_TEAM = [
  { id: 1495, name: 'Göran Hägglund', title: 'Styrelseordförande och moderator', panels: 47, role: 'Senior Rådgivare' },
  { id: 15140, name: 'Mikaela Kotschack', title: 'Moderator', panels: 3, role: 'Seniorkonsult' },
  { id: 436, name: 'Anne Carlsson', title: null, panels: 2, role: 'Seniorkonsult' },
  { id: 16315, name: 'Lovisa Montin', title: 'Seniorkonsult', panels: 2, role: 'Seniorkonsult' },
  { id: 15128, name: 'Jakob Ohlsson', title: 'Kampanjstrateg', panels: 1, role: 'Kampanjstrateg' },
  { id: 136, name: 'Kim Nilke Nordlund', title: null, panels: 2, role: 'VD' },
];

function MiniSparkline({ data, color = '#ff6632' }: { data: Record<string, number>; color?: string }) {
  const years = ['2022', '2023', '2024', '2025'];
  const values = years.map(y => data[y] || 0);
  const max = Math.max(...values, 1);
  const w = 120;
  const h = 32;
  const points = values.map((v, i) => ({
    x: (i / (years.length - 1)) * (w - 8) + 4,
    y: h - 4 - (v / max) * (h - 8),
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
        ))}
      </svg>
      <span style={{ fontSize: '0.65rem', color: '#666' }}>
        {years.map((y, i) => (
          <span key={y} style={{ marginRight: i < years.length - 1 ? '0.4rem' : 0 }}>
            {y.slice(2)}: {values[i]}
          </span>
        ))}
      </span>
    </div>
  );
}

function SectorBadge({ sector }: { sector: string | null }) {
  if (!sector) return null;
  const color = SECTOR_COLORS[sector] || '#555';
  const label = SECTOR_LABELS[sector] || sector;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.6rem',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: '3px',
      backgroundColor: color + '22',
      color,
      border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

function TopicBar({ topic, count, maxCount }: { topic: string; count: number; maxCount: number }) {
  const pct = (count / maxCount) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
      <span style={{ fontSize: '0.8rem', color: '#ccc', minWidth: '120px' }}>
        {TOPIC_LABELS[topic] || topic}
      </span>
      <div style={{ flex: 1, height: '6px', backgroundColor: '#333', borderRadius: '3px' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: '#ff6632',
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: '#888', minWidth: '24px', textAlign: 'right' }}>{count}</span>
    </div>
  );
}

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/team-network')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #333',
            borderTopColor: '#ff6632',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#888' }}>Laddar Reform Societys Almedalsprofil...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888' }}>Kunde inte ladda data.</p>
      </div>
    );
  }

  const totalCoArrangers = data.coArrangers.length;
  const totalSpeakers = data.speakers.length;
  const sentimentLabel = data.sentiment.avg > 0.1 ? 'positiv' : data.sentiment.avg < -0.1 ? 'negativ' : 'neutral';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: 'clamp(2.5rem, 6vw, 5rem) clamp(1rem, 4vw, 3rem) clamp(1.5rem, 3vw, 2.5rem)',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '0.75rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#ff6632',
          marginBottom: '0.75rem',
          fontWeight: 600,
        }}>
          Reform Society
        </p>
        <h1 style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(2rem, 7vw, 4.5rem)',
          lineHeight: 1,
          margin: 0,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 0%, #999 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          REFORM SOCIETY I ALMEDALEN
        </h1>
        <p style={{
          fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
          color: '#999',
          marginTop: '1rem',
          lineHeight: 1.5,
        }}>
          {data.arranger.totalEvents} seminarier &middot; {totalCoArrangers} samarbetspartners &middot; {totalSpeakers} medverkande
        </p>
      </header>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 clamp(1rem, 3vw, 2rem)' }}>

        {/* Göran Hägglund Hero */}
        <section style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: 'clamp(1.5rem, 3vw, 2.5rem)',
          marginBottom: '2rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{
                fontSize: '0.65rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#ff6632',
                marginBottom: '0.5rem',
                fontWeight: 600,
              }}>
                Senior R&aring;dgivare &middot; F.d. partiledare KD
              </p>
              <h2 style={{
                fontFamily: 'var(--font-formula)',
                fontSize: 'clamp(1.8rem, 5vw, 3rem)',
                lineHeight: 1.05,
                margin: 0,
                letterSpacing: '-0.01em',
              }}>
                G&Ouml;RAN H&Auml;GGLUND
              </h2>
              <p style={{ color: '#999', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.5rem' }}>{data.goranProfile.totalPanels}</span>{' '}
                panelmedverkanden &mdash; en av Almedalens mest aktiva r&ouml;ster
              </p>
            </div>
            <a
              href="/speakers?id=1495"
              style={{
                display: 'inline-block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#ff6632',
                textDecoration: 'none',
                border: '1px solid #ff6632',
                padding: '0.4rem 1rem',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                alignSelf: 'center',
              }}
            >
              Se fullst&auml;ndig profil &rarr;
            </a>
          </div>

          {/* Sparkline */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Medverkanden per &aring;r
            </p>
            <MiniSparkline data={data.goranProfile.perYear} />
          </div>

          {/* Topics & Arrangers grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            {/* Top topics */}
            <div>
              <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Vanligaste &auml;mnen
              </p>
              {data.goranProfile.topTopics.slice(0, 5).map(t => (
                <div key={t.topic} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #222' }}>
                  <span style={{ fontSize: '0.8rem', color: '#ccc' }}>{TOPIC_LABELS[t.topic] || t.topic}</span>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>{t.count}</span>
                </div>
              ))}
            </div>
            {/* Top arrangers */}
            <div>
              <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Vanligaste arrang&ouml;rer
              </p>
              {data.goranProfile.topArrangers.slice(0, 5).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid #222', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#ccc', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  <SectorBadge sector={a.sector} />
                  <span style={{ fontSize: '0.75rem', color: '#888', flexShrink: 0 }}>{a.events}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RS Almedalsprofil */}
        <section style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: 'clamp(1.5rem, 3vw, 2rem)',
          marginBottom: '2rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
            margin: '0 0 1.5rem',
            letterSpacing: '-0.01em',
          }}>
            RS ALMEDALSPROFIL
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            {/* Events per year */}
            <div>
              <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Seminarier per &aring;r
              </p>
              <MiniSparkline data={data.perYear} />
              <div style={{ marginTop: '1rem' }}>
                {['2022', '2023', '2024', '2025'].map(y => (
                  <div key={y} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', width: '36px' }}>{y}</span>
                    <div style={{ flex: 1, height: '4px', backgroundColor: '#333', borderRadius: '2px' }}>
                      <div style={{
                        width: `${((data.perYear[y] || 0) / Math.max(...Object.values(data.perYear), 1)) * 100}%`,
                        height: '100%',
                        backgroundColor: '#ff6632',
                        borderRadius: '2px',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#ccc', width: '20px', textAlign: 'right' }}>{data.perYear[y] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div>
              <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                &Auml;mnesf&ouml;rdelning
              </p>
              {data.topics.map(t => (
                <TopicBar key={t.topic} topic={t.topic} count={t.count} maxCount={data.topics[0]?.count || 1} />
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #222' }}>
            <p style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Ton i seminariebeskrivningar
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: sentimentLabel === 'positiv' ? '#2a9d8f' : sentimentLabel === 'negativ' ? '#e63946' : '#e9c46a',
              }}>
                {data.sentiment.avg > 0 ? '+' : ''}{data.sentiment.avg}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>
                {data.sentiment.pos} positiva &middot; {data.sentiment.neu} neutrala &middot; {data.sentiment.neg} negativa
              </span>
            </div>
          </div>
        </section>

        {/* Samarbetspartners */}
        <section style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: 'clamp(1.5rem, 3vw, 2rem)',
          marginBottom: '2rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
            margin: '0 0 0.5rem',
            letterSpacing: '-0.01em',
          }}>
            SAMARBETSPARTNERS
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1.5rem' }}>
            Organisationer som samarrangerat seminarier med Reform Society
          </p>

          <div style={{ display: 'grid', gap: '0' }}>
            {data.coArrangers.map((co, i) => (
              <a
                key={co.id}
                href={`/speakers?tab=aktorer&id=${co.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  borderBottom: i < data.coArrangers.length - 1 ? '1px solid #222' : 'none',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: '4px',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#252525')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '0.9rem',
                    color: '#eee',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {co.name}
                  </span>
                  <SectorBadge sector={co.sector} />
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  flexShrink: 0,
                  marginLeft: '0.5rem',
                }}>
                  {co.sharedEvents} {co.sharedEvents === 1 ? 'event' : 'events'}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Medarbetare i Almedalen */}
        <section style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: 'clamp(1.5rem, 3vw, 2rem)',
          marginBottom: '2rem',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
            margin: '0 0 0.5rem',
            letterSpacing: '-0.01em',
          }}>
            MEDARBETARE I ALMEDALEN
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1.5rem' }}>
            Reform Societys team i Almedalens program
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {RS_TEAM.filter(m => m.id !== 1495).map(member => (
              <a
                key={member.id}
                href={`/speakers?id=${member.id}`}
                style={{
                  display: 'block',
                  backgroundColor: '#111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                  padding: '1rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#ff6632';
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#2a2a2a';
                  e.currentTarget.style.backgroundColor = '#111';
                }}
              >
                <p style={{
                  fontFamily: 'var(--font-formula)',
                  fontSize: '1rem',
                  margin: '0 0 0.25rem',
                  letterSpacing: '-0.01em',
                }}>
                  {member.name}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#ff6632', margin: '0 0 0.5rem', fontWeight: 500 }}>
                  {member.role}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>
                  {member.panels} {member.panels === 1 ? 'panelmedverkan' : 'panelmedverkanden'}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{
          textAlign: 'center',
          padding: '2rem 0 3rem',
          borderTop: '1px solid #222',
        }}>
          <p style={{
            fontFamily: 'var(--font-formula)',
            fontSize: '1rem',
            color: '#555',
            letterSpacing: '0.1em',
          }}>
            REFORM SOCIETY
          </p>
          <p style={{ fontSize: '0.7rem', color: '#444', marginTop: '0.5rem' }}>
            Data fr&aring;n Almedalsveckan 2022&ndash;2025
          </p>
        </footer>
      </div>
    </div>
  );
}
