'use client';
import dynamic from 'next/dynamic';
import type { MapPoint } from '@/components/ScheduleMap';

const ScheduleMap = dynamic(() => import('@/components/ScheduleMap'), { ssr: false });

export default function PeterLubeckMap({ points, total }: { points: MapPoint[]; total?: number }) {
  return <ScheduleMap points={points} height={440} total={total} />;
}
