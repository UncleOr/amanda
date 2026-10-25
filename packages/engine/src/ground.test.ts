import { describe, expect, it } from "vitest";
import { buildBattle } from "./setup.js";
import type { BoardInput } from "./setup.js";
import { ARENAS, ARENA_POWER_BONUS, arenaFor, groundFor, type Card } from "@amanda/shared";

/*
 * The ground.
 *
 * Or: *"add a caption at the bottom — cards from the Slime series get +20%
 * power in the Court! (and of course implement it too)."*
 *
 * Which makes WHERE a match is fought a thing that changes how it goes, for
 * the first time. Three things have to be true for that not to become a bug
 * nobody can see: the right family gets it, it is 20% of power and nothing
 * else, and it reaches BOTH sides of the board — the ground is the ground,
 * not a reward for having climbed to it.
 */

const BASE = {
  seriesId: "slimes",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

const card = (id: string, seriesId: string): Card =>
  ({
    ...(BASE as object),
    id,
    seriesId,
    name: { he: id, en: id },
    stats: { hp: 1000, power: 500, attackSpeed: 1, moveSpeed: 1, range: "melee" },
    abilities: [],
  }) as unknown as Card;

const CATALOG = new Map<string, Card>([
  ["s1", card("s1", "slimes")],
  ["s2", card("s2", "slimes")],
  ["g1", card("g1", "giants")],
]);

const build = (ground?: string, mine?: BoardInput["placements"]) =>
  buildBattle({
    a: { owner: "A", placements: mine ?? [{ cardId: "s1", x: 3, y: 0 }, { cardId: "g1", x: 3, y: 1 }] },
    b: { owner: "B", placements: [{ cardId: "s2", x: 3, y: 0 }, { cardId: "g1", x: 3, y: 1 }] },
    seed: 1,
    catalog: CATALOG,
    synergies: [],
    ...(ground ? { ground } : {}),
  });

const unit = (state: ReturnType<typeof buildBattle>, owner: "A" | "B", cardId: string) =>
  state.units.find((u) => u.owner === owner && u.cardId === cardId)!;

describe("the ground", () => {
  it("gives the local family +20% power", () => {
    const state = build("slimes");
    expect(unit(state, "A", "s1").power).toBe(600);
    expect(unit(state, "A", "s1").flags.ground).toBe(true);
  });

  it("gives it to the other side too", () => {
    // Or's own words are about the PLACE: "cards from the Slime series get
    // +20% power in the Court". Not "your cards". A slime is harder to kill
    // there whoever brought it.
    expect(unit(build("slimes"), "B", "s2").power).toBe(600);
  });

  it("leaves every other family alone", () => {
    const state = build("slimes");
    expect(unit(state, "A", "g1").power).toBe(500);
    expect(unit(state, "A", "g1").flags.ground).toBeFalsy();
  });

  it("changes nothing at all when no ground is passed", () => {
    // The tutorial, the playground bench and the FX workbench are not fought
    // in an arena and do not pass one.
    const state = build();
    for (const u of state.units) {
      expect(u.power).toBe(500);
      expect(u.flags.ground).toBeFalsy();
    }
  });

  it("does not touch health", () => {
    // +20% to both is the SERIES synergy. Two bonuses that do the same thing
    // are two things nobody can tell apart on the board.
    expect(unit(build("slimes"), "A", "s1").maxHp).toBe(1000);
  });

  it("stacks on top of the family synergy rather than replacing it", () => {
    const state = buildBattle({
      a: {
        owner: "A",
        placements: [
          { cardId: "s1", x: 3, y: 0 },
          { cardId: "s2", x: 3, y: 1 },
          { cardId: "s1", x: 3, y: 2 },
        ],
      },
      b: { owner: "B", placements: [{ cardId: "g1", x: 3, y: 0 }] },
      seed: 1,
      catalog: CATALOG,
      synergies: [
        {
          seriesId: "slimes",
          threshold: 3,
          ability: { type: "statAura", trigger: "aura", params: { pct: 20 } },
        },
      ] as never,
      ground: "slimes",
    });
    const u = unit(state, "A", "s1");
    // 500 → 600 for the touching trio → 720 for being at home.
    expect(u.power).toBe(720);
    expect(u.maxHp).toBe(1200);
  });

  it("is the number Or asked for", () => {
    expect(ARENA_POWER_BONUS).toBe(0.2);
  });
});

describe("which ground", () => {
  it("names a real series for every arena", () => {
    // A typo here would be a caption promising a bonus that never arrives:
    // nothing throws on an unknown seriesId, the units simply never match.
    const known = new Set(["dragons", "giants", "furries", "insects", "plants", "slimes"]);
    for (const a of ARENAS) expect(known.has(a.family)).toBe(true);
  });

  it("gives each arena its own family", () => {
    const families = ARENAS.map((a) => a.family);
    expect(new Set(families).size).toBe(families.length);
  });

  /*
   * Or: *"you already have Giants from the start (they turn up in the
   * tutorial), so it needs other series."* Amanda fields one in the
   * tutorial, so they are an old acquaintance before any arena could
   * introduce them.
   */
  it("is never the family Amanda already shows you in the tutorial", () => {
    expect(ARENAS.map((a) => a.family)).not.toContain("giants");
  });

  it("is the Slimes in the Court, which is Or's own line", () => {
    expect(ARENAS.find((a) => a.id === "court")!.family).toBe("slimes");
  });

  it("follows trophies the way the arena does", () => {
    for (const a of ARENAS) expect(groundFor(a.from)).toBe(a.family);
    expect(groundFor(-50)).toBe(arenaFor(0).family);
  });
});
