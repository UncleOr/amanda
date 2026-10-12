#!/usr/bin/env bash
#
# Turn whatever you photographed into what Google Play will accept.
#
# Drop captures from a phone into store/raw/ and run this. They can be any
# size and any aspect; what comes out is 16:9, 1600x900, PNG with no alpha
# channel, numbered in the order the files sort.
#
#   bash scripts/screenshots.sh         store/raw/    → store/screenshots/
#   bash scripts/screenshots.sh en      store/raw-en/ → store/screenshots-en/
#
# ═══ TWO LISTINGS, TWO SETS ═══
#
# Play takes screenshots per listing language, and the game's interface is
# the thing being photographed — so an English listing showing Hebrew
# buttons is not a translation problem, it is the wrong picture. Or, after
# switching the game over: *"for the ident, the trailer and the app
# screenshots we'll use English for everything (including the Amanda
# title)."*
#
# make-trailer.sh reads the same two folders, so the English cut of the
# trailer stops using Hebrew footage the moment store/screenshots-en exists.
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

LANG=${1:-he}
case "$LANG" in
  he) RAW=store/raw;    OUT=store/screenshots ;;
  en) RAW=store/raw-en; OUT=store/screenshots-en ;;
  *) echo "  usage: screenshots.sh [he|en]" >&2; exit 1 ;;
esac
W=1600
H=900
BG=0x070a12   # the game's background, so the padding is invisible

if [ ! -d "$RAW" ] || [ -z "$(ls -A "$RAW" 2>/dev/null)" ]; then
  echo
  echo "  Put your $LANG phone captures in $RAW/ and run this again."
  echo "  Any size, any format — jpg, png, heic if ffmpeg can read it."
  echo
  exit 1
fi

mkdir -p "$OUT"
n=0
for src in "$RAW"/*; do
  [ -f "$src" ] || continue
  n=$((n + 1))
  # A leading "3-" or "3 " in the capture's own name is there to order the
  # files and has no business in the name Play shows. Stripped, so
  # `3 win.png` becomes `03-win.png` rather than `03-3-win.png`.
  label=$(basename "${src%.*}" | sed -E 's/^[0-9]+[-_ ]+//' | tr ' ' '-')
  name=$(printf '%02d-%s' "$n" "$label")
  ffmpeg -y -v error -i "$src" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},format=rgb24" \
    "$OUT/$name.png"
  printf '  %-28s ' "$name.png"
  ffprobe -v error -show_entries stream=width,height,pix_fmt -of csv=p=0 "$OUT/$name.png"
done

echo
echo "  $n file(s) in $OUT — 1600x900, no alpha, ready to upload."

# ── and a word about what is IN them ───────────────────────────────────
#
# Nothing here can look at a picture and tell you the buttons are in the
# wrong language. What it can do is say how many there are: Play shows up to
# eight and refuses a listing with fewer than two, and four is what the
# Hebrew listing has.
if [ "$n" -lt 2 ]; then
  echo "  Play needs at least TWO. This listing has $n."
elif [ "$n" -lt 4 ]; then
  echo "  Play accepts $n; the Hebrew listing has four, and more is better."
fi
echo
