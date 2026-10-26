# The collage tiles

Six screens, and the only thing in `store/` besides the achievements that is
committed as a source rather than as a product. They are here because
`scripts/make-trailer.sh` reads them when it builds the collage, and a
trailer that can only be rebuilt on the machine the screenshots were taken on
is a trailer that will not be rebuilt.

| file | where it came from |
|---|---|
| `home.jpg` | the running game at `?album=full` |
| `album.jpg` | the same, with The Dragons open |
| `shop.jpg` | the same, Corner Shop |
| `deck.jpg` | the same, a deck filled with FILL IT FOR ME |
| `build.jpg` | frame at 0:33 of `store/recordings/2026-10-26-match-en.mp4` |
| `battle.jpg` | frame at 0:52 of the same recording |

## Why four of them needed a door in the code

The album, the shop and the deck builder are all empty on a fresh account —
0/51, nothing owned, no decks — and the only played-in account is on Or's
phone. So `apps/client/src/game/account.ts` has `?album=full`, which builds a
whole account in the CLIENT and writes nothing: every card held, copies and
levels spread by a standing pattern so two captures a week apart match, and
the trophies, diamonds and nachos set to the numbers in the recording, so the
collage and the footage after it read as one session.

It is the same kind of entrance as `?chest=gold` and `?amanda=solo` in
App.tsx: a way into a screen that normal play puts a long way from the front.

## Taking them again

Run the client, open `http://localhost:5173/?album=full`, and photograph the
screens at a landscape-phone shape. What matters is that all six are the same
aspect — the collage crops each one to fill its tile, and a tile cropped from
a portrait capture loses the half of the screen that made it worth taking.
