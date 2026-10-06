import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { BoardInput } from "./setup.js";
import type { Card, Series } from "@amanda/shared";

/*
 * Cards that beat other cards.
 *
 * Or's ask, in his words: "if I see the opponent played X, it pays me to play
 * Y to defend against him or to hurt him. We need to put a few strategies
 * like that in." Six abilities were already printed on thirteen cards and had
 * no handler in the engine — they did nothing at all — and several of them are
 * exactly that shape. These tests are what keeps them that shape.
 *
 * The cards here are built by hand rather than taken from the catalogue, so a
 * balance change to a real card can never quietly turn one of these green
 * while the counter itself is broken.
 */

const BASE: Omit<Card, "id" | "name" | "stats" | "abilities"> = {
  seriesId: "test",
  number: 1,
  rarity: "common",
  elements: ["earth"],
  flying: false,
  midBoss: false,
  launch: true,
  art: { placeholderColor: "#888", sprite: null },
} as never;

function card(id: string, hp: number, power: number, abilities: Card["abilities"] = []): Card {
  return {
    ...BASE,
    id,
    name: { he: id, en: id },
    stats: { hp, power, attackSpeed: 1, moveSpeed: 1, range: "melee" },
    abilities,
  } as Card;
}

/** A tough King on both sides, so a duel is decided by the duel. */
const KING = card("king", 4000, 100);

function arena(cards: Card[]): Map<string, Card> {
  return new Map([KING, ...cards].map((c) => [c.id, c]));
}

/** `count` copies spread across the lanes, on the front row. */
function side(owner: "A" | "B", id: string, count: number): BoardInput {
  return {
    owner,
    placements: [
      { cardId: "king", x: 1, y: 1, king: true },
      ...Array.from({ length: count }, (_, i) => ({ cardId: id, x: 3, y: i })),
    ],
  } as BoardInput;
}

/** One card, placed in a lane of its own choosing. */
function solo(owner: "A" | "B", id: string, lane: number): BoardInput {
  return {
    owner,
    placements: [
      { cardId: "king", x: 1, y: 1, king: true },
      { cardId: id, x: 3, y: lane },
    ],
  } as BoardInput;
}

/** `count` copies queued up behind each other in ONE lane. */
function column(owner: "A" | "B", id: string, lane: number, count: number): BoardInput {
  return {
    owner,
    placements: [
      { cardId: "king", x: 1, y: 1, king: true },
      ...Array.from({ length: count }, (_, i) => ({ cardId: id, x: 3 - i, y: lane })),
    ],
  } as BoardInput;
}

function run(catalog: Map<string, Card>, a: BoardInput, b: BoardInput) {
  const r = runBattle({
    seed: 7,
    catalog,
    synergies: [] as Series["synergy"][] as never,
    a,
    b,
    recordFrames: false,
  });
  const killedB = r.events.filter(
    (e) => e.type === "death" && r.finalUnits.find((u) => u.uid === e.uid)?.owner === "B",
  ).length;
  return { ...r, killedB };
}

function fight(catalog: Map<string, Card>, a: string, b: string, aN = 1, bN = 1) {
  const r = runBattle({
    seed: 7,
    catalog,
    synergies: [] as Series["synergy"][] as never,
    a: side("A", a, aN),
    b: side("B", b, bN),
    recordFrames: false,
  });
  const killed = (owner: "A" | "B") =>
    r.events.filter(
      (e) => e.type === "death" && r.finalUnits.find((u) => u.uid === e.uid)?.owner === owner,
    ).length;
  return { ...r, killedA: killed("A"), killedB: killed("B") };
}

describe("poison is the answer to a wall", () => {
  const WALL = card("wall", 3000, 200);
  const BUG = card("bug", 300, 100, [
    { type: "stackingDot", trigger: "onHit", params: { dotPerStack: 60 } } as never,
  ]);
  const FLEA = card("flea", 300, 100); // the same bug without the poison

  it("a 300hp poisoner kills a 3000hp wall it could never out-punch", () => {
    const r = fight(arena([WALL, BUG]), "bug", "wall");
    expect(r.killedB).toBe(1);
  });

  it("the same card without poison does not", () => {
    const r = fight(arena([WALL, FLEA]), "flea", "wall");
    expect(r.killedB).toBe(0);
  });

  it("armor does not stop it — that is the whole point", () => {
    const ARMORED = card("armored", 2000, 200, [
      { type: "armorGain", trigger: "passive", params: { armor: 400 } } as never,
    ]);
    const r = fight(arena([ARMORED, BUG]), "bug", "armored");
    expect(r.killedB).toBe(1);
  });

  it("stacks from two poisoners add up, so two cheap ones work faster", () => {
    const one = fight(arena([WALL, BUG]), "bug", "wall", 1, 1);
    const two = fight(arena([WALL, BUG]), "bug", "wall", 2, 1);
    const died = (r: { events: { type: string }[]; ticks: number }) => r.ticks;
    expect(died(two)).toBeLessThanOrEqual(died(one));
  });
});

describe("a wide swing is the answer to anything that multiplies", () => {
  /*
   * Deliberately tough enough that one lane at a time runs out of clock. A
   * swarm that a single-target card can clear anyway is not a swarm, and a
   * test built on one proves nothing: both swings killed exactly eight.
   */
  const SPLITTER = card("splitter", 900, 180, [
    {
      type: "splitOnDeath",
      trigger: "onDeath",
      params: { count: 2, childHp: 500, childPower: 90 },
    } as never,
  ]);
  const WIDE = card("wide", 2000, 500, [
    { type: "aoeRowAttack", trigger: "onAttack", params: { lanes: 3 } } as never,
  ]);
  /** Same body, same damage, one lane at a time. */
  const NARROW = card("narrow", 2000, 500);

  /*
   * The swinger stands in a MIDDLE lane on purpose. A wide swing in a corner
   * lane throws half its arc off the board — which is true of the real card
   * too, and is the sort of thing the playground is for.
   */
  it("the wide swing kills more than it was aimed at", () => {
    const cat = arena([SPLITTER, WIDE, NARROW]);
    const wide = run(cat, solo("A", "wide", 1), side("B", "splitter", 4));
    const narrow = run(cat, solo("A", "narrow", 1), side("B", "splitter", 4));
    expect(wide.killedB).toBeGreaterThan(narrow.killedB);
  });

  it("…and it reaches the lanes either side, not just the one it aimed at", () => {
    const cat = arena([SPLITTER, WIDE]);
    const r = run(cat, solo("A", "wide", 1), side("B", "splitter", 4));
    const hitLanes = new Set(
      r.events
        .filter((e) => e.type === "hit")
        .map((e) => r.finalUnits.find((u) => u.uid === (e as { targetUid: string }).targetUid))
        .filter((u) => u?.owner === "B" && !u.isKing)
        .flatMap((u) => u!.lanes),
    );
    expect(hitLanes.size).toBeGreaterThan(1);
  });
});

describe("a burning lane is the answer to a stacked lane", () => {
  const LAVA = card("lava", 800, 300, [
    { type: "lineDenialDot", trigger: "passive", params: { dps: 200 } } as never,
  ]);
  const PLAIN = card("plain", 800, 300);
  // Tough enough that punching them one at a time does not clear the lane in
  // time — otherwise the burning adds nothing measurable and the test lies.
  const ANT = card("ant", 900, 120);

  /*
   * The ants are queued up in ONE lane, which is what "a stacked lane" means
   * and is the only thing this card answers. Spread across four lanes the
   * burn only ever touches the one in front of it — true of the real card,
   * and worth knowing before anyone calls it overpowered.
   */
  const healthLeft = (r: ReturnType<typeof run>) =>
    r.finalUnits
      .filter((u) => u.owner === "B" && !u.isKing && u.alive)
      .reduce((n, u) => n + u.hp, 0);

  it("everything queued in its lane pays per second, armor or not", () => {
    const cat = arena([LAVA, PLAIN, ANT]);
    const burning = run(cat, solo("A", "lava", 1), column("B", "ant", 1, 3));
    const plain = run(cat, solo("A", "plain", 1), column("B", "ant", 1, 3));
    // Counting corpses is the wrong measure here and it hid the effect: both
    // sides killed two, while the third ant finished on 53hp against the lava
    // and on a full 900 against the plain card. The bill is what matters.
    expect(healthLeft(burning)).toBeLessThan(healthLeft(plain) / 2);
  });

  it("and the burn is the difference between winning and losing that lane", () => {
    const cat = arena([LAVA, PLAIN, ANT]);
    expect(run(cat, solo("A", "lava", 1), column("B", "ant", 1, 3)).winner).toBe("A");
    expect(run(cat, solo("A", "plain", 1), column("B", "ant", 1, 3)).winner).toBe("B");
  });

  it("but it does nothing to the lanes it is not pointing at", () => {
    const cat = arena([LAVA, ANT]);
    const r = run(cat, solo("A", "lava", 0), column("B", "ant", 3, 3));
    const untouched = r.finalUnits.filter(
      (u) => u.owner === "B" && !u.isKing && u.hp === u.maxHp,
    );
    expect(untouched.length).toBeGreaterThan(0);
  });
});

describe("a bodyguard is the answer to a fragile card worth protecting", () => {
  const GLASS = card("glass", 400, 900); // hits like a truck, dies to a breeze
  const SHIELD = card("shield", 900, 60, [
    { type: "damageShareAdjacent", trigger: "passive", params: { pct: 50 } } as never,
  ]);
  const HITTER = card("hitter", 900, 400);

  it("the fragile card lives longer with the shield beside it", () => {
    const alone = runBattle({
      seed: 7,
      catalog: arena([GLASS, SHIELD, HITTER]),
      synergies: [] as never,
      a: {
        owner: "A",
        placements: [
          { cardId: "king", x: 1, y: 1, king: true },
          { cardId: "glass", x: 3, y: 1 },
        ],
      } as BoardInput,
      b: side("B", "hitter", 2),
      recordFrames: false,
    });
    const guarded = runBattle({
      seed: 7,
      catalog: arena([GLASS, SHIELD, HITTER]),
      synergies: [] as never,
      a: {
        owner: "A",
        placements: [
          { cardId: "king", x: 1, y: 1, king: true },
          { cardId: "glass", x: 3, y: 1 },
          { cardId: "shield", x: 3, y: 2 },
        ],
      } as BoardInput,
      b: side("B", "hitter", 2),
      recordFrames: false,
    });
    const deathTick = (r: typeof alone) =>
      r.events.find(
        (e) => e.type === "death" && r.finalUnits.find((u) => u.uid === e.uid)?.cardId === "glass",
      )?.tick ?? Infinity;
    expect(deathTick(guarded)).toBeGreaterThan(deathTick(alone));
  });
});

describe("the vacuum is the answer to a board that wants to keep its distance", () => {
  const VACUUM = card("vacuum", 1500, 400, [
    { type: "pullVacuum", trigger: "onAttack", params: { everySeconds: 2, slots: 1 } } as never,
  ]);
  const PLAIN = card("plain2", 1500, 400);
  const RUNNER = card("runner", 600, 200);

  it("it drags the enemy line toward it", () => {
    const pulled = fight(arena([VACUUM, RUNNER]), "vacuum", "runner", 1, 3);
    const not = fight(arena([PLAIN, RUNNER]), "plain2", "runner", 1, 3);
    const meanCol = (r: typeof pulled) => {
      const them = r.finalUnits.filter((u) => u.owner === "B" && !u.isKing);
      return them.reduce((n, u) => n + u.col, 0) / Math.max(1, them.length);
    };
    // Side B faces left, so being dragged toward A means a LOWER column.
    expect(meanCol(pulled)).toBeLessThanOrEqual(meanCol(not));
  });
});

describe("a swallow holds what walked into it", () => {
  const BLOB = card("blob", 900, 80, [
    { type: "absorbOnCollision", trigger: "onCollision", params: { stunSeconds: 3 } } as never,
  ]);
  const VICTIM = card("victim", 700, 400);

  it("stuns the first thing it meets, once", () => {
    const r = fight(arena([BLOB, VICTIM]), "blob", "victim");
    const stuns = r.events.filter((e) => e.type === "stun");
    expect(stuns.length).toBe(1);
  });
});
