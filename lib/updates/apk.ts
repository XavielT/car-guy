import { Platform } from 'react-native';

import { recordError } from '../diagnostics';
import type { ApkInfo } from '../release/apk';
import { isNewer } from './semver';
import { getUpdateState, setUpdateState } from './store';

/**
 * The APK updater (IMP 01102026 Phase 4, ADR-52, research 01 §3b): when GitHub has a newer release than the
 * installed binary (a native change no OTA can carry), offer it, download it with progress and hand it to
 * Android's installer. The user does the install taps; nothing installs in the background. Android only.
 */
const SITE = 'https://car-guy.vercel.app';
/** A test build can point at another feed (a mock release) — EXPO_PUBLIC_APK_FEED, never set for releases. */
const FEED = process.env.EXPO_PUBLIC_APK_FEED || `${SITE}/api/apk`;

const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;
const APK_MIME = 'application/vnd.android.package-archive';

let checkedThisLaunch = false;

async function installedVersion(): Promise<string | null> {
  const A = await import('expo-application');
  return A.nativeApplicationVersion;
}

/** Once per launch unless `force` (Novedades → "Buscar actualización"). Null when up to date or unknown. */
export async function checkApk(force = false): Promise<ApkInfo | null> {
  if (Platform.OS !== 'android' || __DEV__) return null;
  if (checkedThisLaunch && !force) return getUpdateState().apk;
  checkedThisLaunch = true;
  try {
    const res = await fetch(FEED, { cache: 'no-store' });
    if (!res.ok) return null;
    const info = (await res.json()) as ApkInfo;
    const newer = info?.version && info.url && isNewer(info.version, await installedVersion()) ? info : null;
    setUpdateState({ apk: newer, checkedAt: Date.now() });
    return newer;
  } catch {
    return null;
  }
}

/** Old downloads from earlier updates (research §3b: clean the cache on the next launch). */
export async function cleanOldApks(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { Directory, Paths } = await import('expo-file-system');
    for (const entry of new Directory(Paths.cache).list()) {
      if (/^car-guy-.*\.apk$/.test(entry.name)) entry.delete();
    }
  } catch {
    // best effort
  }
}

export type InstallResult = { ok: true } | { ok: false; reason: 'size' | 'download' | 'intent' };

/** Download (progress into the store) → size check → the system installer via a content:// URI. */
export async function downloadAndInstall(info: ApkInfo): Promise<InstallResult> {
  const { File, Paths } = await import('expo-file-system');
  const dest = new File(Paths.cache, `car-guy-${info.version}.apk`);
  let file: InstanceType<typeof File>;
  try {
    if (dest.exists) dest.delete();
    setUpdateState({ progress: 0, error: null });
    const task = File.createDownloadTask(info.url, dest, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const total = totalBytes > 0 ? totalBytes : (info.size ?? 0);
        if (total > 0) setUpdateState({ progress: Math.min(1, bytesWritten / total) });
      },
    });
    const done = await task.downloadAsync();
    if (!done) throw new Error('cancelled');
    file = done;
  } catch (e) {
    recordError('apk-download', e);
    setUpdateState({ progress: null, error: 'download' });
    return { ok: false, reason: 'download' };
  }
  // A cut-off download would make the installer say "problem parsing the package".
  if (info.size != null && file.size !== info.size) {
    file.delete();
    setUpdateState({ progress: null, error: 'size' });
    return { ok: false, reason: 'size' };
  }
  setUpdateState({ progress: null });
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: file.contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
    });
    return { ok: true };
  } catch (e) {
    recordError('apk-intent', e);
    setUpdateState({ error: 'intent' });
    return { ok: false, reason: 'intent' };
  }
}
