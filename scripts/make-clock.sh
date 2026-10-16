#!/usr/bin/env bash
#
# The countdown's clock: one tick and one tock.
#
#   bash scripts/make-clock.sh
#   → apps/client/public/sfx/clock.mp3
#   → apps/client/public/sfx/clockLow.mp3
#
# ═══ WHY NOT JUST REUSE A SOUND WE HAVE ═══
#
# Or: *"the 3 2 1 at the start of a match sounds like gunshots. Change it to
# a clock ticking."*
#
# The obvious fix was to point the countdown at `tick.mp3`, which is called
# tick and is described in the code as "a clock, not an alarm". Measured, it
# is not one: 300ms long with its peak 212ms IN — a slow swell, not a click —
# and a spectral centroid of 3.9kHz. And `beep.mp3`, which the countdown was
# actually playing, is a 400ms broadband hit with a 34ms attack and a
# tonality of 0.16, which is to say a percussive thud with no pitch in it.
# Three of those in a row is a fair description of gunshots.
#
# A clock tick is a SHORT, resonant click: a few milliseconds of excitation
# into a narrow band, decaying inside a tenth of a second. Nothing in the
# library is that, so it is made here.
#
# ═══ TICK AND TOCK ═══
#
# A real clock alternates two pitches, and that alternation is most of what
# makes a sound "a clock" rather than "a click". Two files: 2.2kHz and
# 1.6kHz. The countdown plays 3 and 1 on one and 2 on the other, so even
# three seconds carries the rhythm.
set -euo pipefail
cd "$(dirname "$0")/.."

out=apps/client/public/sfx

# A click is noise through a resonant filter, cut short.
#
#   anoisesrc  — the excitation, 60ms of it
#   bandpass   — the body of the clock, narrow (csg keeps the gain honest)
#   afade      — 2ms in so it starts instantly, exponential out so it stops
#                being heard well before it stops
tick () {
  local freq=$1 file=$2
  ffmpeg -v error -y \
    -f lavfi -i "anoisesrc=d=0.06:c=pink:a=0.9:r=44100" \
    -af "bandpass=f=${freq}:width_type=q:w=9:csg=1,\
volume=3.5,\
afade=t=in:st=0:d=0.002,\
afade=t=out:st=0.006:d=0.054:curve=exp,\
alimiter=limit=0.9" \
    -ac 1 -ar 44100 -b:a 96k "$out/$file"
}

tick 2200 clock.mp3
tick 1600 clockLow.mp3

for f in clock clockLow; do
  printf '%-10s %ss  %s bytes\n' "$f.mp3" \
    "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$f.mp3")" \
    "$(stat -c%s "$out/$f.mp3")"
done
