import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { es } from '@/lib/i18n/es';
import { recordError, recordReportable } from '@/lib/diagnostics';
import { pickCandidates, storePhoto, type Candidate } from '@/lib/media';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from './T';

/**
 * Photo slot: shows the current picture, or the two ways to add one.
 *
 * Reusable by later phases — a failed inspection item and a service record both
 * want exactly this. Camera is hidden on web: the browser's file input already
 * offers the camera on a phone, and `launchCameraAsync` there is a worse version
 * of the same dialog.
 */
export function PhotoPicker({
  mediaId,
  ownerTable,
  ownerId,
  vehicleId,
  onChange,
  height = 180,
  recoverPending = false,
}: {
  mediaId: string | null;
  ownerTable: string;
  ownerId: string;
  vehicleId?: string;
  onChange: (mediaId: string | null) => void;
  height?: number;
  /**
   * Picks up a photo Android handed back after killing the activity mid-pick
   * (`getPendingResultAsync`). Only one picker per screen should ask.
   */
  recoverPending?: boolean;
}) {
  const { theme } = useTheme();
  const uri = useMediaUri(mediaId);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The storing runs outside React (lib/media): an unmount cannot cancel it,
  // it can only make the result land nowhere — hence the mounted check.
  async function store(candidate: Pick<Candidate, 'uri' | 'width' | 'takenAt'>, camera: boolean) {
    setBusy(true);
    try {
      const saved = await storePhoto(candidate, { camera, ownerTable, ownerId, vehicleId });
      if (saved && mounted.current) onChange(saved.id);
    } catch (error) {
      // The raw text (a Kotlin stack, often) is for the diagnostics, never the screen.
      recordReportable('photo', error);
      if (!mounted.current) return;
      Alert.alert(es.common.photoErrorTitle, es.common.photoErrorRetry, [
        { text: es.common.cancel, style: 'cancel' },
        { text: es.common.retry, onPress: () => void store(candidate, camera) },
      ]);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function add(camera: boolean) {
    let candidate: Candidate | undefined;
    try {
      // Called straight from the press handler: on web the picker injects an
      // <input type="file"> and clicks it, which only works inside a gesture.
      [candidate] = await pickCandidates({ camera });
    } catch (error) {
      recordReportable('photo-pick', error);
      Alert.alert(es.common.photoErrorTitle, es.common.photoPickError);
      return;
    }
    if (candidate) await store(candidate, camera);
  }

  useEffect(() => {
    if (!recoverPending || Platform.OS !== 'android') return;
    void (async () => {
      try {
        const { pendingPickedPhoto } = await import('@/lib/media');
        const pending = await pendingPickedPhoto();
        if (pending && mounted.current) await store(pending, false);
      } catch (error) {
        recordError('photo-pending', error);
      }
    })();
    // Once per mount: a pending result can only be read once anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (busy) {
    return (
      <View style={[styles.empty, { height, borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
        <ActivityIndicator color={theme.text.muted} />
        <T style={[styles.actionLabel, { color: theme.text.muted }]}>{es.common.photoSaving}</T>
      </View>
    );
  }

  if (uri) {
    return (
      <View style={styles.wrap}>
        <Image
          source={{ uri }}
          style={[styles.photo, { height, backgroundColor: theme.bg.raised }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="button"
          accessibilityLabel={es.common.removePhoto}
          style={styles.removeButton}>
          <Ionicons name="close" size={16} color={theme.text.secondary} />
          <T face="semibold" style={[styles.removeLabel, { color: theme.text.secondary }]}>
            {es.common.removePhoto}
          </T>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.empty, { height, borderColor: theme.line, backgroundColor: theme.bg.raised }]}>
      <Ionicons name="camera-outline" size={26} color={theme.text.muted} />
      <View style={styles.actions}>
        {Platform.OS !== 'web' ? (
          <Pressable
            onPress={() => add(true)}
            accessibilityRole="button"
            style={[styles.action, { borderColor: theme.line }]}>
            <T face="semibold" style={[styles.actionLabel, { color: theme.text.primary }]}>
              {es.common.takePhoto}
            </T>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => add(false)}
          accessibilityRole="button"
          style={[styles.action, { borderColor: theme.line }]}>
          <T face="semibold" style={[styles.actionLabel, { color: theme.text.primary }]}>
            {es.common.choosePhoto}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  photo: { width: '100%', borderRadius: radius.card },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: space.sm,
    minHeight: 44,
    paddingHorizontal: space.md,
  },
  removeLabel: { fontSize: 13 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  action: {
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 13 },
});
