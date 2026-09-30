import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { appVersion, gitSha } from '@/lib/appVersion';

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
export const installedVersion: string | null =
  Application.nativeApplicationVersion ?? (appVersion === '—' ? null : appVersion);

/** Android's versionCode; null on web. */
export const buildNumber: string | null = Platform.OS === 'web' ? null : Application.nativeBuildVersion;

export { gitSha };
