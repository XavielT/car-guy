import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/lib/theme/useTheme';

/**
 * Master/detail for a wide window (SPEC-F §F2): the list on the left, a pane on the right. With `wide` false it renders `children`
 * alone as a bare fragment, so a phone's DOM and layout are exactly what they were.
 */
export function SplitPane({ wide, pane, paneWidth = 400, children }: { wide: boolean; pane: ReactNode; paneWidth?: number; children: ReactNode }) {
  const { theme } = useTheme();
  if (!wide) return <>{children}</>;
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <View style={{ width: paneWidth, borderLeftWidth: 1, borderColor: theme.line, backgroundColor: theme.bg.surface, padding: 20 }}>{pane}</View>
    </View>
  );
}
