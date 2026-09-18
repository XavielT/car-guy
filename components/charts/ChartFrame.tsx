import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { space } from '@/constants/theme';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';
import { Surface } from '../ui';

/**
 * The card every chart sits in: a title, an optional caption, and the measured
 * inner width handed to the chart itself.
 *
 * The width matters more than it looks. `react-native-gifted-charts` lays out
 * in absolute pixels, so a chart that guesses is either clipped on a phone or
 * marooned in white space on a wide browser window. Measuring with `onLayout`
 * is the only figure that is right on both, and it costs one extra render on
 * mount.
 *
 * Children are a render prop rather than plain nodes so nothing draws until the
 * width is known — gifted-charts given a width of 0 renders a broken axis
 * rather than nothing at all.
 *
 * The width handed down is capped and the plot is centred. On a phone the cap
 * never bites; on a desktop browser it stops six bars from huddling against the
 * y-axis with half a metre of empty card beside them.
 */
const MAX_PLOT_WIDTH = 560;

export function ChartFrame({
  title,
  caption,
  empty,
  children,
  trailing,
}: {
  title: string;
  caption?: string;
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: string;
  children: (width: number) => ReactNode;
  trailing?: ReactNode;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  return (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T face="title" style={[styles.title, { color: theme.text.primary }]}>
            {title}
          </T>
          {caption ? (
            <T face="body" style={[styles.caption, { color: theme.text.secondary }]}>
              {caption}
            </T>
          ) : null}
        </View>
        {trailing}
      </View>

      <View onLayout={onLayout} style={styles.body}>
        {empty ? (
          <T face="body" style={[styles.empty, { color: theme.text.muted }]}>
            {empty}
          </T>
        ) : width > 0 ? (
          <View style={styles.plot}>{children(Math.min(width, MAX_PLOT_WIDTH))}</View>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.lg },
  title: { fontSize: 17 },
  caption: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  body: { width: '100%' },
  plot: { alignSelf: 'center', width: '100%', maxWidth: MAX_PLOT_WIDTH },
  empty: { fontSize: 13, lineHeight: 19, paddingVertical: space.lg },
});
