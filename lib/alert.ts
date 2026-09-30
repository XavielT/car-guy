import { Alert as RNAlert, Platform } from 'react-native';

import { takeReportable } from './diagnostics';
import { FEATURE_FEEDBACK } from './flags';
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
  /** An error alert: AlertHost adds the "Reportar" link (PROMPT-06 item 4). */
  report?: boolean;
};

/**
 * "Error alert": the one alert right after an error the screen chose to show
 * (`userMessage()`'s fallback, the photo pickers — lib/diagnostics.ts
 * `recordReportable`). A confirmation with its own choices (three buttons) is
 * left alone. Consumes the mark, so only that alert gets the link.
 */
export function isErrorAlert(buttons: AlertButton[] | undefined, now = Date.now()): boolean {
  if (!FEATURE_FEEDBACK) return false;
  const armed = takeReportable(now);
  return armed && (buttons?.length ?? 0) <= 2;
}

/** Opens Enviar comentario as a bug report, from the route the error happened on. */
export function openReport(): void {
  void import('./feedback').then((m) => m.openFeedback('bug'));
}

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
    report: isErrorAlert(buttons),
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
    // Native: the platform dialog takes up to three buttons. "Reportar" goes
    // first — Android's neutral slot, on the left — so it never becomes the
    // main button of the dialog.
    RNAlert.alert(
      title,
      message,
      isErrorAlert(buttons) ? [{ text: es.feedback.report, onPress: openReport }, ...(buttons?.length ? buttons : OK)] : buttons,
    );
  },
};
