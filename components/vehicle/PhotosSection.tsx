import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { T } from '@/components/T';
import { GhostButton, Sheet } from '@/components/ui';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { recordError } from '@/lib/diagnostics';
import { addPhotos, movePhoto, removePhoto, setCover, type Gallery } from '@/lib/domain/gallery';
import { es } from '@/lib/i18n/es';
import { pickCandidates, storePhoto, type Candidate } from '@/lib/media';
import { useTheme } from '@/lib/theme/useTheme';

const THUMB = 96;

/**
 * The vehicle's photos in the form (note 10): a strip of thumbs, "＋" to add
 * from the camera or the gallery (several at once), tap a photo for Portada ·
 * move · Quitar. The first photo is the cover until another is chosen.
 *
 * Photos are stored as they are picked (media rows, owned by the vehicle) but
 * the gallery itself — album items with role 'vehicle' — is written when the
 * form is saved (lib/db/vehicleOps.ts): a new vehicle has no row yet for the
 * album items to point at, and cancelling the form must not leave a gallery.
 *
 * Reordering is "mover" in the photo's sheet rather than drag: the same on
 * native and web, and reachable with a screen reader.
 */
export function PhotosSection({
  gallery,
  onChange,
  vehicleId,
}: {
  gallery: Gallery;
  onChange: (next: Gallery) => void;
  /** The draft id: photos belong to it before the vehicle is saved. */
  vehicleId: string;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(0);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const latest = useRef(gallery);
  latest.current = gallery;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function store(candidates: Pick<Candidate, 'uri' | 'width' | 'takenAt'>[], camera: boolean) {
    const failed: typeof candidates = [];
    setBusy((n) => n + candidates.length);
    for (const candidate of candidates) {
      try {
        const saved = await storePhoto(candidate, { camera, ownerTable: 'vehicle', ownerId: vehicleId, vehicleId });
        if (saved && mounted.current) onChange(addPhotos(latest.current, [saved.id]));
      } catch (error) {
        recordError('photo', error);
        failed.push(candidate);
      } finally {
        if (mounted.current) setBusy((n) => n - 1);
      }
    }
    if (failed.length && mounted.current) {
      Alert.alert(es.common.photoErrorTitle, es.common.photoErrorRetry, [
        { text: es.common.cancel, style: 'cancel' },
        { text: es.common.retry, onPress: () => void store(failed, camera) },
      ]);
    }
  }

  async function pick(camera: boolean) {
    setAdding(false);
    let candidates: Candidate[] = [];
    try {
      // Straight from the press: on web the picker needs the gesture.
      candidates = await pickCandidates({ camera, multiple: !camera });
    } catch (error) {
      recordError('photo-pick', error);
      Alert.alert(es.common.photoErrorTitle, es.common.photoPickError);
      return;
    }
    if (candidates.length) await store(candidates, camera);
  }

  // Android may kill the app while the camera is open (Phase 1): the photo
  // comes back through the pending result on the next mount.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void (async () => {
      try {
        const { pendingPickedPhoto } = await import('@/lib/media');
        const pending = await pendingPickedPhoto();
        if (pending && mounted.current) await store([pending], true);
      } catch (error) {
        recordError('photo-pending', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = gallery.ids.length === 0 && busy === 0;
  const at = selected ? gallery.ids.indexOf(selected) : -1;

  return (
    <View style={styles.wrap}>
      <T face="eyebrow" style={[styles.label, { color: theme.text.secondary }]}>
        {es.vehicleForm.photos}
      </T>
      {empty ? (
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel={es.vehicleForm.photosEmpty}
          style={[styles.emptyCard, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
          <Ionicons name="images-outline" size={26} color={theme.text.muted} />
          <T face="body" style={[styles.emptyText, { color: theme.text.secondary }]}>
            {es.vehicleForm.photosEmpty}
          </T>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {gallery.ids.map((id, i) => (
            <PhotoThumb
              key={id}
              mediaId={id}
              size={THUMB}
              onPress={() => setSelected(id)}
              onLongPress={() => setSelected(id)}
              accessibilityLabel={es.vehicleForm.photoN(i + 1, gallery.ids.length, id === gallery.cover)}
              style={id === gallery.cover ? { borderWidth: 2, borderColor: theme.accent } : undefined}>
              {id === gallery.cover ? (
                <View style={[styles.coverTag, { backgroundColor: theme.accentFill }]}>
                  <T face="eyebrow" style={[styles.coverText, { color: theme.accentFillInk }]}>
                    {es.vehicleForm.cover}
                  </T>
                </View>
              ) : null}
            </PhotoThumb>
          ))}
          {busy > 0 ? (
            <View style={[styles.add, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
              <ActivityIndicator color={theme.text.muted} />
            </View>
          ) : null}
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={es.vehicleForm.addPhotos}
            style={[styles.add, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
            <Ionicons name="add" size={28} color={theme.text.secondary} />
          </Pressable>
        </ScrollView>
      )}

      <Sheet visible={adding} onClose={() => setAdding(false)} title={es.vehicleForm.addPhotos}>
        {Platform.OS !== 'web' ? <GhostButton label={es.common.takePhoto} onPress={() => void pick(true)} /> : null}
        <GhostButton label={es.vehicleForm.fromGallery} onPress={() => void pick(false)} />
      </Sheet>

      <Sheet visible={selected != null} onClose={() => setSelected(null)} title={es.vehicleForm.photoSheet(at + 1, gallery.ids.length)}>
        {selected && selected !== gallery.cover ? (
          <GhostButton
            label={es.vehicleForm.makeCover}
            onPress={() => {
              onChange(setCover(gallery, selected));
              setSelected(null);
            }}
          />
        ) : null}
        {at > 0 ? <GhostButton label={es.vehicleForm.moveLeft} onPress={() => onChange(movePhoto(gallery, selected!, -1))} /> : null}
        {at >= 0 && at < gallery.ids.length - 1 ? (
          <GhostButton label={es.vehicleForm.moveRight} onPress={() => onChange(movePhoto(gallery, selected!, 1))} />
        ) : null}
        <GhostButton
          danger
          label={es.common.removePhoto}
          onPress={() => {
            onChange(removePhoto(gallery, selected!));
            setSelected(null);
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  label: { fontSize: 12, marginBottom: 6 },
  emptyCard: {
    height: 120,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  emptyText: { fontSize: 14 },
  strip: { gap: space.sm, paddingVertical: 2 },
  add: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.input,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTag: { position: 'absolute', left: 4, bottom: 4, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2 },
  coverText: { fontSize: 10 },
});
