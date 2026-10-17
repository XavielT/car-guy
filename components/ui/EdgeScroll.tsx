import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

/** Which sides of a horizontal strip still have content beyond the edge (pure; tested). */
export function edgeState(offset: number, contentWidth: number, layoutWidth: number): { left: boolean; right: boolean } {
  if (contentWidth <= layoutWidth + 1) return { left: false, right: false };
  return { left: offset > 4, right: offset + layoutWidth < contentWidth - 4 };
}

/** Where to scroll so the item at [x, x + w] sits in the middle, clamped to the strip. */
export function centerOffset(x: number, w: number, contentWidth: number, layoutWidth: number): number {
  const target = x + w / 2 - layoutWidth / 2;
  return Math.max(0, Math.min(target, Math.max(0, contentWidth - layoutWidth)));
}

/**
 * A horizontal strip that says there is more (IMP 16102026 X4): a fade over the edge that still has content, and the
 * active item brought to the middle when `active` changes or the strip is first laid out. `bg` is the colour the fade
 * dissolves into — the strip's own background.
 */
export function EdgeScroll({
  children,
  bg,
  active,
  contentContainerStyle,
  accessibilityRole,
  testID,
}: {
  children: ReactNode;
  bg: string;
  /** The active item's box inside the content (from its onLayout), to centre it. */
  active?: { x: number; w: number } | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: 'tablist' | 'list';
  testID?: string;
}) {
  const ref = useRef<ScrollView>(null);
  const [offset, setOffset] = useState(0);
  const [content, setContent] = useState(0);
  const [layout, setLayout] = useState(0);
  const { left, right } = edgeState(offset, content, layout);

  useEffect(() => {
    if (!active || !layout || !content) return;
    ref.current?.scrollTo({ x: centerOffset(active.x, active.w, content, layout), animated: false });
  }, [active?.x, active?.w, layout, content]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(e.nativeEvent.contentOffset.x), []);
  const onLayout = useCallback((e: LayoutChangeEvent) => setLayout(e.nativeEvent.layout.width), []);

  return (
    <View onLayout={onLayout} testID={testID}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={onScroll}
        onContentSizeChange={(w) => setContent(w)}
        contentContainerStyle={contentContainerStyle}
        accessibilityRole={accessibilityRole}>
        {children}
      </ScrollView>
      {left ? <LinearGradient pointerEvents="none" colors={[bg, `${bg}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { left: 0 }]} /> : null}
      {right ? <LinearGradient pointerEvents="none" colors={[`${bg}00`, bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { right: 0 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, bottom: 0, width: 28 },
});
