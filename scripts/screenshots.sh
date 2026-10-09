#!/usr/bin/env bash
#
# Turn whatever you photographed into what Google Play will accept.
#
# Drop captures from a phone into store/raw/ and run this. They can be any
# size and any aspect; what comes out is 16:9, 1600x900, PNG with no alpha
# channel, numbered in the order the files sort.
#
#   bash scripts/screenshots.sh
#   → store/screenshots/01-*.png …
#
# ═══ THE RULE THAT CATCHES PEOPLE ═══
#
# Play rejects a screenshot whose long side is more than TWICE its short
# side. A landscape phone is 844x390 — a ratio of 2.16 — so a raw capture
# from the device the game is designed for is refused. That is why this pads
# to 16:9 rather than simply scaling: the picture keeps its shape and the
# bars fill with the game's own background colour instead of black.
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=store/raw
OUT=store/screenshots
W=1600
H=900
BG=0x070a12   # the game's background, so the padding is invisible

if [ ! -d "$RAW" ] || [ -z "$(ls -A "$RAW" 2>/dev/null)" ]; then
  echo
  echo "  Put your phone captures in $RAW/ and run this again."
  echo "  Any size, any format — jpg, png, heic if ffmpeg can read it."
  echo
  exit 1
fi

mkdir -p "$OUT"
n=0
for src in "$RAW"/*; do
  [ -f "$src" ] || continue
  n=$((n + 1))
  name=$(printf '%02d-%s' "$n" "$(basename "${src%.*}" | tr ' ' '-')")
  ffmpeg -y -v error -i "$src" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},format=rgb24" \
    "$OUT/$name.png"
  printf '  %-28s ' "$name.png"
  ffprobe -v error -show_entries stream=width,height,pix_fmt -of csv=p=0 "$OUT/$name.png"
done

echo
echo "  $n file(s) in $OUT — 1600x900, no alpha, ready to upload."
