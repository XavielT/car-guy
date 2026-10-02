/**
 * What the EAS Update runtime fingerprint must NOT hash (IMP 01102026 Phase 4, ADR-52).
 *
 * app.config.js puts the commit sha into `extra` and every release bumps `version`; with those hashed,
 * each commit would get its own runtime and no OTA would ever reach an installed APK. Neither changes native
 * code. Package name, scheme, permissions, plugins and native packages still count — a change there needs a
 * new APK, and tools/release-apk.sh --ota refuses it.
 *
 * The expo-location patch only touches the browser shim (build/ExpoLocation.web.js), which no APK or OTA bundle
 * contains — hashing it would demand a new APK for a web-only fix.
 */
const { SourceSkips } = require('@expo/fingerprint');

/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  sourceSkips:
    SourceSkips.ExpoConfigVersions |
    SourceSkips.ExpoConfigExtraSection |
    SourceSkips.PackageJsonScriptsAll |
    SourceSkips.GitIgnore,
  ignorePaths: ['patches/expo-location+*.patch'],
};
