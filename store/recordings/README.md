# Screen recordings

Raw captures of the game. None of them are committed — together they are
nearly two hundred megabytes and this repository is public. What ships is
cut out of them by `scripts/cut-gameplay.sh` and is a few seconds long.

Drop a new capture at the repo root if that is where it lands; file it here
with a name in this shape, so that a year from now the file says what it is
without being opened:

    YYYY-MM-DD-match-<lang>.mp4      a session worth cutting a trailer from
    YYYY-MM-DD-report-<what>.mp4     a recording of something going wrong

## What is here

| file | what it is |
|---|---|
| `2026-10-09-match-he.mp4` | The first match recorded for the store, in Hebrew. 2340×1080 from the phone, 83s. The interface is three weeks of work out of date — it still says "התחל את הקרב!" — so it is history, not footage. |
| `2026-10-12-match-en.mp4` | Re-recorded the day the game learned English. 2340×1080, 156s, two matches. Also out of date: it predates the icons, the shorter English and the new buttons. |
| `2026-10-26-match-en.mp4` | **The one the trailer is cut from.** One match end to end, in English: home screen, the catchphrases, the build, the countdown, the battle, the king going down, the win. 848×392, 91s. |
| `2026-10-26-report-take-button.mp4` | Or showing the challenge button turning into three dots, and the gold chest whose button needed scrolling. Both fixed. |
| `2026-10-26-report-upgrade-wait.mp4` | Or showing the seconds between pressing upgrade and anything moving. Fixed. |

## One thing worth knowing about the October 26th capture

It is 848×392, where the two before it are 2340×1080 off the phone. Nothing
in the cut hides that — the trailer blows it up about two and a half times
and leans on the fact that the art is painted rather than drawn in thin
lines. It holds, but a phone capture of the same match would be sharper, and
if one ever arrives the cut points in `cut-gameplay.sh` are the only thing
that needs finding again.
