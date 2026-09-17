import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/**
 * Bottom sheet for the quick-add flows. A plain Modal with an animated
 * translate — no new dependency, and it behaves the same on web, where the
 * gesture-driven sheet libraries tend not to.
 *
 * Dismiss is tap-the-scrim or the hardware back button; there is no drag, which
 * keeps it predictable inside scrolling forms.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  // useState, not useRef: the value is read during render to build the
  // transform, and reading a ref there is exactly what react-hooks/refs forbids.
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.bg.surface, borderColor: theme.line, transform: [{ translateY }] },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.text.muted }]} />
        {title ? (
          <T face="title" style={[styles.title, { color: theme.text.primary }]}>
            {title}
          </T>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    opacity: 0.5,
    marginBottom: space.lg,
  },
  title: { fontSize: 20, marginBottom: space.lg },
});
