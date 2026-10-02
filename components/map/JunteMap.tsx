import { Camera, GeoJSONSource, Layer, Map as MLMap, Marker } from '@maplibre/maplibre-react-native';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/T';
import { boundsOf, routesGeoJson } from '@/lib/junte/mapData';

import { Recenter } from './Recenter';
import { UserDot } from './UserDot';
import type { JunteMapProps } from './types';
import { useMapStyle } from './useMapStyle';

/**
 * A junte on the map, native half (IMP 01102026 Phase 6, ADR-57): everyone's avatar dot with the @handle (greyed
 * when old), the meeting point, my own dot, and after the junte the members' trimmed routes in their colours. The
 * camera fits everyone; panning stops that, the button brings it back.
 */
export const JunteMap = memo(function JunteMap({ peers, me, avatar, meet, routes = [], height = 320, onUnavailable }: JunteMapProps) {
  const style = useMapStyle(onUnavailable);
  const [fit, setFit] = useState(true);
  const all = useMemo(
    () => [...peers, ...(me ? [me] : []), ...(meet ? [meet] : []), ...routes.flatMap((r) => r.pieces.flat())],
    [peers, me, meet, routes],
  );
  const bounds = boundsOf(all);
  const lines = useMemo(() => routesGeoJson(routes), [routes]);

  if (!style.url) return <View style={[styles.box, { height }]} />;
  return (
    <View style={[styles.box, { height }]}>
      <MLMap
        style={styles.fill}
        mapStyle={style.url}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, left: 8 }}
        compass={false}
        scaleBar={false}
        onDidFailLoadingMap={style.fail}
        onRegionWillChange={(e) => {
          if (e.nativeEvent.userInteraction) setFit(false);
        }}>
        <Camera
          initialViewState={bounds ? { bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]], padding: { top: 48, bottom: 48, left: 48, right: 48 } } : { center: [-69.93, 18.47], zoom: 11 }}
          {...(fit && bounds ? { bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]], padding: { top: 48, bottom: 48, left: 48, right: 48 }, duration: 800 } : {})}
        />
        <GeoJSONSource id="junte-routes" data={lines as never}>
          <Layer id="junte-routes-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.5 }} />
          <Layer id="junte-routes-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': ['get', 'color'], 'line-width': 4 }} />
        </GeoJSONSource>
        {meet ? (
          <Marker id="meet" lngLat={[meet.lng, meet.lat]} anchor="bottom">
            <View style={styles.flag}>
              <T face="semibold" style={styles.flagText} numberOfLines={1}>
                {meet.label || '🏁'}
              </T>
            </View>
          </Marker>
        ) : null}
        {peers.map((p) => (
          <Marker key={p.handle} id={`peer-${p.handle}`} lngLat={[p.lng, p.lat]} anchor="center">
            <View style={styles.peer}>
              <UserDot fresh={!p.stale} arrowDeg={p.heading} photoUri={p.photo} avatarId={p.avatarId} name={p.name ?? p.handle} />
              <T face="mono" style={styles.label} numberOfLines={1}>
                @{p.handle}
              </T>
            </View>
          </Marker>
        ))}
        {me ? (
          <Marker id="me" lngLat={[me.lng, me.lat]} anchor="center">
            <UserDot fresh={me.fresh} arrowDeg={me.heading} {...avatar} />
          </Marker>
        ) : null}
      </MLMap>
      {!fit ? <Recenter onPress={() => setFit(true)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#0B0B0D' },
  fill: { flex: 1 },
  peer: { alignItems: 'center' },
  label: { color: '#FFFFFF', fontSize: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 4, borderRadius: 4, marginTop: -6, maxWidth: 110 },
  flag: { backgroundColor: '#E10600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, maxWidth: 160 },
  flagText: { color: '#FFFFFF', fontSize: 12 },
});
