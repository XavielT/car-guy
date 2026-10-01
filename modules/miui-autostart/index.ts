/**
 * MIUI's "Inicio automático" for Car Guy (modules/miui-autostart, Android only).
 * `unknown` on web, iOS, non-Xiaomi phones, Expo Go, or when MIUI changes the
 * hidden API — the checklist then just shows the step without a verdict.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

export type AutostartState = 'enabled' | 'disabled' | 'unknown';

type Native = { getState(): string; openSettings(): boolean; getBatteryState?(): string; openBatterySettings?(): boolean };

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

/**
 * Battery optimisation (IMP 01102026 Phase 1): 'unrestricted' = Android exempts Car Guy from Doze limits.
 * Not MIUI-specific (PowerManager); 'unknown' on web, iOS, Expo Go or an older APK without the function.
 */
export type BatteryState = 'unrestricted' | 'optimized' | 'unknown';

export function getBatteryState(): BatteryState {
  try {
    const s = native?.getBatteryState?.();
    return s === 'unrestricted' || s === 'optimized' ? s : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** The system's "allow in background" dialog (else the battery list); false when neither opened. */
export function openBatterySettings(): boolean {
  try {
    return native?.openBatterySettings?.() ?? false;
  } catch {
    return false;
  }
}
