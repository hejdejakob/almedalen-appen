'use client';

import { useState, useEffect } from 'react';
import Footer from '@/components/Footer';

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
  tänketank_stiftelse: 'Tankesmedja & stiftelse',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

type ArenaData = {
  name: string;
  totalEvents: number;
  uniqueArrangers: number;
  sectorBreakdown: Record<string, number>;
  dominantSector: string;
  dominantPct: number;
  sectorDiversity: number;
  yearlyEvents: Record<string, number>;
  type: 'pluralistic' | 'mixed' | 'dominated';
};

type ArenaDetail = {
  arena: string;
  totalEvents: number;
  perYear: Record<string, number>;
  topArrangers: { id: number; name: string; sector: string | null; eventCount: number }[];
  topTopics: { topic: string; count: number }[];
  topSpeakers: { id: number; name: string; title: string | null; org: string | null; category: string | null; eventCount: number }[];
  sectorBreakdown: { sector: string; count: number }[];
};

type FilterType = 'all' | 'pluralistic' | 'dominated' | 'mixed';
type SortType = 'events' | 'arrangers' | 'diversity';

function SectorBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  if (total === 0) return null;
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', width: '100%' }}>
      {sorted.map(([sector, count]) => {
        const pct = (count / total) * 100;
        return (
          <div
            key={sector}
            title={`${SECTOR_LABELS[sector] || sector}: ${Math.round(pct)}%`}
            style={{
              width: `${pct}%`,
              backgroundColor: SECTOR_COLORS[sector] || '#999',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

function YearSparkline({ yearlyEvents }: { yearlyEvents: Record<string, number> }) {
  const years = [2022, 2023, 2024, 2025, 2026];
  const values = years.map(y => yearlyEvents[String(y)] || 0);
  const max = Math.max(...values, 1);

  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '32px' }}>
      {years.map((year, i) => (
        <div
          key={year}
          title={`${year}: ${values[i]} events`}
          style={{
            flex: 1,
            backgroundColor: values[i] > 0 ? '#fb531a' : '#e5e0d3',
            height: `${Math.max((values[i] / max) * 100, values[i] > 0 ? 8 : 4)}%`,
            borderRadius: '2px 2px 0 0',
            minHeight: values[i] > 0 ? '4px' : '2px',
          }}
        />
      ))}
    </div>
  );
}

function TypeBadge({ type, dominantSector, dominantPct }: { type: ArenaData['type']; dominantSector: string; dominantPct: number }) {
  const sectorLabel = SECTOR_LABELS[dominantSector] || dominantSector;
  if (type === 'pluralistic') {
    return (
      <span style={{
        backgroundColor: 'rgba(138, 201, 38, 0.15)',
        color: '#4a7c10',
        border: '1px solid rgba(138, 201, 38, 0.4)',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        Pluralistisk · {sectorLabel} {dominantPct}%
      </span>
    );
  }
  if (type === 'dominated') {
    return (
      <span style={{
        backgroundColor: 'rgba(230, 57, 70, 0.12)',
        color: '#b5222e',
        border: '1px solid rgba(230, 57, 70, 0.3)',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {sectorLabel} {dominantPct}%
      </span>
    );
  }
  return (
    <span style={{
      backgroundColor: 'rgba(233, 196, 106, 0.2)',
      color: '#8a6a00',
      border: '1px solid rgba(233, 196, 106, 0.5)',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.72rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      Blandad · {sectorLabel} {dominantPct}%
    </span>
  );
}

function ArenaCard({ arena, onClick }: { arena: ArenaData; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#fff',
        borderRadius: '10px',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.13)' : '0 2px 8px rgba(0,0,0,0.07)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
      }}>
      {/* Name + badge row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3 style={{
          margin: 0,
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
          lineHeight: 1.2,
          color: '#111',
          flex: 1,
        }}>
          {arena.name}
        </h3>
        <TypeBadge type={arena.type} dominantSector={arena.dominantSector} dominantPct={arena.dominantPct} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
          <span style={{ fontFamily: 'var(--font-formula)', fontSize: '1.35rem', color: '#fb531a', lineHeight: 1 }}>
            {arena.totalEvents}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>events</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
          <span style={{ fontFamily: 'var(--font-formula)', fontSize: '1.35rem', color: '#457b9d', lineHeight: 1 }}>
            {arena.uniqueArrangers}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>arrangörer</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '50px' }}>
          <span style={{ fontFamily: 'var(--font-formula)', fontSize: '1.35rem', color: '#2a9d8f', lineHeight: 1 }}>
            {arena.sectorDiversity}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>sektorer</span>
        </div>
      </div>

      {/* Sector bar */}
      <div>
        <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '4px' }}>Sektorsammansättning</div>
        <SectorBar breakdown={arena.sectorBreakdown} />
        {/* Sector legend — top 3 sectors */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
          {Object.entries(arena.sectorBreakdown)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([sector]) => (
              <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: SECTOR_COLORS[sector] || '#999',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.68rem', color: '#555' }}>
                  {SECTOR_LABELS[sector] || sector}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Year sparkline */}
      <div>
        <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '4px' }}>Events per år (2022–2026)</div>
        <YearSparkline yearlyEvents={arena.yearlyEvents} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          {[2022, 2023, 2024, 2025, 2026].map(y => (
            <span key={y} style={{ fontSize: '0.6rem', color: '#aaa' }}>{y}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTopic(topic: string): string {
  const s = topic.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ArenaDetailView({ detail, onClose }: { detail: ArenaDetail; onClose: () => void }) {
  const [hoveredArranger, setHoveredArranger] = useState<number | null>(null);
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const [hoveredSpeaker, setHoveredSpeaker] = useState<number | null>(null);

  const years = Object.keys(detail.perYear).sort();
  const maxYearVal = Math.max(...Object.values(detail.perYear), 1);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#fb531a',
          fontSize: '0.95rem',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '0.5rem 0',
          fontFamily: 'inherit',
          marginBottom: '1rem',
        }}
      >
        &larr; Tillbaka till arenalistan
      </button>

      {/* Heading */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{
          margin: '0 0 0.5rem',
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
          color: '#111',
        }}>
          {detail.arena}
        </h2>
        <span style={{
          fontFamily: 'var(--font-formula)',
          fontSize: '1.1rem',
          color: '#fb531a',
        }}>
          {detail.totalEvents} events totalt
        </span>

        {/* Per-year bar chart */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '8px', fontWeight: 600 }}>Events per år</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px' }}>
            {years.map(year => {
              const val = detail.perYear[year] || 0;
              return (
                <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fb531a', marginBottom: '4px' }}>{val}</span>
                  <div style={{
                    width: '100%',
                    maxWidth: '60px',
                    backgroundColor: val > 0 ? '#fb531a' : '#e5e0d3',
                    height: `${Math.max((val / maxYearVal) * 100, val > 0 ? 8 : 4)}%`,
                    borderRadius: '4px 4px 0 0',
                    minHeight: val > 0 ? '6px' : '3px',
                  }} />
                  <span style={{ fontSize: '0.72rem', color: '#999', marginTop: '4px' }}>{year}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sektorfördelning */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          margin: '0 0 1rem',
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
          color: '#111',
        }}>
          SEKTORFÖRDELNING
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {detail.sectorBreakdown
            .sort((a, b) => b.count - a.count)
            .map(({ sector, count }) => (
              <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: SECTOR_COLORS[sector] || '#999',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.9rem', color: '#333', flex: 1 }}>
                  {SECTOR_LABELS[sector] || sector}
                </span>
                <span style={{
                  backgroundColor: '#fb531a',
                  color: '#fff',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  {count}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Toppaktörer */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          margin: '0 0 1rem',
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
          color: '#111',
        }}>
          TOPPAKTÖRER ({Math.min(detail.topArrangers.length, 15)})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {detail.topArrangers.slice(0, 15).map(arr => (
            <div
              key={arr.id}
              onClick={() => { window.location.href = '/speakers?tab=aktorer&id=' + arr.id; }}
              onMouseEnter={() => setHoveredArranger(arr.id)}
              onMouseLeave={() => setHoveredArranger(null)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: hoveredArranger === arr.id ? '#edeadc' : '#f7f5e4',
                borderRadius: '6px',
                border: '1px solid #e0dcc8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'background-color 0.15s',
              }}
            >
              {arr.sector && (
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: SECTOR_COLORS[arr.sector] || '#999',
                  flexShrink: 0,
                }} />
              )}
              <span style={{ fontSize: '0.9rem', color: '#222', flex: 1, fontWeight: 500 }}>
                {arr.name}
              </span>
              <span style={{
                backgroundColor: '#fb531a',
                color: '#fff',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {arr.eventCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Vanligaste ämnen */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          margin: '0 0 1rem',
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
          color: '#111',
        }}>
          VANLIGASTE ÄMNEN ({Math.min(detail.topTopics.length, 10)})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {detail.topTopics.slice(0, 10).map(t => (
            <div
              key={t.topic}
              onClick={() => { window.location.href = '/speakers?tab=amnen&topic=' + encodeURIComponent(t.topic); }}
              onMouseEnter={() => setHoveredTopic(t.topic)}
              onMouseLeave={() => setHoveredTopic(null)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: hoveredTopic === t.topic ? '#edeadc' : '#f7f5e4',
                borderRadius: '6px',
                border: '1px solid #e0dcc8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'background-color 0.15s',
              }}
            >
              <span style={{ fontSize: '0.9rem', color: '#222', flex: 1, fontWeight: 500 }}>
                {formatTopic(t.topic)}
              </span>
              <span style={{
                backgroundColor: '#fb531a',
                color: '#fff',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {t.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Topptalare */}
      <div style={{
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{
          margin: '0 0 1rem',
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
          color: '#111',
        }}>
          TOPPTALARE ({Math.min(detail.topSpeakers.length, 15)})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {detail.topSpeakers.slice(0, 15).map(sp => (
            <div
              key={sp.id}
              onClick={() => { window.location.href = '/speakers?id=' + sp.id; }}
              onMouseEnter={() => setHoveredSpeaker(sp.id)}
              onMouseLeave={() => setHoveredSpeaker(null)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: hoveredSpeaker === sp.id ? '#edeadc' : '#f7f5e4',
                borderRadius: '6px',
                border: '1px solid #e0dcc8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'background-color 0.15s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', color: '#222', fontWeight: 500 }}>{sp.name}</div>
                {(sp.title || sp.org) && (
                  <div style={{ fontSize: '0.78rem', color: '#777', marginTop: '2px' }}>
                    {[sp.title, sp.org].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <span style={{
                backgroundColor: '#fb531a',
                color: '#fff',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}>
                {sp.eventCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ArenaGuidenPage() {
  const [arenas, setArenas] = useState<ArenaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('events');
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [selectedArena, setSelectedArena] = useState<string | null>(null);
  const [arenaDetail, setArenaDetail] = useState<ArenaDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard?view=arena-guide')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setArenas(data.arenas || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openArena = async (arenaName: string) => {
    setSelectedArena(arenaName);
    setDetailLoading(true);
    setArenaDetail(null);
    try {
      const res = await fetch(`/api/dashboard?view=arena-detail&arena=${encodeURIComponent(arenaName)}`);
      const data = await res.json();
      setArenaDetail(data);
    } catch { setArenaDetail(null); }
    setDetailLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeArena = () => {
    setSelectedArena(null);
    setArenaDetail(null);
  };

  const filtered = arenas
    .filter(a => filterType === 'all' || a.type === filterType)
    .filter(a => !sectorFilter || (a.sectorBreakdown[sectorFilter] || 0) > 0)
    .sort((a, b) => {
      if (sortBy === 'events') return b.totalEvents - a.totalEvents;
      if (sortBy === 'arrangers') return b.uniqueArrangers - a.uniqueArrangers;
      // diversity: most sectors first
      return b.sectorDiversity - a.sectorDiversity;
    });

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '20px',
    border: active ? '2px solid #fb531a' : '2px solid #ddd',
    backgroundColor: active ? '#fb531a' : '#fff',
    color: active ? '#fff' : '#444',
    fontWeight: active ? 700 : 400,
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  });

  const sortBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '20px',
    border: active ? '2px solid #457b9d' : '2px solid #ddd',
    backgroundColor: active ? '#457b9d' : '#fff',
    color: active ? '#fff' : '#444',
    fontWeight: active ? 700 : 400,
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ backgroundColor: 'var(--rs-natur, #f7f5e4)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem 0',
        borderBottom: '4px solid #fb531a',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
          <a href="/" style={{
            color: '#fb531a',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}>
            ← Tillbaka till dashboarden
          </a>
          <h1 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(2rem, 6vw, 3.5rem)',
            margin: '0.5rem 0 0.25rem',
            letterSpacing: '0.03em',
          }}>
            ARENAGUIDEN
          </h1>
          <p style={{
            margin: 0,
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: '#ccc',
            fontWeight: 400,
          }}>
            Var hamnar du rätt i Almedalen?
          </p>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Intro */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          lineHeight: 1.6,
          fontSize: '1.05rem',
          color: '#333',
        }}>
          <p style={{ margin: 0 }}>
            Almedalens 50+ arenor har alla sin egen karaktär. Vissa domineras av en enda sektor —
            fackets arena, branschens tält, partiernas scen. Andra är genuina mötesplatser där
            näringsliv, civilsamhälle och offentlig sektor blandas. Här hittar du rätt arena för ditt syfte.
          </p>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1.75rem',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginRight: '0.25rem' }}>
              Visa:
            </span>
            {([
              ['all', 'Alla'],
              ['pluralistic', 'Pluralistiska'],
              ['dominated', 'Sektordominerade'],
              ['mixed', 'Blandade'],
            ] as [FilterType, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterType(val)}
                style={filterBtnStyle(filterType === val)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginRight: '0.25rem' }}>
              Sortera:
            </span>
            {([
              ['events', 'Flest events'],
              ['arrangers', 'Flest arrangörer'],
              ['diversity', 'Mest pluralistisk'],
            ] as [SortType, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSortBy(val)}
                style={sortBtnStyle(sortBy === val)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#555', marginRight: '0.25rem' }}>
              Sektor:
            </span>
            <button
              onClick={() => setSectorFilter('')}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '20px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: !sectorFilter ? 700 : 400,
                transition: 'all 0.15s',
                border: !sectorFilter ? '2px solid #fb531a' : '2px solid #ddd',
                backgroundColor: !sectorFilter ? '#fb531a' : '#fff',
                color: !sectorFilter ? '#fff' : '#444',
              }}
            >
              Alla
            </button>
            {Object.entries(SECTOR_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSectorFilter(sectorFilter === key ? '' : key)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: sectorFilter === key ? 700 : 400,
                  transition: 'all 0.15s',
                  border: sectorFilter === key ? `2px solid ${SECTOR_COLORS[key]}` : '2px solid #ddd',
                  backgroundColor: sectorFilter === key ? SECTOR_COLORS[key] : '#fff',
                  color: sectorFilter === key ? '#fff' : '#444',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px',
            color: '#666',
            fontSize: '1rem',
          }}>
            Laddar arenadata...
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fff0f0',
            border: '1px solid #e63946',
            borderRadius: '8px',
            padding: '1rem',
            color: '#b5222e',
          }}>
            Fel vid laddning: {error}
          </div>
        )}

        {/* Detail view or Grid */}
        {!loading && !error && selectedArena && (
          detailLoading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px',
              color: '#666',
              fontSize: '1rem',
            }}>
              Laddar arenainfo...
            </div>
          ) : arenaDetail ? (
            <ArenaDetailView detail={arenaDetail} onClose={closeArena} />
          ) : (
            <div>
              <button
                onClick={closeArena}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fb531a',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.5rem 0',
                  fontFamily: 'inherit',
                }}
              >
                &larr; Tillbaka till arenalistan
              </button>
              <p style={{ color: '#888', marginTop: '1rem' }}>Kunde inte ladda arenainfo.</p>
            </div>
          )
        )}

        {!loading && !error && !selectedArena && (
          <>
            {/* Result count */}
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#777' }}>
              Visar {filtered.length} av {arenas.length} arenor
            </p>

            {/* Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.25rem',
            }}>
              {filtered.map(arena => (
                <ArenaCard key={arena.name} arena={arena} onClick={() => openArena(arena.name)} />
              ))}
            </div>

            {/* Legend */}
            <div style={{
              marginTop: '2.5rem',
              backgroundColor: '#fff',
              borderRadius: '10px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <h3 style={{
                margin: '0 0 0.75rem',
                fontFamily: 'var(--font-formula)',
                fontSize: '1rem',
                color: '#111',
              }}>
                SEKTORFÄRGER
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem 1.25rem', flexWrap: 'wrap' }}>
                {Object.entries(SECTOR_LABELS).map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: SECTOR_COLORS[key] || '#999',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '0.8rem', color: '#444' }}>{label}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '1rem 0 0', fontSize: '0.78rem', color: '#888' }}>
                Typ definieras av dominansprocent: Pluralistisk = dominant sektor &lt;35% av events,
                Dominerad = &gt;60%, Blandad = däremellan. Baserat på data 2022–2026.
              </p>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
