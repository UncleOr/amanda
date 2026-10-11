#!/usr/bin/env bash
#
# The clip that plays the first time somebody opens the game.
#
#   bash scripts/make-intro.sh
#   → apps/client/public/brand/intro.mp4
#
# Or: *"add the video part of the trailer (without the screenshots) when you
# open the app, with a skip button. Or maybe only the first time you open
# it?"*
#
# Only the first time. Hod will open this hundreds of times and ten seconds
# in front of every one of them is not an opening, it is an obstacle. There
# is a "watch it again" in the About screen for the times he wants to show
# somebody.
#
# ═══ IT IS NOT THE TRAILER ═══
#
# Same seven shots, three differences, all of them because this one is
# standing in front of the game rather than selling it:
#
#   - It ends by fading to the GAME'S OWN BACKGROUND, not to a flash. The
#     clip dissolves into the app behind it instead of cutting.
#   - 1280x720, not 1080p. It plays over a phone screen that is 844x390.
#   - It carries the music from the same place in the same song as the
#     trailer, because the game's own soundtrack starts right after it.
set -euo pipefail
cd "$(dirname "$0")/.."

. "$(dirname "$0")/trailer-shots.sh"

OUT=apps/client/public/brand/intro.mp4
CLIPS=assets/raw/trailer/clips
MUSIC="apps/client/public/music/track1.mp3"
MUSIC_START=91          # the steady passage; see docs/SOUNDTRACK.md
W=1280
H=720
FPS=25
BG=0x070a12

for s in "${SHOTS[@]}"; do
  set -- $s
  [ -f "$CLIPS/$1.mp4" ] || { echo "missing clip: $CLIPS/$1.mp4 — run pnpm art:trailer motion" >&2; exit 1; }
done
[ -f "$MUSIC" ] || { echo "missing: $MUSIC — run scripts/make-music.sh" >&2; exit 1; }

LEN=$(for s in "${SHOTS[@]}"; do set -- $s; echo "$2"; done | awk '{t+=$1} END{printf "%.2f", t}')
OUT_AT=$(awk -v t="$LEN" 'BEGIN{printf "%.2f", t-0.8}')

inputs=(); filters=(); i=0
for s in "${SHOTS[@]}"; do
  set -- $s
  inputs+=(-t "$2" -i "$CLIPS/$1.mp4")
  filters+=("[$i:v]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},fps=${FPS},setsar=1,format=yuv420p[s$i]")
  i=$((i + 1))
done
concat=$(for ((j = 0; j < i; j++)); do printf '[s%d]' "$j"; done)

# crf 30 rather than the trailer's 19: this is downloaded by a child on a
# phone before the game starts, and it is dark, grainy footage that hides
# compression well. Anything above about 3MB and the first launch is slower
# because of the thing that was supposed to make it feel good.
ffmpeg -y -v error -stats \
  "${inputs[@]}" \
  -ss "$MUSIC_START" -i "$MUSIC" \
  -filter_complex "$(IFS=';'; echo "${filters[*]}");\
${concat}concat=n=${i}:v=1:a=0,fade=t=in:st=0:d=0.5,\
fade=t=out:st=${OUT_AT}:d=0.8:color=${BG}[v];\
[${i}:a]atrim=0:${LEN},afade=t=in:st=0:d=0.8,afade=t=out:st=${OUT_AT}:d=0.8[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -r "$FPS" \
  -c:a aac -b:a 96k -movflags +faststart \
  "$OUT"

echo
printf '  %-40s ' "$OUT"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
