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

type ArenaNode = { id: string; name: string; type: 'arena'; uniqueArrangers: number; totalEvents: number };
type OrgNode = { id: number; name: string; type: 'org'; sector: string };
type Edge = { source: string | number; target: string | number; weight: number };

export default function ArenaNetwork({
  arenaNodes,
  orgNodes,
  edges,
  height = 700,
}: {
  arenaNodes: ArenaNode[];
  orgNodes: OrgNode[];
  edges: Edge[];
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !arenaNodes.length) return;

    const container = svgRef.current.parentElement;
    const actualWidth = container ? container.clientWidth : 900;
    const actualHeight = height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', actualWidth).attr('height', actualHeight)
      .attr('viewBox', `0 0 ${actualWidth} ${actualHeight}`);

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Combine nodes — arena nodes get a string id, org nodes get a numeric id
    const isFolkhalsodalen = (d: any) => d.nodeType === 'arena' && d.name === 'Folkhälsodalen';
    const allNodes: any[] = [
      ...arenaNodes.map(n => ({
        ...n,
        nodeType: 'arena',
        // Pin Folkhälsodalen to center
        ...(n.name === 'Folkhälsodalen' ? { fx: actualWidth / 2, fy: actualHeight / 2 } : {}),
      })),
      ...orgNodes.map(n => ({ ...n, nodeType: 'org' })),
    ];
    const simEdges = edges.map(e => ({ ...e }));

    // Scales
    const maxArenaArrangers = Math.max(...arenaNodes.map(n => n.uniqueArrangers));
    const arenaRadiusScale = d3.scaleSqrt().domain([1, maxArenaArrangers]).range([12, 35]);
    const maxWeight = Math.max(...edges.map(e => e.weight), 1);
    const edgeWidthScale = d3.scaleLinear().domain([2, maxWeight]).range([0.5, 3]);

    const getRadius = (d: any) => {
      if (d.nodeType !== 'arena') return 4;
      const base = arenaRadiusScale(d.uniqueArrangers || 1);
      return isFolkhalsodalen(d) ? base * 1.5 : base;
    };

    const padding = 40;

    // Simulation
    const simulation = d3.forceSimulation(allNodes)
      .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(80).strength(0.2))
      .force('charge', d3.forceManyBody().strength((d: any) => d.nodeType === 'arena' ? -300 : -30))
      .force('center', d3.forceCenter(actualWidth / 2, actualHeight / 2))
      .force('collision', d3.forceCollide().radius((d: any) => getRadius(d) + 2))
      .force('x', d3.forceX(actualWidth / 2).strength(0.03))
      .force('y', d3.forceY(actualHeight / 2).strength(0.03));

    // Edges
    const link = g.append('g')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.15)
      .attr('stroke-width', (d: any) => edgeWidthScale(d.weight));

    // Org nodes (circles, colored by sector)
    const orgNodeSelection = g.append('g')
      .selectAll('circle')
      .data(allNodes.filter(n => n.nodeType === 'org'))
      .join('circle')
      .attr('r', 4)
      .attr('fill', (d: any) => SECTOR_COLORS[d.sector] || '#ccc')
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: any, d: any) {
        d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);
        // Highlight connected edges and arena nodes
        link
          .attr('stroke-opacity', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 0.7 : 0.03)
          .attr('stroke', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? '#fb531a' : '#999');
        arenaNodeSelection
          .attr('stroke-width', (a: any) =>
            simEdges.some((e: any) =>
              (e.source.id === d.id && e.target.id === a.id) ||
              (e.target.id === d.id && e.source.id === a.id)
            ) ? 3 : 1.5);
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          lines: [d.name],
        });
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 0.5);
        link.attr('stroke-opacity', 0.15).attr('stroke', '#999');
        arenaNodeSelection.attr('stroke-width', 1.5);
        setTooltip(null);
      })
      .call(d3.drag<any, any>()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Arena nodes (larger circles with double ring)
    const arenaNodeSelection = g.append('g')
      .selectAll('g')
      .data(allNodes.filter(n => n.nodeType === 'arena'))
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Outer ring
    arenaNodeSelection.append('circle')
      .attr('r', (d: any) => arenaRadiusScale(d.uniqueArrangers) + 3)
      .attr('fill', 'none')
      .attr('stroke', '#fb531a')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,2');

    // Inner filled circle
    arenaNodeSelection.append('circle')
      .attr('r', (d: any) => arenaRadiusScale(d.uniqueArrangers))
      .attr('fill', '#fff')
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5);

    // Arena icon (small inner dot)
    arenaNodeSelection.append('circle')
      .attr('r', 3)
      .attr('fill', '#fb531a');

    // Hover on arena groups
    arenaNodeSelection
      .on('mouseover', function (event: any, d: any) {
        d3.select(this).selectAll('circle').filter((_: any, i: number) => i === 1)
          .attr('stroke', '#fb531a').attr('stroke-width', 2.5);
        link
          .attr('stroke-opacity', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? 0.7 : 0.03)
          .attr('stroke', (l: any) =>
            l.source.id === d.id || l.target.id === d.id ? '#fb531a' : '#999');
        orgNodeSelection
          .attr('r', (o: any) =>
            simEdges.some((e: any) =>
              (e.source.id === d.id && e.target.id === o.id) ||
              (e.target.id === d.id && e.source.id === o.id)
            ) ? 7 : 4)
          .attr('stroke-width', (o: any) =>
            simEdges.some((e: any) =>
              (e.source.id === d.id && e.target.id === o.id) ||
              (e.target.id === d.id && e.source.id === o.id)
            ) ? 1.5 : 0.5);
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          lines: [
            d.name,
            `${d.totalEvents} seminarier`,
            `${d.uniqueArrangers} unika arrangörer`,
          ],
        });
      })
      .on('mouseout', function () {
        d3.select(this).selectAll('circle').filter((_: any, i: number) => i === 1)
          .attr('stroke', '#000').attr('stroke-width', 1.5);
        link.attr('stroke-opacity', 0.15).attr('stroke', '#999');
        orgNodeSelection.attr('r', 4).attr('stroke-width', 0.5);
        setTooltip(null);
      });

    // Labels for ALL arena nodes
    const arenaLabelData = allNodes.filter(n => n.nodeType === 'arena');

    // Shadow for readability
    const arenaLabelShadows = g.append('g')
      .selectAll('text')
      .data(arenaLabelData)
      .join('text')
      .attr('font-size', '12px')
      .attr('font-weight', 700)
      .attr('fill', '#fff')
      .attr('stroke', '#fff')
      .attr('stroke-width', 4)
      .attr('paint-order', 'stroke')
      .attr('text-anchor', 'middle')
      .text((d: any) => d.name.length > 30 ? d.name.substring(0, 28) + '…' : d.name);

    // Actual text
    const arenaLabels = g.append('g')
      .selectAll('text')
      .data(arenaLabelData)
      .join('text')
      .attr('font-size', '12px')
      .attr('font-weight', 700)
      .attr('fill', '#000')
      .attr('text-anchor', 'middle')
      .text((d: any) => d.name.length > 30 ? d.name.substring(0, 28) + '…' : d.name);

    simulation.on('tick', () => {
      for (const d of allNodes) {
        const r = getRadius(d);
        d.x = Math.max(padding + r, Math.min(actualWidth - padding - r, d.x));
        d.y = Math.max(padding + r, Math.min(actualHeight - padding - r, d.y));
      }

      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      orgNodeSelection
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
      arenaNodeSelection
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      const labelY = (d: any) => d.y - arenaRadiusScale(d.uniqueArrangers || 1) - 10;
      arenaLabelShadows
        .attr('x', (d: any) => d.x)
        .attr('y', labelY);
      arenaLabels
        .attr('x', (d: any) => d.x)
        .attr('y', labelY);
    });

    return () => { simulation.stop(); };
  }, [arenaNodes, orgNodes, edges, height]);

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
          padding: '0.4rem 0.7rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 1rem)',
          lineHeight: 1.4,
        }}>
          {tooltip.lines.map((line, i) => (
            <div key={i} style={{ opacity: i === 0 ? 1 : 0.7, fontSize: i === 0 ? '0.85rem' : '0.75rem' }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
