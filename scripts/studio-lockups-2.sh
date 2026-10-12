#!/usr/bin/env bash
#
# ASULINS, round two — the one Hod picked, simplified.
#
#   bash scripts/studio-lockups-2.sh
#   → assets/raw/studio/lockups-2.png
#
# Or, after the first sheet: *"I love that it's all on one line. Hod loves
# the two monsters holding the controller. I'm going with him on it, but to
# me it's a bit fussy — the visual needs simplifying and fewer colours, or if
# the controller is white then the text should be white too."*
#
# So three decisions are already made and this sheet does not re-ask them:
# the layout is INLINE, the art is the pair with the controller, and the
# palette is cut.
#
# ═══ THE TEXT TAKES ITS COLOUR FROM THE ART ═══
#
# That last clause of his is the rule, not a preference about one case. A
# wordmark in a colour the drawing beside it does not contain reads as two
# logos that happen to be adjacent — which is most of what "fussy" was. So
# the colour is declared WITH the art it stands next to, and the only thing
# varying across the sheet is the font.
set -euo pipefail
cd "$(dirname "$0")/.."

ART=assets/raw/studio
OUT="$ART"
SHEET="$ART/lockups-2.png"
W=900
H=320
BG=0x070a12

f() { printf 'C\\:/Windows/Fonts/%s' "$1"; }

# Where the drawing actually is inside its 16:9 frame. See studio-lockups.sh
# for why this is measured rather than cropped by a fraction.
trim() {
  ffmpeg -v info -i "$1" -vf "cropdetect=limit=24:round=2:skip=0" -frames:v 1 -f null - 2>&1 |
    grep -o "crop=[0-9:]*" | tail -1 | cut -d= -f2
}

# art | its dominant colour | what to call it
ARTS=(
  "art-pair-twotone|0xf2ece0|שמנת וזהב"
  "art-pair-white|0xf4f1ea|הכל לבן"
  "art-pair-outline|0xf4f1ea|קו בלבד"
)

# Two fonts, because the rest is settled and four would be noise.
FONTS=(
  "ariblk.ttf|Arial-Black|ASULINS"
  "bahnschrift.ttf|Bahnschrift|A S U L I N S"
)

made=()
n=0
for a in "${ARTS[@]}"; do
  IFS='|' read -r art hex label <<<"$a"
  src="$ART/$art.png"
  [ -f "$src" ] || { echo "missing: $src — run studioMarks.ts first" >&2; exit 1; }
  CROP=$(trim "$src")
  [ -n "$CROP" ] || { echo "could not find the drawing in $src" >&2; exit 1; }

  for fi in "${!FONTS[@]}"; do
    n=$((n + 1))
    IFS='|' read -r file fontname word <<<"${FONTS[$fi]}"
    dest=$(printf '%s/lockup2-%02d-%s-%s.png' "$OUT" "$n" "$art" "$fontname")

    # One line: the pair on the left, the word to the right of it. The art
    # gets a known width so the word's x cannot collide with it.
    AW=190; AX=70; GAP=44
    TX=$((AX + AW + GAP))
    ffmpeg -y -v error -f lavfi -t 0.04 -i "color=${BG}:s=${W}x${H}" -i "$src" \
      -filter_complex "[1:v]crop=${CROP},scale=${AW}:-1[a];\
[0:v][a]overlay=x=${AX}:y=(H-h)/2[b];\
[b]drawtext=fontfile='$(f "$file")':text='${word}':x=${TX}:y=(h-text_h)/2\
:fontsize=86:fontcolor=${hex}[v]" \
      -map "[v]" -frames:v 1 "$dest"

    made+=("$dest")
    printf '  %-2s %-16s %s\n' "$n" "$label" "$fontname"
  done
done

# ── the sheet ─────────────────────────────────────────────────────────
inputs=(); tiles=()
for i in "${!made[@]}"; do
  inputs+=(-i "${made[$i]}")
  tiles+=("[$i:v]scale=660:235,pad=680:255:10:10:color=${BG},\
drawtext=fontfile='$(f ariblk.ttf)':text='$((i + 1))':x=20:y=14\
:fontsize=30:fontcolor=0x55627a[t$i]")
done
rows=(); r=0
for ((i = 0; i < ${#made[@]}; i += 2)); do
  rows+=("[t$i][t$((i + 1))]hstack=2[r$r]")
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
