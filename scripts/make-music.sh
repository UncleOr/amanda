#!/usr/bin/env bash
#
# The two soundtrack files the game ships.
#
#   bash scripts/make-music.sh
#   → apps/client/public/music/track1.mp3
#   → apps/client/public/music/track2.mp3
#
# ═══ TWO WHOLE SONGS, NOT ONE MONTAGE ═══
#
# This used to produce a single score.mp3: eleven stretches cut out of four
# songs, levelled, crossfaded into each other, and with the tail folded over
# the head so the loop would not be audible. It did what Or asked for at the
# time — "assemble a soundtrack out of everything I gave you".
#
# Then he heard it under the trailer: *"after 10 seconds the melody suddenly
# changes."* It did, and worse, the first five seconds of that file were the
# END of one song mixed over the BEGINNING of another — the loop fold. A
# trailer opened on two songs playing at once.
#
# Or: *"then let there not be one. Take a single track and use it in the
# game. It can vary — start one of the two each time. And if one ends you can
# start the other. And in the clip certainly don't switch between two pieces
# inside 30 seconds."*
#
# So: two files, each one complete song, untouched except for level. Nothing
# is cut out, nothing is crossfaded, and there is no fold. music.ts picks one
# at random and plays the other when it ends.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=apps/client/public/music
SRC=soundtracks

# The loudness both are matched to. The old montage sat at -17.4 LUFS and the
# game's volume (0.35 in music.ts) is tuned against that, so moving it would
# quietly change how loud the game is.
I=-17
TP=-1.5

# source                     output        trim
# -------------------------  ------------  -----------------------------------
# Soundtrack 2 ends with 1.7 seconds of silence. It is the only edit here.
TRACKS=(
  "סאונדטרק 1.mp3|track1.mp3|"
  "סאונדטרק 2.mp3|track2.mp3|-t 258.8"
)

mkdir -p "$OUT"
for row in "${TRACKS[@]}"; do
  IFS='|' read -r src dst trim <<<"$row"
  [ -f "$SRC/$src" ] || { echo "missing: $SRC/$src" >&2; exit 1; }
  printf '  %-12s ' "$dst"
  # shellcheck disable=SC2086
  ffmpeg -y -v error $trim -i "$SRC/$src" \
    -af "loudnorm=I=${I}:TP=${TP}:LRA=11,aresample=44100" \
    -codec:a libmp3lame -b:a 96k -ac 2 \
    "$OUT/$dst"
  ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT/$dst"
done

echo
for f in "$OUT"/track*.mp3; do
  printf '  %-34s ' "$f"
  ffmpeg -v error -i "$f" -af ebur128=framelog=quiet -f null - 2>&1 |
    awk '/Integrated loudness/{g=1} g&&/I:/{print $2, $3; exit}'
done
