#!/usr/bin/env bash
#
# Cut Or's screen recording down to the part that belongs in the trailer.
#
#   bash scripts/cut-gameplay.sh ["battel screenshot.mp4"]
#   → store/gameplay.mp4
#
# ═══ WHY FOUR PIECES AND NOT ONE ═══
#
# Or: *"I put a screen recording of a battle in the folder. I think it's
# worth taking only parts of it — say the beginning and the end — because
# there's a bit of fumbling with action cards in the middle."*
#
# He is right, and the recording says so plainly. It is 83 seconds of one
# match: the board fills steadily for the first half minute, then two card
# detail panels sit open from about 0:35 to 0:60 while he reads them, then
# the countdown, the battle and the result. The middle is a person deciding.
# Nobody watches a trailer to see someone decide.
#
# So four pieces, in the order they happened:
#
#   BUILD      a card lands, then another; the board fills
#   COUNTDOWN  "ועכשיו נראה מה בנית" → 2 → 1 → "ועכשיו: לקרב!"
#   BATTLE     both boards, damage numbers flying
#   WIN        "טוב. באמת טוב."
#
# The countdown is the piece worth protecting. It is the game's own writing
# and it does the one job a cut between two phases usually needs a caption
# for: it says the building is over and the fighting starts now.
#
# ═══ THE BARS ARE NOT A MISTAKE ═══
#
# The recording is 2340x1080 — a landscape phone, 2.17:1 — and the trailer
# is 16:9. Scaling to fill would crop 210 pixels off each side, and both
# edges carry interface: the card in your hand on the left, the opponent's
# columns on the right. So it is padded instead, in the game's own
# background colour, and the game keeps its real shape.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-battel screenshot.mp4}"
OUT=store/gameplay.mp4
W=1920
H=1080
BG=0x070a12
FPS=25
XF=0.25      # the crossfade between pieces

[ -f "$SRC" ] || { echo "no recording at: $SRC" >&2; exit 1; }

# start  length  what
PIECES=(
  "5.0   4.0   build"
  "65.4  3.9   countdown"
  "69.3  5.2   battle"
  "79.5  2.1   win"
)

inputs=()
filters=()
i=0
for p in "${PIECES[@]}"; do
  read -r ss len _ <<<"$p"
  # -ss BEFORE -i seeks fast; -t after it trims from there.
  inputs+=(-ss "$ss" -t "$len" -i "$SRC")
  filters+=(
    "[$i:v]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},fps=${FPS},setsar=1,format=yuv420p[p$i]"
  )
  i=$((i + 1))
done

# Stitch, crossfading between pieces. Each xfade overlaps by XF, so the
# running offset loses XF every time — the same arithmetic as make-trailer.sh.
chain=""
prev="[p0]"
elapsed=0
for ((j = 1; j < ${#PIECES[@]}; j++)); do
  read -r _ len _ <<<"${PIECES[$((j - 1))]}"
  elapsed=$(awk -v e="$elapsed" -v l="$len" -v f="$XF" 'BEGIN{printf "%.3f", e + l - f}')
  chain+="${prev}[p$j]xfade=transition=fade:duration=${XF}:offset=${elapsed}[x$j];"
  prev="[x$j]"
done

total=$(awk -v f="$XF" -v n="${#PIECES[@]}" 'BEGIN{t=0}
  {t += $2} END{printf "%.3f", t - (n-1)*f}' <<<"$(printf '%s\n' "${PIECES[@]}")")

chain+="${prev}fade=t=in:st=0:d=0.3,fade=t=out:st=$(awk -v t="$total" 'BEGIN{printf "%.3f", t-0.4}'):d=0.4[v]"

mkdir -p store
ffmpeg -y -v warning -stats \
  "${inputs[@]}" \
  -filter_complex "$(IFS=';'; echo "${filters[*]}");${chain}" \
  -map "[v]" -an \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" -movflags +faststart \
  "$OUT"

echo
echo "  $OUT"
ffprobe -v error -show_entries format=duration:stream=width,height -of default=nw=1 "$OUT"
