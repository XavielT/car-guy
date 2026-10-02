#!/usr/bin/env bash
# Builds "TEST Car Guy" — package com.xaviel.carguy.test, arm64 only — from
# the current checkout, for trying a phase on a real phone next to the real app
# (separate data, separate package; signed with the debug key, never released).
#
#   bash tools/build-test-apk.sh            → releases/car-guy-test.apk
#   ARCH=x86_64 bash tools/build-test-apk.sh → releases/car-guy-test-x86_64.apk (emulator)
#   adb install -r releases/car-guy-test.apk
#
# The cloud values come from .env.local, as for `expo start`.
set -euo pipefail
cd "$(dirname "$0")/.."
export ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk" APP_VARIANT=test
# React Native's Gradle plugin rewrites library manifests inside node_modules (it drops `package=`) and leaves
# android/build dirs there. Both change the expo-updates fingerprint, and the next release-apk.sh then fails with
# "Runtime version calculated on local machine not equal…" (2026-10-02). Put node_modules back as npm left it.
SNAP=$(mktemp)
find node_modules -path '*/android/src/main/AndroidManifest.xml' -print0 | tar -cf "$SNAP" --null -T -
restore_node_modules() {
  tar -xf "$SNAP" && rm -f "$SNAP"
  find node_modules -mindepth 2 -maxdepth 4 -type d -path '*/android/build' -prune -exec rm -rf {} +
}
trap restore_node_modules EXIT
npx expo prebuild --platform android --clean --no-install >/dev/null
# Gradle's Metaspace is raised by app.config.js (withGradleMemory) for every build path.
ARCH="${ARCH:-arm64-v8a}"
OUT=releases/car-guy-test.apk
[ "$ARCH" = arm64-v8a ] || OUT="releases/car-guy-test-${ARCH}.apk"
(cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="$ARCH" --no-daemon -q)
mkdir -p releases
cp android/app/build/outputs/apk/release/app-release.apk "$OUT"
# Leave no generated native project behind (the repo is managed / CNG).
rm -rf android
echo "✓ $OUT ($(du -h "$OUT" | cut -f1))"
