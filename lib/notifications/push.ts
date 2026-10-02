import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { recordError } from '../diagnostics';
import { rpc } from '../social/rpc';
import { hasPermission, requestPermission } from './index';

/**
 * The device's Expo push token, registered on the signed-in Car Guy account (sql/039 push_token) so junte chat
 * messages reach it through api/junte-push.ts.
 *
 * Native only: the iPhone is a web app (ADR-48) and Expo push does not do web push, so there the chat is read
 * while Car Guy is open. On Android a token needs Firebase in the build (app.config.js withFirebase); without it
 * `getExpoPushTokenAsync` throws and this quietly registers nothing — the 2.5.0 APK is in that state.
 *
 * Never asks by itself: `ask` is set only from the junte chat, where a member has a reason to say yes.
 */

export const JUNTES_CHANNEL = 'juntes';

let registered: string | null = null;

export const pushSupported = () => Platform.OS === 'android' || Platform.OS === 'ios';

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** The token, or null (web, no permission, no Firebase, offline). */
async function deviceToken(ask: boolean): Promise<string | null> {
  if (!pushSupported()) return null;
  const granted = ask ? await requestPermission() : await hasPermission();
  if (!granted) return null;
  // Inline require, evaluated only here (native): web never runs expo-notifications.
  const N = require('expo-notifications') as typeof import('expo-notifications');
  try {
    const id = projectId();
    const { data } = await N.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    return typeof data === 'string' ? data : null;
  } catch (e) {
    // "Default FirebaseApp is not initialized" until google-services.json is in the build.
    recordError('push-token', String((e as Error)?.message ?? e));
    return null;
  }
}

/** Registers this device for the signed-in account; once per launch unless the token changes. */
export async function registerPush({ ask = false }: { ask?: boolean } = {}): Promise<boolean> {
  const token = await deviceToken(ask);
  if (!token) return false;
  if (registered === token) return true;
  const r = await rpc<null>('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (!r.ok) return false;
  registered = token;
  return true;
}

/** Before sign-out, while the session is still valid: this phone stops getting the account's pushes. */
export async function unregisterPush(): Promise<void> {
  const token = registered ?? (await deviceToken(false));
  registered = null;
  if (!token) return;
  await rpc<null>('unregister_push_token', { p_token: token });
}
