import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { layoutClass, type LayoutClass } from './layout';

/**
 * `useLayout()` (SPEC-F §F1): the layout class for this window, and whether the pointer is a mouse. Phones and the APK are always
 * `compact`. `desktopPointer` is true for a mouse/trackpad (hover + fine pointer): hover states and tooltips only make sense then.
 */
export function useLayout(): { layout: LayoutClass; width: number; wide: boolean; compact: boolean; desktopPointer: boolean } {
  const { width } = useWindowDimensions();
  const [desktopPointer, setDesktopPointer] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setDesktopPointer(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  const layout = layoutClass(width, Platform.OS === 'web');
  return { layout, width, wide: layout === 'wide', compact: layout === 'compact', desktopPointer };
}
