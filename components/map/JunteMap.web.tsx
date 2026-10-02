import 'maplibre-gl/dist/maplibre-gl.css';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { boundsOf, routesGeoJson } from '@/lib/junte/mapData';

import { Recenter } from './Recenter';
import { USER_DOT_SIZE, UserDot } from './UserDot';
import type { JunteMapProps } from './types';
import { useMapStyle } from './useMapStyle';
import { createMap, setSourceData, type GLMap } from './webMap';

type XY = { x: number; y: number };

/** A junte on the map, web half: same contract as JunteMap.tsx; the dots are overlays placed with map.project(). */
export const JunteMap = memo(function JunteMap({ peers, me, avatar, meet, routes = [], height = 320, onUnavailable }: JunteMapProps) {
  const box = useRef<View>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [fit, setFit] = useState(true);
  const [, setTick] = useState(0);
  const style = useMapStyle(onUnavailable);
  const fail = useRef(style.fail);
  useEffect(() => {
    fail.current = style.fail;
  });

  const all = useMemo(() => [...peers, ...(me ? [me] : []), ...(meet ? [meet] : []), ...routes.flatMap((r) => r.pieces.flat())], [peers, me, meet, routes]);
  const bounds = boundsOf(all);
  const lines = useMemo(() => routesGeoJson(routes), [routes]);

  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null;
    if (!style.url || !el) return;
    let cancelled = false;
    let map: GLMap | null = null;
    void createMap(el, style.url, { center: [-69.93, 18.47], zoom: 11 }, () => fail.current(), () => cancelled).then((m) => {
      if (!m) return;
      map = m;
      mapRef.current = m;
      m.on('dragstart', () => setFit(false));
      m.on('move', () => setTick((n) => n + 1));
      m.on('load', () => {
        if (cancelled) return;
        m.addSource('junte-routes', { type: 'geojson', data: routesGeoJson([]) as never });
        m.addLayer({ id: 'junte-routes-casing', type: 'line', source: 'junte-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.5 } });
        m.addLayer({ id: 'junte-routes-line', type: 'line', source: 'junte-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4 } });
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
    if (ready && m) setSourceData(m, 'junte-routes', lines);
  }, [ready, lines]);

  const key = bounds ? bounds.flat().map((v) => v.toFixed(4)).join(',') : '';
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !fit || !bounds) return;
    m.fitBounds(bounds, { padding: 48, duration: 800, maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fit, key]);

  const at = useCallback((p: { lat: number; lng: number }): XY | null => {
    const m = mapRef.current;
    if (!ready || !m) return null;
    const pt = m.project([p.lng, p.lat]);
    return { x: pt.x, y: pt.y };
  }, [ready]);
  const bearing = mapRef.current?.getBearing() ?? 0;
  const half = (USER_DOT_SIZE + 16) / 2;
  const meetXY = meet ? at(meet) : null;
  const meXY = me ? at(me) : null;

  return (
    <View style={[styles.box, { height }]}>
      {/* maplibre-gl forces position: relative on its container, so it needs a real size (absoluteFill collapses to 0). */}
      <View ref={box} style={{ width: '100%', height }} />
      {meet && meetXY ? (
        <View pointerEvents="none" style={[styles.abs, { left: meetXY.x - 40, top: meetXY.y - 28 }]}>
          <View style={styles.flag}>
            <T face="semibold" style={styles.flagText} numberOfLines={1}>
              {meet.label || '🏁'}
            </T>
          </View>
        </View>
      ) : null}
      {peers.map((p) => {
        const xy = at(p);
        return xy ? (
          <View key={p.handle} pointerEvents="none" style={[styles.abs, styles.peer, { left: xy.x - half, top: xy.y - half }]}>
            <UserDot fresh={!p.stale} arrowDeg={p.heading == null ? null : p.heading - bearing} photoUri={p.photo} avatarId={p.avatarId} name={p.name ?? p.handle} />
            <T face="mono" style={styles.label} numberOfLines={1}>
              @{p.handle}
            </T>
          </View>
        ) : null;
      })}
      {me && meXY ? (
        <View pointerEvents="none" style={[styles.abs, { left: meXY.x - half, top: meXY.y - half }]}>
          <UserDot fresh={me.fresh} arrowDeg={me.heading == null ? null : me.heading - bearing} {...avatar} />
        </View>
      ) : null}
      {!fit ? <Recenter onPress={() => setFit(true)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#0B0B0D' },
  abs: { position: 'absolute' },
  peer: { alignItems: 'center', width: USER_DOT_SIZE + 16 },
  label: { color: '#FFFFFF', fontSize: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4, marginTop: -6, maxWidth: 110 },
  flag: { backgroundColor: '#E10600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: 160 },
  flagText: { color: '#FFFFFF', fontSize: 12 },
});
