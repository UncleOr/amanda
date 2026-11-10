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
 * ═══ THE TABLE BELOW IS MEASURED, AND THE OLD ONE WAS WRONG ═══
 *
 * Or, 10 November: *"somehow the medium mode has become too easy again, I
 * win in a second."* He is right, and finding out why took correcting the
 * MEASUREMENT before correcting the bot.
 *
 * The numbers that used to be here were taken against `good` in
 * scripts/bot-report.ts — a model that buys the strongest cards the budget
 * allows. The cost scale is flat enough that this is always the same nine
 * cards: three Flame Dragons, three Titan Kings, three Sky Kings, exactly 45
 * of a 45 budget. Mean card worth 5,460 against the normal bot's 3,185, and
 * more even than the hard bot's 5,408 WITH its level-6 multiplier. Against
 * that board the normal bot wins 1% and the average battle is 1.9 seconds —
 * which reads as a catastrophe and is really a model nobody plays.
 *
 * So there is a third opponent now, read off the live database: the deck Or
 * and Hod actually built. Eighteen different things — two Stone Colossus,
 * three Obsidian Eggs, three Healing Blooms, a Thunderwing, a Titan King,
 * trees. These are the numbers against THAT, 900 battles a side:
 *
 *                   a beginner    the real deck     his target
 *     קליל               4%             1%             10%
 *     רגיל              69%            42%             50%   (was 29%)
 *     קשה               87%            78%             75%   (was 83%)
 *
 * ⚠ AND BOTH CHANGES ARE SMARTNESS, WHICH IS HIS OWN RULE. The normal bot
 * no longer builds its board from a RANDOM 24 of the arena pool — it sees
 * all of them and chooses, like the hard one. Its card LEVEL is untouched at
 * 2, the same a fortnight-old album carries. And the hard bot came DOWN a
 * level, 6 to 5, which is the complaint he made on 9 November finally acted
 * on: measured, it lands on his 75% instead of past it.
 *
 * The easy bot is under its target and is left alone: it is the setting a
 * seven-year-old learns on, it pays no trophies and no nachos, and nobody
 * has ever complained that it is too easy.
 *
 * The lever that did most of it is new and is pinned here: the bot's cards
 * have LEVELS now. Every bot fielded level-1 cards because nothing had ever
 * given them one, and a player who has been collecting for a fortnight has
 * not — ten per cent a level, on every card, in every battle.
 *
 * ═══ AND ON 9 NOVEMBER 2026 OR OBJECTED TO EXACTLY THAT LEVER ═══
 *
 * *"There is no way it kills my whole defence in a second. That means it is
 * simply significantly more upgraded than me, no? The difference between the
 * levels should be in how SMART it is and how well it uses the cards, not in
 * how strong they are."*
 *
 * He is right about the fact, and the database says it is worse than he
 * guessed. Measured on the live accounts:
 *
 *     the hard bot          level 6   ×1.50
 *     Or's 48 cards         avg 2.04  ×1.10   (top level 3)
 *     Hod's 11 cards        all 1     ×1.00   (and he is at 1560 trophies)
 *
 * So the hard bot carries 36% more health and power than Or's average card,
 * and a flat 50% more than every card Hod owns — while Hod is the one further
 * up the ladder.
 *
 * ⚠ AND IT WAS ACTED ON ON 10 NOVEMBER, NOT BEFORE. For a day this note
 * ended "nothing has changed here yet", because his other target — *"a
 * player should lose 75% of the time to the hard bot"* — was what the levels
 * were buying, and two planner changes had already been tried and thrown
 * away (see scripts/bot-report.ts, which has both and why).
 *
 * What unlocked it was the measurement, not an idea: against the deck he
 * really plays, the hard bot was winning 83% rather than 75% — so there was
 * a whole step of strength to give back before his number was in danger.
 * Level 6 → 5 lands it on 78%. The advantage over his album is now x1.40
 * against x1.11 instead of x1.50, which is smaller and still not nothing;
 * closing it entirely needs a planner that is genuinely cleverer, and that
 * is still true and still unwritten.
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

/**
 * **What the dial is allowed to be about.**
 *
 * Or: *"the difference between the levels should be in how SMART it is and
 * how well it uses the cards, not in how strong they are."* That sentence
 * has no home in the code — `SKILL` is six numbers in a row and nothing says
 * which of them are the brain and which are the muscles. This is the home.
 */
describe("the dial is mostly about thinking", () => {
  const SMART = ["window", "sloppiness", "gaps", "draw"] as const;

  it("separates the two bots by more than their card level", () => {
    /*
     * ⚠ THE TRAP THIS EXISTS FOR, AND IT WAS NEARLY SHIPPED. Giving the
     * normal bot the hard one's exact brain — window 1, every card in the
     * pool — measures at 47% against the real deck, which is nearer Or's
     * 50% than the 42% that actually shipped. It was rejected because the
     * only thing left between the two settings would have been the card
     * level: the game would have hit his number by doing the one thing he
     * said not to do.
     */
    const skill = __testing.SKILL;
    const differs = SMART.filter((k) => skill.normal[k] !== skill.hard[k]);
    expect(
      differs.length,
      "normal and hard now differ only in how strong their cards are",
    ).toBeGreaterThan(0);
  });

  it("lets the two upper settings see every card they could play", () => {
    /*
     * `draw` caps how much of the arena's pool the planner even looks at,
     * and 24 of it was most of why the normal bot was winning 29% instead
     * of 50: it was not playing badly, it was playing a random hand. Zero
     * means "all of them", and choosing well out of everything available is
     * the definition of using the cards better.
     */
    expect(__testing.SKILL.normal.draw, "the normal bot is back on a random sample").toBe(0);
    expect(__testing.SKILL.hard.draw).toBe(0);
    // The easy bot still draws a hand, because a beginner has one.
    expect(__testing.SKILL.easy.draw).toBeGreaterThan(0);
  });

  it("keeps the normal bot sloppy, which is what it is for", () => {
    expect(__testing.SKILL.normal.sloppiness).toBeGreaterThan(__testing.SKILL.hard.sloppiness);
    expect(__testing.SKILL.easy.sloppiness).toBeGreaterThan(__testing.SKILL.normal.sloppiness);
  });
});
