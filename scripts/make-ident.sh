#!/usr/bin/env bash
#
# The Asulins ident — the three seconds before the game.
#
#   bash scripts/make-ident.sh
#   → apps/client/public/brand/ident.mp4
#
# Hod chose the mark, Or chose the sound, and the only job left is to make
# them one thing rather than two that happen to play together.
#
# ═══ EVERYTHING HAPPENS AT 0.50 ═══
#
# Not a guess. The sound's own crescendo was measured — per-20ms RMS across
# the file, looking for the largest jump:
#
#   the landing is at  0.50s
#   peak level at      0.74s
#
# So the pair arrives through the run-up and LANDS on 0.50, the word follows
# while the chord is still opening, and both are settled before the peak.
# An ident whose picture lands a frame off its own chord reads as broken
# without anyone being able to say why.
#
# ═══ WHY THE DIP ═══
#
# The mark is two monsters holding a controller, so the landing is a BUTTON
# PRESS: the whole thing dips six pixels and springs back. It is small enough
# to be felt rather than seen, which is the point — a logo that bounces is a
# cartoon, and a logo that lands on the beat is an ident.
set -euo pipefail
cd "$(dirname "$0")/.."

ART=assets/raw/studio/art-pair-white.png
SND=assets/raw/studio/sting/3-voices-with-weight.mp3
OUT=apps/client/public/brand/ident.mp4
TMP=assets/raw/studio/ident
W=1280
H=720
FPS=25
BG=0x070a12
INK=0xf4f1ea          # the art's own off-white, so the word belongs to it
LAND=0.50             # measured, see above

[ -f "$ART" ] || { echo "missing: $ART — run studioMarks.ts" >&2; exit 1; }
[ -f "$SND" ] || { echo "missing: $SND — run studioSting.ts" >&2; exit 1; }

mkdir -p "$TMP" "$(dirname "$OUT")"

FONT='C\:/Windows/Fonts/bahnschrift.ttf'
[ -f "/c/Windows/Fonts/bahnschrift.ttf" ] || { echo "missing bahnschrift.ttf" >&2; exit 1; }

# ── the two pieces, as stills with real transparency ──────────────────
#
# The drawing comes on the game's own near-black. Keyed out rather than
# overlaid, because both halves have to FADE, and a fade needs an alpha
# channel to fade. 0.03 is the threshold that survived being measured on the
# wordmark — see packages/art/src/wordmarkEn.ts.
CROP=$(ffmpeg -v info -i "$ART" -vf "cropdetect=limit=24:round=2:skip=0" -frames:v 1 -f null - 2>&1 |
  grep -o "crop=[0-9:]*" | tail -1 | cut -d= -f2)
[ -n "$CROP" ] || { echo "could not find the drawing in $ART" >&2; exit 1; }

ffmpeg -y -v error -i "$ART" \
  -vf "crop=${CROP},scale=300:-1,colorkey=0x070A12:0.03:0.08,format=rgba" \
  -frames:v 1 "$TMP/pair.png"

ffmpeg -y -v error -f lavfi -i "color=0x000000@0:s=900x160,format=rgba" \
  -vf "drawtext=fontfile='${FONT}':text='A S U L I N S':x=(w-text_w)/2:y=(h-text_h)/2\
:fontsize=88:fontcolor=${INK}" \
  -frames:v 1 "$TMP/word-wide.png"

# ═══ AND THEN TRIMMED TO THE LETTERS ═══
#
# The text is drawn centred on a 900px canvas, so the image is 900 wide and
# the LETTERS are not. Laying it out by a hardcoded width put 200px of empty
# canvas between the drawing and the word, and the block it was supposed to
# centre was never the block on screen — the first render came out as a mark
# on the far left and a word on the far right with a hole between them.
#
# Measured, like the drawing above it, for the same reason: the font decides
# how wide "A S U L I N S" is, not this file.
# ═══ THE LETTERS ARE MEASURED, NOT DETECTED ═══
#
# Or, from a photograph of his phone: *"the letters are cut off at the
# bottom."* They were, and cropdetect is why.
#
# It ran with `round=2:limit=8` and came back 490x62 for glyphs that measure
# 496x64: rows 110 and 111 are SOLID letter — alpha 255 and 125 — and both
# were thrown away, with six pixels of the width. `round=2` rounds the box to
# even numbers and is free to round DOWN, and `limit=8` reads the faintest
# row of anti-aliasing as background. Two pixels is nothing on a 1280-wide
# canvas and everything on a letter: at the size this is drawn on a phone it
# is the flat bottom edge in his photograph.
#
# Padding cropdetect's answer was the first fix and it was still wrong,
# because the error is not symmetric — it had lost more on one side than the
# other, so any single margin either clips or leaves a gap. So the box is
# measured directly off the alpha channel, which is the thing that actually
# says where a letter is, plus a two-pixel margin so no edge pixel of a
# glyph ever lands on the edge of its own image.
WCROP=$(python -c "
from PIL import Image
im = Image.open(r'$TMP/word-wide.png').convert('RGBA')
w, h = im.size
px = im.load()
xs = [x for x in range(w) for y in range(h) if px[x, y][3] > 0]
ys = [y for y in range(h) for x in range(w) if px[x, y][3] > 0]
M = 2
x0, x1 = max(0, min(xs) - M), min(w - 1, max(xs) + M)
y0, y1 = max(0, min(ys) - M), min(h - 1, max(ys) + M)
print('%d:%d:%d:%d' % (x1 - x0 + 1, y1 - y0 + 1, x0, y0))
")
[ -n "$WCROP" ] || { echo "could not find the letters in word-wide.png" >&2; exit 1; }
ffmpeg -y -v error -i "$TMP/word-wide.png" -vf "crop=${WCROP},format=rgba"   -frames:v 1 "$TMP/word.png"

# And checked, because "the letters are cut off" is the kind of thing that
# looks perfectly fine in a thumbnail.
EDGE=$(python -c "
from PIL import Image
im = Image.open(r'$TMP/word.png').convert('RGBA')
w, h = im.size
px = im.load()
hit = any(px[x, 0][3] > 8 or px[x, h - 1][3] > 8 for x in range(w)) or any(
    px[0, y][3] > 8 or px[w - 1, y][3] > 8 for y in range(h)
)
print('touching' if hit else 'clear')
")
if [ "$EDGE" = "touching" ]; then
  echo "  a letter is touching the edge of its own box — it is being cut" >&2
  exit 1
fi
echo "  wordmark ${WCROP} · edges ${EDGE}"

PW=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$TMP/pair.png")
WW=$(ffprobe -v error -show_entries stream=width -of csv=p=0 "$TMP/word.png")
echo "  pair ${PW}  ·  word ${WW}px  ·  landing at ${LAND}s"

# ── the move ──────────────────────────────────────────────────────────
#
# The pair and the word are laid out as one block: the pair on the left, the
# word to the right of it, the whole thing centred. Same arrangement as the
# still lockup, so the ident ends on exactly the logo Hod picked.
PAIR_W=${PW%%,*}
GAP=44
WORD_W=${WW}          # measured above, not guessed
BLOCK=$((PAIR_W + GAP + WORD_W))
PAIR_X=$(( (W - BLOCK) / 2 ))
WORD_X=$((PAIR_X + PAIR_W + GAP))

# Down six and back, over 0.3s, starting on the chord.
DIP="if(lt(t,${LAND}),0,if(lt(t,${LAND}+0.12),(t-${LAND})/0.12*6,if(lt(t,${LAND}+0.30),6-(t-${LAND}-0.12)/0.18*6,0)))"

# ═══ ONE ARRIVAL, AND IT IS CENTRED THE WHOLE TIME ═══
#
# Or: *"the Asulins ident is not centred."* He was right, and the still frame
# was not the problem — measured at the end, the mark sits 222px from the left
# and 224px from the right, which is centred to within two pixels.
#
# It was the first half second. The pair faded in at 0.10 and the word did not
# arrive until 0.56, so for 0.46s the ONLY thing on screen was the pair,
# sitting at the left edge of a block whose right half was still empty —
# measured 268px left of centre. A staged reveal is fine when what is on
# screen is balanced at every moment, and this one never was.
#
# So both pieces fade in together now, over the same window, and land together
# on the chord at 0.50. The word keeps its 40px settle, but INSIDE that window
# rather than after it: a word that slides once it is already solid reads as a
# glitch, and a word that slides while it is arriving reads as arriving.
# During the slide the block is 20px narrow out of 1280 — 1.5%, while fading
# up from transparent.
SLIDE="${WORD_X}-40*(1-min(1,max(0,(t-0.10)/0.40)))"

# ═══ -loop 1, AND IT IS THE WHOLE BUG ═══
#
# Without it a png is ONE FRAME, not a stream. `fade=t=in:st=0.10` then has a
# single frame at t=0 to work on — which is BEFORE the fade starts, so it is
# rendered fully transparent — and `overlay` holds that last frame for the
# rest of the film. The build reported success and every sampled frame came
# back solid black: both pieces were there, both were invisible, and nothing
# in the output said so.
#
# The opposite trap is one file away. In the intro film `-loop 1` turned a
# card into a stream and `zoompan` emitted `d` frames PER INPUT FRAME, making
# a 12-second film 130 seconds long. The rule that reconciles them: loop when
# a filter needs TIME to pass (a fade, a move), never when a filter already
# generates its own frames.
ffmpeg -y -v error -stats \
  -f lavfi -t 3.0 -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
  -loop 1 -t 3.0 -framerate ${FPS} -i "$TMP/pair.png" \
  -loop 1 -t 3.0 -framerate ${FPS} -i "$TMP/word.png" \
  -i "$SND" \
  -filter_complex "\
[1:v]format=rgba,fade=t=in:st=0.10:d=0.40:alpha=1[p];\
[2:v]format=rgba,fade=t=in:st=0.10:d=0.40:alpha=1[w];\
[0:v][p]overlay=x=${PAIR_X}:y='(H-h)/2+${DIP}':shortest=0[a];\
[a][w]overlay=x='${SLIDE}':y='(H-h)/2+${DIP}':shortest=0[b];\
[b]trim=0:3.0,fade=t=out:st=2.55:d=0.45:color=${BG},fps=${FPS},format=yuv420p[v];\
[3:a]atrim=0:3.0,afade=t=out:st=2.55:d=0.45[s]" \
  -map "[v]" -map "[s]" \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -r "$FPS" \
  -c:a aac -b:a 128k -movflags +faststart \
  "$OUT"

# ── and it is CHECKED, because "success" meant nothing last time ──────
#
# ffmpeg exited 0 on a film that was three seconds of black. So the frame on
# the landing is sampled and measured: if the brightest pixel in it is still
# near-black, the overlays did not land and the build fails here rather than
# shipping silently.
ffmpeg -y -v error -ss "${LAND}" -i "$OUT" -frames:v 1 "$TMP/check.png"
PEAK=$(ffmpeg -v info -i "$TMP/check.png" -vf "signalstats,metadata=print:key=lavfi.signalstats.YMAX" \
  -f null - 2>&1 | grep -o "YMAX=[0-9.]*" | cut -d= -f2 | tail -1)
PEAK=${PEAK:-0}
if [ "${PEAK%.*}" -lt 100 ]; then
  echo "  the frame at ${LAND}s is blank (brightest pixel ${PEAK}) — the overlays did not land" >&2
  exit 1
fi
echo "  frame at ${LAND}s: brightest pixel ${PEAK} — the mark is on screen"

echo
printf '  %-44s ' "$OUT"
ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
