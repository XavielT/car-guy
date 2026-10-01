import 'maplibre-gl/dist/maplibre-gl.css';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { committedLength, pointFeature, ROUTE_CASING_PAINT, ROUTE_LINE_LAYOUT, ROUTE_LINE_WIDTH, routeSegments, speedColorExpression, tailStart } from '@/lib/trips/geojson';

import { Recenter } from './Recenter';
import { USER_DOT_SIZE, UserDot } from './UserDot';
import type { LiveMapProps } from './types';
import { useMapStyle } from './useMapStyle';
import { createMap, setSourceData, type GLMap } from './webMap';

const HOME: [number, number] = [-69.93, 18.47];

/**
 * The drive-mode map, web half: the user's avatar dot is an overlay placed with
 * `map.project()` (IMP 01102026 ADR-49) — the camera follows it only on a fresh
 * fix; without `me`, the newest trail point (a white dot) as before. A drag
 * stops the follow; the re-centre button brings it back. Same two-source trail
 * as native.
 */
export const LiveMap = memo(function LiveMap({ trail, follow = true, insets, onUnavailable, me, avatar }: LiveMapProps) {
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;
  const box = useRef<View>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tracking, setTracking] = useState(follow);
  const style = useMapStyle(onUnavailable);
  const fail = useRef(style.fail);
  useEffect(() => {
    fail.current = style.fail;
  });

  const k = committedLength(trail.length);
  const first = trail.length ? `${trail[0].lat},${trail[0].lng}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const committed = useMemo(() => routeSegments(trail.slice(0, k)), [k, first]);
  const tail = useMemo(() => routeSegments(trail.slice(tailStart(k))), [trail, k]);
  const last = trail.length ? trail[trail.length - 1] : null;
  const [screen, setScreen] = useState<{ x: number; y: number; bearing: number } | null>(null);
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  });

  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null;
    if (!style.url || !el) return;
    let cancelled = false;
    let map: GLMap | null = null;
    void createMap(el, style.url, { center: HOME, zoom: 16, pitch: 45 }, () => fail.current(), () => cancelled).then((m) => {
      if (!m) return;
      map = m;
      mapRef.current = m;
      // A drag by the person (not our easeTo) stops the follow.
      m.on('dragstart', () => setTracking(false));
      // The overlay dot follows every camera move.
      m.on('move', () => {
        const p = meRef.current;
        if (!p) return;
        const pt = m.project([p.lng, p.lat]);
        setScreen({ x: pt.x, y: pt.y, bearing: m.getBearing() });
      });
      m.on('load', () => {
        if (cancelled) return;
        for (const id of ['trail-committed', 'trail-tail']) {
          m.addSource(id, { type: 'geojson', data: routeSegments([]) as any });
          m.addLayer({ id: `${id}-casing`, type: 'line', source: id, layout: ROUTE_LINE_LAYOUT as any, paint: ROUTE_CASING_PAINT as any });
          m.addLayer({ id: `${id}-line`, type: 'line', source: id, layout: ROUTE_LINE_LAYOUT as any, paint: { 'line-color': speedColorExpression() as any, 'line-width': ROUTE_LINE_WIDTH + 1 } });
        }
        m.addSource('car', { type: 'geojson', data: pointFeature(null) as any });
        m.addLayer({ id: 'car', type: 'circle', source: 'car', paint: { 'circle-radius': 8, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#E10600', 'circle-stroke-width': 3 } });
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
    if (ready && m) setSourceData(m, 'trail-committed', committed);
  }, [ready, committed]);

  // Overlays: the followed point centres in the uncovered band; the credit sits above the sheet.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.setPadding({ top, bottom, left: 0, right: 0 });
    const corner = m.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-bottom-right');
    if (corner) corner.style.bottom = `${bottom}px`;
  }, [ready, top, bottom]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    setSourceData(m, 'trail-tail', tail);
    // With the user's own dot the white trail-end circle would be a second "me".
    setSourceData(m, 'car', pointFeature(me ? null : last));
    if (follow && tracking && !me && last) m.easeTo({ center: [last.lng, last.lat], zoom: Math.max(m.getZoom(), 15), duration: 800 });
  }, [ready, tail, last, follow, tracking, me]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    if (!me) {
      setScreen(null);
      return;
    }
    const pt = m.project([me.lng, me.lat]);
    setScreen({ x: pt.x, y: pt.y, bearing: m.getBearing() });
    // Only a fresh fix moves the camera (ADR-49): a stale one is drawn greyed where it was.
    if (follow && tracking && me.fresh) m.easeTo({ center: [me.lng, me.lat], zoom: Math.max(m.getZoom(), 15), duration: 800 });
  }, [ready, me, follow, tracking]);

  return (
    <View style={styles.fill}>
      <View ref={box} style={styles.fill} />
      {me && screen ? (
        <View pointerEvents="none" style={[styles.dot, { left: screen.x - (USER_DOT_SIZE + 16) / 2, top: screen.y - (USER_DOT_SIZE + 16) / 2 }]}>
          <UserDot fresh={me.fresh} arrowDeg={me.heading == null ? null : me.heading - screen.bearing} {...avatar} />
        </View>
      ) : null}
      {follow && !tracking ? <Recenter bottom={bottom} onPress={() => setTracking(true)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0B0B0D' },
  dot: { position: 'absolute' },
});
