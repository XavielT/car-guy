import { Camera, GeoJSONSource, Layer, Map as MLMap } from '@maplibre/maplibre-react-native';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';

import { cameraFit, heatFeatures, heatmapPaint } from '@/lib/trips/geojson';

import type { HeatMapProps } from './types';
import { useMapStyle } from './useMapStyle';

/**
 * "Por dónde manejas" on the MapLibre map, native half: a heatmap layer over
 * the sampled points of the listed trips (lib/trips/geojson.ts sampleAlong),
 * framed on all of them. `texture` view: it sits in the Viajes ScrollView.
 */
export const HeatMap = memo(function HeatMap({ points, height = 220, onUnavailable }: HeatMapProps) {
  const style = useMapStyle(onUnavailable);
  const [width, setWidth] = useState(0);
  const data = useMemo(() => heatFeatures(points), [points]);
  const fit = useMemo(() => (width > 0 ? cameraFit(points, width, height, 20) : null), [points, width, height]);
  const paint = useMemo(() => heatmapPaint(), []);
  // A new point set re-frames: the Camera is keyed on the bounds.
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
          <GeoJSONSource id="heat" data={data}>
            <Layer id="heat" type="heatmap" paint={paint as any} />
          </GeoJSONSource>
        </MLMap>
      ) : null}
    </View>
  );
});
