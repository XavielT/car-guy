#!/usr/bin/env bash
# Subsets the two faces that ship far more glyphs than Car Guy can show:
#
# - Noto Sans JP → the ADR-16 kanji list, both kana blocks, CJK punctuation.
#   The full face is 5.4 MB per weight; shipping it for a dozen kanji would
#   put 11 MB in front of the first render on web.
# - Rajdhani → Latin (Spanish needs Latin-1: á é í ó ú ñ ü ¿ ¡) plus the
#   punctuation and symbols the UI uses. The package also carries Devanagari,
#   ~360 KB per weight that no screen can show.
#
#   pip install fonttools   # once, any venv (or set PYFTSUBSET)
#   npm i --no-save @expo-google-fonts/noto-sans-jp @expo-google-fonts/rajdhani
#   bash tools/subset-fonts.sh
#
# Adding a kanji: append it to KANJI, re-run, commit the .ttf files.
# Both faces are SIL OFL 1.1 (licences copied next to them); subsetting is allowed.
set -euo pipefail
PYFT=${PYFTSUBSET:-pyftsubset}
OUT=assets/fonts
mkdir -p "$OUT"

KANJI='車改走峠整備点検給油燃費記録憶'
JP=node_modules/@expo-google-fonts/noto-sans-jp
for w in 500Medium 700Bold; do
  "$PYFT" "$JP/$w/NotoSansJP_$w.ttf" \
    --text="$KANJI" \
    --unicodes='U+0020-007E,U+3000-303F,U+3040-309F,U+30A0-30FF' \
    --layout-features='kern,palt' --no-hinting --desubroutinize \
    --output-file="$OUT/NotoSansJP-CarGuy_$w.ttf"
done
cp "$JP/LICENSE_FONT" "$OUT/OFL-NotoSansJP.txt"

LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2248,U+2264-2265,U+00B0'
RJ=node_modules/@expo-google-fonts/rajdhani
for w in 500Medium 600SemiBold 700Bold; do
  "$PYFT" "$RJ/$w/Rajdhani_$w.ttf" \
    --unicodes="$LATIN" \
    --layout-features='kern,liga' \
    --output-file="$OUT/Rajdhani-Latin_$w.ttf"
done
cp "$RJ/LICENSE_FONT" "$OUT/OFL-Rajdhani.txt"

ls -la "$OUT"
