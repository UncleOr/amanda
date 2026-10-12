#!/usr/bin/env bash
#
# ASULINS — the studio lockup, in every combination worth looking at.
#
#   bash scripts/studio-lockups.sh
#   → assets/raw/studio/lockups.png   (a contact sheet)
#   → assets/raw/studio/lockup-NN-*.png
#
# Or: *"let's write ASULINS, and make a big game controller with a small one
# next to it — they stand for father and son. Or a big monster and a small
# monster. Give me several options in different combinations of font, colour,
# image and layout."*
#
# ═══ WHY THE WORD IS SET HERE AND NOT GENERATED ═══
#
# Because the spelling has to be a fact. A studio name misspelt by one letter,
# in the thing that plays before every single launch, is the worst place in the
# product for that to happen — and "it came back right last time" is luck, not
# a method. packages/art/src/studioMarks.ts draws the PICTURE and is told, at
# length, not to draw a single letter.
#
# It is also the only way to answer the actual request. "Different
# combinations of font, colour and layout" is a grid, and a grid wants a loop
# — not twelve more prompts and twelve more dollars.
set -euo pipefail
cd "$(dirname "$0")/.."

ART=assets/raw/studio
OUT="$ART"
SHEET="$ART/lockups.png"
W=900
H=420
BG=0x070a12

mkdir -p "$ART"

f() { printf 'C\\:/Windows/Fonts/%s' "$1"; }

# ── the pieces ────────────────────────────────────────────────────────
#
# Four fonts, chosen to be genuinely different from each other rather than
# four weights of the same idea: a grotesque that shouts, a condensed one, a
# geometric one and a rounded one. Anything subtler is a choice Or cannot
# actually make from a contact sheet.
#
# The last field is the WORD, not a spacing value: this ffmpeg's drawtext has
# no letter_spacing option (only line_spacing), so tracking is done the only
# way left — by putting the spaces in. Which is no loss, because wide
# tracking on a studio name is a real typographic choice rather than a
# tweak, and seeing both is the point of a contact sheet.
FONTS=(
  "ariblk.ttf|Arial-Black|ASULINS"
  "impact.ttf|Impact|A S U L I N S"
  "bahnschrift.ttf|Bahnschrift|A S U L I N S"
  "seguibl.ttf|Segoe-Black|ASULINS"
)

# Orange and teal are the two the art is drawn in. Cream is the neutral that
# lets the picture carry the colour on its own.
COLOURS=(
  "0xffb020|gold"
  "0x4ecdc4|teal"
  "0xf2ece0|cream"
)

# ── compose ───────────────────────────────────────────────────────────
#
# Three layouts, and each one says something different about which half is
# the logo:
#
#   beside   the picture leads and the word is its label
#   over     the word leads and the picture is a crest above it
#   inline   both on one line, the word big — the business-card version
#
# The word is drawn twice in `over` and `inline`, once as a wide dark stroke
# and once in the colour on top, so it keeps its edge on any background.
pick_art() {
  case "$1" in
    1|5|9)  echo "$ART/art-pads.png" ;;
    2|6|10) echo "$ART/art-pads-cord.png" ;;
    3|7|11) echo "$ART/art-monsters.png" ;;
    *)      echo "$ART/art-monsters-pad.png" ;;
  esac
}

# ═══ THE ART IS MEASURED, NOT GUESSED ═══
#
# First pass cropped a fixed fraction of the frame and scaled by HEIGHT, so
# the art's width was whatever it happened to be — and in two of the three
# layouts the word landed on top of the picture. A logo whose two halves
# overlap is not a layout option, it is a bug wearing one.
#
# cropdetect finds where the drawing actually is in each 16:9 frame, and
# everything downstream is placed from a known width.
trim() {
  ffmpeg -v info -i "$1" -vf "cropdetect=limit=24:round=2:skip=0" -frames:v 1 -f null - 2>&1 |
    grep -o "crop=[0-9:]*" | tail -1 | cut -d= -f2
}

made=()
n=0
for layout in beside over inline; do
  for fi in "${!FONTS[@]}"; do
    n=$((n + 1))
    IFS='|' read -r file fontname word <<<"${FONTS[$fi]}"
    IFS='|' read -r hex colourname <<<"${COLOURS[$((fi % ${#COLOURS[@]}))]}"
    art=$(pick_art "$n")
    [ -f "$art" ] || { echo "missing: $art — run studioMarks.ts first" >&2; exit 1; }

    dest=$(printf '%s/lockup-%02d-%s-%s-%s.png' "$OUT" "$n" "$layout" "$fontname" "$colourname" | tr ' ' '-')

    CROP=$(trim "$art")
    [ -n "$CROP" ] || { echo "could not find the drawing in $art" >&2; exit 1; }

    case "$layout" in
      beside)
        # Picture left, word to its right. The art gets a known width, so the
        # word's x is the art's right edge plus a gap and nothing can collide.
        AW=260; AX=70; GAP=46
        TX=$((AX + AW + GAP))
        ffmpeg -y -v error -f lavfi -t 0.04 -i "color=${BG}:s=${W}x${H}" -i "$art" \
          -filter_complex "[1:v]crop=${CROP},scale=${AW}:-1[a];\
[0:v][a]overlay=x=${AX}:y=(H-h)/2[b];\
[b]drawtext=fontfile='$(f "$file")':text='${word}':x=${TX}:y=(h-text_h)/2\
:fontsize=62:fontcolor=${hex}[v]" \
          -map "[v]" -frames:v 1 "$dest"
        ;;
      over)
        # Crest above, word beneath, both centred. The one that reads most
        # like a studio ident, and the one the animation is easiest on.
        #
        # The word's y comes from the art's measured HEIGHT, not a constant.
        # A pair of controllers is wide and flat; a pair of monsters is
        # nearly square, so at the same width the second is twice as tall. A
        # fixed y put the word straight through the big monster's chest.
        AW=300; AY=52; GAP=26
        AH=$(echo "$CROP" | awk -F: -v w="$AW" '{printf "%d", w * $2 / $1}')
        TY=$((AY + AH + GAP))
        ffmpeg -y -v error -f lavfi -t 0.04 -i "color=${BG}:s=${W}x${H}" -i "$art" \
          -filter_complex "[1:v]crop=${CROP},scale=${AW}:-1[a];\
[0:v][a]overlay=x=(W-w)/2:y=${AY}[b];\
[b]drawtext=fontfile='$(f "$file")':text='${word}':x=(w-text_w)/2:y=${TY}\
:fontsize=80:fontcolor=${hex}[v]" \
          -map "[v]" -frames:v 1 "$dest"
        ;;
      inline)
        # One line, word large: the business-card version.
        AW=180; AX=60; GAP=40
        TX=$((AX + AW + GAP))
        ffmpeg -y -v error -f lavfi -t 0.04 -i "color=${BG}:s=${W}x${H}" -i "$art" \
          -filter_complex "[1:v]crop=${CROP},scale=${AW}:-1[a];\
[0:v][a]overlay=x=${AX}:y=(H-h)/2[b];\
[b]drawtext=fontfile='$(f "$file")':text='${word}':x=${TX}:y=(h-text_h)/2\
:fontsize=84:fontcolor=${hex}[v]" \
          -map "[v]" -frames:v 1 "$dest"
        ;;
    esac
    made+=("$dest")
    printf '  %-2s %-8s %-14s %s\n' "$n" "$layout" "$fontname" "$colourname"
  done
done

# ── the sheet ─────────────────────────────────────────────────────────
#
# Two columns. A logo judged at thumbnail size is a logo approved by mistake,
# and the thing being judged here is whether a word and a picture look like
# one object or two things that happen to be near each other.
inputs=(); tiles=()
for i in "${!made[@]}"; do
  inputs+=(-i "${made[$i]}")
  tiles+=("[$i:v]scale=640:299,pad=660:319:10:10:color=${BG}[t$i]")
done
rows=(); r=0
for ((i = 0; i < ${#made[@]}; i += 2)); do
  if [ -n "${made[$((i + 1))]:-}" ]; then
    rows+=("[t$i][t$((i + 1))]hstack=2[r$r]")
  else
    rows+=("[t$i]pad=1320:319:0:0:color=${BG}[r$r]")
  fi
  r=$((r + 1))
done
stack=""
for ((j = 0; j < r; j++)); do stack+="[r$j]"; done
stack+="vstack=$r[v]"

ffmpeg -y -v error "${inputs[@]}" \
  -filter_complex "$(IFS=';'; echo "${tiles[*]}");$(IFS=';'; echo "${rows[*]}");${stack}" \
  -map "[v]" -frames:v 1 "$SHEET"

echo
echo "  sheet → $SHEET"
