import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { t } from '@/lib/i18n';
import { NAV_ITEMS } from '@/lib/nav/model';
import { railActive } from '@/lib/theme/layout';

/**
 * The browser tab's title (WCAG 2.4.2, found by the axe check of PROMPT-12: the page had none). "Hoy · Car Guy" on a main destination, plain
 * "Car Guy" elsewhere. Web only; renders nothing.
 */
export function DocumentTitle() {
  const pathname = usePathname();
  const id = railActive(pathname);
  const here = id ? NAV_ITEMS.find((i) => i.id === id)?.label() : null;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = here ? `${here} · ${t.app.name}` : t.app.name;
  }, [here]);
  return null;
}
