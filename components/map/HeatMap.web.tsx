import 'maplibre-gl/dist/maplibre-gl.css';

import { memo, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { cameraFit, heatFeatures, heatmapPaint } from '@/lib/trips/geojson';

import type { HeatMapProps } from './types';
import { useMapStyle } from './useMapStyle';
import { createMap, setSourceData, type GLMap } from './webMap';

/** "Por dónde manejas", web half: the same heatmap as HeatMap.tsx on maplibre-gl (lazy chunk). */
export const HeatMap = memo(function HeatMap({ points, height = 220, onUnavailable }: HeatMapProps) {
  const box = useRef<View>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [ready, setReady] = useState(false);
  const style = useMapStyle(onUnavailable);
  const fail = useRef(style.fail);
  useEffect(() => {
    fail.current = style.fail;
  });

  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null;
    if (!style.url || !el) return;
    let cancelled = false;
    let map: GLMap | null = null;
    void createMap(
      el,
      style.url,
      { cooperativeGestures: true, pitchWithRotate: false, dragRotate: false, center: [-69.93, 18.47], zoom: 10 },
      () => fail.current(),
      () => cancelled,
    ).then((m) => {
      if (!m) return;
      map = m;
      mapRef.current = m;
      m.on('load', () => {
        if (cancelled) return;
        m.addSource('heat', { type: 'geojson', data: heatFeatures([]) as any });
        m.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', paint: heatmapPaint() as any });
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [style.url]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    setSourceData(m, 'heat', heatFeatures(points));
    const c = m.getContainer();
    const fit = cameraFit(points, c.clientWidth, c.clientHeight, 20);
    if (fit) m.fitBounds(fit.bounds, { padding: fit.padding, duration: 0 });
  }, [ready, points]);

  return <View ref={box} style={{ height, backgroundColor: '#0B0B0D' }} />;
});
