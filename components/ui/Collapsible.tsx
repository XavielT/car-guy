import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { space } from '@/constants/theme';
import { settings } from '@/lib/db/repos';
import { useTheme } from '@/lib/theme/useTheme';
import { T } from '../T';

/** Content fades in over this long (ms) when a section opens; none with "reduce motion". */
export const COLLAPSIBLE_MS = 180;
const key = (id: string) => `collapsible:${id}`;

/**
 * A section that opens and closes and REMEMBERS which it was, per person (SPEC-K §K7). `id` names the memory; `defaultOpen` is what a
 * person who never touched it sees. A header ≤ 3 words, sentence case, with an optional count so a closed section still says what is in it.
 */
export function Collapsible({
  id,
  title,
  count,
  hint,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  count?: number | string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    let live = true;
    void settings
      .get<boolean | null>(key(id), null)
      .then((v) => {
        if (live && typeof v === 'boolean') setOpen(v);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    void settings.set(key(id), next).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={count != null ? `${title}, ${count}` : title}
        style={styles.head}>
        <View style={{ flex: 1 }}>
          <T face="semibold" style={{ color: theme.text.primary, fontSize: 16 }}>
            {title}
          </T>
          {hint && !open ? (
            <T face="body" numberOfLines={1} style={{ color: theme.text.muted, fontSize: 12, marginTop: 1 }}>
              {hint}
            </T>
          ) : null}
        </View>
        {count != null ? (
          <T face="mono" style={{ color: theme.text.muted, fontSize: 13 }}>
            {count}
          </T>
        ) : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.text.secondary} />
      </Pressable>
      {open ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(COLLAPSIBLE_MS)} style={{ paddingTop: space.xs }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.sm },
  head: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
});
