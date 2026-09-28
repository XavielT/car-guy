import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { T } from '@/components/T';
import { EmptyState, GhostButton, PrimaryButton } from '@/components/ui';
import { space } from '@/constants/theme';
import { albumPhotos, type AlbumPhoto } from '@/lib/db/albumQueries';
import { es } from '@/lib/i18n/es';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme/useTheme';
import { PhotoThumb } from './PhotoThumb';
import { StorageMeter } from './StorageMeter';

/**
 * The hub's Álbum tab: the latest photos and the ways in — the full album,
 * importing old photos, a new hito. The album itself is its own screen
 * (a long list does not belong inside the hub's scroll view).
 */
export function AlbumTab({ vehicleId, version }: { vehicleId: string; version: number }) {
  const router = useRouter();
  const { data } = useStore();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void albumPhotos(vehicleId).then((ps) => !cancelled && setPhotos(ps));
    return () => {
      cancelled = true;
    };
  }, [vehicleId, version, data]);

  const importPhotos = () => router.push({ pathname: '/album/importar', params: { vehicleId } });
  if (photos && !photos.length) {
    return (
      <View>
        <EmptyState icon="images-outline" message={es.album.empty} actionLabel={es.album.import} onAction={importPhotos} />
        <GhostButton label={es.album.addHito} onPress={() => router.push({ pathname: '/hito/nuevo', params: { vehicleId } })} />
      </View>
    );
  }

  const cell = Math.floor((width - space.gutter * 2 - 12) / 3);
  return (
    <View>
      <T face="mono" style={[styles.count, { color: theme.text.muted }]}>
        {photos ? es.album.photos(photos.length) : ''}
      </T>
      <View style={styles.grid}>
        {(photos ?? []).slice(0, 6).map((p) => (
          <PhotoThumb key={p.id} mediaId={p.id} blurhash={p.blurhash} size={cell} onPress={() => router.push({ pathname: '/foto/[id]', params: { id: p.id, vehicleId } })} />
        ))}
      </View>
      <PrimaryButton label={es.album.open} onPress={() => router.push({ pathname: '/vehiculo/[id]/album', params: { id: vehicleId } })} />
      <View style={styles.row}>
        <GhostButton label={es.album.import} onPress={importPhotos} style={{ flex: 1 }} />
        <GhostButton label={es.album.addHito} onPress={() => router.push({ pathname: '/hito/nuevo', params: { vehicleId } })} style={{ flex: 1 }} />
      </View>
      <StorageMeter vehicleId={vehicleId} style={{ marginTop: space.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 12, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.md },
  row: { flexDirection: 'row', gap: space.sm },
});
