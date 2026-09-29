import Constants from 'expo-constants';

/** The app's version, as app.json says (e.g. "2.1.3"). */
export const appVersion: string = Constants.expoConfig?.version ?? '—';

/**
 * The commit the build came from. Two sources because neither covers both
 * platforms: `app.config.js` puts the SHA in `extra`, which is what a native/EAS
 * build reads — but `expo export` inlines only `extra.router` into the web
 * manifest and drops everything else, so web reads the EXPO_PUBLIC_ var that
 * `npm run build` sets instead.
 */
export const gitSha: string | null =
  (Constants.expoConfig?.extra as { gitSha?: string } | undefined)?.gitSha ?? process.env.EXPO_PUBLIC_GIT_SHA ?? null;
