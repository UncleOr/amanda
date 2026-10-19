/**
 * **The bot got cards that have been played with.**
 *
 * Or, a fortnight in: *"we're doing loads of games against the hard bot.
 * We're just in the playground, with 40 cards, some of which we upgraded to
 * level 2, and we're taking it apart. The hard bot needs to be harder for a
 * player who is not a complete beginner — and the medium one too. A player
 * should lose 75% of the time to the hard bot, 50% to the medium one and 10%
 * to the easy one."*
 *
 * Measured over 900 battles a side, against two different opponents, because
 * "a player" is two different people (see scripts/bot-report.ts):
 *
 *                   a beginner    Or and Hod
 *     קליל              11%            0%
 *     רגיל              71%           54%
 *     קשה               82%           75%
 *
 * The lever that did most of it is new and is pinned here: the bot's cards
 * have LEVELS now. Every bot fielded level-1 cards because nothing had ever
 * given them one, and a player who has been collecting for a fortnight has
 * not — ten per cent a level, on every card, in every battle.
 */
import { describe, expect, it } from "vitest";
import { levelMultiplier } from "@amanda/shared";
import { __testing } from "./useMatch";
import { CATALOG } from "../data/catalog";

const plan = (level: "easy" | "normal" | "hard") => __testing.generateAiPlan(undefined, level);
const buffs = (p: ReturnType<typeof plan>) => p.map((x) => x.buff?.powerMult ?? 1);

describe("what the bot brings", () => {
  it("fields upgraded cards at the top of the dial", () => {
    const got = buffs(plan("hard"));
    expect(got.length).toBeGreaterThan(1);
    for (const m of got) expect(m, "every card, not the King alone").toBeGreaterThan(1);
  });

  it("gives health and power the same multiplier, as a level does", () => {
    for (const p of plan("hard")) expect(p.buff?.hpMult).toBe(p.buff?.powerMult);
  });

  /* The beginner's bot is a beginner: no collection, no upgrades. */
  it("leaves the easy bot at level one", () => {
    for (const m of buffs(plan("easy"))) expect(m).toBe(1);
  });

  it("climbs with the dial", () => {
    const at = (l: "easy" | "normal" | "hard") => Math.max(...buffs(plan(l)));
    expect(at("normal")).toBeGreaterThan(at("easy"));
    expect(at("hard")).toBeGreaterThan(at("normal"));
  });

  /*
   * ═══ EXCEPT IN A MIRROR MATCH ═══
   *
   * "חפיסה זהה" promises the same cards on both sides, so that the only
   * thing left to be better at is where you put them. The same cards at
   * different levels are not the same cards, and a levelled mirror would
   * quietly make that mode unwinnable.
   */
  it("plays a mirror match at the player's level, which is none", () => {
    const deck = [...CATALOG.keys()].filter((id) => id !== "crumb_demon").slice(0, 16);
    for (const p of __testing.generateAiPlan(deck, "hard")) expect(p.buff).toBeUndefined();
  });

  it("uses the multiplier the player's own cards get", () => {
    const top = Math.max(...buffs(plan("hard")));
    // Whatever the level is tuned to, it has to BE a level.
    const levels = Array.from({ length: 10 }, (_, i) => levelMultiplier(i + 1));
    expect(levels.some((l) => Math.abs(l - top) < 1e-9)).toBe(true);
  });
});
