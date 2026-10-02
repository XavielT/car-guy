import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { appVersion, gitSha } from '@/lib/appVersion';
import { compareVersions } from '@/lib/updates/semver';

/**
 * Where "Buscar actualización" goes. One constant so Phase 7 can point it at
 * the web's /instalar page once it exists.
 */
export const UPDATE_URL = 'https://github.com/XavielT/car-guy/releases/latest';

/** The release notes of one version on GitHub. */
export function releaseUrl(version: string): string {
  return `https://github.com/XavielT/car-guy/releases/tag/v${version}`;
}

/**
 * What is running. The installed binary's version when there is one (the APK
 * knows it for sure), else app.json's — on web expo-application returns null.
 */
export const installedVersion: string | null = newest(Application.nativeApplicationVersion, appVersion === '—' ? null : appVersion);

/**
 * IMP 01102026 Phase 4: after an OTA the JS (expoConfig.version, from the update's manifest) is newer than
 * the binary — 2.5.1 running on the 2.5.0 APK is "2.5.1". Whichever of the two is newer.
 */
function newest(native: string | null, js: string | null): string | null {
  if (!native) return js;
  if (!js) return native;
  return compareVersions(js, native) === 1 ? js : native;
}

/** Android's versionCode; null on web. */
export const buildNumber: string | null = Platform.OS === 'web' ? null : Application.nativeBuildVersion;

export { gitSha };
