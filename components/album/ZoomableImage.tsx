import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMediaUri } from '@/lib/media/useMediaUri';

/**
 * One photo in the viewer: pinch to zoom (1–4×), pan while zoomed, double-tap
 * to toggle 2×. Own implementation over gesture-handler + reanimated (research
 * §6: the viewer libraries are unmaintained or native-only), so it works on web
 * too. The full copy loads over the thumb — the thumb is on the device already.
 *
 * `onZoomChange` tells the pager to stop paging while a photo is zoomed, so a
 * pan inside the photo is not read as a swipe to the next one.
 */
export function ZoomableImage({
  mediaId,
  blurhash,
  width,
  height,
  onZoomChange,
  active = true,
}: {
  mediaId: string;
  blurhash?: string | null;
  width: number;
  height: number;
  onZoomChange?: (zoomed: boolean) => void;
  /** Only the page on screen loads its full copy; neighbours show the thumb (egress). */
  active?: boolean;
}) {
  const full = useMediaUri(active ? mediaId : null);
  const thumb = useMediaUri(mediaId, { thumb: true });

  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const report = (zoomed: boolean) => onZoomChange?.(zoomed);

  // Keeps the photo from being dragged off screen at the current scale.
  const clamp = (v: number, s: number, size: number) => {
    'worklet';
    const max = ((s - 1) * size) / 2;
    return Math.min(max, Math.max(-max, v));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.min(4, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      'worklet';
      saved.value = scale.value;
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        saved.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
      runOnJS(report)(saved.value > 1.01);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      'worklet';
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (scale.value <= 1) return;
      tx.value = clamp(startX.value + e.translationX, scale.value, width);
      ty.value = clamp(startY.value + e.translationY, scale.value, height);
    });
  // Only claims the gesture while zoomed; unzoomed, the pager's swipe wins.
  const panWhenZoomed = pan.manualActivation(true).onTouchesMove((_e, manager) => {
    'worklet';
    if (scale.value > 1.01) manager.activate();
    else manager.fail();
  });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      const next = scale.value > 1.01 ? 1 : 2;
      scale.value = withTiming(next);
      saved.value = next;
      if (next === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      }
      runOnJS(report)(next > 1);
    });

  const gesture = Gesture.Simultaneous(pinch, panWhenZoomed, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <Image
          source={full ? { uri: full } : thumb ? { uri: thumb } : undefined}
          placeholder={thumb ? { uri: thumb } : blurhash ? { blurhash } : undefined}
          placeholderContentFit="contain"
          contentFit="contain"
          recyclingKey={mediaId}
          transition={120}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </GestureDetector>
  );
}
