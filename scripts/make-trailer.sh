#!/usr/bin/env bash
#
# The trailer, assembled.
#
#   bash scripts/make-trailer.sh he     → store/trailer-he.mp4
#   bash scripts/make-trailer.sh en     → store/trailer-en.mp4
#   bash scripts/make-trailer.sh        → both
#
# Four segments, built separately and then joined — and then the studio
# ident is laid in front of the finished thing:
#
#   IDENT     the Asulins mark, with its own sting             2.6s
#   OPENING   7 generated shots in a dark petrol station       9.8s
#   CARDS     four cards fall out of Amanda's light            1.4s
#   GAMEPLAY  nine moments out of one recorded match          16.1s
#   CLOSING   the end card                                     3.4s
#
# ═══ WHAT OR SAID ABOUT THE CUT BEFORE THIS ONE ═══
#
# *"Make it all look really good and not miserable like it is now. It should
# look like a game you want to play."*
#
# The opening was never the problem — it is eight generated shots filling the
# frame edge to edge. The problem was what came after it: the game arrived as
# a small bright rectangle in a large black screen, because the recording it
# was cut from was itself a window inside a capture, and it then got
# letterboxed a second time on the way in. Half the height of the frame was
# black, and the half that was not was a person thinking.
#
# Three things answer that, and two of them live in cut-gameplay.sh: the
# picture fills the width now, and the cut is nine moments rather than four.
# The third is here — the four cards that drop between the opening and the
# game were 315px wide on a 1920px screen, which looked like a mistake. They
# are 420 now and they land in the middle of the frame.
#
# ═══ WHY THE IDENT IS ADDED LAST AND NOT FIRST ═══
#
# It is the one piece with sound of its own. The four segments are silent
# and the score is laid over the whole join in a single pass — put the ident
# among them and the sting would be buried under music written for a
# different moment, which is the opposite of what an ident is for.
#
# So the trailer is finished, scored, and only then does the ident go on the
# front with its own audio intact. The music starts when the trailer starts.
#
# ═══ TWO CUTS, AND ONLY THE LAST THREE SECONDS DIFFER ═══
#
# Or: *"I want us to make a Hebrew clip and an English clip."* Play takes one
# promo video per listing language, so these are two uploads.
#
# They used to differ in their footage as well. They no longer do, because
# Or decided it: *"for the ident, the trailer and the app screenshots we will
# use English for everything, including the Amanda title."* So both cuts show
# the same match in the same language, and what is left of the difference is
# the end card — the wordmark and the line under it:
#
#   he   אמנדה   משחק קלפים מפלצתי
#   en   AMANDA    Monster card game
#
# Which is the one thing a Hebrew listing should still say in Hebrew: what
# the game is called.
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

LANGS=("$@")
[ ${#LANGS[@]} -gt 0 ] || LANGS=(he en)
for l in "${LANGS[@]}"; do
  [ "$l" = "he" ] || [ "$l" = "en" ] || { echo "usage: $0 [he|en ...]" >&2; exit 1; }
done

SEG=assets/raw/trailer/segments
CLIPS=assets/raw/trailer/clips
MUSIC="apps/client/public/music/track1.mp3"

# ═══ WHERE THE MUSIC STARTS, AND WHY NOT AT ZERO ═══
#
# Or, watching the first cut: *"after 10 seconds the melody suddenly
# changes"* — and *"in the clip certainly don't switch between two pieces
# inside 30 seconds."*
#
# The old score.mp3 was a montage and did exactly that. It is gone; the game
# ships two whole songs now (scripts/make-music.sh). But a whole song still
# has an intro and a chorus, and dropping 31 seconds anywhere inside one can
# land on the seam between them.
#
# So the window was measured rather than guessed: per-second RMS across both
# songs, scanning every 32-second window for the smallest spread and the
# smallest single jump within it.
#
#   track1 @ 91s    spread 3.1 dB   largest jump 1.8 dB   <- this one
#   track2 @ 177s   spread 5.9 dB   largest jump 5.8 dB
#
# 1.8 dB across half a minute is a passage, not a change. The check further
# down keeps the cut inside it.
#
# Re-measured when this cut got longer, because the number above is only
# worth anything for the length it was measured at. Scanning again, with the
# window set to 32, 34, 36 and 38 seconds, every one of them picks the same
# stretch and the same spread -- the passage is wider than the trailer needs:
#
#   start 88   32s   spread 4.9 dB   largest jump 2.3 dB
#   start 88   36s   spread 4.9 dB   largest jump 2.3 dB
#   start 91   36s   spread 4.9 dB   largest jump 2.9 dB   <- 91 is late
#
# So the cut moved three seconds earlier and the window is still 32, which
# is more than the 30.6 this now runs to. The jump is what to watch: at 91
# a 36-second window starts to reach into the next passage.
# ═══ NO loudnorm ON THE MUSIC. IT SKIPPED THREE SECONDS. ═══
#
# Or: *"something is wrong with the soundtrack. At second 16 there is some
# strange join. Where does it come from?"*
#
# Measured rather than guessed: correlating the finished trailer against the
# song, second by second, the first ten seconds matched exactly — and from
# about twelve seconds on, every window matched a point 2.98 SECONDS LATER
# in the song than it should have. The music jumps forward, once, and
# carries on. Three seconds is loudnorm's lookahead window.
#
# The file does not need it. make-music.sh already normalises both songs to
# -17 LUFS, which is the level the game is tuned against; normalising a
# second time was work that could only do harm, and did.
MUSIC_START=88
MUSIC_WINDOW=32
W=1920
H=1080
FPS=25
BG=0x070a12
# The colour the opening fades out through and the cards fade in from. It is
# Amanda's teal, washed almost to white — the last thing in shot 7 is her
# light flooding the station, so that is what the cards come out of.
FLASH=0xdff6f2

# The shot list lives in its own file: scripts/make-intro.sh builds the same
# opening for the game's first-launch splash, and two copies of these numbers
# would drift. It also carries the reasoning for why they are so short, and
# for why 08-fold is not among them.
. "$(dirname "$0")/trailer-shots.sh"

# ═══ THE HEBREW ON THE END CARD IS LAID OUT BY ffmpeg, NOT BY ME ═══
#
# drawtext does not reorder text by itself, so the obvious move is to reverse
# the Hebrew string before handing it over. It is also wrong here: this
# ffmpeg is built --enable-libfribidi --enable-libharfbuzz, so it applies
# bidi already, and a pre-reversed string would come out backwards. Checked
# by rendering one frame and reading it rather than by reasoning about it.
#
# Segoe UI Bold rather than Arial: it is the game's own interface font
# (tokens.css), it covers Hebrew, and the end card is the one place in the
# trailer where the game's own typography should be showing.
FONT='C\:/Windows/Fonts/segoeuib.ttf'
HAS_FONT=1
[ -f "/c/Windows/Fonts/segoeuib.ttf" ] || HAS_FONT=0

# The tagline is not written here. It is the subtitle under the wordmark on
# the home screen, and its English is the English that shipped — see COPY.md
# s86247d1. Two places saying this in two different ways is how a game ends
# up calling itself one thing in the store and another when you open it.
mkdir -p "$SEG" store assets/raw/trailer/text
printf 'משחק קלפים מפלצתי' > assets/raw/trailer/text/tagline-he.txt
printf 'Monster card game'  > assets/raw/trailer/text/tagline-en.txt

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

# The opening ends by fading UP into Amanda's own light rather than down to
# black, and the cards fade in out of the same colour — so her light is what
# becomes them. Or: "it ends there with a fade to the game."
OPEN_LEN=$(for s in "${SHOTS[@]}"; do set -- $s; echo "$2"; done | awk '{t+=$1} END{printf "%.2f", t}')
OPEN_OUT=$(awk -v t="$OPEN_LEN" 'BEGIN{printf "%.2f", t-0.26}')

ffmpeg -y -v error "${inputs[@]}" \
  -filter_complex "$(IFS=';'; echo "${filters[*]}");${concat}concat=n=${i}:v=1:a=0,fade=t=in:st=0:d=0.4,fade=t=out:st=${OPEN_OUT}:d=0.26:color=${FLASH}[v]" \
  -map "[v]" "${ENC[@]}" "$SEG/1-opening.mp4"

# ── 2 · the collage ───────────────────────────────────
#
# Six screens flying in out of Amanda's light, and then the game.
#
# ═══ WHAT WAS HERE BEFORE, AND WHY IT WENT ═══
#
# Four cards falling onto black. Or, watching it: *"this looks superfluous
# and drags it down."* He was right and the frame says why — four pieces of
# artwork, no interface, nothing the game does, and a second and a half of a
# viewer's attention spent on a picture of four monsters they have just spent
# ten seconds watching move.
#
# Or: *"it would be worth taking more screenshots — of the album, of the
# shop and so on, in English of course — and working them into nice
# transitions, maybe some energetic collage."* So: six screens, each sliding
# in from the edge it is nearest, a tenth of a second apart. It is the one
# second in the trailer that says how much game there is.
#
# Four of the six are captures of the running game (store/raw-screens, made
# with `?album=full` — see account.ts) and two are frames of the recording,
# so the collage and the montage after it are the same session.
#
# The last second of it is a slow push in, because a grid that lands and
# then stops is a photograph of a collage. `zoompan` with d=1 takes one
# frame and gives one frame back, which is what makes it a zoom on a
# moving picture rather than a Ken Burns on a still.
echo "  collage"
TILES=(
  store/raw-screens/home.jpg
  store/raw-screens/album.jpg
  store/raw-screens/shop.jpg
  store/raw-screens/deck.jpg
  store/raw-screens/build.jpg
  store/raw-screens/battle.jpg
)
# Which edge each one comes from. Nearest edge, so nothing crosses the frame
# and nothing crosses anything else: six tiles arriving through each other
# is not energy, it is a mess.
FROM=(left top right left bottom right)

COL_HOLD=2.4
TILE_W=620
TILE_H=286          # the game is 2.165:1, and 620/2.165 is 286
GAP=12
GRID_X=18           # (1920 - 3*620 - 2*12) / 2
GRID_Y=248          # (1080 - 2*286 - 12) / 2
FLY=0.28            # seconds in the air
STEP=0.13           # between one tile leaving and the next

for f in "${TILES[@]}"; do
  [ -f "$f" ] || { echo "missing collage tile: $f" >&2; exit 1; }
done

tinputs=(-f lavfi -t "$COL_HOLD" -i "color=${BG}:s=${W}x${H}:r=${FPS}")
tfilters=()
prev="[0:v]"
k=1
for idx in "${!TILES[@]}"; do
  tinputs+=(-i "${TILES[$idx]}")
  col=$((idx % 3))
  row=$((idx / 3))
  xf=$((GRID_X + col * (TILE_W + GAP)))
  yf=$((GRID_Y + row * (TILE_H + GAP)))
  t0=$(awk -v i="$idx" -v s="$STEP" 'BEGIN{printf "%.2f", 0.08 + i*s}')

  # A thin lid the colour of the game's own panel edges, so six pictures
  # read as six screens.
  tfilters+=("[${k}:v]scale=$((TILE_W - 6)):$((TILE_H - 6)):force_original_aspect_ratio=increase,\
crop=$((TILE_W - 6)):$((TILE_H - 6)),unsharp=5:5:0.6:5:5:0.0,\
pad=${TILE_W}:${TILE_H}:3:3:color=0x2a4269[c$idx]")

  case "${FROM[$idx]}" in
    left)
      sp=$(awk -v a="-${TILE_W}" -v b="$xf" -v d="$FLY" 'BEGIN{printf "%.1f", (b-a)/d}')
      xe="if(lt(t,${t0}),-${TILE_W},min(${xf},-${TILE_W}+(t-${t0})*${sp}))"; ye="$yf" ;;
    right)
      sp=$(awk -v a="$W" -v b="$xf" -v d="$FLY" 'BEGIN{printf "%.1f", (a-b)/d}')
      xe="if(lt(t,${t0}),${W},max(${xf},${W}-(t-${t0})*${sp}))"; ye="$yf" ;;
    top)
      sp=$(awk -v a="-${TILE_H}" -v b="$yf" -v d="$FLY" 'BEGIN{printf "%.1f", (b-a)/d}')
      xe="$xf"; ye="if(lt(t,${t0}),-${TILE_H},min(${yf},-${TILE_H}+(t-${t0})*${sp}))" ;;
    *)
      sp=$(awk -v a="$H" -v b="$yf" -v d="$FLY" 'BEGIN{printf "%.1f", (a-b)/d}')
      xe="$xf"; ye="if(lt(t,${t0}),${H},max(${yf},${H}-(t-${t0})*${sp}))" ;;
  esac

  tfilters+=("${prev}[c$idx]overlay=x='${xe}':y='${ye}'[g$idx]")
  prev="[g$idx]"
  k=$((k + 1))
done

# ═══ THE FLASH IS A FADE, NOT AN OVERLAY ═══
#
# This was first built as a near-white layer composited on top and faded out
# on its alpha channel. It came out a flat mid-grey: the colour source went
# through yuva420p and the alpha fade, and what landed on screen was neither
# the flash nor what was under it. `fade=t=in` takes a COLOUR, so the whole
# effect is one filter on the finished frame — it starts AT Amanda's light
# and reveals the collage out of it. Nothing to composite, nothing to go grey.
ffmpeg -y -v error "${tinputs[@]}" \
  -filter_complex "$(IFS=';'; echo "${tfilters[*]}");${prev}fade=t=in:st=0:d=0.26:color=${FLASH},\
zoompan=z='min(1+0.0011*on,1.055)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},\
format=yuv420p[v]" \
  -map "[v]" "${ENC[@]}" "$SEG/2-collage.mp4"

# ── 3 and 4, once per language ────────────────────────────────────────
#
# Everything above this line is the same film in both cuts: four monsters in
# a petrol station and four cards falling out of Amanda's light, with not one
# word in any of it. So, now, is the montage — see the note at the top about
# Or choosing English for every store asset. The only thing left with a
# language is the card at the end.

# The cut is disposable: cut-gameplay.sh makes it from the recording in about
# a minute. So a missing one is rebuilt rather than worked around — which is
# what makes it safe to DELETE it when disk is short.
GAMEPLAY=store/gameplay-en.mp4
if [ ! -f "$GAMEPLAY" ]; then
  echo "  montage missing — cutting it from the recording"
  bash scripts/cut-gameplay.sh >/dev/null
  [ -f "$GAMEPLAY" ] || { echo "  no montage, and nothing to cut one from" >&2; exit 1; }
fi
echo "  gameplay"
ffmpeg -y -v error -i "$GAMEPLAY" -vf "$NORM" "${ENC[@]}" "$SEG/3-gameplay.mp4"

for L in "${LANGS[@]}"; do
  echo
  echo "── ${L} ──"

  if [ "$L" = "he" ]; then
    WORDMARK=apps/client/public/brand/wordmark.png
  else
    WORDMARK=apps/client/public/brand/wordmark-en.png
  fi

  [ -f "$WORDMARK" ] || { echo "missing: $WORDMARK — run pnpm --filter @amanda/art exec tsx src/wordmarkEn.ts" >&2; exit 1; }

  # ── closing ─────────────────────────────────────────
  #
  # The end card Or asked for:
  #
  #     אמנדה                    the wordmark, which IS the name
  #     משחק קלפים מפלצתי        what it is
  #     playamanda.com           where to get it
  #
  # This is the only text in the whole trailer, and Play autoplays the first
  # thirty seconds MUTED, so it has to carry the pitch on its own in silence.
  #
  # ═══ IT IS ALONE NOW, AND THAT IS THE POINT ═══
  #
  # This segment used to open on a screenshot of the win and dissolve to the
  # card. The win is in the montage now, live, with the king going down three
  # seconds before it — a better version of the same beat — which leaves the
  # card the whole of the last three and a half seconds instead of sharing
  # them with a screenshot of a three-week-old interface.
  #
  # Three tiers and they are not close: the mark is 760px wide, the tagline
  # is 54px and grey, the address is 56px and gold. Squint at it and the
  # name is what you see; look at it and the address is the only coloured
  # thing on the screen. The tagline sits between them because it explains,
  # and explaining is never the hero.
  echo "  closing"

  # Laid out from the top of the group so the three lines stay locked to each
  # other, and the group is centred as a block. The two wordmarks are
  # different heights, so the block is measured rather than assumed.
  WM_W=760
  WM_H=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$WORDMARK" |
         awk -F, -v w="$WM_W" '{printf "%d", w * $2 / $1}')
  TAG_SIZE=54
  ADR_SIZE=56
  BLOCK=$((WM_H + 46 + TAG_SIZE + 42 + ADR_SIZE))
  WM_Y=$(( (H - BLOCK) / 2 ))
  TAG_Y=$((WM_Y + WM_H + 46))
  ADR_Y=$((TAG_Y + TAG_SIZE + 42))

  if [ "$HAS_FONT" = "1" ]; then
    CARDTEXT=",drawtext=fontfile='${FONT}':textfile=assets/raw/trailer/text/tagline-${L}.txt\
:x=(w-text_w)/2:y=${TAG_Y}:fontsize=${TAG_SIZE}:fontcolor=0xd5dce8@0.85\
,drawtext=fontfile='${FONT}':text='playamanda.com'\
:x=(w-text_w)/2:y=${ADR_Y}:fontsize=${ADR_SIZE}:fontcolor=0xffb020"
    # 0xffb020 is --accent from tokens.css. The address is the only thing on
    # the end card wearing it, which is the whole idea of an accent.
  else
    echo "    (no segoeuib.ttf — the end card will be the wordmark alone)"
    CARDTEXT=""
  fi

  # The card comes up out of the dark rather than cutting in: the montage
  # before it ends on a lit win screen, and a hard cut from that to a flat
  # background reads as the file having stopped.
  ffmpeg -y -v error \
    -f lavfi -t 3.4 -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
    -i "$WORDMARK" \
    -filter_complex "\
[1:v]scale=${WM_W}:-1[wm];\
[0:v][wm]overlay=x=(W-w)/2:y=${WM_Y}${CARDTEXT},fade=t=in:st=0:d=0.45,format=yuv420p[v]" \
    -map "[v]" "${ENC[@]}" "$SEG/4-closing.mp4"

  # ── join, and lay the score over the whole thing ────────────────────
  echo "  joining"
  OUT="store/trailer-${L}.mp4"
  : > "$SEG/list.txt"
  for f in 1-opening 2-collage 3-gameplay 4-closing; do
    echo "file '${f}.mp4'" >> "$SEG/list.txt"
  done

  TOTAL=$(for f in "$SEG"/[1-4]-*.mp4; do
    ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
  done | awk '{t+=$1} END{printf "%.3f", t}')
  FADEOUT=$(awk -v t="$TOTAL" 'BEGIN{printf "%.3f", t-1.4}')

  awk -v t="$TOTAL" -v w="$MUSIC_WINDOW" 'BEGIN{if (t > w) exit 1}' || {
    echo "The cut is ${TOTAL}s but the steady stretch of music is only ${MUSIC_WINDOW}s." >&2
    echo "Shorten a segment, or measure a longer window — see MUSIC_START." >&2
    exit 1
  }

  # ═══ AND THE GAME'S OWN SOUND, UNDER IT ═══
  #
  # The montage carries the audio off the recording — cards landing, hits,
  # the countdown — and it is mixed in here at half rather than cut into
  # the segments, for the same reason the ident goes on last: the music is
  # laid across the whole join in one pass, and anything mixed before that
  # would be balanced against a different thing.
  #
  # normalize=0 on the mix. amix divides by the number of inputs by
  # default, so without it adding a quiet second layer makes the score six
  # decibels quieter, which is the opposite of adding anything.
  SFX_AT=$(for f in "$SEG"/1-opening.mp4 "$SEG"/2-collage.mp4; do
    ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"
  done | awk '{t+=$1} END{printf "%d", t*1000}')

  ffmpeg -y -v warning -stats \
    -f concat -safe 0 -i "$SEG/list.txt" \
    -ss "$MUSIC_START" -i "$MUSIC" \
    -i "$GAMEPLAY" \
    -filter_complex "[0:v]fade=t=out:st=${FADEOUT}:d=1.4[v];\
[1:a]atrim=0:${TOTAL},afade=t=in:st=0:d=1.2,afade=t=out:st=${FADEOUT}:d=1.4[m];\
[2:a]volume=0.5,adelay=${SFX_AT}|${SFX_AT}[g];\
[m][g]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]" \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 192k -movflags +faststart \
    "$SEG/scored-${L}.mp4"

  # ── 0 · the ident, on the front ─────────────────────────────────────
  #
  # Scaled from 720p rather than re-rendered at 1080: the mark's size is set
  # in pixels inside make-ident.sh, so a bigger canvas there would give a
  # bigger frame with the same small logo in the middle of it. It is flat
  # shapes and one word, which is exactly the kind of picture that survives
  # 1.5x — and the alternative is two sets of layout numbers to keep in step.
  echo "  ident"
  IDENT=apps/client/public/brand/ident.mp4
  [ -f "$IDENT" ] || { echo "missing: $IDENT — run bash scripts/make-ident.sh" >&2; exit 1; }
  ffmpeg -y -v error -i "$IDENT" \
    -vf "$NORM" -af "aresample=48000" \
    -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 192k "$SEG/0-ident-${L}.mp4"

  # Re-encoded rather than stream-copied. The two pieces agree on size, rate
  # and pixel format by now, but not on how their audio was written, and a
  # concat demuxer that is handed two different AAC headers produces a file
  # that plays the first three seconds and goes silent.
  ffmpeg -y -v warning -stats \
    -i "$SEG/0-ident-${L}.mp4" -i "$SEG/scored-${L}.mp4" \
    -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" \
    -c:a aac -b:a 192k -movflags +faststart \
    "$OUT"

  echo
  printf '  %-26s ' "$OUT"
  ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
done
