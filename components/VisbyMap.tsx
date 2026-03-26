'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

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

type Venue = {
  name: string;
  lat: number;
  lng: number;
  eventCount: number;
  sectors: Record<string, number>;
  primarySector: string;
  topArrangers: string[];
};

export default function VisbyMap({ venues, height = 600 }: { venues: Venue[]; height?: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [57.6390, 18.2910],
        zoom: 16,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Scale radius: sqrt scale, min 6, max 40
      const maxCount = Math.max(...venues.map(v => v.eventCount));
      const getRadius = (count: number) => {
        return 6 + Math.sqrt(count / maxCount) * 34;
      };

      for (const venue of venues) {
        const color = SECTOR_COLORS[venue.primarySector] || '#999';
        const radius = getRadius(venue.eventCount);

        const circle = L.circleMarker([venue.lat, venue.lng], {
          radius,
          fillColor: color,
          color: '#000',
          weight: 1.5,
          fillOpacity: 0.7,
        }).addTo(map);

        // Build popup content
        const sectorBreakdown = Object.entries(venue.sectors)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([s, count]) => `<span style="color:${SECTOR_COLORS[s] || '#999'}">■</span> ${SECTOR_LABELS[s] || s}: ${count}`)
          .join('<br>');

        const arrangerList = venue.topArrangers.slice(0, 5).join(', ');

        circle.bindPopup(`
          <div style="font-family: sans-serif; min-width: 160px; max-width: 250px;">
            <strong style="font-size: 14px;">${venue.name}</strong><br>
            <span style="color: #666; font-size: 12px;">${venue.eventCount} seminarier</span>
            <hr style="margin: 6px 0; border: none; border-top: 1px solid #ddd;">
            <div style="font-size: 12px; line-height: 1.6;">${sectorBreakdown}</div>
            <hr style="margin: 6px 0; border: none; border-top: 1px solid #ddd;">
            <div style="font-size: 11px; color: #666;">
              <strong>Största arrangörer:</strong><br>${arrangerList}
            </div>
          </div>
        `);
      }

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [venues]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: '6px' }} />
    </>
  );
}
