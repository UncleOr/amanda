#!/usr/bin/env bash
#
# The trailer, assembled.
#
#   bash scripts/make-trailer.sh
#   → store/trailer.mp4
#
# Four segments, built separately and then joined:
#
#   OPENING   8 generated shots in a dark petrol station      11.2s
#   CARDS     four cards drop onto black                       1.4s
#   GAMEPLAY  Or's screen recording, cut down                 14.5s
#   CLOSING   album, a win, the wordmark, the address          5.2s
#
# ═══ WHY SEGMENTS AND NOT ONE FILTER GRAPH ═══
#
# The first version of this file was a single filter_complex and it was
# unreadable by the second change. Each segment is encoded to its own file
# now and the concat DEMUXER joins them, so a broken closing card costs one
# segment's encode instead of the whole trailer, and any segment can be
# played on its own to see what is wrong with it.
#
# ═══ THE OPENING CUTS HARD, AND EACH SHOT IS CUT FROM ITS HEAD ═══
#
# The generated clips are five seconds each; the cut uses between 1.1 and
# 1.8 of them, taken from the START. Kling drifts towards the end of a
# clip — by second four of 06-charge the stone colossus has grown horns and
# become something else — and the head of a clip is the part that still
# resembles the frame that was approved.
#
# No dissolves between the eight. They are one continuous place and a
# dissolve would say otherwise; hard cuts at this speed read as a fight.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=store/trailer.mp4
SEG=assets/raw/trailer/segments
CLIPS=assets/raw/trailer/clips
MUSIC="apps/client/public/music/score.mp3"
GAMEPLAY=store/gameplay.mp4
W=1920
H=1080
FPS=25
BG=0x070a12

# Shot, and how much of its five seconds is used. Sums to 11.2.
SHOTS=(
  "01-pump 1.2" "02-titan 1.4" "03-dragon 1.4" "04-chuppy 1.3"
  "05-bread 1.1" "06-charge 1.6" "07-amanda 1.8" "08-fold 1.4"
)

# The four that drop. Amanda last, because she is who you just met.
CARDS=(
  apps/client/public/cards/dragons_01_flame_dragon.webp
  apps/client/public/cards/giants_01_stone_colossus.webp
  apps/client/public/cards/furries_01_chuppy.webp
  apps/client/public/cards/legends_01_amanda.webp
)

FONT='C\:/Windows/Fonts/arial.ttf'
HAS_FONT=1
[ -f "/c/Windows/Fonts/arial.ttf" ] || [ -f "C:/Windows/Fonts/arial.ttf" ] || HAS_FONT=0

mkdir -p "$SEG" store

# The gameplay cut is built by its own script; make it if it is not there.
if [ ! -f "$GAMEPLAY" ]; then
  echo "  gameplay cut missing — building it"
  bash scripts/cut-gameplay.sh
fi

for s in "${SHOTS[@]}"; do
  set -- $s
  [ -f "$CLIPS/$1.mp4" ] || { echo "missing clip: $CLIPS/$1.mp4 — run pnpm art:trailer motion" >&2; exit 1; }
done
[ -f "$MUSIC" ] || { echo "missing: $MUSIC" >&2; exit 1; }

# Everything is normalised to the same geometry, rate and pixel format, which
# is what lets the concat demuxer join the segments without re-encoding them
# into a common shape first.
NORM="scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},fps=${FPS},setsar=1,format=yuv420p"
ENC=(-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" -an)

# ── 1 · opening ───────────────────────────────────────────────────────
echo "  opening"
inputs=(); filters=(); i=0
for s in "${SHOTS[@]}"; do
  set -- $s
  inputs+=(-t "$2" -i "$CLIPS/$1.mp4")
  filters+=("[$i:v]${NORM}[s$i]")
  i=$((i + 1))
done
concat=$(for ((j = 0; j < i; j++)); do printf '[s%d]' "$j"; done)
ffmpeg -y -v error "${inputs[@]}" \
  -filter_complex "$(IFS=';'; echo "${filters[*]}");${concat}concat=n=${i}:v=1:a=0,fade=t=in:st=0:d=0.7[v]" \
  -map "[v]" "${ENC[@]}" "$SEG/1-opening.mp4"

# ── 2 · the cards ─────────────────────────────────────────────────────
#
# Shot 8 ends on the four of them catching fire and rising as embers, so
# this opens on a warm flash and lets the dark come up behind it. The four
# cards fall in staggered, land in a row, and hold just long enough to read:
# shot 8 said they were becoming something, and this says what.
#
# The flash is ember-coloured and not white. An earlier cut of shot 8 blew
# out to white and this was white to match it; that frame was regenerated
# (it had split Amanda into three creatures) and the new one ends on fire.
# A white flash off an orange frame reads as a mistake in the edit.
echo "  cards"
CARD_H=420
CARD_W=315          # the art is 384x512, so 3:4
Y_END=330           # (1080-420)/2 — the row sits on the centre line
Y_START=-470
DROP=0.30           # seconds in the air
HOLD=1.6
SPEED=$(awk -v a="$Y_START" -v b="$Y_END" -v d="$DROP" 'BEGIN{printf "%.1f", (b-a)/d}')

# ═══ THE FLASH IS A FADE, NOT AN OVERLAY ═══
#
# This was first built as a near-white layer composited on top and faded out
# on its alpha channel. It came out a flat mid-grey: the colour source went
# through yuva420p and the alpha fade, and what landed on screen was neither
# the flash nor the cards. `fade=t=in` takes a COLOUR, so the whole effect is
# one filter on the finished frame — it starts AT the ember colour and
# reveals the cards out of it. Nothing to composite and nothing to go grey.
cinputs=(-f lavfi -t "$HOLD" -i "color=${BG}:s=${W}x${H}:r=${FPS}")
cfilters=()
prev="[0:v]"
k=1
for idx in "${!CARDS[@]}"; do
  cinputs+=(-i "${CARDS[$idx]}")
  x=$((330 + idx * 345))
  # The art comes on backgrounds that do not match each other — the dragon on
  # black, the colossus on cream — so each gets the same thin dark edge and
  # the row reads as four cards instead of four pictures.
  t0=$(awk -v i="$idx" 'BEGIN{printf "%.2f", 0.22 + i*0.12}')
  cfilters+=("[${k}:v]scale=$((CARD_W - 12)):$((CARD_H - 16)),pad=${CARD_W}:${CARD_H}:6:8:color=0x16203a[c$idx]")
  cfilters+=("${prev}[c$idx]overlay=x=${x}:y='if(lt(t,${t0}),${Y_START},min(${Y_END},${Y_START}+(t-${t0})*${SPEED}))'[bg$idx]")
  prev="[bg$idx]"
  k=$((k + 1))
done
ffmpeg -y -v error "${cinputs[@]}"   -filter_complex "$(IFS=';'; echo "${cfilters[*]}");${prev}fade=t=in:st=0:d=0.30:color=0xfff0dc,format=yuv420p[v]"   -map "[v]" "${ENC[@]}" "$SEG/2-cards.mp4"

# ── 3 · gameplay ──────────────────────────────────────────────────────
echo "  gameplay"
ffmpeg -y -v error -i "$GAMEPLAY" -vf "$NORM" "${ENC[@]}" "$SEG/3-gameplay.mp4"

# ── 4 · closing ───────────────────────────────────────────────────────
#
# What winning looks like, and where to get it. The address is the only text
# in the whole trailer: Play autoplays the first thirty seconds MUTED, so the
# last thing on screen has to work in silence.
#
# ═══ THE ALBUM SHOT IS MISSING, DELIBERATELY ═══
#
# This closed on the album before the win, which is the right order — what
# you collect, then what it gets you. The album screenshot we have is from a
# brand new account: "0% הושלמו", four zeroes across the counters and a page
# of empty slots. As the last thing a viewer sees before the address, that is
# an argument against installing.
#
# It comes back the moment there is a played-in capture. Put one at
# store/screenshots/04-album.png and set ALBUM=1.
ALBUM=0
echo "  closing"
if [ "$HAS_FONT" = "1" ]; then
  LOGOTEXT=",drawtext=fontfile='${FONT}':text='playamanda.com':x=(w-text_w)/2:y=h/2+130:fontsize=52:fontcolor=white@0.92"
else
  echo "    (no arial.ttf — the address will be left off the end card)"
  LOGOTEXT=""
fi
if [ "$ALBUM" = "1" ]; then
  ffmpeg -y -v error \
    -i store/screenshots/04-album.png \
    -i store/screenshots/03-win.png \
    -f lavfi -t 2.6 -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
    -i apps/client/public/brand/wordmark.png \
    -filter_complex "\
[0:v]${NORM},zoompan=z='min(zoom+0.0009,1.1)':d=45:s=${W}x${H}:fps=${FPS}[a];\
[1:v]${NORM},zoompan=z='if(eq(on,0),1.1,max(zoom-0.0009,1.0))':d=55:s=${W}x${H}:fps=${FPS}[b];\
[3:v]scale=840:-1[wm];\
[2:v][wm]overlay=x=(W-w)/2:y=(H-h)/2-60${LOGOTEXT},fade=t=in:st=0:d=0.4[c];\
[a][b]xfade=transition=fade:duration=0.3:offset=1.5[ab];\
[ab][c]xfade=transition=fade:duration=0.4:offset=3.3,format=yuv420p[v]" \
    -map "[v]" "${ENC[@]}" "$SEG/4-closing.mp4"
else
  ffmpeg -y -v error \
    -i store/screenshots/03-win.png \
    -f lavfi -t 2.8 -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
    -i apps/client/public/brand/wordmark.png \
    -filter_complex "\
[0:v]${NORM},zoompan=z='if(eq(on,0),1.1,max(zoom-0.0008,1.0))':d=60:s=${W}x${H}:fps=${FPS}[b];\
[2:v]scale=840:-1[wm];\
[1:v][wm]overlay=x=(W-w)/2:y=(H-h)/2-60${LOGOTEXT},fade=t=in:st=0:d=0.4[c];\
[b][c]xfade=transition=fade:duration=0.4:offset=2.0,format=yuv420p[v]" \
    -map "[v]" "${ENC[@]}" "$SEG/4-closing.mp4"
fi

# ── join, and lay the score over the whole thing ──────────────────────
echo "  joining"
: > "$SEG/list.txt"
for f in 1-opening 2-cards 3-gameplay 4-closing; do
  echo "file '$(basename "$f").mp4'" >> "$SEG/list.txt"
done

TOTAL=$(for f in "$SEG"/[1-4]-*.mp4; do
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
done | awk '{t+=$1} END{printf "%.3f", t}')
FADEOUT=$(awk -v t="$TOTAL" 'BEGIN{printf "%.3f", t-1.4}')

ffmpeg -y -v warning -stats \
  -f concat -safe 0 -i "$SEG/list.txt" \
  -i "$MUSIC" \
  -filter_complex "[0:v]fade=t=out:st=${FADEOUT}:d=1.4[v];\
[1:a]atrim=0:${TOTAL},afade=t=in:st=0:d=1.2,afade=t=out:st=${FADEOUT}:d=1.4,\
loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" \
  -c:a aac -b:a 192k -movflags +faststart \
  "$OUT"

echo
echo "  $OUT"
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of default=nw=1 "$OUT"
