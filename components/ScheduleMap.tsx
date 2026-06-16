'use client';
import { useEffect, useRef } from 'react';

// Karta för en persons schema: en pin per plats, popup listar passen där.
export type MapPoint = { lat: number; lng: number; location: string; time: string; title: string; n: number };

export default function ScheduleMap({ points, height = 420, total }: { points: MapPoint[]; height?: number; total?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !ref.current) return;

      // ikon-fix (samma som VisbyMap)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(ref.current).setView([57.639, 18.291], 15);
      mapRef.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // gruppera pass per koordinat
      const byCoord = new Map<string, MapPoint[]>();
      for (const p of points) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
        const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
        (byCoord.get(k) || byCoord.set(k, []).get(k))!.push(p);
      }

      const bounds: [number, number][] = [];
      for (const group of byCoord.values()) {
        const { lat, lng, location } = group[0];
        bounds.push([lat, lng]);
        const sorted = [...group].sort((a, b) => a.n - b.n);
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#fb531a;color:#fff;border:2px solid #000;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;box-shadow:2px 2px 0 #000;">${sorted.length}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const list = sorted.slice(0, 12)
          .map((s) => `<div style="margin:3px 0;"><b style="font-family:'Space Mono',monospace;">${s.time}</b> ${escapeHtml(s.title).slice(0, 70)}</div>`)
          .join('') + (sorted.length > 12 ? `<div style="margin-top:5px;color:#888;font-family:'Space Mono',monospace;">…och ${sorted.length - 12} till</div>` : '');
        L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;max-width:260px;"><div style="font-weight:700;text-transform:uppercase;font-family:'Formula Condensed',sans-serif;font-size:1.1rem;margin-bottom:4px;">${escapeHtml(location || 'Okänd plats')}</div>${list}</div>`
          );
      }
      if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      // tiles kan bli feljusterade om containern fått sin storlek efter init
      setTimeout(() => { if (!cancelled) try { map.invalidateSize(); } catch {} }, 250);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [points]);

  const withCoords = points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number').length;

  return (
    <div>
      {/* Leaflet-CSS laddas inte globalt på /speakers — ladda den här */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={ref} style={{ height, width: '100%', border: '2px solid #000', boxShadow: '4px 4px 0 #000' }} />
      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: '#666', marginTop: '0.4rem' }}>
        {withCoords} av {total ?? points.length} pass kunde placeras på kartan (övriga saknar koordinater).
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
