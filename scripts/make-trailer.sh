#!/usr/bin/env bash
#
# A thirty-second trailer for the store listing and YouTube.
#
# Built from the real screenshots in store/screenshots plus the painted
# banner, over the game's own score. Deliberately NOT a screen recording:
# a recording of a match is ninety seconds of two boards standing still,
# which is what the game is and not what a trailer is for.
#
# Replace the screenshots with captures from a phone with a played-in
# account and re-run this; nothing here cares where the images came from.
#
#   bash scripts/make-trailer.sh
#   → store/trailer.mp4
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=store/trailer.mp4
MUSIC="apps/client/public/music/score.mp3"
BANNER="apps/client/public/brand/amanda_banner.webp"
W=1920
H=1080
# Seconds per shot, and the crossfade between them.
SHOT=5
FADE=0.7

shots=(
  "$BANNER"
  store/screenshots/01-home.png
  store/screenshots/02-build.png
  store/screenshots/03-win.png
  store/screenshots/04-album.png
)

for f in "${shots[@]}" "$MUSIC"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

# ── each shot: letterboxed to 1920x1080 and slowly pushed in ──────────
#
# ═══ NO -loop ON THE INPUTS ═══
#
# zoompan's `d` is frames produced PER INPUT PICTURE, not frames in total. Fed
# a looped still at 25fps it was handed 125 pictures and dutifully made 125
# frames of each: the first cut of this trailer came out ten minutes and
# forty-two seconds long. A still image read once is exactly one picture, so
# `d=125` means five seconds, which is what it was always meant to mean.
FPS=25
FRAMES=$((SHOT * FPS))

inputs=()
filters=()
for i in "${!shots[@]}"; do
  inputs+=(-i "${shots[$i]}")
  # Alternate the direction of the push so it does not feel mechanical.
  if [ $((i % 2)) -eq 0 ]; then
    zoom="zoom+0.0012"
  else
    zoom="if(eq(on,0),1.14,zoom-0.0012)"
  fi
  filters+=(
    "[$i:v]scale=${W}*2:${H}*2:force_original_aspect_ratio=increase,crop=${W}*2:${H}*2,\
zoompan=z='$zoom':d=${FRAMES}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},\
setsar=1,format=yuv420p[v$i]"
  )
done

# ── stitch with crossfades ───────────────────────────────────────────
chain=""
prev="[v0]"
offset=0
for ((i = 1; i < ${#shots[@]}; i++)); do
  offset=$(awk -v s="$SHOT" -v f="$FADE" -v i="$i" 'BEGIN{printf "%.3f", i*s - i*f}')
  label="[x$i]"
  chain+="${prev}[v$i]xfade=transition=fade:duration=${FADE}:offset=${offset}${label};"
  prev="$label"
done

# Open from black and close to it; the last shot ends where the audio does.
total=$(awk -v n="${#shots[@]}" -v s="$SHOT" -v f="$FADE" 'BEGIN{printf "%.3f", n*s - (n-1)*f}')
fadeout=$(awk -v t="$total" 'BEGIN{printf "%.3f", t-1.2}')
chain+="${prev}fade=t=in:st=0:d=0.8,fade=t=out:st=${fadeout}:d=1.2[vout];"
chain+="[${#shots[@]}:a]atrim=0:${total},afade=t=in:st=0:d=1,afade=t=out:st=${fadeout}:d=1.2,\
loudnorm=I=-16:TP=-1.5:LRA=11[aout]"

ffmpeg -y -v warning -stats \
  "${inputs[@]}" -i "$MUSIC" \
  -filter_complex "$(IFS=';'; echo "${filters[*]}");${chain}" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" \
  -c:a aac -b:a 192k -movflags +faststart \
  "$OUT"

echo
echo "  $OUT"
ffprobe -v error -show_entries format=duration:stream=width,height -of default=nw=1 "$OUT"
