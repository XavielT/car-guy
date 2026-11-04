import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/constants/theme';

/**
 * Two columns for a dashboard on a wide window (SPEC-F §F2). On a phone or a regular window (`wide` false) both components render their
 * children as a bare fragment, so the DOM and the layout are exactly what they were: the phone layout does not change.
 */
export function DashCols({ wide, children }: { wide: boolean; children: ReactNode }) {
  if (!wide) return <>{children}</>;
  return <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>{children}</View>;
}

export function DashCol({ wide, side, children }: { wide: boolean; side: 'left' | 'right'; children: ReactNode }) {
  if (!wide) return <>{children}</>;
  return <View style={side === 'left' ? { width: '42%', minWidth: 400, maxWidth: 520 } : { flex: 1, minWidth: 0 }}>{children}</View>;
}
