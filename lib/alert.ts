import { Alert as RNAlert, Platform } from 'react-native';

/**
 * `react-native-web` ships `Alert.alert` as an empty function, so on web every
 * confirmation silently does nothing — and because the real work lives in a
 * button's `onPress`, "Borrar todo" and friends become dead buttons rather than
 * merely quiet ones. This maps the same call shape onto the browser dialogs.
 *
 * Import this instead of `Alert` from 'react-native'; the call sites are
 * unchanged.
 */

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const body = message ? `${title}\n\n${message}` : title;

  // No buttons, or a single one: a plain notice. A lone button is the implicit
  // "OK", so dismissing the notice runs it — that is what tapping it does natively.
  if (!buttons || buttons.length === 0) {
    window.alert(body);
    return;
  }

  const cancel = buttons.find((b) => b.style === 'cancel');
  const confirm = buttons.find((b) => b.style !== 'cancel');

  if (cancel && confirm) {
    if (window.confirm(body)) confirm.onPress?.();
    else cancel.onPress?.();
    return;
  }

  window.alert(body);
  confirm?.onPress?.();
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
