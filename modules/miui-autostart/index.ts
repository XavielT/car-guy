/**
 * MIUI's "Inicio automático" for Car Guy (modules/miui-autostart, Android only).
 * `unknown` on web, iOS, non-Xiaomi phones, Expo Go, or when MIUI changes the
 * hidden API — the checklist then just shows the step without a verdict.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export type AutostartState = 'enabled' | 'disabled' | 'unknown';

type Native = { getState(): string; openSettings(): boolean };

const native = requireOptionalNativeModule<Native>('MiuiAutostart');

export function getAutostartState(): AutostartState {
  try {
    const s = native?.getState();
    return s === 'enabled' || s === 'disabled' ? s : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Opens MIUI's autostart list (else the app's settings); false when neither could open. */
export function openAutostartSettings(): boolean {
  try {
    return native?.openSettings() ?? false;
  } catch {
    return false;
  }
}
