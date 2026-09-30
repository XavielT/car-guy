import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '@/components/album/PhotoThumb';
import { T } from '@/components/T';
import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { recordError } from '@/lib/diagnostics';
import { MAX_CHECK_PHOTOS } from '@/lib/domain/inspections';
import { t } from '@/lib/i18n';
import { pickCandidates, storePhoto, type Candidate } from '@/lib/media';
import { useTheme } from '@/lib/theme/useTheme';

const THUMB = 84;

/**
 * The photos of one FALLA / ATENCIÓN answer (IMP 29092026 note 3): up to five,
 * camera or gallery (several at once where the picker allows it), shown as a
 * row of thumbs with a remove button each.
 *
 * Built on the same pipeline as PhotoPicker — `pickCandidates` then
 * `storePhoto` (ingest: compress, thumb, blurhash) — and the same Phase 1
 * error handling: a failed save shows `photoErrorRetry` with "Reintentar",
 * which retries the photos already in hand without reopening the picker.
 * Each photo is stored as a media row owned by the result (`ownerTable`
 * 'inspection_result'); saveInspection later drops the ones removed here.
 */
export function CheckPhotoStrip({
  mediaIds,
  ownerId,
  vehicleId,
  label,
  onChange,
}: {
  mediaIds: string[];
  ownerId: string;
  vehicleId: string;
  /** The item's label, for screen readers. */
  label: string;
  onChange: (next: string[]) => void;
}) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  // The latest list, so photos stored one after another append to each other
  // rather than to the list as it was when the picker opened.
  const current = useRef(mediaIds);
  useEffect(() => {
    current.current = mediaIds;
  }, [mediaIds]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const room = MAX_CHECK_PHOTOS - mediaIds.length;

  async function store(candidates: Pick<Candidate, 'uri' | 'width' | 'takenAt'>[], camera: boolean) {
    setBusy(true);
    const failed: typeof candidates = [];
    try {
      for (const candidate of candidates) {
        if (current.current.length >= MAX_CHECK_PHOTOS) break;
        try {
          const saved = await storePhoto(candidate, { camera, ownerTable: 'inspection_result', ownerId, vehicleId });
          if (saved && mounted.current) {
            current.current = [...current.current, saved.id];
            onChange(current.current);
          }
        } catch (error) {
          // The raw text (a Kotlin stack, often) is for the diagnostics, never the screen.
          recordError('photo', error);
          failed.push(candidate);
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
    if (failed.length && mounted.current) {
      Alert.alert(
        t.common.photoErrorTitle,
        failed.length > 1 ? `${t.check.photosFailed(failed.length)} ${t.common.photoErrorRetry}` : t.common.photoErrorRetry,
        [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.common.retry, onPress: () => void store(failed, camera) },
        ],
      );
    }
  }

  async function add(camera: boolean) {
    let picked: Candidate[];
    try {
      // Straight from the press handler: on web the picker needs the gesture.
      picked = await pickCandidates({ camera, multiple: !camera });
    } catch (error) {
      recordError('photo-pick', error);
      Alert.alert(t.common.photoErrorTitle, t.common.photoPickError);
      return;
    }
    if (picked.length) await store(picked.slice(0, Math.max(0, MAX_CHECK_PHOTOS - current.current.length)), camera);
  }

  return (
    <View style={styles.wrap}>
      <T face="eyebrow" style={{ color: theme.text.muted, fontSize: 11, marginBottom: 6 }}>
        {t.check.photoCount(mediaIds.length, MAX_CHECK_PHOTOS)}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {mediaIds.map((id, i) => (
          <PhotoThumb key={id} mediaId={id} size={THUMB} accessibilityLabel={t.check.photoOpen(label, i + 1)}>
            <Pressable
              onPress={() => onChange(mediaIds.filter((m) => m !== id))}
              accessibilityRole="button"
              accessibilityLabel={t.check.photoRemove(i + 1)}
              hitSlop={8}
              style={styles.remove}>
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </Pressable>
          </PhotoThumb>
        ))}
        {busy ? (
          <View style={[styles.slot, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
            <ActivityIndicator color={theme.text.muted} />
          </View>
        ) : room > 0 ? (
          <>
            {/* Camera is hidden on web: the browser's file input already offers it on a phone. */}
            {Platform.OS !== 'web' ? (
              <Pressable
                onPress={() => add(true)}
                accessibilityRole="button"
                accessibilityLabel={t.common.takePhoto}
                style={[styles.slot, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
                <Ionicons name="camera-outline" size={22} color={theme.text.secondary} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => add(false)}
              accessibilityRole="button"
              accessibilityLabel={t.common.choosePhoto}
              style={[styles.slot, { borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
              <Ionicons name="images-outline" size={22} color={theme.text.secondary} />
              <T face="semibold" style={{ color: theme.text.secondary, fontSize: 11 }}>
                {t.check.photoAdd}
              </T>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  row: { gap: space.sm, alignItems: 'center' },
  slot: {
    width: THUMB,
    height: THUMB,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(18,18,18,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
