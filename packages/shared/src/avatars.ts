/**
 * The faces, as data rather than as part of a screen.
 *
 * They lived in Profile.tsx, which is a React component and therefore
 * unreachable from the server — and the server is what has to pick a face for
 * somebody who never chose one. One list, both sides.
 *
 * Matching packages/art/src/brandLooks.ts, which is what draws them.
 */

/**
 * The free faces. Interleaved on purpose so the grid does not read as "the
 * boys, then the girls, then the monsters" — the first row alone is a knight,
 * a sorceress, a robot and a warrior.
 */
export const AVATAR_IDS = [
  "av_knight",
  "av_sorceress",
  "av_robot",
  "av_warrior",
  "av_witch",
  "av_pirate",
  "av_goblin",
  "av_fairy",
  "av_ghost",
  "av_vampire",
  "av_cat",
  "av_alien",
  "av_slime",
  "av_mummy",
  "av_dragon",
  "av_wolf",
] as const;

/**
 * The faces the shop sells.
 *
 * Kept apart from the free list rather than mixed into it, because the grid
 * has to be able to answer "can I have this one" — and the answer is a row in
 * player_items, not a hard-coded list. A face that is not yours is not drawn
 * in the profile at all: a locked thing you can see but not choose is an
 * advertisement inside the profile screen, and the shop is where the shop is.
 */
export const SHOP_AVATAR_IDS = [
  "av_astronaut",
  "av_mechanic",
  "av_skater",
  "av_yeti",
  "av_jellyking",
  "av_mothgirl",
] as const;
