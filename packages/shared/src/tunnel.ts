/**
 * ═══ מנהרת הפרסים — THE PRIZE WASH ═══
 *
 * Or: *"we want to add a prize track like in Brawl Stars. We'll call it 'the
 * prize tunnel' and it should look like a car wash tunnel — if there is a
 * cool expression for that in English, go for it. It works by trophies. It
 * adds little prize stations between the arenas: you can get cards, new
 * cards, chests, a pile of diamonds, avatars, and anything you can get in
 * the shop. Obviously later we will do two tracks, so whoever is on the paid
 * track gets better prizes. Make both tracks now with the better prizes, and
 * write 'coming soon' on the Legendary Pass."*
 *
 * ═══ WHY IT IS A LIST OF NUMBERS AND NOTHING ELSE ═══
 *
 * The one thing a reward track must never do is pay twice, and the one thing
 * it must never do to a child is forget. Both come from the same place: what
 * is OWED is derived from a single number — the trophies you have reached —
 * and what has been TAKEN is one row per stop in the database. Nothing is
 * stored about where you are on the track, because there is nothing to store.
 *
 * Trophies you have REACHED, never the ones you hold. You can lose a match on
 * the way home and you do not lose a prize you walked past.
 *
 * ═══ THE STOPS SIT BETWEEN THE ARENAS, WHICH IS THE POINT ═══
 *
 * The arenas open at 0, 150, 450, 1200 and 2400 (arenas.ts), and between two
 * of them is a long climb with nothing in it. These are what is in it. The
 * last five run past the last open arena, because a player at the top of the
 * ladder still has to have something to be two games away from.
 *
 * ═══ AND BOTH LANES ARE WRITTEN NOW ═══
 *
 * The Legendary Pass is not for sale and this build cannot claim it — the
 * screen says "coming soon" and the server refuses the lane outright. It is
 * written down anyway because a half-built track is the thing that gets
 * balanced wrong: the free lane is only generous or stingy NEXT TO the paid
 * one, and you cannot judge that against an empty column.
 */
import type { GrantGives } from "./grants.js";

export type TunnelLane = "free" | "pass";

/** The two lanes, in the order they are drawn. */
export const TUNNEL_LANES: readonly TunnelLane[] = ["free", "pass"];

export interface TunnelStop {
  /** The trophies that open it. Strictly increasing down the list. */
  at: number;
  /** What everybody gets. */
  free: GrantGives;
  /** What the Legendary Pass gets instead — never nothing, never the same. */
  pass: GrantGives;
}

/*
 * ⚠ CARD IDS AND SHOP ITEM IDS ARE BOTH REAL REFERENCES, and neither of them
 * fails loudly. A card id with a typo in it hands over a copy of nothing; an
 * item id that is not a row in `shop_items` writes a receipt for a thing
 * nobody can wear. Both are checked by a test that reads the real catalogue
 * (apps/client/src/game/tunnel.test.ts) — that is what keeps this list from
 * quietly becoming a list of empty boxes.
 */
export const TUNNEL: readonly TunnelStop[] = [
  // ── the Playroom, where everybody starts ──
  { at: 30, free: { diamonds: 25 }, pass: { diamonds: 60, chest: "wood" } },
  { at: 70, free: { chest: "wood" }, pass: { chest: "silver" } },
  {
    at: 110,
    free: { cards: [{ cardId: "slimes_01_basic_slime", copies: 2 }] },
    pass: { cards: [{ cardId: "slimes_06_toxic_sludge", copies: 2 }], diamonds: 40 },
  },
  // ── the Court ──
  { at: 190, free: { diamonds: 40 }, pass: { diamonds: 100 } },
  {
    at: 250,
    free: { cards: [{ cardId: "insects_01_ant_soldier", copies: 3 }] },
    pass: { cards: [{ cardId: "insects_02_ant_queen", copies: 3 }] },
  },
  { at: 320, free: { chest: "silver" }, pass: { chest: "gold" } },
  {
    at: 400,
    free: { items: ["phrase.goodgame"] },
    pass: { items: ["phrase.winner"], diamonds: 60 },
  },
  // ── the Station ──
  {
    at: 520,
    free: { cards: [{ cardId: "plants_01_thorn_sprout", copies: 3 }] },
    pass: { cards: [{ cardId: "plants_03_healing_bloom", copies: 3 }], diamonds: 50 },
  },
  { at: 650, free: { diamonds: 60 }, pass: { diamonds: 150, chest: "silver" } },
  { at: 800, free: { items: ["back.nacho"] }, pass: { items: ["back.gold"] } },
  {
    at: 950,
    free: { cards: [{ cardId: "sea_05_surge", copies: 2 }] },
    pass: { cards: [{ cardId: "sea_09_shark", copies: 2 }] },
  },
  { at: 1100, free: { chest: "silver" }, pass: { chest: "gold", diamonds: 80 } },
  // ── the Garage ──
  {
    at: 1350,
    free: { items: ["avatar.skater"] },
    pass: { items: ["avatar.yeti"], diamonds: 100 },
  },
  {
    at: 1600,
    free: { cards: [{ cardId: "machines_05_repair_rig", copies: 3 }] },
    pass: { cards: [{ cardId: "machines_10_mother_machine", copies: 2 }] },
  },
  { at: 1900, free: { diamonds: 100 }, pass: { diamonds: 250, chest: "gold" } },
  {
    at: 2200,
    free: { chest: "gold" },
    pass: { chest: "gold", cards: [{ cardId: "giants_10_titan_king", copies: 2 }] },
  },
  // ── the Pool, and past it ──
  {
    at: 2600,
    free: { cards: [{ cardId: "dragons_07_gold_horn", copies: 3 }] },
    pass: { cards: [{ cardId: "dragons_10_sky_king", copies: 2 }], diamonds: 120 },
  },
  /*
   * ⚠ NOT A CLUB EMBLEM, however much one looks like a prize. Emblems are
   * rows in `shop_items` whose kind is NOT in SHOP_KINDS — they are chosen
   * in the club screen, not sold on a shelf — so a tunnel that handed one
   * over would write a receipt the shop cannot draw. See the test.
   */
  { at: 2900, free: { items: ["emoji.monsters"] }, pass: { items: ["avatar.mothgirl"] } },
  { at: 3300, free: { diamonds: 150 }, pass: { diamonds: 400 } },
  {
    at: 3800,
    free: { cards: [{ cardId: "furries_01_chuppy", copies: 2 }] },
    pass: { cards: [{ cardId: "demons_01_alley_king", copies: 2 }] },
  },
  {
    at: 4300,
    free: { chest: "gold", diamonds: 100 },
    pass: { chest: "gold", items: ["avatar.jellyking"], diamonds: 300 },
  },
  /*
   * ── and on, past the arenas that are open today ──
   *
   * Or: *"carry on with the track."*
   *
   * These run through Fright Alley (4500) and the Fuel Stop (8000), which
   * are shut from the admin panel for now — and that is the right place for
   * a track to go. A player at the top of the open ladder can still see
   * where the road continues, which is the one thing a reward track must
   * never run out of. They cost nothing until somebody gets there.
   */
  {
    at: 4800,
    free: { cards: [{ cardId: "insects_06_ambush_spider", copies: 3 }] },
    pass: { cards: [{ cardId: "insects_10_insect_empress", copies: 2 }], diamonds: 150 },
  },
  { at: 5300, free: { diamonds: 180 }, pass: { diamonds: 450, chest: "gold" } },
  { at: 5900, free: { items: ["back.stars"] }, pass: { items: ["avatar.astronaut"] } },
  {
    at: 6500,
    free: { chest: "gold" },
    pass: { chest: "gold", cards: [{ cardId: "machines_09_steelbot", copies: 2 }] },
  },
  {
    at: 7200,
    free: { cards: [{ cardId: "slimes_09_pudding_shield", copies: 3 }], diamonds: 80 },
    pass: { cards: [{ cardId: "slimes_10_zelig_giant_ooze", copies: 2 }], diamonds: 200 },
  },
  { at: 8000, free: { items: ["phrase.behindyou"] }, pass: { items: ["avatar.mechanic"], diamonds: 150 } },
  {
    at: 8800,
    free: { cards: [{ cardId: "plants_02_ancient_tree", copies: 3 }] },
    pass: { cards: [{ cardId: "plants_10_great_mother_tree", copies: 2 }] },
  },
  { at: 9600, free: { diamonds: 220, chest: "silver" }, pass: { diamonds: 600, chest: "gold" } },
  {
    at: 10500,
    free: { chest: "gold", items: ["back.lava"] },
    pass: { chest: "gold", cards: [{ cardId: "sea_10_leviathan", copies: 3 }], diamonds: 400 },
  },
];

/**
 * How many stops this player has walked past, which is also the index of the
 * next one. `best` is the high-water mark, never today's total.
 */
export function stopsReached(best: number): number {
  let n = 0;
  for (const stop of TUNNEL) if (best >= stop.at) n++;
  return n;
}

/** The next stop up the tunnel, or null at the end of it. */
export function nextStop(best: number): TunnelStop | null {
  return TUNNEL[stopsReached(best)] ?? null;
}

/**
 * How far along the gap between the last stop and the next one, 0 to 1.
 *
 * The bar on the home screen. At the end of the track it is full rather than
 * empty: there is nothing ahead, and a bar at zero would read as "you have
 * got nowhere" to the player who has got furthest.
 */
export function tunnelProgress(best: number): number {
  const n = stopsReached(best);
  const next = TUNNEL[n];
  if (!next) return 1;
  const from = n > 0 ? TUNNEL[n - 1]!.at : 0;
  return Math.max(0, Math.min(1, (best - from) / Math.max(1, next.at - from)));
}

/** What a stop hands over on one of the two lanes. */
export function tunnelGives(stop: number, lane: TunnelLane): GrantGives | null {
  const row = TUNNEL[stop];
  if (!row) return null;
  return lane === "pass" ? row.pass : row.free;
}

/**
 * ⚠ THE PAID LANE IS NOT FOR SALE YET, AND THE REFUSAL LIVES HERE.
 *
 * Or: *"write 'coming soon' on the Legendary Pass."* A screen that says so is
 * a label; this is the rule. The server asks the same question the button
 * does, so there is no version of the client — old, hand-edited, or written
 * by somebody else — that can claim the better lane by asking nicely.
 */
export const PASS_FOR_SALE = false;

export function canClaim(lane: TunnelLane): boolean {
  return lane === "free" || PASS_FOR_SALE;
}
