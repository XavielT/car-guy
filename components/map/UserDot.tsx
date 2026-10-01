import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';

/** The ring is the app's amber; greyed while the position is old (ADR-49). */
const RING = '#FFB300';
const RING_OLD = '#8A8A8A';
export const USER_DOT_SIZE = 46;

/**
 * "Me" on the drive-mode map (IMP 01102026 note 16): the person's avatar (photo → drawing → initials) in an
 * amber ring, with a small course arrow when the phone knows the heading. `fresh = false` greys it — the
 * last good position, not a claim about now. Native (inside a MapLibre <Marker>) and web (an overlay
 * positioned by the map) draw the same component.
 */
export function UserDot({
  fresh,
  arrowDeg,
  photoUri,
  avatarId,
  name,
}: {
  fresh: boolean;
  /** Arrow rotation on screen (heading − map bearing), degrees; null hides it. */
  arrowDeg: number | null;
  photoUri?: string | null;
  avatarId?: string | null;
  name?: string | null;
}) {
  const ring = fresh ? RING : RING_OLD;
  return (
    <View style={[styles.box, !fresh && styles.old]} pointerEvents="none">
      {arrowDeg != null ? (
        <View style={[styles.arrowWrap, { transform: [{ rotate: `${arrowDeg}deg` }] }]}>
          <View style={[styles.arrow, { borderBottomColor: ring }]} />
        </View>
      ) : null}
      <View style={[styles.ring, { borderColor: ring }]}>
        <Avatar size={USER_DOT_SIZE - 10} photoUri={photoUri} avatarId={avatarId} name={name} decorative />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: USER_DOT_SIZE + 16, height: USER_DOT_SIZE + 16, alignItems: 'center', justifyContent: 'center' },
  old: { opacity: 0.55 },
  ring: {
    width: USER_DOT_SIZE,
    height: USER_DOT_SIZE,
    borderRadius: USER_DOT_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0D',
    overflow: 'hidden',
  },
  arrowWrap: { position: 'absolute', width: USER_DOT_SIZE + 16, height: USER_DOT_SIZE + 16, alignItems: 'center' },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
