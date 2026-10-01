import { Camera, GeoJSONSource, Layer, Map as MLMap, UserLocation } from '@maplibre/maplibre-react-native';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { committedLength, ROUTE_CASING_PAINT, ROUTE_LINE_LAYOUT, ROUTE_LINE_WIDTH, routeSegments, speedColorExpression, tailStart } from '@/lib/trips/geojson';

import { Recenter } from './Recenter';
import type { LiveMapProps } from './types';
import { useMapStyle } from './useMapStyle';

/** Santo Domingo, until the first fix. */
const HOME: [number, number] = [-69.93, 18.47];

/**
 * The drive-mode map, native half (research 01 §6): the camera follows the car
 * course-up (zoom 16, pitch 45) with the user puck; the trail grows in speed
 * colours as two sources — the committed part (rebuilt every 10 updates) and
 * the tail (every update) — so a long drive does not re-send the whole line
 * each second. Panning stops the follow; the re-centre button brings it back.
 */
export const LiveMap = memo(function LiveMap({ trail, follow = true, insets, onUnavailable }: LiveMapProps) {
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;
  const style = useMapStyle(onUnavailable);
  const [tracking, setTracking] = useState(follow);
  const k = committedLength(trail.length);
  const first = trail.length ? `${trail[0].lat},${trail[0].lng}` : '';
  // Rebuilt only when the committed length (or the trip) changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const committed = useMemo(() => routeSegments(trail.slice(0, k)), [k, first]);
  const tail = useMemo(() => routeSegments(trail.slice(tailStart(k))), [trail, k]);
  const last = trail[trail.length - 1];
  const [initial] = useState(() => ({ center: last ? ([last.lng, last.lat] as [number, number]) : HOME, zoom: 16, pitch: 45 }));
  const paint = useMemo(() => ({ 'line-color': speedColorExpression() as any, 'line-width': ROUTE_LINE_WIDTH + 1 }), []);

  if (!style.url) return <View style={styles.fill} />;
  return (
    <View style={styles.fill}>
      <MLMap
        style={styles.fill}
        mapStyle={style.url}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8 + bottom, left: 8 }}
        compass={false}
        scaleBar={false}
        preferredFramesPerSecond={30}
        onDidFailLoadingMap={style.fail}>
        <Camera
          initialViewState={initial}
          trackUserLocation={follow && tracking ? 'course' : undefined}
          padding={{ top, bottom }}
          {...(follow && tracking ? { zoom: 16, pitch: 45 } : {})}
          onTrackUserLocationChange={(e) => {
            if (!e.nativeEvent.trackUserLocation) setTracking(false);
          }}
        />
        <GeoJSONSource id="trail-committed" data={committed}>
          <Layer id="trail-committed-casing" type="line" layout={ROUTE_LINE_LAYOUT as any} paint={ROUTE_CASING_PAINT as any} />
          <Layer id="trail-committed-line" type="line" layout={ROUTE_LINE_LAYOUT as any} paint={paint} />
        </GeoJSONSource>
        <GeoJSONSource id="trail-tail" data={tail}>
          <Layer id="trail-tail-casing" type="line" layout={ROUTE_LINE_LAYOUT as any} paint={ROUTE_CASING_PAINT as any} />
          <Layer id="trail-tail-line" type="line" layout={ROUTE_LINE_LAYOUT as any} paint={paint} />
        </GeoJSONSource>
        <UserLocation heading animated />
      </MLMap>
      {follow && !tracking ? <Recenter bottom={bottom} onPress={() => setTracking(true)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#0B0B0D' },
});
