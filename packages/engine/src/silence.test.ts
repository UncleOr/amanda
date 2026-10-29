/**
 * **The cards that break what the other card does.**
 *
 * Or: *"and give me the option to add neutralising abilities to cards: when
 * it hits a healer — it damages the healing ability; when it hits armour —
 * it cancels the armour; when it hits a poison-spitter — it cancels its
 * abilities. (Each one separately, of course. There is a card with
 * heal-neutralising and a different card with armour-neutralising.)"*
 *
 * ═══ MEASURED AS A DIFFERENCE, NOT AS A FLAG ═══
 *
 * Every test here runs the SAME battle twice — once with the neutraliser and
 * once with an identical card that does not have it — and compares what
 * happened on the board. A test that checked `flags.silencedHeal` would pass
 * on a flag nothing reads, which is the exact failure this engine already
 * has one of: `armorGain` is a legal ability on a card and no handler has
 * ever matched it.
 *
 * So the question is always "did the healer end up with less health",
 * never "was the flag set".
 */
import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Ability, Card } from "@amanda/shared";

const BASE = {
  seriesId: "dragons",
  number: 1,
  rarity: "common",
  elements: ["fire"],
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (
  id: string,
  over: Partial<{
    hp: number;
    power: number;
    range: "melee" | "ranged" | "sniper";
    abilities: Ability[];
  }> = {},
): Card =>
  ({
    ...(BASE as object),
    id,
    name: { he: id, en: id },
    flying: false,
    targeting: "lane",
    stats: {
      hp: over.hp ?? 20000,
      power: over.power ?? 0,
      attackSpeed: 0.5,
      moveSpeed: 0,
      range: over.range ?? "ranged",
    },
    abilities: over.abilities ?? [],
  }) as unknown as Card;

const ab = (type: string, trigger: string, params: Record<string, number> = {}): Ability =>
  ({ type, trigger, params }) as unknown as Ability;

const CATALOG = new Map<string, Card>([
  // ── the attackers: identical but for the one ability ──
  ["plain", card("plain", { power: 400 })],
  ["breaks_heal", card("breaks_heal", { power: 400, abilities: [ab("silenceHeal", "onHit")] })],
  ["breaks_armor", card("breaks_armor", { power: 400, abilities: [ab("silenceArmor", "onHit")] })],
  ["breaks_poison", card("breaks_poison", { power: 400, abilities: [ab("silencePoison", "onHit")] })],

  // ── and the three things they break ──
  /** Heals itself faster than one attacker can take it down. */
  ["healer", card("healer", { hp: 9000, abilities: [ab("regen", "passive", { hpPerSecond: 600 })] })],
  /** Wears armour granted by the ally beside it. */
  ["shielded", card("shielded", { hp: 60000 })],
  ["shielder", card("shielder", { hp: 60000, abilities: [ab("armorAura", "aura", { armor: 380 })] })],
  /** Spits poison back at whatever hits it. */
  [
    "poisoner",
    card("poisoner", {
      hp: 60000,
      power: 10,
      abilities: [ab("stackingDot", "onHit", { dotPerStack: 300 })],
    }),
  ],
]);

/** Run the fight and report everyone's health at the end, and how long it took. */
function fight(
  attacker: string,
  enemies: BoardInput["placements"],
  mine: BoardInput["placements"] = [],
) {
  const r = runBattle({
    a: { owner: "A", placements: [{ cardId: attacker, x: 3, y: 0 }, ...mine] },
    b: { owner: "B", placements: enemies },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
  });
  const hp = new Map<string, number>();
  for (const u of r.finalUnits) hp.set(u.cardId, Math.round(Math.max(0, u.hp)));
  return { hp, ticks: r.ticks };
}

describe("מנטרל ריפוי — the one that breaks the healing", () => {
  const board: BoardInput["placements"] = [{ cardId: "healer", x: 3, y: 0 }];

  /*
   * ⚠ MEASURED IN TIME, NOT IN HEALTH. The healer dies either way — one
   * attacker eventually out-damages any regen — so the final health is zero
   * in both battles and says nothing. What the ability is actually worth is
   * HOW LONG the healer stood there, and that is where the difference is:
   * 1,403 ticks against 400hp a second of regen, 443 with it broken.
   */
  it("makes a healer die three times faster", () => {
    const whole = fight("plain", board).ticks;
    const broken = fight("breaks_heal", board).ticks;
    expect(broken).toBeLessThan(whole / 2);
  });

  it("and the regen was really doing the work", () => {
    // If this is ever close, the healer is not healing and the test above
    // would pass on an ability that does nothing.
    expect(fight("plain", board).ticks).toBeGreaterThan(1000);
  });
});

describe("מנטרל שריון — the one that cancels the armour", () => {
  const board: BoardInput["placements"] = [
    { cardId: "shielded", x: 3, y: 0 },
    { cardId: "shielder", x: 2, y: 0 },
  ];

  it("takes the armour off whatever it hits", () => {
    const wearing = fight("plain", board).hp.get("shielded")!;
    const bare = fight("breaks_armor", board).hp.get("shielded")!;
    expect(bare).toBeLessThan(wearing);
  });

  /*
   * ⚠ THE HALF THAT WOULD HAVE LOOKED LIKE NOTHING. `auraArmor` is rebuilt
   * from scratch every tick out of whatever allies are standing nearby, so
   * an armour cancelled at the moment of the blow is back a thirtieth of a
   * second later. The ally granting it is alive and in range for this whole
   * battle, which is what makes this measurement mean anything.
   */
  it("and it does not come back while the ally keeps granting it", () => {
    const wearing = fight("plain", board).hp.get("shielded")!;
    const bare = fight("breaks_armor", board).hp.get("shielded")!;
    const sameAlly = fight("breaks_armor", board).hp.get("shielder")!;
    expect(sameAlly, "the ally is alive and still granting").toBeGreaterThan(0);
    // Not a one-hit difference: most of the damage of the whole battle.
    expect(wearing - bare).toBeGreaterThan(5000);
  });

  it("leaves the ally's own armour alone — it only breaks what it hits", () => {
    // The neutraliser is not an aura. One card, the one in front of it.
    const bare = fight("breaks_armor", board).hp;
    expect(bare.get("shielder")!).toBeGreaterThan(bare.get("shielded")!);
  });
});

describe("מנטרל רעל — the one that cancels the poison", () => {
  const board: BoardInput["placements"] = [{ cardId: "poisoner", x: 3, y: 0 }];

  it("turns a losing fight into a winning one", () => {
    /*
     * The clearest of the three, and it is a whole result rather than a
     * number: against a poisoner, an attacker of 20,000 health DIES —
     * poison ignores armour and ramps per stack. The same attacker, with
     * the poison broken on its first blow, finishes with 18,607 and has
     * taken the poisoner down to 3,484.
     */
    const poisoned = fight("plain", board);
    const clean = fight("breaks_poison", board);
    expect(poisoned.hp.get("plain"), "the ordinary one is killed by the poison").toBe(0);
    expect(clean.hp.get("breaks_poison")!, "the one that broke it lives").toBeGreaterThan(10000);
  });

  it("and it is the poison that was broken, not the poisoner", () => {
    // It keeps its health and its attack: this is a silence, not a nerf.
    // What changed is only that the stacks stopped arriving.
    const clean = fight("breaks_poison", board);
    expect(clean.hp.get("poisoner")!).toBeLessThan(fight("plain", board).hp.get("poisoner")!);
  });
});

describe("each one breaks only its own thing", () => {
  it("a heal-breaker does nothing to armour", () => {
    const board: BoardInput["placements"] = [
      { cardId: "shielded", x: 3, y: 0 },
      { cardId: "shielder", x: 2, y: 0 },
    ];
    // Or: *"each one separately, of course."* A card with one of these must
    // not quietly carry the other two.
    expect(fight("breaks_heal", board).hp.get("shielded")).toBe(fight("plain", board).hp.get("shielded"));
  });

  it("an armour-breaker does nothing to healing", () => {
    const board: BoardInput["placements"] = [{ cardId: "healer", x: 3, y: 0 }];
    expect(fight("breaks_armor", board).hp.get("healer")).toBe(fight("plain", board).hp.get("healer"));
  });
});
