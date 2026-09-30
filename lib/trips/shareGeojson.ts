import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Trip } from '../db/types';
import { tripGeojson } from './exportGeojson';
import type { Fix } from './geo';

/** Writes the trip's GeoJSON and opens the share sheet (web: a download). False when nothing could share it. */
export async function shareTripGeojson(trip: Trip, points: readonly Fix[]): Promise<boolean> {
  const json = tripGeojson(trip, points);
  const name = `car-guy-viaje-${trip.startedAt.slice(0, 10)}-${trip.id.slice(0, 8)}.geojson`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/geo+json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { dialogTitle: 'Puntos GPS del viaje', mimeType: 'application/geo+json' });
  return true;
}
