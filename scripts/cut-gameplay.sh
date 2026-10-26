#!/usr/bin/env bash
#
# The montage: the part of Or's screen recording that belongs in the trailer.
#
#   bash scripts/cut-gameplay.sh        → store/gameplay-en.mp4
#
# ═══ WHAT WAS WRONG WITH THE OLD ONE ═══
#
# Or, watching the cut it produced: *"make it all look really good and not
# miserable like it is now. It should look like a game you want to play."*
#
# He is right and the frames say why. The opening is eight generated shots
# that fill 1920x1080 edge to edge, and then the game arrived as a small
# bright box floating in the middle of a black screen — the recording it was
# cut from was itself a window inside a larger capture, so by the time it had
# been letterboxed a second time the game was about half the height of the
# frame. A cinematic, and then a thumbnail of a game.
#
# Three things changed:
#
#   THE FRAME IS FULL      the new recording is edge to edge, and the top
#                          strip with LEAVE and the settings cog is cropped
#                          off, so what is on screen is the board
#   THE BARS ARE NOT BLACK a 2.38:1 picture in a 16:9 frame leaves 137px top
#                          and bottom; they carry a heavy blur of the frame
#                          itself, so the picture bleeds into its own edge
#                          instead of sitting in a box
#   IT CUTS                nine pieces in sixteen seconds, hard cuts, no
#                          dissolves. The old cut was four pieces crossfading
#                          into each other, which reads as slow at any speed
#
# ═══ ONE RECORDING, NINE MOMENTS ═══
#
# Or: *"make sure you take only the cool parts from it."*
#
# The recording is one match end to end, 91 seconds, and most of it is a
# person thinking. These are the nine moments where something HAPPENS, found
# by walking the file at two and three frames a second and looking:
#
#   0:01  the two catchphrases facing each other
#   0:04  BUILD FRENZY, and the first card goes down
#   0:33  three cards dragged onto a board that is already full
#   0:36  that board, held for a second, because it is the thing you built
#   0:47  the countdown: 2, 1, 0, INTO BATTLE!
#   0:51  the clash, damage numbers coming off both sides
#   1:16  KING DOWN!
#
# ═══ TWO THAT WERE HERE AND ARE NOT ═══
#
# Or, watching the cut: *"these two look superfluous and drag it down."*
#
#   the home screen  it opened the montage; it opens the whole trailer now
#                    instead, as one tile of the collage. Twice is once too
#                    many, and the collage says more in the same second.
#   You won.         a panel of text, held for a second and a half. KING
#                    DOWN! three seconds earlier is the same news, in motion,
#                    with monsters in it — and the trailer ends on the
#                    wordmark, which is a better last frame than a dialog.
#
# The still that is left is a breath between moving pieces, and the only way
# a viewer reads a whole screen rather than watching one corner of it.
#
# ═══ THE PICTURE IS 848 WIDE AND THE TRAILER IS 1920 ═══
#
# This recording is 848x392 where the two before it were 2340x1080 off the
# phone, so every piece here is blown up about two and a half times. It
# survives it because the art is painted rather than ruled — there are no
# thin lines in it to go soft — and because `unsharp` is run after the
# scale, not before. A phone capture of the same match would be sharper; see
# store/recordings/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=store/recordings/2026-10-26-match-en.mp4
OUT=store/gameplay-en.mp4
SEG=assets/raw/trailer/segments/montage
W=1920
H=1080
FPS=25

# ── the cut ───────────────────────────────────────────────────────────
#
#   kind   start   length  crop-y  name
#
# CROP-Y is which 356 of the recording's 392 rows are kept. In a match the
# top 36 are the LEAVE button and the cog, and they are the two things on
# screen that are not the game, so they go. On the three SCREENS — home, the
# catchphrases, the win — the top is the wordmark and the player's name, so
# there the 356 rows are taken from the top and the bottom edge goes instead.
#
# Every piece ends up the same shape, which matters more than it sounds:
# pieces of two different heights make the picture jump size at every cut.
#
# Two of the lengths were trimmed after watching the cut rather than when it
# was planned, and both for the same reason — a stretch where nothing on
# screen changes reads as long however short it is:
#
#   frenzy     2.0 -> 1.5   the banner is up over a board with two cards on
#                           it, which is the emptiest the game ever looks
#   countdown  2.8 -> 2.6   and starts 0.35s later: the game dims the board
#                           under the numbers, so this is the darkest piece
#                           in the montage and the part worth keeping is the
#                           end of it, where INTO BATTLE! comes up bright
#
# The 0.7s they gave back went to `building`, which is three cards being
# dragged onto a board that is already full of monsters.
PIECES=(
  "clip    0.75  1.5   0   catchphrases"
  "clip    3.55  1.5  36   frenzy"
  "clip   33.10  3.6  36   building"
  "still  36.20  1.1  36   board"
  "clip   47.65  2.6  36   countdown"
  "clip   51.30  2.8  36   clash"
  "clip   75.75  2.2  36   kingdown"
)

# ═══ HOW THE PIECES MEET ═══
#
# Or: *"and the transitions don't look good either."*
#
# They were hard cuts, and a hard cut between two shots of the same board a
# few seconds apart does not read as an edit — it reads as the video having
# skipped. The eye sees one picture twitch rather than two pictures.
#
# So each piece pushes the one before it off to the left. A slide says
# "next" where the cut said nothing, it is the gesture a player makes going
# through their own cards, and it keeps the montage moving even across the
# still.
XFADE=0.24
TRANS=slideleft

[ -f "$SRC" ] || { echo "no recording at: $SRC" >&2; exit 1; }
rm -rf "$SEG"
mkdir -p "$SEG" store

# The picture, and the bed it sits on.
#
# The bed is the same frame scaled to FILL 1920x1080, blurred to nothing and
# pulled down two stops — so the colour above and below the picture is the
# colour of the picture, moving with it. A flat background would be a box
# drawn around the game; this is the game's own light spilling past its edge.
BED="scale=${W}:${H}:force_original_aspect_ratio=increase:flags=bilinear,crop=${W}:${H},\
gblur=sigma=50,eq=brightness=-0.40:saturation=0.5"
# 806 = 1920 * 356/848. The 4px pad is a hairline the colour of the game's
# own panel edges, so the picture has a lid and a floor rather than fading
# into the blur.
PIC_H=806
LIP="pad=${W}:$((PIC_H + 8)):0:4:color=0x24375c"
# ═══ THE GAME'S OWN SOUND COMES WITH IT ═══
#
# The recording has audio, and it is the app's rather than a microphone's:
# at 1:26, sitting on the home screen, it measures -91 dB, which is digital
# silence and not a room. So what is on it is card thumps, hits and the
# countdown, and nobody talking.
#
# It rides UNDER the score — make-trailer.sh mixes it in at about half —
# because the music is written and this is texture. But a card that lands
# with a sound is the difference between footage of a game and a game.
#
# Every piece is encoded with the same audio settings, the silent ones
# included: the concat demuxer is not re-encoding anything, and two
# different AAC headers make a file that goes quiet halfway through.
AENC=(-c:a aac -b:a 192k -ar 48000 -ac 2)
ENC=(-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS")

i=0
for p in "${PIECES[@]}"; do
  read -r kind ss len cy name <<<"$p"
  i=$((i + 1))
  out=$(printf '%s/%02d-%s.mp4' "$SEG" "$i" "$name")
  printf '  %-13s %5ss  %ss\n' "$name" "$ss" "$len"

  # Where the sound fades out, half a frame before the picture does.
  fo=$(awk -v l="$len" 'BEGIN{printf "%.2f", l-0.06}')

  if [ "$kind" = "clip" ]; then
    ffmpeg -y -v error -ss "$ss" -t "$len" -i "$SRC" -filter_complex "\
[0:v]crop=848:356:0:${cy},fps=${FPS},split=2[a][b];\
[a]${BED}[bg];\
[b]scale=${W}:-2:flags=lanczos,unsharp=5:5:0.75:5:5:0.0,${LIP}[fg];\
[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v];\
[0:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=0.06,\
afade=t=out:st=${fo}:d=0.06[a]" \
      -map "[v]" -map "[a]" -t "$len" "${ENC[@]}" "${AENC[@]}" "$out"
  else
    # ═══ A STILL IS A CLIP OF ONE FRAME, PUSHED INTO ═══
    #
    # zoompan turns a single input frame into N and crops a shrinking window
    # out of it, which is the push. It only ever emits N frames from ONE
    # frame, so the bed cannot come off the same input — it is the same file
    # opened a second time with -loop, which is what the second -i is.
    n=$(awk -v l="$len" -v f="$FPS" 'BEGIN{printf "%d", l*f}')
    ffmpeg -y -v error -ss "$ss" -i "$SRC" -frames:v 1 "$SEG/.frame.png"
    ffmpeg -y -v error -i "$SEG/.frame.png" -loop 1 -t "$len" -i "$SEG/.frame.png" \
      -f lavfi -t "$len" -i anullsrc=r=48000:cl=stereo \
      -filter_complex "\
[0:v]crop=848:356:0:${cy},\
zoompan=z='1.09-0.09*on/(${n}-1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'\
:d=${n}:s=${W}x${PIC_H}:fps=${FPS},unsharp=5:5:0.75:5:5:0.0,${LIP}[fg];\
[1:v]crop=848:356:0:${cy},fps=${FPS},${BED}[bg];\
[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]" \
      -map "[v]" -map 2:a -t "$len" "${ENC[@]}" "${AENC[@]}" "$out"
  fi
done
rm -f "$SEG/.frame.png"

# ── join ──────────────────────────────────────────────
#
# xfade wants every piece in one graph, and each transition's OFFSET is a
# time on the RUNNING OUTPUT — every overlap shortens everything after it,
# so the offsets accumulate rather than being summed off the list above.
#
# acrossfade mirrors it on the audio at the same duration, which is what
# keeps a card's thump on the frame where the card lands.
echo
echo "  joining: ${TRANS} × ${XFADE}s"

inputs=()
vchain=""
achain=""
prev_v="[0:v]"
prev_a="[0:a]"
elapsed=0
last=0
i=0
for p in "${PIECES[@]}"; do
  read -r kind ss len cy name <<<"$p"
  i=$((i + 1))
  inputs+=(-i "$(printf '%s/%02d-%s.mp4' "$SEG" "$i" "$name")")
  if [ "$i" -gt 1 ]; then
    elapsed=$(awk -v e="$elapsed" -v l="$last" -v x="$XFADE" 'BEGIN{printf "%.3f", e + l - x}')
    vchain+="${prev_v}[$((i - 1)):v]xfade=transition=${TRANS}:duration=${XFADE}:offset=${elapsed}[v$i];"
    achain+="${prev_a}[$((i - 1)):a]acrossfade=d=${XFADE}:c1=tri:c2=tri[a$i];"
    prev_v="[v$i]"
    prev_a="[a$i]"
  fi
  last=$len
done

ffmpeg -y -v error "${inputs[@]}" \
  -filter_complex "${vchain%;};${achain%;}" \
  -map "${prev_v}" -map "${prev_a}" \
  "${ENC[@]}" "${AENC[@]}" -movflags +faststart "$OUT"

echo
printf '  %-24s ' "$OUT"
ffprobe -v error -show_entries format=duration -show_entries stream=width,height -of csv=p=0 "$OUT" | tr '\n' ' '
echo
