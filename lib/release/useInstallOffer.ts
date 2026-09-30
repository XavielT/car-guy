import { Platform } from 'react-native';

import { isAndroidBrowser } from './apk';

/**
 * Offer the APK (Más row, Inicio pill) only in a browser on Android — never
 * inside the native app, never on iOS or desktop (they get the PWA hint on
 * /instalar). Constant for the page's life, so no state.
 */
export function useInstallOffer(): boolean {
  return Platform.OS === 'web' && isAndroidBrowser(globalThis.navigator as never);
}
