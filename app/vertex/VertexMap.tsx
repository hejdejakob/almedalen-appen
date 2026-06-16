'use client';
import dynamic from 'next/dynamic';
import type { MapPoint } from '@/components/ScheduleMap';

// Klient-ö: bara kartan renderas client-side (leaflet kräver browser).
// Resten av Vertex-sidan är en serverkomponent och SSR:as som vanligt.
const ScheduleMap = dynamic(() => import('@/components/ScheduleMap'), { ssr: false });

export default function VertexMap({ points, total }: { points: MapPoint[]; total?: number }) {
  return <ScheduleMap points={points} height={440} total={total} />;
}
