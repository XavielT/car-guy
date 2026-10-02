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
    // TEST_APP_VERSION=2.4.0: the test app claims an older version so the real /api/apk offers the update
    // (IMP 01102026 Phase 4 — trying the APK updater without publishing a fake release).
    version: process.env.TEST_APP_VERSION || config.version,
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

/**
 * IMP 01102026 Phase 6: Gradle's JVM limits for every native build path (local gradle, `eas build --local`).
 * expo-updates pushed the build past the generated 512 MB Metaspace (an OOM on 2026-10-01).
 */
function withGradleMemory(config) {
  const { withGradleProperties } = require('expo/config-plugins');
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'));
    c.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx4096m -XX:MaxMetaspaceSize=1536m' });
    return c;
  });
}

/**
 * Junte chat push (sql/039): Android needs Firebase (FCM v1) for an Expo push token. google-services.json comes
 * from the Firebase console (Android apps com.xaviel.carguy AND com.xaviel.carguy.test in one project) and is
 * committed — it is a client config, not a secret. Until it exists nothing changes: same native config, same
 * runtime fingerprint, and lib/notifications/push.ts just gets no token.
 */
function withFirebase(config) {
  const file = require('node:path').join(__dirname, 'google-services.json');
  if (!require('node:fs').existsSync(file)) return config;
  return { ...config, android: { ...config.android, googleServicesFile: './google-services.json' } };
}

module.exports = ({ config }) => {
  assertReleaseEnv();
  const base = withGradleMemory(withFirebase(withChannel(applyVariant(config))));
  return {
    ...base,
    extra: { ...base.extra, gitSha: gitSha(), variant: process.env.APP_VARIANT ?? null },
  };
};
