import { Camera, GeoJSONSource, Layer, Map as MLMap } from '@maplibre/maplibre-react-native';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';

import { cameraFit, frequencyPaint, routeFrequency } from '@/lib/trips/geojson';

import type { HeatMapProps } from './types';
import { useMapStyle } from './useMapStyle';

/**
 * "Por dónde manejas" on the MapLibre map, native half (SPEC-I §I4): the ROUTE-FREQUENCY lines of the listed trips (lib/trips/geojson.ts
 * routeFrequency): thin, amber → orange → red by how often a stretch was driven, with a faint glow underneath. There is no heatmap layer:
 * a blob of density hid the streets; a line shows them. Framed on all the routes. `texture` view: it sits in the Viajes ScrollView.
 * (The component keeps its old name and place so no caller changes.)
 */
export const HeatMap = memo(function HeatMap({ routes, height = 220, onUnavailable }: HeatMapProps) {
  const style = useMapStyle(onUnavailable);
  const [width, setWidth] = useState(0);
  const data = useMemo(() => routeFrequency(routes), [routes]);
  const points = useMemo(() => routes.flat(), [routes]);
  const fit = useMemo(() => (width > 0 ? cameraFit(points, width, height, 20) : null), [points, width, height]);
  const paint = useMemo(() => frequencyPaint(), []);
  // A new set of routes re-frames: the Camera is keyed on the bounds.
  const camKey = fit ? fit.bounds.map((n) => n.toFixed(4)).join(',') : '';

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
          onDidFailLoadingMap={style.fail}>
          <Camera key={camKey} initialViewState={{ bounds: fit.bounds, padding: fit.padding }} />
          <GeoJSONSource id="frequency" data={data}>
            <Layer id="frequency-glow" type="line" layout={paint.layout as any} paint={paint.glow as any} />
            <Layer id="frequency-line" type="line" layout={paint.layout as any} paint={paint.line as any} />
          </GeoJSONSource>
        </MLMap>
      ) : null}
    </View>
  );
});
