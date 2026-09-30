import 'maplibre-gl/dist/maplibre-gl.css';

import { memo, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  cameraFit,
  END_COLOR,
  endpointFeatures,
  pointFeature,
  ROUTE_CASING_PAINT,
  ROUTE_LINE_LAYOUT,
  ROUTE_LINE_WIDTH,
  routeSegments,
  speedColorExpression,
  START_COLOR,
} from '@/lib/trips/geojson';

import type { TripMapProps } from './types';
import { useMapStyle } from './useMapStyle';
import { createMap, setSourceData, type GLMap } from './webMap';

/**
 * One trip on the MapLibre map, web half (maplibre-gl v6, lazy chunk): the
 * same GeoJSON and paint as TripMap.tsx. Cooperative gestures: the map sits in
 * a scrolling page, so the wheel scrolls the page and ctrl/two fingers move
 * the map. Right-click / long-press (contextmenu) → onLongPress.
 */
export const TripMap = memo(function TripMap({ points, replay, height = 240, onLongPress, onUnavailable }: TripMapProps) {
  const box = useRef<View>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [ready, setReady] = useState(false);
  const style = useMapStyle(onUnavailable);
  const longPress = useRef(onLongPress);
  useEffect(() => {
    longPress.current = onLongPress;
  }, [onLongPress]);
  const fail = useRef(style.fail);
  useEffect(() => {
    fail.current = style.fail;
  });

  // One map per style URL.
  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null;
    if (!style.url || !el) return;
    let cancelled = false;
    let map: GLMap | null = null;
    void createMap(
      el,
      style.url,
      { cooperativeGestures: true, pitchWithRotate: false, dragRotate: false, center: [-69.93, 18.47], zoom: 11 },
      () => fail.current(),
      () => cancelled,
    ).then((m) => {
      if (!m) return;
      map = m;
      mapRef.current = m;
      m.on('contextmenu', (e) => {
        e.preventDefault();
        longPress.current?.();
      });
      m.on('load', () => {
        if (cancelled) return;
        m.addSource('route', { type: 'geojson', data: routeSegments([]) as any });
        m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: ROUTE_LINE_LAYOUT as any, paint: ROUTE_CASING_PAINT as any });
        m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: ROUTE_LINE_LAYOUT as any, paint: { 'line-color': speedColorExpression() as any, 'line-width': ROUTE_LINE_WIDTH } });
        m.addSource('route-ends', { type: 'geojson', data: endpointFeatures([]) as any });
        m.addLayer({
          id: 'route-ends',
          type: 'circle',
          source: 'route-ends',
          paint: { 'circle-radius': 6, 'circle-color': ['match', ['get', 'kind'], 'start', START_COLOR, END_COLOR] as any, 'circle-stroke-color': '#0B0B0D', 'circle-stroke-width': 2 },
        });
        m.addSource('replay', { type: 'geojson', data: pointFeature(null) as any });
        m.addLayer({ id: 'replay-dot', type: 'circle', source: 'replay', paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#FFB300', 'circle-stroke-width': 3 } });
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

  // The route (and the camera on it) whenever the points change.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    setSourceData(m, 'route', routeSegments(points));
    setSourceData(m, 'route-ends', endpointFeatures(points));
    const c = m.getContainer();
    const fit = cameraFit(points, c.clientWidth, c.clientHeight);
    if (fit) m.fitBounds(fit.bounds, { padding: fit.padding, duration: 0 });
  }, [ready, points]);

  useEffect(() => {
    const m = mapRef.current;
    if (ready && m) setSourceData(m, 'replay', pointFeature(replay));
  }, [ready, replay]);

  return <View ref={box} style={{ height, backgroundColor: '#0B0B0D' }} />;
});
