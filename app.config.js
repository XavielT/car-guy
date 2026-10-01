/**
 * app.json, plus the one thing a static file cannot know: which commit this is.
 *
 * Every field still lives in app.json — this file only receives it and appends
 * `extra.gitSha`, so there is one place to edit the app's identity and no risk
 * of the two drifting.
 *
 * The SHA comes from whichever builder is running, because none of them agree:
 * Vercel and EAS each inject their own variable, and a local `expo export` has
 * neither but does have a .git directory. A build that cannot find any of the
 * three ships without the line rather than failing — the version number is the
 * part that matters, and the SHA is for telling two builds of 2.0.0 apart.
 */
const { execSync } = require('node:child_process');

function gitSha() {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.EAS_BUILD_GIT_COMMIT_HASH;
  if (fromCi) return fromCi.slice(0, 7);

  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// Expo reads app.json and passes it in as `config`; building on that (rather
// than require-ing app.json here) is the documented shape, and the one
// expo-doctor checks for.
/**
 * A release build without the Supabase values ships an app whose Cuenta says
 * "no disponible" forever — 2.1.0–2.1.2 did exactly that (IMP 29092026 note 13).
 * EAS evaluates this file inside the build, so an empty value stops it here,
 * with the variable's name in the build log. eas.json `base.env` and the EAS
 * environments `preview`/`production` both provide them; development builds and
 * a plain `expo start` without .env.local stay allowed (cloud off is a
 * supported state, ADR-05).
 */
function assertReleaseEnv() {
  const isEasRelease = process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PROFILE !== 'development';
  if (!isEasRelease) return;
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']) {
    if (!process.env[name]) {
      throw new Error(`[car-guy] ${name} is empty in this ${process.env.EAS_BUILD_PROFILE ?? ''} build — refusing to build without the cloud (see eas.json base.env).`);
    }
  }
}

/**
 * `APP_VARIANT=test`: a second app on the same phone — its own package, name
 * and URL scheme, so it installs next to the real Car Guy with separate data.
 * For trying a phase build on Xaviel's Redmi without touching his garage
 * (IMP 29092026). Never a release: tools/release-apk.sh does not set it.
 */
function applyVariant(config) {
  if (process.env.APP_VARIANT !== 'test') return config;
  return {
    ...config,
    name: 'Car Guy (prueba)',
    scheme: 'carguytest',
    android: { ...config.android, package: 'com.xaviel.carguy.test' },
    ios: config.ios ? { ...config.ios, bundleIdentifier: 'com.xaviel.carguy.test' } : config.ios,
  };
}

/**
 * IMP 01102026 ADR-52: the EAS Update channel, written into the binary as the request header, so a local
 * gradle/EAS build asks for the right updates whatever the build path (research 01 §3a: "verify once").
 * The test app listens to `preview`; every real build to `production`.
 */
function withChannel(config) {
  const channel = process.env.APP_VARIANT === 'test' ? 'preview' : 'production';
  return { ...config, updates: { ...config.updates, requestHeaders: { ...config.updates?.requestHeaders, 'expo-channel-name': channel } } };
}

module.exports = ({ config }) => {
  assertReleaseEnv();
  const base = withChannel(applyVariant(config));
  return {
    ...base,
    extra: { ...base.extra, gitSha: gitSha(), variant: process.env.APP_VARIANT ?? null },
  };
};
