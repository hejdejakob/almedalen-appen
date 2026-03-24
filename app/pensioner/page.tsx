'use client';

import { useEffect, useRef, useState } from 'react';

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

function formatTopic(t: string): string {
  return t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

type Arranger = { id: number; name: string; sector: string; eventCount: number };
type Speaker = { id: number; name: string; title: string | null; org: string | null; category: string | null; eventCount: number };
type TopicItem = { topic: string; count: number };
type SectorItem = { sector: string; count: number };
type SampleEvent = { id: number; year: number; title: string };
type PensionData = {
  totalEvents: number;
  perYear: Record<string, number> | { year: number; count: number }[];
  topArrangers: Arranger[];
  topSpeakers: Speaker[];
  topicDistribution: TopicItem[];
  sectorBreakdown: SectorItem[];
  sentiment: { avg: number; pos: number; neu: number; neg: number; total: number };
  sampleEvents: SampleEvent[];
  network?: {
    nodes: { id: number; name: string; sector: string; events: number }[];
    edges: { source: number; target: number; weight: number }[];
  };
};

export default function PensionerPage() {
  const [data, setData] = useState<PensionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard?view=pension-deep')
      .then(r => { if (!r.ok) throw new Error('Kunde inte ladda data'); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <div style={{ backgroundColor: '#000', color: '#ff6632', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      {error}
    </div>
  );

  if (!data) return (
    <div style={{ backgroundColor: '#000', color: '#999', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      Laddar pensionsdata...
    </div>
  );

  // Normalize perYear: API may return array [{year,count}] or object {2022: N}
  const perYearObj: Record<string, number> = {};
  if (Array.isArray(data.perYear)) {
    for (const item of data.perYear) perYearObj[String(item.year)] = item.count;
  } else {
    for (const [k, v] of Object.entries(data.perYear)) perYearObj[k] = v;
  }
  const years = ['2022', '2023', '2024', '2025'];
  const maxYearCount = Math.max(...years.map(y => perYearObj[y] || 0));
  const maxTopicCount = Math.max(...data.topicDistribution.map(t => t.count), 1);
  const maxSectorCount = Math.max(...data.sectorBreakdown.map(s => s.count), 1);
  const top15Arrangers = data.topArrangers.slice(0, 15);
  const top15Speakers = data.topSpeakers.slice(0, 15);
  const top20Events = data.sampleEvents.slice(0, 20);

  const sentimentColor = data.sentiment.avg >= 0 ? '#8ac926' : '#e63946';
  const sentimentLabel = data.sentiment.avg >= 0.05 ? 'positivt' : data.sentiment.avg <= -0.05 ? 'negativt' : 'neutralt';

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* 1. HEADER */}
        <header style={{ marginBottom: '3rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            color: '#ff6632',
            margin: 0,
            lineHeight: 1.1,
            textTransform: 'uppercase',
          }}>
            PENSIONER I ALMEDALEN
          </h1>
          <p style={{ color: '#999', fontSize: '1rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
            {data.totalEvents} seminarier &middot; 2022&ndash;2025 &middot; Vem driver pensionsfr&aring;gan?
          </p>
        </header>

        {/* 2. PENSIONSNÄTVERKET */}
        {data.network && data.network.nodes.length > 0 && (
          <Section title="PENSIONSN&Auml;TVERKET">
            <p style={{ color: '#999', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem', lineHeight: 1.5 }}>
              Organisationer som delar pensionsseminarier. Linjer visar samarbeten &mdash; tjockare linje = fler gemensamma event.
            </p>
            <PensionNetwork
              nodes={data.network.nodes}
              edges={data.network.edges}
            />
          </Section>
        )}

        {/* 3. TRENDEN */}
        <Section title="TRENDEN">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: 200, marginBottom: '1rem' }}>
            {years.map(y => {
              const count = perYearObj[y] || 0;
              const height = maxYearCount > 0 ? (count / maxYearCount) * 160 : 0;
              return (
                <div key={y} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{count}</span>
                  <div style={{ width: '100%', height, backgroundColor: '#ff6632', borderRadius: '4px 4px 0 0', minHeight: count > 0 ? 8 : 0 }} />
                  <span style={{ fontSize: '0.85rem', color: '#999', marginTop: 6 }}>{y}</span>
                </div>
              );
            })}
          </div>
          <p style={{ color: '#999', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
            Pensionsfr&aring;gan dippade 2024 men har gjort stark comeback 2025.
          </p>
        </Section>

        {/* 3. VEM DRIVER FRÅGAN? */}
        <Section title="VEM DRIVER FR&Aring;GAN?">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {top15Arrangers.map((a, i) => (
              <div
                key={a.id}
                onClick={() => { window.location.href = '/speakers?tab=aktorer&id=' + a.id; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
                  padding: '0.75rem 1rem', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#ff6632')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
              >
                <span style={{ color: '#666', fontSize: '0.8rem', minWidth: 20, textAlign: 'right' }}>{i + 1}</span>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: SECTOR_COLORS[a.sector] || '#666',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#999' }}>{SECTOR_LABELS[a.sector] || a.sector}</div>
                </div>
                <span style={{
                  backgroundColor: '#ff6632', color: '#000', fontWeight: 700,
                  fontSize: '0.8rem', padding: '2px 8px', borderRadius: 4,
                }}>
                  {a.eventCount}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. PENSIONSRÖSTERNA */}
        <Section title="PENSIONSR&Ouml;STERNA">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {top15Speakers.map((s, i) => (
              <div
                key={s.id}
                onClick={() => { window.location.href = '/speakers?id=' + s.id; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
                  padding: '0.75rem 1rem', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#ff6632')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#333')}
              >
                <span style={{ color: '#666', fontSize: '0.8rem', minWidth: 20, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[s.title, s.org].filter(Boolean).join(' \u00b7 ') || '\u2014'}
                  </div>
                </div>
                {s.category && (
                  <span style={{
                    fontSize: '0.7rem', color: '#999', border: '1px solid #444',
                    borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap',
                  }}>
                    {s.category}
                  </span>
                )}
                <span style={{
                  backgroundColor: '#ff6632', color: '#000', fontWeight: 700,
                  fontSize: '0.8rem', padding: '2px 8px', borderRadius: 4,
                }}>
                  {s.eventCount}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. ÄMNESKLUSTER */}
        <Section title="&Auml;MNESKLUSTER">
          <p style={{ color: '#999', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
            Pensionsseminarier klassificeras under dessa &auml;mnen:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.topicDistribution.map(t => (
              <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#ccc', minWidth: 120, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatTopic(t.topic)}
                </span>
                <div style={{ flex: 1, height: 24, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(t.count / maxTopicCount) * 100}%`,
                    backgroundColor: '#ff6632', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                    minWidth: 32,
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#000' }}>{t.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. SEKTORER */}
        <Section title="SEKTORER">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.sectorBreakdown.map(s => (
              <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#ccc', minWidth: 120, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {SECTOR_LABELS[s.sector] || s.sector}
                </span>
                <div style={{ flex: 1, height: 24, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${(s.count / maxSectorCount) * 100}%`,
                    backgroundColor: SECTOR_COLORS[s.sector] || '#666', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                    minWidth: 32,
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#000' }}>{s.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 7. TONLÄGE */}
        <Section title="TONL&Auml;GE">
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 800, color: sentimentColor, lineHeight: 1 }}>
              {data.sentiment.avg >= 0 ? '+' : ''}{data.sentiment.avg.toFixed(2)}
            </div>
            <div style={{ color: '#999', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Snittsentiment &mdash; {sentimentLabel}
            </div>
          </div>
          <div style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {data.sentiment.pos} positiva &middot; {data.sentiment.neu} neutrala &middot; {data.sentiment.neg} negativa
          </div>
          <p style={{ color: '#999', fontSize: '0.9rem', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
            {data.sentiment.avg <= -0.05
              ? 'Pensionsdebatten i Almedalen präglas av oro och problemformulering — seminarierna lyfter oftare utmaningar än lösningar.'
              : data.sentiment.avg >= 0.05
                ? 'Pensionsdebatten har en positiv ton — fokus ligger oftare på lösningar och framtidsmöjligheter.'
                : 'Pensionsdebatten har en balanserad ton — ungefär lika mycket problemformulering som lösningsfokus.'}
          </p>
        </Section>

        {/* 8. SENASTE SEMINARIERNA */}
        <Section title="SENASTE SEMINARIERNA">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {top20Events.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.6rem 0', borderBottom: '1px solid #1a1a1a',
              }}>
                <span style={{
                  backgroundColor: '#1a1a1a', color: '#ff6632', fontWeight: 700,
                  fontSize: '0.75rem', padding: '2px 6px', borderRadius: 4,
                  flexShrink: 0,
                }}>
                  {e.year}
                </span>
                <span style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: 1.4 }}>{e.title}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 9. FOOTER */}
        <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #333', textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
            Data: Almedalsdata.se &mdash; Reform Society. Baserat p&aring; nyckelordss&ouml;k i 9&nbsp;407 seminariebeskrivningar.
          </p>
        </footer>
      </div>
    </div>
  );
}

function PensionNetwork({
  nodes,
  edges,
}: {
  nodes: { id: number; name: string; sector: string; events: number }[];
  edges: { source: number; target: number; weight: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; sector: string; events: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current || !nodes.length) return;

    let destroyed = false;

    import('d3').then((d3) => {
      if (destroyed || !containerRef.current) return;

      // Clear previous
      containerRef.current.innerHTML = '';

      const width = containerRef.current.clientWidth;
      const height = 500;

      const svg = d3.select(containerRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', '#111')
        .style('border-radius', '8px');

      const g = svg.append('g');

      // Zoom
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));
      svg.call(zoom);

      // Build node map for quick lookup
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // Filter edges to only include nodes present in the data
      const validEdges = edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

      // Create simulation data
      const simNodes = nodes.map(n => ({ ...n }));
      const simEdges = validEdges.map(e => ({ source: e.source, target: e.target, weight: e.weight }));

      const maxWeight = Math.max(...validEdges.map(e => e.weight), 1);

      // Force simulation
      const simulation = d3.forceSimulation(simNodes as any)
        .force('link', d3.forceLink(simEdges as any).id((d: any) => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d: any) => Math.sqrt(d.events) * 3 + 4));

      // Draw edges
      const link = g.selectAll('.link')
        .data(simEdges)
        .join('line')
        .attr('class', 'link')
        .attr('stroke', '#fff')
        .attr('stroke-opacity', 0.3)
        .attr('stroke-width', (d: any) => Math.max(0.5, (d.weight / maxWeight) * 3));

      // Draw nodes
      const node = g.selectAll('.node')
        .data(simNodes)
        .join('circle')
        .attr('class', 'node')
        .attr('r', (d: any) => Math.sqrt(d.events) * 3)
        .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#666')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .call(d3.drag<SVGCircleElement, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any);

      // Labels
      const label = g.selectAll('.label')
        .data(simNodes)
        .join('text')
        .attr('class', 'label')
        .text((d: any) => d.name)
        .attr('font-size', 9)
        .attr('fill', '#fff')
        .attr('text-anchor', 'middle')
        .attr('dy', (d: any) => -(Math.sqrt(d.events) * 3 + 4))
        .style('pointer-events', 'none')
        .style('user-select', 'none');

      // Hover interactions
      node.on('mouseenter', (event, d: any) => {
        // Highlight connected edges
        link.attr('stroke-opacity', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.05
        ).attr('stroke', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? '#ff6632' : '#fff'
        );
        // Dim other nodes
        node.attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const connected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return connected ? 1 : 0.2;
        });
        label.attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const connected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return connected ? 1 : 0.1;
        });
        // Tooltip
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          name: d.name,
          sector: SECTOR_LABELS[d.sector] || d.sector,
          events: d.events,
        });
      }).on('mouseleave', () => {
        link.attr('stroke-opacity', 0.3).attr('stroke', '#fff');
        node.attr('opacity', 1);
        label.attr('opacity', 1);
        setTooltip(null);
      });

      // Tick
      simulation.on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
        node
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
        label
          .attr('x', (d: any) => d.x)
          .attr('y', (d: any) => d.y);
      });
    });

    return () => {
      destroyed = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [nodes, edges]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 500 }} />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          backgroundColor: 'rgba(0,0,0,0.9)',
          border: '1px solid #ff6632',
          borderRadius: 6,
          padding: '6px 10px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>{tooltip.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#999' }}>{tooltip.sector} &middot; {tooltip.events} event</div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '3rem' }}>
      <h2
        style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
          color: '#ff6632',
          margin: '0 0 1rem 0',
          lineHeight: 1.2,
        }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {children}
    </section>
  );
}
