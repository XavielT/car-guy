#!/usr/bin/env bash
# Builds the universal release APK locally, checks it, and (with --publish)
# creates the GitHub release. IMP 29092026 Phase 1 / ADR-34.
#
#   bash tools/release-apk.sh              # build + checks only
#   bash tools/release-apk.sh --publish    # … then gh release create vX.Y.Z
#   bash tools/release-apk.sh --skip-build --publish   # reuse releases/car-guy-vX.Y.Z.apk
#
# Every release carries two assets with the same bytes:
#   car-guy.apk          stable name: …/releases/latest/download/car-guy.apk always
#                        points at the newest APK (the web's "Descargar APK", note 17)
#   car-guy-vX.Y.Z.apk   versioned copy, for anyone keeping an archive
# The release is never a pre-release: "latest" skips those.
set -euo pipefail
cd "$(dirname "$0")/.."

PUBLISH=0
BUILD=1
for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=1 ;;
    --skip-build) BUILD=0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

VERSION=$(node -p "require('./app.json').expo.version")
APK="releases/car-guy-v${VERSION}.apk"
STABLE="releases/car-guy.apk"
# The EAS-managed keystore's certificate (created 2026-09-25). An APK signed
# with anything else will not install over the users' copies.
EXPECTED_CERT="a16450a0"
APKSIGNER=$(ls -d "$HOME"/Android/Sdk/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)

if [ "$BUILD" = 1 ]; then
  export ANDROID_HOME="$HOME/Android/Sdk" ANDROID_SDK_ROOT="$HOME/Android/Sdk"
  set -a; . ./.env.expo.local; set +a
  npx eas-cli@24.8.0 build --local --profile release-apk --platform android --non-interactive --output "$APK"
fi

[ -f "$APK" ] || { echo "✗ $APK not found" >&2; exit 1; }

# 1. The cloud is in the bundle (note 13).
node tools/check-bundle-env.mjs "$APK"

# 2. Signed with the users' key.
CERT=$("$APKSIGNER" verify --print-certs "$APK" | grep -m1 'SHA-256' | awk '{print $NF}')
case "$CERT" in
  "$EXPECTED_CERT"*) echo "✓ signed with the EAS key ($CERT)" ;;
  *) echo "✗ unexpected signing certificate: $CERT" >&2; exit 1 ;;
esac

# 3. The version inside is the one we are about to tag.
INSIDE=$(unzip -p "$APK" AndroidManifest.xml | strings -e l | grep -m1 -E "^${VERSION//./\\.}$" || true)
[ "$INSIDE" = "$VERSION" ] || { echo "✗ versionName ${VERSION} not found in the manifest" >&2; exit 1; }
echo "✓ versionName $VERSION"

cp "$APK" "$STABLE"
SHA=$(sha256sum "$APK" | awk '{print $1}')
echo "✓ $APK  sha256 $SHA"

[ "$PUBLISH" = 1 ] || { echo "Built and checked. Re-run with --publish to create v${VERSION}."; exit 0; }

# Notes: the CHANGELOG section for this version, then install lines.
NOTES=$(mktemp)
awk -v v="## ${VERSION} " 'index($0, v) == 1 {on=1; next} /^## / {if (on) exit} on' CHANGELOG.md > "$NOTES"
cat >> "$NOTES" <<EOF

Se instala encima de cualquier versión anterior de Car Guy; tus datos se quedan.

- **Android**: descarga \`car-guy.apk\` y ábrelo (enlace fijo: https://github.com/XavielT/car-guy/releases/latest/download/car-guy.apk).
- **Web**: https://car-guy.vercel.app

SHA-256 del APK: \`${SHA}\`
EOF

gh release create "v${VERSION}" "$STABLE" "$APK" \
  --target main --title "Car Guy v${VERSION}" --notes-file "$NOTES" --latest
rm -f "$NOTES"

LOCATION=$(curl -sIL "https://github.com/XavielT/car-guy/releases/latest/download/car-guy.apk" | grep -i '^location' | tail -1)
echo "latest/download/car-guy.apk → ${LOCATION}"
