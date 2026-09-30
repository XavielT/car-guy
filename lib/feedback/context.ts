import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { appVersion, gitSha } from '../appVersion';
import { LATEST_VERSION } from '../db/migrations';
import { recentErrors } from '../diagnostics';
import * as Flags from '../flags';
import type { FeedbackContext } from './payload';

/**
 * What "Lo que se envía" shows and sends: read from the device when the form
 * opens. No expo-device — Platform.constants already carries the Android
 * model and manufacturer, and a new native module would need a new build
 * of every variant for one string.
 */

function deviceName(): string | null {
  if (Platform.OS === 'android') {
    const c = Platform.constants as { Manufacturer?: string; Brand?: string; Model?: string };
    const maker = c.Manufacturer || c.Brand || '';
    const model = c.Model ?? '';
    const name = model.toLowerCase().startsWith(maker.toLowerCase()) ? model : `${maker} ${model}`;
    return name.trim() || null;
  }
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') return navigator.userAgent.slice(0, 120);
  return null;
}

function osVersion(): string | null {
  if (Platform.OS === 'android') {
    const c = Platform.constants as { Release?: string; Version?: number };
    return [c.Release ? `Android ${c.Release}` : null, c.Version ? `API ${c.Version}` : null].filter(Boolean).join(' · ') || null;
  }
  // react-native-web reports '0.0.0'; the user agent (device) says more.
  if (Platform.OS === 'web') return null;
  return Platform.Version != null ? String(Platform.Version) : null;
}

function flags(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(Flags)) if (typeof value === 'boolean') out[key] = value;
  return out;
}

const variant = (Constants.expoConfig?.extra as { variant?: unknown } | undefined)?.variant;

export function collectContext(input: {
  screen: string | null;
  sync: FeedbackContext['sync'];
  diagnosticsMode: boolean;
  secrets: (string | null | undefined)[];
}): FeedbackContext {
  return {
    appVersion: Application.nativeApplicationVersion ?? appVersion,
    build: Application.nativeBuildVersion ?? null,
    gitSha,
    variant: typeof variant === 'string' ? variant : null,
    platform: Platform.OS,
    osVersion: osVersion(),
    device: deviceName(),
    screen: input.screen,
    flags: flags(),
    dbVersion: LATEST_VERSION,
    sync: input.sync,
    diagnosticsMode: input.diagnosticsMode,
    errors: recentErrors(),
    secrets: input.secrets.filter((s): s is string => typeof s === 'string' && s.trim().length > 0),
  };
}
