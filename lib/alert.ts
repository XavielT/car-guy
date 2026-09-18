import { Alert as RNAlert, Platform } from 'react-native';

import { es } from './i18n/es';

/**
 * `react-native-web` ships `Alert.alert` as an empty function, so on web every
 * confirmation silently does nothing — and because the real work lives in a
 * button's `onPress`, "Borrar todo" and friends become dead buttons rather than
 * merely quiet ones.
 *
 * Until Phase 6 this mapped onto `window.alert` / `window.confirm`, which fixed
 * the dead buttons but bought a worse problem: those dialogs block the browser's
 * main thread, so the app freezes behind an OS-chrome box that belongs to no
 * identity at all, and nothing can drive the page while one is open. Now web
 * routes through `<AlertHost>` — a themed Modal inside the app — and native
 * keeps the platform dialog, which is what an Android user expects there.
 *
 * Import this instead of `Alert` from 'react-native'; the call sites are
 * unchanged.
 */

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

type Listener = (request: AlertRequest) => void;

let listener: Listener | null = null;
let sequence = 0;

/**
 * Mounted once by `<AlertHost>`. Only one host exists, so this is a single slot
 * rather than a set — a second host would mean two dialogs for one call.
 */
export function subscribeToAlerts(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

/** The implicit "OK" a native alert shows when given no buttons. */
const OK: AlertButton[] = [{ text: es.common.ok }];

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const request: AlertRequest = {
    id: (sequence += 1),
    title,
    message,
    buttons: buttons?.length ? buttons : OK,
  };

  if (listener) {
    listener(request);
    return;
  }

  // No host yet — during the boot screen, or if someone alerts from a module
  // that runs before the tree mounts. A blocking dialog is worse than this one
  // is good, but losing the message entirely is worse still.
  window.alert(message ? `${title}\n\n${message}` : title);
  request.buttons.find((b) => b.style !== 'cancel')?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (Platform.OS === 'web') {
      webAlert(title, message, buttons);
      return;
    }
    RNAlert.alert(title, message, buttons);
  },
};
