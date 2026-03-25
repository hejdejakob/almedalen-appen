'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

const PARTY_COLORS: Record<string, string> = {
  V: '#da291c',
  SAP: '#ed1b34',
  MP: '#83cf39',
  C: '#009933',
  L: '#006ab3',
  M: '#1b49dd',
  KD: '#231977',
  SD: '#dddd00',
};

type Org = {
  id: number;
  name: string;
  sector: string | null;
  lrecon: number;
  galtan: number;
  politicians: number;
  events: number;
  partyBreakdown: Record<string, number>;
};

type Party = {
  party: string;
  lrecon: number;
  galtan: number;
  label: string;
};

type GaltanData = {
  organizations: Org[];
  parties: Party[];
  stats: { totalOrgs: number; totalPoliticians: number };
};

export default function GaltanPage() {
  const [data, setData] = useState<GaltanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Org | null>(null);
  const [hovered, setHovered] = useState<Org | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/galtan')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const margin = { top: 40, right: 40, bottom: 60, left: 70 };
  const width = 900;
  const height = 600;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const scaleX = useCallback((v: number) => margin.left + (v / 10) * plotW, [plotW, margin.left]);
  const scaleY = useCallback((v: number) => margin.top + (v / 10) * plotH, [plotH, margin.top]);

  const handleMouseMove = useCallback((e: React.MouseEvent, org: Org) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    setHovered(org);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', opacity: 0.6 }}>Laddar data...</p>
      </div>
    );
  }

  if (!data || !data.organizations.length) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', opacity: 0.6 }}>Ingen data tillgänglig.</p>
      </div>
    );
  }

  const { organizations, parties, stats } = data;

  // Top lists
  const mostGal = [...organizations].sort((a, b) => a.galtan - b.galtan).slice(0, 10);
  const mostTan = [...organizations].sort((a, b) => b.galtan - a.galtan).slice(0, 10);
  const mostLeft = [...organizations].sort((a, b) => a.lrecon - b.lrecon).slice(0, 10);
  const mostRight = [...organizations].sort((a, b) => b.lrecon - a.lrecon).slice(0, 10);

  // Grid lines at 5
  const centerX = scaleX(5);
  const centerY = scaleY(5);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff' }}>
      {/* Header */}
      <header style={{ maxWidth: 1200, margin: '0 auto', padding: '3rem 2rem 1rem' }}>
        <a href="/" style={{ color: '#999', textDecoration: 'none', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
          &larr; Tillbaka
        </a>
        <h1 style={{
          fontFamily: '"Formula Condensed", sans-serif',
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          margin: '1rem 0 0.5rem',
          lineHeight: 1,
        }}>
          POLITISK PROFIL
        </h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.15rem', color: '#ccc', maxWidth: 700, lineHeight: 1.5 }}>
          Var hamnar Almedalens aktörer på den ideologiska kartan?
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
          Baserat på CHES 2024 + vilka partipolitiker organisationer bjuder in till sina paneler
        </p>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', color: '#666', marginTop: '0.75rem' }}>
          {stats.totalOrgs} organisationer &middot; {stats.totalPoliticians} politiker &middot; 2022&ndash;2025
        </p>
      </header>

      {/* Scatter Plot */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 2rem' }} ref={containerRef}>
        <div style={{ position: 'relative' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', maxHeight: '600px' }}
          >
            {/* Background */}
            <rect x={0} y={0} width={width} height={height} fill="#000" />

            {/* Grid */}
            <line x1={margin.left} y1={centerY} x2={width - margin.right} y2={centerY} stroke="#333" strokeDasharray="4 4" />
            <line x1={centerX} y1={margin.top} x2={centerX} y2={height - margin.bottom} stroke="#333" strokeDasharray="4 4" />

            {/* Axes */}
            <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#555" />
            <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#555" />

            {/* X-axis ticks */}
            {[0, 2, 4, 5, 6, 8, 10].map(v => (
              <g key={`xt-${v}`}>
                <line x1={scaleX(v)} y1={height - margin.bottom} x2={scaleX(v)} y2={height - margin.bottom + 5} stroke="#555" />
                <text x={scaleX(v)} y={height - margin.bottom + 18} fill="#888" fontSize={11} textAnchor="middle" fontFamily="Space Mono, monospace">{v}</text>
              </g>
            ))}

            {/* Y-axis ticks */}
            {[0, 2, 4, 5, 6, 8, 10].map(v => (
              <g key={`yt-${v}`}>
                <line x1={margin.left - 5} y1={scaleY(v)} x2={margin.left} y2={scaleY(v)} stroke="#555" />
                <text x={margin.left - 10} y={scaleY(v) + 4} fill="#888" fontSize={11} textAnchor="end" fontFamily="Space Mono, monospace">{v}</text>
              </g>
            ))}

            {/* X-axis labels */}
            <text x={margin.left + 10} y={height - margin.bottom + 42} fill="#aaa" fontSize={12} fontFamily="Inter, sans-serif" fontWeight={600}>
              VÄNSTER
            </text>
            <text x={width - margin.right - 10} y={height - margin.bottom + 42} fill="#aaa" fontSize={12} fontFamily="Inter, sans-serif" fontWeight={600} textAnchor="end">
              HÖGER
            </text>
            <text x={width / 2} y={height - 5} fill="#666" fontSize={11} fontFamily="Inter, sans-serif" textAnchor="middle">
              Vänster–Höger (lrecon)
            </text>

            {/* Y-axis labels */}
            <text x={15} y={margin.top + 15} fill="#aaa" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>
              GAL
            </text>
            <text x={15} y={margin.top + 28} fill="#666" fontSize={9} fontFamily="Inter, sans-serif">
              (progressiv)
            </text>
            <text x={15} y={height - margin.bottom - 15} fill="#aaa" fontSize={11} fontFamily="Inter, sans-serif" fontWeight={600}>
              TAN
            </text>
            <text x={15} y={height - margin.bottom - 2} fill="#666" fontSize={9} fontFamily="Inter, sans-serif">
              (konservativ)
            </text>

            {/* Quadrant labels */}
            <text x={margin.left + 15} y={margin.top + 18} fill="#444" fontSize={11} fontFamily="Inter, sans-serif">
              Frihetlig vänster
            </text>
            <text x={width - margin.right - 15} y={margin.top + 18} fill="#444" fontSize={11} fontFamily="Inter, sans-serif" textAnchor="end">
              Frihetlig höger
            </text>
            <text x={margin.left + 15} y={height - margin.bottom - 10} fill="#444" fontSize={11} fontFamily="Inter, sans-serif">
              Traditionell vänster
            </text>
            <text x={width - margin.right - 15} y={height - margin.bottom - 10} fill="#444" fontSize={11} fontFamily="Inter, sans-serif" textAnchor="end">
              Traditionell höger
            </text>

            {/* Party markers */}
            {parties.map(p => (
              <g key={p.party}>
                <circle
                  cx={scaleX(p.lrecon)}
                  cy={scaleY(p.galtan)}
                  r={28}
                  fill={PARTY_COLORS[p.party] || '#666'}
                  opacity={0.2}
                  stroke={PARTY_COLORS[p.party] || '#666'}
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                />
                <text
                  x={scaleX(p.lrecon)}
                  y={scaleY(p.galtan) + 4}
                  fill={PARTY_COLORS[p.party] || '#fff'}
                  fontSize={12}
                  fontFamily="Space Mono, monospace"
                  fontWeight={700}
                  textAnchor="middle"
                  opacity={0.9}
                >
                  {p.party}
                </text>
              </g>
            ))}

            {/* Organization dots */}
            {organizations.map(org => {
              const isSelected = selected?.id === org.id;
              const isHovered = hovered?.id === org.id;
              const r = Math.max(3, Math.min(8, Math.sqrt(org.politicians) * 1.5));
              return (
                <circle
                  key={org.id}
                  cx={scaleX(org.lrecon)}
                  cy={scaleY(org.galtan)}
                  r={isSelected || isHovered ? r + 2 : r}
                  fill={SECTOR_COLORS[org.sector || ''] || '#999'}
                  opacity={isSelected || isHovered ? 1 : 0.7}
                  stroke={isSelected ? '#fff' : isHovered ? '#fff' : 'none'}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
                  onClick={() => setSelected(org)}
                  onMouseEnter={(e) => handleMouseMove(e, org)}
                  onMouseMove={(e) => handleMouseMove(e, org)}
                  onMouseLeave={() => { setHovered(null); setTooltip(null); }}
                />
              );
            })}
          </svg>

          {/* Tooltip */}
          {hovered && tooltip && (
            <div style={{
              position: 'absolute',
              left: tooltip.x + 15,
              top: tooltip.y - 10,
              backgroundColor: 'rgba(20,20,20,0.95)',
              border: '1px solid #444',
              borderRadius: 8,
              padding: '10px 14px',
              pointerEvents: 'none',
              zIndex: 10,
              maxWidth: 280,
              fontFamily: 'Inter, sans-serif',
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>{hovered.name}</div>
              <div style={{ fontSize: '0.75rem', color: SECTOR_COLORS[hovered.sector || ''] || '#999', marginBottom: 6 }}>
                {SECTOR_LABELS[hovered.sector || ''] || hovered.sector || 'Okänd sektor'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#aaa', fontFamily: 'Space Mono, monospace' }}>
                LR: {hovered.lrecon.toFixed(2)} &middot; GT: {hovered.galtan.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
                {hovered.politicians} politiker &middot; {hovered.events} event
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {Object.entries(hovered.partyBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([party, count]) => (
                    <span key={party} style={{
                      fontSize: '0.7rem',
                      padding: '1px 5px',
                      borderRadius: 3,
                      backgroundColor: PARTY_COLORS[party] || '#555',
                      color: party === 'SD' ? '#000' : '#fff',
                      fontFamily: 'Space Mono, monospace',
                    }}>
                      {party}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Sector legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.2rem', marginTop: '1rem', justifyContent: 'center' }}>
          {Object.entries(SECTOR_LABELS).filter(([k]) => k !== 'parti').map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: SECTOR_COLORS[key] }} />
              <span style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'Inter, sans-serif' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{
          maxWidth: 1200,
          margin: '1.5rem auto',
          padding: '0 2rem',
        }}>
          <div style={{
            backgroundColor: '#111',
            border: '1px solid #333',
            borderRadius: 12,
            padding: '1.5rem 2rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontFamily: '"Formula Condensed", sans-serif', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                  {selected.name}
                </h3>
                <span style={{
                  display: 'inline-block',
                  marginTop: 4,
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: SECTOR_COLORS[selected.sector || ''] || '#555',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {SECTOR_LABELS[selected.sector || ''] || selected.sector || 'Okänd sektor'}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none',
                  border: '1px solid #555',
                  color: '#999',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.8rem',
                }}
              >
                Stäng
              </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#aaa', fontFamily: 'Inter, sans-serif', margin: '0 0 0.75rem' }}>
                Baserat på {selected.politicians} politiker från {Object.keys(selected.partyBreakdown).length} partier
              </p>

              {/* Party breakdown bar */}
              <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', width: '100%' }}>
                {Object.entries(selected.partyBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([party, count]) => {
                    const pct = (count / selected.politicians) * 100;
                    return (
                      <div
                        key={party}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PARTY_COLORS[party] || '#555',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: pct > 8 ? undefined : 0,
                        }}
                      >
                        {pct > 8 && (
                          <span style={{
                            fontSize: '0.7rem',
                            fontFamily: 'Space Mono, monospace',
                            fontWeight: 700,
                            color: party === 'SD' ? '#000' : '#fff',
                          }}>
                            {party} ({count})
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Party legend below bar for small segments */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(selected.partyBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([party, count]) => (
                    <span key={party} style={{ fontSize: '0.75rem', color: '#aaa', fontFamily: 'Space Mono, monospace' }}>
                      <span style={{ color: PARTY_COLORS[party] || '#888' }}>&#9679;</span> {party}: {count}
                    </span>
                  ))}
              </div>

              <div style={{ marginTop: '0.75rem', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', color: '#888' }}>
                Vänster–Höger: {selected.lrecon.toFixed(2)} &middot; GAL–TAN: {selected.galtan.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top lists */}
      <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <TopList title="Mest GAL (progressiv)" items={mostGal} valueKey="galtan" format={v => v.toFixed(2)} />
          <TopList title="Mest TAN (konservativ)" items={mostTan} valueKey="galtan" format={v => v.toFixed(2)} />
          <TopList title="Mest vänster" items={mostLeft} valueKey="lrecon" format={v => v.toFixed(2)} />
          <TopList title="Mest höger" items={mostRight} valueKey="lrecon" format={v => v.toFixed(2)} />
        </div>
      </div>

      {/* Method note */}
      <div style={{ maxWidth: 1200, margin: '2rem auto 0', padding: '0 2rem 2rem' }}>
        <div style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: 8,
          padding: '1.25rem 1.5rem',
        }}>
          <h4 style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#888', margin: '0 0 0.5rem' }}>
            Metod
          </h4>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#666', lineHeight: 1.6, margin: 0 }}>
            Varje organisations position beräknas som ett viktat medelvärde av CHES 2024-poäng för de riksdagspartier vars
            företrädare medverkat i organisationens Almedalsseminarier 2022–2025. Organisationer med färre än 3 unika
            politikertalare exkluderas. Positionen visar politisk exponering, inte nödvändigtvis ideologisk hemvist.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function TopList({ title, items, valueKey, format }: {
  title: string;
  items: Org[];
  valueKey: 'galtan' | 'lrecon';
  format: (v: number) => string;
}) {
  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      border: '1px solid #222',
      borderRadius: 8,
      padding: '1rem 1.25rem',
    }}>
      <h4 style={{
        fontFamily: '"Formula Condensed", sans-serif',
        fontSize: '1rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        margin: '0 0 0.75rem',
        color: '#ccc',
      }}>
        {title}
      </h4>
      {items.map((org, i) => (
        <div key={org.id} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 0',
          borderBottom: i < items.length - 1 ? '1px solid #1a1a1a' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#555', width: 18, flexShrink: 0 }}>
              {i + 1}.
            </span>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: SECTOR_COLORS[org.sector || ''] || '#555',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.8rem',
              color: '#ccc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {org.name}
            </span>
          </div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', color: '#888', flexShrink: 0, marginLeft: 8 }}>
            {format(org[valueKey])}
          </span>
        </div>
      ))}
    </div>
  );
}
