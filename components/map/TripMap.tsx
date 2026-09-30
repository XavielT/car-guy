import { Camera, GeoJSONSource, Layer, Map as MLMap } from '@maplibre/maplibre-react-native';
import { memo, useMemo, useState } from 'react';
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

/**
 * One trip on the MapLibre map, native half (IMP 30092026 Phase 4, ADR-41):
 * the speed-coloured line over a dark casing, fitted with padding, a green
 * start and red end dot, the replay dot, the style's attribution ornament.
 * `texture` view: the map sits in the trip detail's ScrollView.
 */
export const TripMap = memo(function TripMap({ points, replay, height = 240, onLongPress, onUnavailable }: TripMapProps) {
  const style = useMapStyle(onUnavailable);
  const [width, setWidth] = useState(0);
  const segments = useMemo(() => routeSegments(points), [points]);
  const ends = useMemo(() => endpointFeatures(points), [points]);
  const fit = useMemo(() => (width > 0 ? cameraFit(points, width, height) : null), [points, width, height]);
  const dot = useMemo(() => pointFeature(replay), [replay]);

  return (
    <View style={{ height, backgroundColor: '#0B0B0D' }} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {style.url && fit ? (
        <MLMap
          style={{ flex: 1 }}
          mapStyle={style.url}
          androidView="texture"
          logo={false}
          attribution
          attributionPosition={{ bottom: 4, right: 4 }}
          compass={false}
          scaleBar={false}
          touchPitch={false}
          onLongPress={onLongPress ? () => onLongPress() : undefined}
          onDidFailLoadingMap={style.fail}>
          <Camera initialViewState={{ bounds: fit.bounds, padding: fit.padding }} />
          <GeoJSONSource id="route" data={segments}>
            <Layer id="route-casing" type="line" layout={ROUTE_LINE_LAYOUT as any} paint={ROUTE_CASING_PAINT as any} />
            <Layer id="route-line" type="line" layout={ROUTE_LINE_LAYOUT as any} paint={{ 'line-color': speedColorExpression() as any, 'line-width': ROUTE_LINE_WIDTH }} />
          </GeoJSONSource>
          <GeoJSONSource id="route-ends" data={ends}>
            <Layer
              id="route-ends"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': ['match', ['get', 'kind'], 'start', START_COLOR, END_COLOR] as any,
                'circle-stroke-color': '#0B0B0D',
                'circle-stroke-width': 2,
              }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="replay" data={dot}>
            <Layer id="replay-dot" type="circle" paint={{ 'circle-radius': 7, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#FFB300', 'circle-stroke-width': 3 }} />
          </GeoJSONSource>
        </MLMap>
      ) : null}
    </View>
  );
});
