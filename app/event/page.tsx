'use client';

import { useRef, useEffect, useState } from 'react';

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

type Node = {
  id: number;
  name: string;
  sector: string;
  events: number;
  topTopics: string[];
};
type Edge = { source: number; target: number; weight: number };
type Stats = {
  totalOrgs: number;
  totalEvents: number;
  totalConnections: number;
  totalSharedSpeakers: number;
  sectors: Record<string, number>;
};

export default function EventPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    fetch('/api/event-network')
      .then(r => r.json())
      .then(data => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setStats(data.stats || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        padding: 'clamp(2rem, 6vw, 4rem) clamp(1rem, 4vw, 3rem) clamp(1rem, 3vw, 2rem)',
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
          Reform Society presenterar
        </p>
        <h1 style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(2.5rem, 8vw, 5rem)',
          lineHeight: 1,
          margin: 0,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 0%, #999 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ERT ALMEDALSNÄTVERK
        </h1>
        <p style={{
          fontSize: 'clamp(0.9rem, 2vw, 1.15rem)',
          color: '#999',
          marginTop: '1rem',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.5,
        }}>
          {stats ? stats.totalOrgs : '39'} organisationer. 4 {'\u00e5'}r av data. S{'\u00e5'} h{'\u00e4'}nger ni ihop.
        </p>
      </header>

      {/* Network Graph */}
      <section style={{ padding: '0 clamp(0.5rem, 2vw, 2rem)' }}>
        <div style={{
          backgroundColor: '#111',
          borderRadius: '12px',
          border: '1px solid #222',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {loading ? (
            <div style={{
              height: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '0.9rem',
            }}>
              Laddar n{'\u00e4'}tverksdata...
            </div>
          ) : (
            <NetworkGraph
              nodes={nodes}
              edges={edges}
              onNodeSelect={setSelectedNode}
            />
          )}
          {/* Legend */}
          {!loading && (
            <div style={{
              position: 'absolute',
              bottom: '0.75rem',
              left: '0.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem 0.8rem',
              fontSize: '0.65rem',
              color: '#888',
            }}>
              {Object.entries(SECTOR_COLORS).map(([key, color]) => {
                const hasNodes = nodes.some(n => n.sector === key);
                if (!hasNodes) return null;
                return (
                  <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: color, display: 'inline-block',
                    }} />
                    {SECTOR_LABELS[key] || key}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Stats Bar */}
      {stats && (
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1px',
          backgroundColor: '#222',
          margin: 'clamp(1rem, 3vw, 2rem) clamp(0.5rem, 2vw, 2rem)',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #222',
        }}>
          {[
            { label: 'Organisationer', value: stats.totalOrgs },
            { label: 'Seminarier totalt', value: stats.totalEvents },
            { label: 'Kopplingar', value: stats.totalConnections },
            { label: 'Gemensamma talare', value: stats.totalSharedSpeakers },
          ].map(s => (
            <div key={s.label} style={{
              backgroundColor: '#111',
              padding: 'clamp(1rem, 2vw, 1.5rem)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-formula)',
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                color: '#ff6632',
                lineHeight: 1,
              }}>
                {s.value}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: '#888',
                marginTop: '0.35rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Sector Bar */}
      {stats && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginBottom: 'clamp(1.5rem, 4vw, 3rem)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            color: '#fff',
            marginBottom: '0.75rem',
          }}>
            Sektorbalans i rummet
          </h2>
          <div style={{
            display: 'flex',
            height: '32px',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #333',
          }}>
            {Object.entries(stats.sectors)
              .sort((a, b) => b[1] - a[1])
              .map(([sector, count]) => {
                const pct = (count / stats.totalOrgs) * 100;
                return (
                  <div
                    key={sector}
                    title={`${SECTOR_LABELS[sector] || sector}: ${count}`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: SECTOR_COLORS[sector] || '#555',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      color: '#000',
                      fontWeight: 700,
                      minWidth: pct > 8 ? 'auto' : '0',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pct > 10 ? `${SECTOR_LABELS[sector] || sector}` : ''}
                  </div>
                );
              })}
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '0.5rem',
          }}>
            {Object.entries(stats.sectors)
              .sort((a, b) => b[1] - a[1])
              .map(([sector, count]) => (
                <span key={sector} style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    backgroundColor: SECTOR_COLORS[sector] || '#555',
                    display: 'inline-block',
                  }} />
                  {SECTOR_LABELS[sector] || sector} ({count})
                </span>
              ))}
          </div>
        </section>
      )}

      {/* Organization Cards */}
      {!loading && nodes.length > 0 && (
        <section style={{
          padding: '0 clamp(0.5rem, 2vw, 2rem)',
          marginBottom: 'clamp(2rem, 5vw, 4rem)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            color: '#fff',
            marginBottom: '1rem',
          }}>
            Alla organisationer
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.75rem',
          }}>
            {[...nodes]
              .sort((a, b) => b.events - a.events)
              .map(node => {
                const connections = edges.filter(
                  e => e.source === node.id || e.target === node.id
                );
                return (
                  <div
                    key={node.id}
                    style={{
                      backgroundColor: selectedNode?.id === node.id ? '#222' : '#1a1a1a',
                      border: `1px solid ${selectedNode?.id === node.id ? '#ff6632' : '#333'}`,
                      borderRadius: '10px',
                      padding: 'clamp(0.75rem, 2vw, 1rem)',
                      transition: 'border-color 0.2s, background-color 0.2s',
                      cursor: 'default',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        margin: 0,
                        lineHeight: 1.2,
                        flex: 1,
                      }}>
                        {node.name}
                      </h3>
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '99px',
                        backgroundColor: SECTOR_COLORS[node.sector] || '#555',
                        color: ['fackförbund', 'akademi'].includes(node.sector) ? '#000' : '#fff',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginLeft: '0.5rem',
                      }}>
                        {SECTOR_LABELS[node.sector] || node.sector}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      fontSize: '0.75rem',
                      color: '#999',
                      marginBottom: node.topTopics.length > 0 ? '0.5rem' : 0,
                    }}>
                      <span><strong style={{ color: '#fff' }}>{node.events}</strong> seminarier</span>
                      <span><strong style={{ color: '#fff' }}>{connections.length}</strong> kopplingar</span>
                    </div>
                    {node.topTopics.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {node.topTopics.map(topic => (
                          <span key={topic} style={{
                            fontSize: '0.6rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: '#2a2a2a',
                            color: '#bbb',
                            border: '1px solid #3a3a3a',
                          }}>
                            {TOPIC_LABELS[topic] || topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: 'clamp(2rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem)',
        borderTop: '1px solid #222',
        color: '#666',
        fontSize: '0.75rem',
        lineHeight: 1.6,
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          Data: <span style={{ color: '#ff6632' }}>Almedalsdata.se</span> — Reform Society, 2026
        </div>
        <div>
          Baserat p{'\u00e5'} 9 407 seminarier, 16 509 talare, 2022–2025.
        </div>
      </footer>
    </div>
  );
}

/* ─── Network Graph sub-component ─── */

function NetworkGraph({
  nodes,
  edges,
  onNodeSelect,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodeSelect: (node: Node | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: Node } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !nodes.length) return;

    let destroyed = false;

    import('d3').then(d3 => {
      if (destroyed) return;

      const container = containerRef.current!;
      const isMobile = container.clientWidth < 600;
      const actualWidth = container.clientWidth;
      const actualHeight = isMobile ? 500 : 700;

      const svg = d3.select(svgRef.current!);
      svg.selectAll('*').remove();

      svg
        .attr('width', actualWidth)
        .attr('height', actualHeight)
        .attr('viewBox', `0 0 ${actualWidth} ${actualHeight}`);

      // Defs for glow effect
      const defs = svg.append('defs');
      const filter = defs.append('filter').attr('id', 'glow');
      filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

      const g = svg.append('g');

      // Zoom
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);

      // Scales
      const maxEvents = Math.max(...nodes.map(n => n.events), 1);
      const radiusScale = d3.scaleSqrt().domain([0, maxEvents]).range([6, isMobile ? 24 : 30]);
      const maxWeight = Math.max(...edges.map(e => e.weight), 1);
      const widthScale = d3.scaleLinear().domain([1, maxWeight]).range([0.5, 4]);

      const padding = 40;

      // Simulation
      const simNodes = nodes.map(n => ({ ...n })) as any[];
      const simEdges = edges.map(e => ({ ...e })) as any[];

      const simulation = d3.forceSimulation(simNodes)
        .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(isMobile ? 60 : 80).strength(0.4))
        .force('charge', d3.forceManyBody().strength(isMobile ? -120 : -200))
        .force('center', d3.forceCenter(actualWidth / 2, actualHeight / 2))
        .force('collision', d3.forceCollide().radius((d: any) => radiusScale(d.events) + 4))
        .force('x', d3.forceX(actualWidth / 2).strength(0.04))
        .force('y', d3.forceY(actualHeight / 2).strength(0.04));

      let pinnedId: number | null = null;

      function highlightNode(d: any) {
        node.attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isConnected ? 1 : 0.12;
        });

        nodeGlow.attr('opacity', (n: any) => n.id === d.id ? 0.6 : 0);

        link
          .attr('stroke-opacity', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 0.7 : 0.02
          )
          .attr('stroke', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? '#ff6632' : '#555'
          );

        label.attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isConnected ? 0.9 : 0;
        });
      }

      function resetHighlight() {
        node.attr('opacity', 1);
        nodeGlow.attr('opacity', 0);
        link.attr('stroke-opacity', 0.15).attr('stroke', '#555');
        label.attr('opacity', (d: any) => d.events >= maxEvents * 0.2 ? 0.9 : 0);
      }

      // Draw edges
      const link = g.append('g')
        .selectAll('line')
        .data(simEdges)
        .join('line')
        .attr('stroke', '#555')
        .attr('stroke-opacity', 0.15)
        .attr('stroke-width', (d: any) => widthScale(d.weight));

      // Glow layer (behind nodes)
      const nodeGlow = g.append('g')
        .selectAll('circle')
        .data(simNodes)
        .join('circle')
        .attr('r', (d: any) => radiusScale(d.events) + 6)
        .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#555')
        .attr('opacity', 0)
        .attr('filter', 'url(#glow)');

      // Draw nodes
      const node = g.append('g')
        .selectAll('circle')
        .data(simNodes)
        .join('circle')
        .attr('r', (d: any) => radiusScale(d.events))
        .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#555')
        .attr('stroke', '#000')
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer')
        .on('mouseover', function (_event: any, d: any) {
          if (pinnedId !== null) return;
          highlightNode(d);
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip({
            x: _event.clientX - rect.left,
            y: _event.clientY - rect.top - 10,
            node: d,
          });
        })
        .on('mouseout', function () {
          if (pinnedId !== null) return;
          resetHighlight();
          setTooltip(null);
        })
        .on('click', function (_event: any, d: any) {
          _event.stopPropagation();
          if (pinnedId === d.id) {
            pinnedId = null;
            resetHighlight();
            setTooltip(null);
            onNodeSelect(null);
            return;
          }
          pinnedId = d.id;
          highlightNode(d);
          setTooltip(null);
          onNodeSelect(d);
        })
        .call(d3.drag<any, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
        );

      // Background click
      svg.on('click', () => {
        if (pinnedId !== null) {
          pinnedId = null;
          resetHighlight();
          setTooltip(null);
          onNodeSelect(null);
        }
      });

      // Labels
      const label = g.append('g')
        .selectAll('text')
        .data(simNodes)
        .join('text')
        .attr('font-size', isMobile ? '7px' : '9px')
        .attr('fill', '#ddd')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .attr('dy', (d: any) => -radiusScale(d.events) - 5)
        .attr('opacity', (d: any) => d.events >= maxEvents * 0.2 ? 0.9 : 0)
        .text((d: any) => d.name.length > 22 ? d.name.substring(0, 20) + '...' : d.name);

      simulation.on('tick', () => {
        for (const d of simNodes) {
          const r = radiusScale(d.events);
          d.x = Math.max(padding + r, Math.min(actualWidth - padding - r, d.x));
          d.y = Math.max(padding + r, Math.min(actualHeight - padding - r, d.y));
        }

        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
        node
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
        nodeGlow
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
        label
          .attr('x', (d: any) => d.x)
          .attr('y', (d: any) => d.y);
      });

      // Cleanup
      return () => { simulation.stop(); };
    });

    return () => { destroyed = true; };
  }, [nodes, edges, onNodeSelect]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          minHeight: '500px',
        }}
      />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          padding: '0.4rem 0.7rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          border: '1px solid #333',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div>{tooltip.node.name}</div>
          <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 400 }}>
            {tooltip.node.events} seminarier &middot; {SECTOR_LABELS[tooltip.node.sector] || tooltip.node.sector}
          </div>
        </div>
      )}
    </div>
  );
}
