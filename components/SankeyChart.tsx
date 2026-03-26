'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from 'd3-sankey';

type TopicYear = { year: number; event_count: number };
type Topic = { topic: string; years: TopicYear[]; totalEvents: number };

// Consistent colors for topics
const TOPIC_COLORS: Record<string, string> = {
  'arbetsmarknad_löner': '#e63946',
  'välfärd_omsorg': '#457b9d',
  'hälsa_sjukvård': '#2a9d8f',
  'skola_utbildning_forskning': '#e9c46a',
  'klimat_miljö_hållbarhet': '#264653',
  'energi': '#f4a261',
  'bostäder_samhällsbyggnad': '#6a4c93',
  'transport_infrastruktur': '#1982c4',
  'ekonomi_tillväxt': '#ff595e',
  'skatter_offentliga_finanser': '#8ac926',
  'näringsliv_innovation': '#e63946',
  'digitalisering_ai': '#ff6632',
  'försvar_säkerhet': '#264653',
  'demokrati_rättsstat': '#457b9d',
  'integration_migration': '#f4a261',
  'eu_utrikespolitik': '#6a4c93',
  'jämställdhet_mångfald': '#2a9d8f',
  'media_kommunikation': '#ff595e',
  'kultur_idrott': '#1982c4',
  'barn_ungdom': '#e9c46a',
  'övrigt': '#999',
};

function getTopicColor(topic: string, index: number): string {
  return TOPIC_COLORS[topic] || `hsl(${index * 17}, 65%, 50%)`;
}

function formatTopicLabel(topic: string): string {
  const label = topic.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function SankeyChart({
  topics,
  years,
  width = 900,
  height = 500,
}: {
  topics: Topic[];
  years: number[];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !topics.length || years.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 10, right: 140, bottom: 10, left: 10 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Build nodes: each topic × each year
    // Only include top 12 topics by total volume
    const topTopics = topics.slice(0, 12);
    const nodes: { name: string; topic: string; year: number; index: number }[] = [];
    const nodeIndex = new Map<string, number>();

    for (const year of years) {
      for (let ti = 0; ti < topTopics.length; ti++) {
        const t = topTopics[ti];
        const key = `${t.topic}_${year}`;
        nodeIndex.set(key, nodes.length);
        nodes.push({ name: key, topic: t.topic, year, index: ti });
      }
    }

    // Build links: connect same topic across consecutive years
    const links: { source: number; target: number; value: number; topic: string; topicIndex: number }[] = [];
    for (let yi = 0; yi < years.length - 1; yi++) {
      for (let ti = 0; ti < topTopics.length; ti++) {
        const t = topTopics[ti];
        const srcKey = `${t.topic}_${years[yi]}`;
        const tgtKey = `${t.topic}_${years[yi + 1]}`;
        const srcIdx = nodeIndex.get(srcKey);
        const tgtIdx = nodeIndex.get(tgtKey);
        if (srcIdx === undefined || tgtIdx === undefined) continue;

        const srcCount = t.years.find(y => y.year === years[yi])?.event_count || 0;
        const tgtCount = t.years.find(y => y.year === years[yi + 1])?.event_count || 0;
        // Use average of source and target for smooth flow
        const value = Math.max(1, Math.round((srcCount + tgtCount) / 2));
        links.push({ source: srcIdx, target: tgtIdx, value, topic: t.topic, topicIndex: ti });
      }
    }

    // Create sankey layout
    const sankeyLayout = sankey<typeof nodes[0], typeof links[0]>()
      .nodeId((d: any) => d.index)
      .nodeWidth(12)
      .nodePadding(6)
      .extent([[0, 0], [w, h]])
      .nodeSort(null);

    const graph = sankeyLayout({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    // Draw links
    g.append('g')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', (d: any) => getTopicColor(d.topic, d.topicIndex))
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d: any) => Math.max(1, d.width))
      .on('mouseover', function () {
        d3.select(this).attr('stroke-opacity', 0.7);
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke-opacity', 0.4);
      })
      .append('title')
      .text((d: any) => {
        const src = d.source as any;
        const tgt = d.target as any;
        return `${formatTopicLabel(src.topic)}: ${src.year} → ${tgt.year}\n${d.value} event (snitt)`;
      });

    // Draw nodes
    g.append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => Math.max(1, d.y1 - d.y0))
      .attr('fill', (d: any) => getTopicColor(d.topic, d.index))
      .attr('opacity', 0.9)
      .append('title')
      .text((d: any) => {
        const count = topTopics[d.index]?.years.find((y: TopicYear) => y.year === d.year)?.event_count || 0;
        return `${formatTopicLabel(d.topic)} (${d.year}): ${count} event`;
      });

    // Year labels at top
    const xScale = d3.scalePoint<number>()
      .domain(years)
      .range([6, w - 6]);

    g.append('g')
      .selectAll('text')
      .data(years)
      .join('text')
      .attr('x', d => xScale(d)!)
      .attr('y', -2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', '700')
      .text(d => d.toString());

    // Topic labels on right side
    const lastYear = years[years.length - 1];
    const lastNodes = graph.nodes.filter((n: any) => n.year === lastYear);
    g.append('g')
      .selectAll('text')
      .data(lastNodes)
      .join('text')
      .attr('x', (d: any) => d.x1 + 6)
      .attr('y', (d: any) => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .attr('font-size', '13px')
      .attr('fill', '#333')
      .text((d: any) => {
        const label = formatTopicLabel(d.topic);
        return label.length > 25 ? label.substring(0, 23) + '...' : label;
      });

  }, [topics, years, width, height]);

  return <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />;
}
