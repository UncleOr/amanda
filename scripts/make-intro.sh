#!/usr/bin/env bash
#
# The clip that plays the first time somebody opens the game.
#
#   bash scripts/make-intro.sh          → both
#   bash scripts/make-intro.sh en       → just that one
#   → apps/client/public/brand/intro-he.mp4
#   → apps/client/public/brand/intro-en.mp4
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
#   - It ends on the NAME, and then fades to the game's own background
#     rather than to a flash, so the clip dissolves into the app behind it
#     instead of cutting. Or: *"let's add at the end there Amanda - monster
#     card game, like a title card at the end of the film."*
#
#     Two files, because that card has words in it and the game has two
#     languages. Eight of the ten seconds are identical; only the last two
#     differ, and Intro.tsx picks by lang().
#   - 1280x720, not 1080p. It plays over a phone screen that is 844x390.
#   - It carries the music from the same place in the same song as the
#     trailer, because the game's own soundtrack starts right after it.
set -euo pipefail
cd "$(dirname "$0")/.."

. "$(dirname "$0")/trailer-shots.sh"

LANGS=("$@")
[ ${#LANGS[@]} -gt 0 ] || LANGS=(he en)
for l in "${LANGS[@]}"; do
  [ "$l" = "he" ] || [ "$l" = "en" ] || { echo "usage: $0 [he|en ...]" >&2; exit 1; }
done

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

# ═══ THE CARD AT THE END ═══
#
# `settb=AVTB` on BOTH sides of the xfade. The concat output carries a
# microsecond timebase and a lavfi colour source carries 1/25, and xfade
# refuses to join two links whose timebases differ — "First input link main
# timebase do not match". Nothing about the pictures is wrong; they are
# simply counting time in different units.
#
# The same three-tier lockup as the trailer's closing, at this film's smaller
# size: the wordmark, then what the game is, and no address — this one is
# playing INSIDE the app, so there is nowhere to send anybody.
#
# Segoe UI Bold, and no reversing of the Hebrew: this ffmpeg is built with
# libfribidi and lays it out itself. Checked by rendering a frame and reading
# it; see make-trailer.sh for the longer version of that note.
FONT='C\:/Windows/Fonts/segoeuib.ttf'
HAS_FONT=1
[ -f "/c/Windows/Fonts/segoeuib.ttf" ] || HAS_FONT=0

# Not written here — it is the home screen's own subtitle, and its English is
# the English that shipped (COPY.md s86247d1).
mkdir -p assets/raw/trailer/text
printf 'משחק קלפים מפלצתי' > assets/raw/trailer/text/tagline-he.txt
printf 'Monster card game'  > assets/raw/trailer/text/tagline-en.txt

CARD=2.2          # how long the name holds
FILM=$(for s in "${SHOTS[@]}"; do set -- $s; echo "$2"; done | awk '{t+=$1} END{printf "%.2f", t}')
LEN=$(awk -v a="$FILM" -v b="$CARD" 'BEGIN{printf "%.2f", a+b}')
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

for L in "${LANGS[@]}"; do
  OUT="apps/client/public/brand/intro-${L}.mp4"
  if [ "$L" = "he" ]; then
    WORDMARK=apps/client/public/brand/wordmark.png
  else
    WORDMARK=apps/client/public/brand/wordmark-en.png
  fi
  [ -f "$WORDMARK" ] || { echo "missing: $WORDMARK" >&2; exit 1; }

  # Measured rather than assumed: the two wordmarks are different heights, so
  # the block is centred from what they actually are.
  WM_W=440
  WM_H=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$WORDMARK" |
         awk -F, -v w="$WM_W" '{printf "%d", w * $2 / $1}')
  TAG=30
  BLOCK=$((WM_H + 28 + TAG))
  WM_Y=$(( (H - BLOCK) / 2 ))
  TAG_Y=$((WM_Y + WM_H + 28))

  if [ "$HAS_FONT" = "1" ]; then
    TAGTEXT=",drawtext=fontfile='${FONT}':textfile=assets/raw/trailer/text/tagline-${L}.txt\
:x=(w-text_w)/2:y=${TAG_Y}:fontsize=${TAG}:fontcolor=0xd5dce8@0.85"
  else
    echo "    (no segoeuib.ttf — the end card will be the wordmark alone)"
    TAGTEXT=""
  fi

  # crf 30 rather than the trailer's 19: this is downloaded by a child on a
  # phone before the game starts, and it is dark, grainy footage that hides
  # compression well. Anything above about 3MB and the first launch is slower
  # because of the thing that was supposed to make it feel good.
  ffmpeg -y -v error -stats \
    "${inputs[@]}" \
    -f lavfi -t "$CARD" -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
    -i "$WORDMARK" \
    -ss "$MUSIC_START" -i "$MUSIC" \
    -filter_complex "$(IFS=';'; echo "${filters[*]}");\
[$((i + 1)):v]scale=${WM_W}:-1[wm];\
[${i}:v][wm]overlay=x=(W-w)/2:y=${WM_Y}${TAGTEXT},fps=${FPS},setsar=1,settb=AVTB,format=yuv420p[card];\
${concat}concat=n=${i}:v=1:a=0,fps=${FPS},settb=AVTB[film];\
[film][card]xfade=transition=fade:duration=0.5:offset=$(awk -v t="$FILM" 'BEGIN{printf "%.2f", t-0.5}'),\
fade=t=in:st=0:d=0.5,fade=t=out:st=${OUT_AT}:d=0.8:color=${BG}[v];\
[$((i + 2)):a]atrim=0:${LEN},afade=t=in:st=0:d=0.8,afade=t=out:st=${OUT_AT}:d=0.8[a]" \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 96k -movflags +faststart \
    "$OUT"

  echo
  printf '  %-44s ' "$OUT"
  ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
done
