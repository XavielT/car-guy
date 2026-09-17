import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { es } from '@/lib/i18n/es';
import { pickPhoto } from '@/lib/media';
import { useMediaUri } from '@/lib/media/useMediaUri';
import { Alert } from '@/lib/alert';
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
}: {
  mediaId: string | null;
  ownerTable: string;
  ownerId: string;
  vehicleId?: string;
  onChange: (mediaId: string | null) => void;
  height?: number;
}) {
  const uri = useMediaUri(mediaId);

  async function add(camera: boolean) {
    try {
      // Called straight from the press handler: on web the picker injects an
      // <input type="file"> and clicks it, which only works inside a gesture.
      const saved = await pickPhoto({ camera, ownerTable, ownerId, vehicleId });
      if (saved) onChange(saved.id);
    } catch (error) {
      Alert.alert(
        es.common.photoError,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (uri) {
    return (
      <View style={styles.wrap}>
        <Image source={{ uri }} style={[styles.photo, { height }]} resizeMode="cover" />
        <Pressable onPress={() => onChange(null)} style={styles.removeButton}>
          <Ionicons name="close" size={16} color={colors.ink} />
          <T face="semibold" style={styles.removeLabel}>
            {es.common.removePhoto}
          </T>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.empty, { height }]}>
      <Ionicons name="camera-outline" size={26} color={colors.muted} />
      <View style={styles.actions}>
        {Platform.OS !== 'web' ? (
          <Pressable onPress={() => add(true)} style={styles.action}>
            <T face="semibold" style={styles.actionLabel}>
              {es.common.takePhoto}
            </T>
          </Pressable>
        ) : null}
        <Pressable onPress={() => add(false)} style={styles.action}>
          <T face="semibold" style={styles.actionLabel}>
            {es.common.choosePhoto}
          </T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  photo: { width: '100%', borderRadius: radius.card, backgroundColor: colors.white },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: space.sm,
    paddingVertical: 6,
    paddingHorizontal: space.md,
  },
  removeLabel: { color: colors.muted, fontSize: 13 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  action: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.chip,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  actionLabel: { color: colors.ink, fontSize: 13 },
});
