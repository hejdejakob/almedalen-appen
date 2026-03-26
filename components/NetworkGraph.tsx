'use client';

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

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
  tänketank_stiftelse: 'Tankesmedja & stiftelse',
  offentlig_sektor: 'Offentlig sektor',
  parti: 'Parti',
  media: 'Media',
  akademi: 'Akademi',
};

type Node = { id: number; name: string; sector: string; events: number };
type Edge = { source: number; target: number; weight: number };

export default function NetworkGraph({
  nodes,
  edges,
  width = 900,
  height = 600,
}: {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<{
    name: string;
    sector: string;
    events: number;
    connections: { name: string; sector: string; weight: number }[];
  } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const container = svgRef.current.parentElement;
    const actualWidth = container ? container.clientWidth : width;
    const actualHeight = height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', actualWidth)
      .attr('height', actualHeight)
      .attr('viewBox', `0 0 ${actualWidth} ${actualHeight}`);

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Scales
    const maxEvents = Math.max(...nodes.map(n => n.events));
    const radiusScale = d3.scaleSqrt().domain([0, maxEvents]).range([4, 22]);
    const maxWeight = Math.max(...edges.map(e => e.weight));
    const widthScale = d3.scaleLinear().domain([2, maxWeight]).range([0.5, 3.5]);

    const padding = 30;

    // Simulation
    const simNodes = nodes.map(n => ({ ...n }));
    const simEdges = edges.map(e => ({ ...e }));

    const simulation = d3.forceSimulation(simNodes as any)
      .force('link', d3.forceLink(simEdges as any).id((d: any) => d.id).distance(70).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(actualWidth / 2, actualHeight / 2))
      .force('collision', d3.forceCollide().radius((d: any) => radiusScale(d.events) + 3))
      .force('x', d3.forceX(actualWidth / 2).strength(0.05))
      .force('y', d3.forceY(actualHeight / 2).strength(0.05));

    // State for pinned selection
    let pinnedId: number | null = null;

    function highlightNode(d: any) {
      // Highlight the selected node
      node.attr('stroke', (n: any) => n.id === d.id ? '#000' : '#fff')
        .attr('stroke-width', (n: any) => n.id === d.id ? 3 : 1.5)
        .attr('opacity', (n: any) => {
          if (n.id === d.id) return 1;
          const isConnected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isConnected ? 1 : 0.15;
        });

      // Highlight connected edges
      link
        .attr('stroke-opacity', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? 0.8 : 0.03
        )
        .attr('stroke', (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? '#ff6632' : '#999'
        );

      // Show labels for connected nodes
      label
        .attr('display', (n: any) => {
          if (n.id === d.id) return 'block';
          const isConnected = simEdges.some((e: any) =>
            (e.source.id === d.id && e.target.id === n.id) ||
            (e.target.id === d.id && e.source.id === n.id)
          );
          return isConnected ? 'block' : 'none';
        });
    }

    function resetHighlight() {
      node.attr('stroke', '#fff').attr('stroke-width', 1.5).attr('opacity', 1);
      link.attr('stroke-opacity', 0.3).attr('stroke', '#999');
      label.attr('display', (d: any) => d.events > maxEvents * 0.15 ? 'block' : 'none');
    }

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', (d: any) => widthScale(d.weight));

    // Draw nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d: any) => radiusScale(d.events))
      .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#ccc')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('mouseover', function (_event: any, d: any) {
        if (pinnedId !== null) return; // Don't hover-highlight when pinned
        highlightNode(d);
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: _event.clientX - rect.left,
          y: _event.clientY - rect.top - 10,
          text: `${d.name} (${d.events} event)`,
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
          // Unpin
          pinnedId = null;
          resetHighlight();
          setTooltip(null);
          setSelectedInfo(null);
          return;
        }

        // Pin this node
        pinnedId = d.id;
        highlightNode(d);
        setTooltip(null);

        // Build connection info
        const connections = simEdges
          .filter((e: any) => e.source.id === d.id || e.target.id === d.id)
          .map((e: any) => {
            const other = e.source.id === d.id ? e.target : e.source;
            return { name: other.name, sector: other.sector, weight: e.weight };
          })
          .sort((a: any, b: any) => b.weight - a.weight);

        setSelectedInfo({
          name: d.name,
          sector: d.sector,
          events: d.events,
          connections,
        });
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

    // Click on background to deselect
    svg.on('click', () => {
      if (pinnedId !== null) {
        pinnedId = null;
        resetHighlight();
        setTooltip(null);
        setSelectedInfo(null);
      }
    });

    // Labels for ALL nodes (hidden by default, shown on highlight)
    const label = g.append('g')
      .selectAll('text')
      .data(simNodes)
      .join('text')
      .attr('font-size', '9px')
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .attr('dy', (d: any) => -radiusScale(d.events) - 3)
      .attr('display', (d: any) => d.events > maxEvents * 0.15 ? 'block' : 'none')
      .text((d: any) => d.name.length > 25 ? d.name.substring(0, 23) + '...' : d.name);

    simulation.on('tick', () => {
      for (const d of simNodes as any[]) {
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
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges, width, height]);

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px`, overflow: 'hidden' }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: `clamp(0px, ${tooltip.x}px, calc(100% - 10px))`,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#000',
          color: '#fff',
          padding: '0.3rem 0.6rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 1rem)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {tooltip.text}
        </div>
      )}
      {selectedInfo && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          width: 'min(260px, calc(100% - 1rem))',
          maxHeight: `${height - 20}px`,
          overflowY: 'auto',
          backgroundColor: '#fff',
          border: '2px solid #000',
          borderRadius: '6px',
          boxShadow: '4px 4px 0 #000',
          padding: '0.75rem',
          fontSize: '0.8rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedInfo.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: SECTOR_COLORS[selectedInfo.sector] || '#ccc' }} />
                <span style={{ color: '#666', fontSize: '0.75rem' }}>{SECTOR_LABELS[selectedInfo.sector] || selectedInfo.sector}</span>
              </div>
              <div style={{ color: '#999', fontSize: '0.7rem', marginTop: '0.15rem' }}>{selectedInfo.events} event</div>
            </div>
            <button
              onClick={() => setSelectedInfo(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#999', padding: '0' }}
            >
              ✕
            </button>
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '0.3rem' }}>
              {selectedInfo.connections.length} kopplingar (delade talare)
            </div>
            {selectedInfo.connections.map((c, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.2rem 0',
                borderBottom: i < selectedInfo.connections.length - 1 ? '1px solid #f5f5f0' : 'none',
              }}>
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: SECTOR_COLORS[c.sector] || '#ccc',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ color: '#999', fontSize: '0.7rem', flexShrink: 0 }}>{c.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
