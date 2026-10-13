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
#   IDENT     the Asulins mark, with its own sting             3.0s
#   OPENING   8 generated shots in a dark petrol station      11.2s
#   CARDS     four cards drop onto black                       1.4s
#   GAMEPLAY  Or's screen recording, cut down                 14.5s
#   CLOSING   a win, then the end card                         5.2s
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
# ═══ TWO CUTS, AND ONLY THE END OF THEM DIFFERS ═══
#
# Or: *"I want us to make a Hebrew clip and an English clip."* Play takes one
# promo video per listing language, so these are two uploads.
#
# Eleven of the sixteen seconds are identical between them — the opening is
# four monsters in a petrol station and has no words in it at all. What
# changes is the footage that shows the interface and the card that ends it:
#
#   he   store/gameplay.mp4      store/screenshots/      אמנדה, in the wordmark
#   en   store/gameplay-en.mp4   store/screenshots-en/   AMANDA
#
# The English captures do not exist yet — Or is re-recording them now that
# the game speaks English. Until they do, this builds the English cut with
# the Hebrew footage and says so loudly, because a cut that silently ships
# Hebrew screenshots to an English listing is worse than one that refuses.
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
MUSIC_START=91
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

# The four that drop. Amanda last, because she is who you just met.
CARDS=(
  apps/client/public/cards/dragons_01_flame_dragon.webp
  apps/client/public/cards/giants_01_stone_colossus.webp
  apps/client/public/cards/furries_01_chuppy.webp
  apps/client/public/cards/legends_01_amanda.webp
)

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
  -filter_complex "$(IFS=';'; echo "${filters[*]}");${concat}concat=n=${i}:v=1:a=0,fade=t=in:st=0:d=0.7,fade=t=out:st=${OPEN_OUT}:d=0.26:color=${FLASH}[v]" \
  -map "[v]" "${ENC[@]}" "$SEG/1-opening.mp4"

# ── 2 · the cards ─────────────────────────────────────────────────────
#
# The opening now ends on Amanda at her largest, fading up into her own
# teal light. This picks that light up and lets the dark come up behind it,
# and the four cards fall in staggered and land in a row.
#
# This is the beat Or asked for at the very start: *"and then they go into
# the cards and you start seeing a screen recording of a battle."* The
# cinematic does not explain itself and there is no caption — four cards
# fall out of her light, and the next thing on screen is a board of them.
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
ffmpeg -y -v error "${cinputs[@]}" \
  -filter_complex "$(IFS=';'; echo "${cfilters[*]}");${prev}fade=t=in:st=0:d=0.26:color=${FLASH},format=yuv420p[v]" \
  -map "[v]" "${ENC[@]}" "$SEG/2-cards.mp4"

# ── 3 and 4, once per language ────────────────────────────────────────
#
# Everything above this line is the same film in both cuts: four monsters in
# a petrol station and four cards falling out of Amanda's light, with not one
# word in any of it. Only the footage of the interface and the card at the
# end have a language.
for L in "${LANGS[@]}"; do
  echo
  echo "── ${L} ──"

  if [ "$L" = "he" ]; then
    GAMEPLAY=store/gameplay.mp4
    SHOTS_DIR=store/screenshots
    WORDMARK=apps/client/public/brand/wordmark.png
  else
    GAMEPLAY=store/gameplay-en.mp4
    SHOTS_DIR=store/screenshots-en
    WORDMARK=apps/client/public/brand/wordmark-en.png
  fi

  # Or is re-recording the English captures now that the game speaks English.
  # Until they land, fall back — but say it every time, because the whole
  # point of an English cut is that an English speaker can read the screen.
  FELLBACK=0
  # The cut is disposable: cut-gameplay.sh makes it from the recording in
  # about a minute. So a missing one is rebuilt rather than worked around —
  # which is what makes it safe to DELETE the cuts when disk is short, and
  # this branch is here because deleting them is exactly what found that the
  # English side could not rebuild itself.
  if [ ! -f "$GAMEPLAY" ]; then
    if bash scripts/cut-gameplay.sh "$L" >/dev/null 2>&1 && [ -f "$GAMEPLAY" ]; then
      echo "  gameplay cut missing — rebuilt it from the recording"
    elif [ "$L" != "he" ] && [ -f store/gameplay.mp4 ]; then
      GAMEPLAY=store/gameplay.mp4
      FELLBACK=1
    else
      echo "  no gameplay for ${L}, and no recording to cut one from" >&2
      exit 1
    fi
  fi
  [ -d "$SHOTS_DIR" ] && [ -f "$SHOTS_DIR/03-win.png" ] || { SHOTS_DIR=store/screenshots; FELLBACK=1; }
  [ -f "$WORDMARK" ] || { echo "missing: $WORDMARK — run pnpm --filter @amanda/art exec tsx src/wordmarkEn.ts" >&2; exit 1; }
  [ "$FELLBACK" = "0" ] || cat >&2 <<WARN

  ⚠  The English cut is being built with HEBREW footage.
     Needs store/gameplay-en.mp4 and store/screenshots-en/03-win.png.
     Everything else — the opening and the end card — is English.
WARN

  echo "  gameplay"
  ffmpeg -y -v error -i "$GAMEPLAY" -vf "$NORM" "${ENC[@]}" "$SEG/3-gameplay.mp4"

  # ── closing ─────────────────────────────────────────────────────────
  #
  # What winning looks like, and then the end card Or asked for:
  #
  #     אמנדה                    the wordmark, which IS the name
  #     משחק קלפים מפלצתי        what it is
  #     playamanda.com           where to get it
  #
  # This is the only text in the whole trailer, and Play autoplays the first
  # thirty seconds MUTED, so it has to carry the pitch on its own in silence.
  #
  # ═══ WHICH IS WHY THE WIN SHOT IS SHORT ═══
  #
  # First build of this card put it up at 28.4s. The whole cut is 31.4s and
  # starts fading at 30.0 — so inside the window Play actually autoplays, the
  # address was legible for 1.6 seconds. The win screenshot before it had
  # 2.4. That is the wrong way round: the win is a picture and reads at a
  # glance, the address is nine characters that have to be read and
  # remembered.
  #
  # So the cut to the card comes 0.7s earlier and the card holds 0.7s longer.
  # Same 31.4s total — the music window does not allow more — and the address
  # now gets 2.3 seconds before the fade starts.
  #
  # Three tiers and they are not close: the mark is 760px wide, the tagline
  # is 54px and grey, the address is 56px and gold. Squint at it and the
  # name is what you see; look at it and the address is the only coloured
  # thing on the screen. The tagline sits between them because it explains,
  # and explaining is never the hero.
  #
  # ═══ THE ALBUM SHOT IS MISSING, DELIBERATELY ═══
  #
  # This closed on the album before the win, which is the right order — what
  # you collect, then what it gets you. The album screenshot we have is from
  # a brand new account: "0% הושלמו", four zeroes across the counters and a
  # page of empty slots. As the last thing a viewer sees before the address,
  # that is an argument against installing.
  #
  # It comes back the moment there is a played-in capture. Put one at
  # store/screenshots/04-album.png and set ALBUM=1.
  ALBUM=0
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

  if [ "$ALBUM" = "1" ]; then
    ffmpeg -y -v error \
      -i "$SHOTS_DIR/04-album.png" \
      -i "$SHOTS_DIR/03-win.png" \
      -f lavfi -t 3.9 -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
      -i "$WORDMARK" \
      -filter_complex "\
[0:v]${NORM},zoompan=z='min(zoom+0.0009,1.1)':d=45:s=${W}x${H}:fps=${FPS}[a];\
[1:v]${NORM},zoompan=z='if(eq(on,0),1.1,max(zoom-0.0009,1.0))':d=55:s=${W}x${H}:fps=${FPS}[b];\
[3:v]scale=${WM_W}:-1[wm];\
[2:v][wm]overlay=x=(W-w)/2:y=${WM_Y}${CARDTEXT},fade=t=in:st=0:d=0.4[c];\
[a][b]xfade=transition=fade:duration=0.3:offset=1.5[ab];\
[ab][c]xfade=transition=fade:duration=0.4:offset=2.6,format=yuv420p[v]" \
      -map "[v]" "${ENC[@]}" "$SEG/4-closing.mp4"
  else
    ffmpeg -y -v error \
      -i "$SHOTS_DIR/03-win.png" \
      -f lavfi -t 4.1 -i "color=${BG}:s=${W}x${H}:r=${FPS}" \
      -i "$WORDMARK" \
      -filter_complex "\
[0:v]${NORM},zoompan=z='if(eq(on,0),1.1,max(zoom-0.0008,1.0))':d=60:s=${W}x${H}:fps=${FPS}[b];\
[2:v]scale=${WM_W}:-1[wm];\
[1:v][wm]overlay=x=(W-w)/2:y=${WM_Y}${CARDTEXT},fade=t=in:st=0:d=0.4[c];\
[b][c]xfade=transition=fade:duration=0.4:offset=1.3,format=yuv420p[v]" \
      -map "[v]" "${ENC[@]}" "$SEG/4-closing.mp4"
  fi

  # ── join, and lay the score over the whole thing ────────────────────
  echo "  joining"
  OUT="store/trailer-${L}.mp4"
  : > "$SEG/list.txt"
  for f in 1-opening 2-cards 3-gameplay 4-closing; do
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

  ffmpeg -y -v warning -stats \
    -f concat -safe 0 -i "$SEG/list.txt" \
    -ss "$MUSIC_START" -i "$MUSIC" \
    -filter_complex "[0:v]fade=t=out:st=${FADEOUT}:d=1.4[v];\
[1:a]atrim=0:${TOTAL},afade=t=in:st=0:d=1.2,afade=t=out:st=${FADEOUT}:d=1.4[a]" \
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
