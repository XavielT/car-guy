import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useStore } from '@/lib/store';
import { contentMax } from '@/lib/theme/layout';
import { useLayout } from '@/lib/theme/useLayout';
import { useTheme } from '@/lib/theme/useTheme';
import { ShortcutsHost } from './ShortcutsHost';
import { SideRail } from './SideRail';

/** Routes where the rail must not appear: the welcome, onboarding, and full-screen photo viewing are not "the app". */
const NO_RAIL = ['/bienvenida', '/onboarding', '/foto'];

/**
 * The frame around every screen on the web (SPEC-F §F2, ADR-70).
 *  - compact: renders `children` untouched. The phone layout does not change by a pixel.
 *  - regular (768–1023): a centred column, the tab bar stays.
 *  - wide (>= 1024): the side rail on the left, the content centred beside it, up to 1200 px for dashboards and lists and 760 px for
 *    a form or a single record (a stretched form is harder to read, not easier).
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const { layout } = useLayout();
  const { ready, data } = useStore();
  if (layout === 'compact') return <>{children}</>;

  const max = contentMax(layout, pathname);
  const showRail = layout === 'wide' && ready && data.vehicles.length > 0 && !NO_RAIL.some((p) => pathname.startsWith(p));
  const frame = (
    <View style={{ flex: 1, width: '100%', maxWidth: max ?? undefined, alignSelf: 'center', ...(layout === 'regular' ? { borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.line } : {}) }}>
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.bg.well }}>
      {showRail ? <SideRail /> : null}
      <ShortcutsHost />
      <View style={{ flex: 1 }}>{frame}</View>
    </View>
  );
}
