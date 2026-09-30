import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoomableImage } from '@/components/album/ZoomableImage';
import { vehicleGallery } from '@/lib/db/tripOps';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { T } from '@/components/T';
import { Chip, GhostButton, PrimaryButton, Sheet } from '@/components/ui';
import { palette, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import {
  albumPhotos,
  deletePhoto,
  getMediaRow,
  setPhotoCaption,
  setPhotoDate,
  setPhotoFavorite,
  type AlbumPhoto,
} from '@/lib/db/albumQueries';
import { dateAtPrecision, photoDate, type DatePrecision } from '@/lib/domain/album';
import { dateLabel, monthTitle } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { mediaUri, saveOriginal } from '@/lib/media';
import { useStore } from '@/lib/store';

/**
 * The photo viewer (IMP 28092026 Phase 3): swipe through the vehicle's album in
 * timeline order, pinch to zoom, and fix what the import got wrong — the real
 * date and its precision, a caption — or star it (favourites are the cover).
 * Always dark, like the instruments: a photo reads best on black.
 */
const ink = palette.dark;

export default function PhotoViewer() {
  // `gallery=1`: page through the vehicle's gallery (its photos, in the user's order) instead of the album.
  const { id, vehicleId, gallery } = useLocalSearchParams<{ id: string; vehicleId?: string; gallery?: string }>();
  const router = useRouter();
  const { refresh } = useStore();
  const { width, height } = useWindowDimensions();

  const [photos, setPhotos] = useState<AlbumPhoto[] | null>(null);
  // null until the user swipes: the photo they opened is the start.
  const [swiped, setIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState('');
  const [precision, setPrecision] = useState<DatePrecision>('day');
  const listRef = useRef<FlatList<AlbumPhoto>>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (vehicleId && gallery) {
        const items = await vehicleGallery(vehicleId);
        const all = await albumPhotos(vehicleId);
        const byId = new Map(all.map((p) => [p.id, p]));
        const list = items.map((item) => byId.get(item.mediaId)).filter((p): p is AlbumPhoto => p != null);
        if (list.some((p) => p.id === id)) return list;
      }
      if (vehicleId) {
        const list = await albumPhotos(vehicleId);
        if (list.some((p) => p.id === id)) return list;
      }
      // Opened on its own (a hito cover, a service photo): just this one.
      const row = await getMediaRow(id);
      return row
        ? [{ id: row.id, albumItemId: null, takenAt: row.takenAt, createdAt: row.createdAt, precision: row.datePrecision, blurhash: row.blurhash, isFavorite: row.isFavorite, caption: row.caption, width: row.width, height: row.height }]
        : [];
    })().then((list) => !cancelled && setPhotos(list));
    return () => {
      cancelled = true;
    };
  }, [id, vehicleId, gallery]);

  const start = photos ? Math.max(0, photos.findIndex((p) => p.id === id)) : 0;
  const index = swiped ?? start;

  // Stable for FlatList, which rejects a changing onViewableItemsChanged.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken<AlbumPhoto>[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  });

  const current = photos?.[index] ?? null;

  function patch(next: Partial<AlbumPhoto>) {
    setPhotos((prev) => prev?.map((p, i) => (i === index ? { ...p, ...next } : p)) ?? prev);
  }

  function openEdit() {
    if (!current) return;
    setCaption(current.caption);
    setDate((current.takenAt ?? current.createdAt).slice(0, 10));
    setPrecision(current.precision);
    setEditing(true);
  }

  async function saveEdit() {
    if (!current) return;
    const [y, m, d] = date.split('-').map(Number);
    const takenAt = dateAtPrecision(y, m - 1, d, precision);
    await Promise.all([setPhotoCaption(current.id, caption.trim()), setPhotoDate(current.id, takenAt, precision)]);
    patch({ caption: caption.trim(), takenAt, precision });
    setEditing(false);
    refresh();
  }

  async function toggleFavorite() {
    if (!current) return;
    await setPhotoFavorite(current.id, !current.isFavorite);
    patch({ isFavorite: !current.isFavorite });
    refresh();
  }

  async function share() {
    if (!current) return;
    const row = await getMediaRow(current.id);
    const uri = await mediaUri(row);
    if (uri) await saveOriginal({ uri, fileName: `car-guy-${current.id}.jpg` });
  }

  function remove() {
    if (!current) return;
    Alert.alert(es.viewer.deleteTitle, es.viewer.deleteBody, [
      { text: es.common.cancel, style: 'cancel' },
      {
        text: es.viewer.delete,
        style: 'destructive',
        onPress: () => {
          void deletePhoto(current.id).then(() => {
            refresh();
            const left = (photos ?? []).filter((p) => p.id !== current.id);
            if (!left.length) router.back();
            else {
              setPhotos(left);
              setIndex(Math.min(index, left.length - 1));
            }
          });
        },
      },
    ]);
  }

  const when = current
    ? current.takenAt
      ? current.precision === 'year'
        ? String(new Date(current.takenAt).getFullYear())
        : current.precision === 'month'
          ? monthTitle(new Date(current.takenAt).getFullYear(), new Date(current.takenAt).getMonth())
          : dateLabel(photoDate(current))
      : es.viewer.noDate
    : '';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={es.viewer.close} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          <T face="mono" style={{ color: ink.text.secondary, fontSize: 13, flex: 1, textAlign: 'center' }}>
            {photos?.length ? es.viewer.of(index + 1, photos.length) : ''}
          </T>
          <Pressable
            onPress={() => void toggleFavorite()}
            accessibilityRole="button"
            accessibilityState={{ selected: Boolean(current?.isFavorite) }}
            accessibilityLabel={current?.isFavorite ? es.viewer.unfavorite : es.viewer.favorite}
            hitSlop={10}
            style={styles.iconBtn}>
            <Ionicons name={current?.isFavorite ? 'star' : 'star-outline'} size={24} color={current?.isFavorite ? ink.accentFill : '#FFFFFF'} />
          </Pressable>
        </View>

        {photos?.length ? (
          <FlatList
            ref={listRef}
            data={photos}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomed}
            initialScrollIndex={start}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            // One page either side, and only the visible one fetches its full copy:
            // FlatList's default of ten pages meant ten full downloads per open.
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            renderItem={({ item, index: i }) => (
              <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ZoomableImage mediaId={item.id} blurhash={item.blurhash} width={width} height={Math.max(200, height - 260)} onZoomChange={setZoomed} active={i === index} />
              </View>
            )}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {current ? (
          <View style={styles.panel}>
            <T face="mono" style={{ color: ink.text.primary, fontSize: 13 }}>
              {when}
            </T>
            {current.caption ? (
              <T face="body" style={{ color: ink.text.secondary, fontSize: 14, marginTop: 4 }}>
                {current.caption}
              </T>
            ) : null}
            <View style={styles.actions}>
              <Action icon="create-outline" label={es.viewer.realDate} onPress={openEdit} />
              <Action icon={Platform.OS === 'web' ? 'download-outline' : 'share-outline'} label={Platform.OS === 'web' ? es.viewer.download : es.viewer.saveOriginal} onPress={() => void share()} />
              <Action icon="trash-outline" label={es.viewer.delete} onPress={remove} danger />
            </View>
          </View>
        ) : null}

        <Sheet visible={editing} onClose={() => setEditing(false)} title={es.viewer.realDate}>
          <DateField label={es.viewer.realDate} value={date} onChange={setDate} noFuture />
          <View style={{ flexDirection: 'row', marginBottom: space.md }}>
            {(['day', 'month', 'year'] as DatePrecision[]).map((p) => (
              <Chip key={p} label={es.importer.precisions[p]} selected={precision === p} onPress={() => setPrecision(p)} />
            ))}
          </View>
          <Field label={es.viewer.caption} placeholder={es.viewer.captionPlaceholder} value={caption} onChangeText={setCaption} multiline />
          <PrimaryButton label={es.viewer.save} onPress={() => void saveEdit()} />
          <GhostButton label={es.common.cancel} onPress={() => setEditing(false)} />
        </Sheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function Action({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.action}>
      <Ionicons name={icon} size={22} color={danger ? ink.dangerText : '#FFFFFF'} />
      <T face="eyebrow" numberOfLines={2} style={{ color: danger ? ink.dangerText : ink.text.secondary, fontSize: 10, textAlign: 'center', marginTop: 4 }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, height: 52 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  panel: { paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space.md },
  action: { alignItems: 'center', minWidth: 88, minHeight: 56, paddingVertical: 4 },
});
