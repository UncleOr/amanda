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

  # ═══ THE LOGO IS CENTRED, AND THE TAGLINE HANGS OFF IT ═══
  #
  # Or: *"the Amanda logo at the end isn't centred."* Measured: the card was
  # centred — within one pixel across and six down. What was NOT centred is
  # the LOGO, because the block being centred was logo-plus-tagline, which
  # puts the logo itself 25px above the middle of the frame.
  #
  # He is reading the screen the way anyone does: the logo is the thing you
  # look at, so the logo is the thing that has to sit in the middle. The
  # tagline hangs below it and is allowed to be off-centre, because nobody
  # measures a subtitle.
  WM_W=440
  WM_H=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$WORDMARK" |
         awk -F, -v w="$WM_W" '{printf "%d", w * $2 / $1}')
  TAG=30
  WM_Y=$(( (H - WM_H) / 2 ))
  TAG_Y=$((WM_Y + WM_H + 26))

  if [ "$HAS_FONT" = "1" ]; then
    TAGTEXT=",drawtext=fontfile='${FONT}':textfile=assets/raw/trailer/text/tagline-${L}.txt\
:x=(w-text_w)/2:y=${TAG_Y}:fontsize=${TAG}:fontcolor=0xd5dce8@0.85\
:alpha='if(lt(t,0.45),0,min(1,(t-0.45)/0.35))'"
  else
    echo "    (no segoeuib.ttf — the end card will be the wordmark alone)"
    TAGTEXT=""
  fi

  # ═══ THE ENTRANCE ═══
  #
  # Or: *"and give it a cooler entrance."* It had none — it arrived inside
  # the crossfade from the last shot, which is not an entrance, it is a
  # dissolve that happens to end on a logo.
  #
  # So: the name lands. It starts 22% oversized and settles to its true size
  # over 0.45s, on a square-root curve — fast at first and slowing into
  # place, which is what something heavy arriving looks like. The tagline
  # waits until the logo has stopped moving and then fades up on its own.
  #
  # Done in two passes on purpose. `zoompan` works on a STILL, producing
  # `d` frames from one picture, so the card is composed to a png first and
  # animated second.
  #
  # And the png goes in WITHOUT `-loop 1`. I wrote that warning and then
  # looped it anyway: looping makes it a stream of identical frames, zoompan
  # emits `d` frames for EACH of them, and a ten-second film came out at two
  # minutes and ten. It encoded cleanly and reported nothing wrong — only the
  # duration said anything had happened, which is why this script prints it.
  CARD_PNG="assets/raw/trailer/text/card-${L}.png"
  ffmpeg -y -v error \
    -f lavfi -i "color=${BG}:s=${W}x${H}" \
    -i "$WORDMARK" \
    -filter_complex "[1:v]scale=${WM_W}:-1[wm];[0:v][wm]overlay=x=(W-w)/2:y=${WM_Y}" \
    -frames:v 1 "$CARD_PNG"

  CARD_FRAMES=$(awk -v c="$CARD" -v f="$FPS" 'BEGIN{printf "%d", c*f}')
  # It HOLDS big until the crossfade from the last shot has finished, and
  # only then lands. The first version eased from frame zero, so the whole
  # entrance happened underneath a half-transparent dissolve and the only
  # part anyone saw was the logo already sitting still.
  HOLD=$(awk -v f="$FPS" 'BEGIN{printf "%d", 0.42*f}')
  EASE=$(awk -v f="$FPS" 'BEGIN{printf "%d", 0.45*f}')

  # crf 30 rather than the trailer's 19: this is downloaded by a child on a
  # phone before the game starts, and it is dark, grainy footage that hides
  # compression well. Anything above about 3MB and the first launch is slower
  # because of the thing that was supposed to make it feel good.
  ffmpeg -y -v error -stats \
    "${inputs[@]}" \
    -i "$CARD_PNG" \
    -ss "$MUSIC_START" -i "$MUSIC" \
    -filter_complex "$(IFS=';'; echo "${filters[*]}");\
[${i}:v]zoompan=z='if(lt(on,${HOLD}),1.22,if(lte(on,${HOLD}+${EASE}),1.22-0.22*sqrt((on-${HOLD})/${EASE}),1))'\
:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${CARD_FRAMES}:s=${W}x${H}:fps=${FPS}\
${TAGTEXT},setsar=1,settb=AVTB,format=yuv420p[card];\
${concat}concat=n=${i}:v=1:a=0,fps=${FPS},settb=AVTB[film];\
[film][card]xfade=transition=fade:duration=0.5:offset=$(awk -v t="$FILM" 'BEGIN{printf "%.2f", t-0.5}'),\
fade=t=in:st=0:d=0.5,fade=t=out:st=${OUT_AT}:d=0.8:color=${BG}[v];\
[$((i + 1)):a]atrim=0:${LEN},afade=t=in:st=0:d=0.8,afade=t=out:st=${OUT_AT}:d=0.8[a]" \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 96k -movflags +faststart \
    "$OUT"

  echo
  printf '  %-44s ' "$OUT"
  ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
done
