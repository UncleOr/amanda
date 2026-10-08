#!/usr/bin/env bash
# The four numbers from SKILL.md, counted rather than felt.
#
# Every one of them was a real measurement of this game before the design
# system existed, and every one of them is a thing that creeps back the moment
# somebody is in a hurry. Run it before calling a screen done.
#
# It does not fail a build. It prints, and the numbers must not go up.

set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1

CSS="apps/client/src/styles"
TSX="apps/client/src/components apps/client/src/App.tsx"
# Screens a child plays. The admin panel is a tool for one adult and is
# allowed to explain itself — see SKILL.md §6.
#
# ADD A SCREEN HERE THE DAY YOU TOUCH IT. The inbox was missing, and the empty
# state SKILL.md itself quotes as the example of the offence sat in it unread
# by this script for a week.
PLAY="apps/client/src/components/HomeScreen.tsx
apps/client/src/components/ResultScreen.tsx
apps/client/src/components/BattleScreen.tsx
apps/client/src/components/Say.tsx
apps/client/src/components/Album.tsx
apps/client/src/components/Shop.tsx
apps/client/src/components/ChestReveal.tsx
apps/client/src/components/Challenges.tsx
apps/client/src/components/ArenaTrack.tsx
apps/client/src/components/MoreModes.tsx
apps/client/src/components/Profile.tsx
apps/client/src/components/Friends.tsx
apps/client/src/components/Inbox.tsx"

bar() { printf '%s\n' "────────────────────────────────────────────────────────"; }
line() { printf '  %-46s %s\n' "$1" "$2"; }

bar
printf '  AMANDA UI AUDIT\n'
bar

# ── 1. type scale ────────────────────────────────────────────────────
# Anything that is not a var(--t-N), a clamp/max that wraps one, or 0.
raw_type=$(grep -rhoE 'font-size: *[^;]+;' $CSS apps/client/src/*.css 2>/dev/null \
  | sed 's/font-size: *//;s/;//' \
  | grep -vE 'var\(--t-[1-6]\)' \
  | grep -vE '^(inherit|0|1em|100%)$' | sort | uniq -c | sort -rn)
n_raw=$(printf '%s\n' "$raw_type" | grep -cE '[0-9]' || true)
distinct=$(printf '%s\n' "$raw_type" | awk '{print $2}' | sort -u | grep -c . || true)
line "font sizes outside the scale" "$distinct distinct, was 23"

# ── 2. grey against readable ─────────────────────────────────────────
muted=$(grep -rhoE 'color: *var\(--muted\)' $CSS 2>/dev/null | wc -l | tr -d ' ')
text=$(grep -rhoE 'color: *var\(--text\)' $CSS 2>/dev/null | wc -l | tr -d ' ')
verdict="ok"
[ "$muted" -ge "$text" ] && verdict="GREY IS THE DEFAULT — see §3"
line "--muted $muted  vs  --text $text" "$verdict"

# ── 3. surfaces ──────────────────────────────────────────────────────
# Raw translucent-white panels, which is how twenty near-identical
# surfaces happened. Tokens are --sur-1/2/lit.
surf=$(grep -rhoE 'background: *rgba\(255, *255, *255, *0\.[0-9]+\)' $CSS 2>/dev/null \
  | sort -u | wc -l | tr -d ' ')
line "raw white panel surfaces" "$surf distinct, was ~20"

# ── 4. words ─────────────────────────────────────────────────────────
# Prose in a <p> on a screen a child plays. Not a count of characters in
# the file — a count of SENTENCES shown to a player.
prose=0
offenders=""
for f in $PLAY; do
  [ -f "$f" ] || continue
  # 46 BYTES, which is about 25 Hebrew characters — grep counts bytes here
  # and Hebrew is two of them each. Below that nothing has ever been an
  # explanation: the brand tagline (32 bytes), "שגיאה בהצגת הקרב" (30) and
  # "המדפים עוד ריקים. בקרוב." (43) all sit under it, and every sentence
  # that has had to be deleted from this game for explaining itself has been
  # well over — the two cut today were 60 and 74.
  # `tr` first: JSX wraps, and a sentence long enough to be an explanation is
  # exactly the kind that prettier breaks over three lines. Reading the file
  # line by line reported ZERO prose on screens that had two — the album's
  # "you are playing from the full deck" and the profile's age note both sat
  # across line breaks and were invisible to this check for a week.
  n=$(tr '
' ' ' < "$f" | grep -ohE '<p[^>]*>[^<{]{46,}</p>' | wc -l | tr -d ' ')
  if [ "${n:-0}" -gt 0 ]; then
    prose=$((prose + n))
    offenders="$offenders\n      ${n}  $(basename "$f")"
  fi
done
verdict="ok"
[ "$prose" -gt 0 ] && verdict="MUST BE ZERO — see §6"
line "prose sentences on play screens" "$prose  $verdict"
[ -n "$offenders" ] && printf '%b\n' "$offenders"

bar
if [ "$distinct" -gt 0 ]; then
  printf '  font sizes still written by hand:\n'
  printf '%s\n' "$raw_type" | head -12 | sed 's/^/      /'
  bar
fi
printf '  Full rules: .claude/skills/amanda-ui/SKILL.md\n'
bar
