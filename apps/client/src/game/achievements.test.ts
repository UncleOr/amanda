import { describe, expect, it } from "vitest";
import {
  earned,
  kingWasUntouched,
  outcomeOf,
  ACHIEVEMENTS,
  type Snapshot,
  type MatchOutcome,
} from "./achievements";

/*
 * The eighteen Or approved, and whether they are earned.
 *
 * This is the only part of Play Games that can be tested at all: the native
 * side does not exist in a browser and the Android wrapper that would carry
 * it is built on a machine that is not this one. So everything that can be
 * decided in JavaScript is decided in `earned`, and these pin it.
 */

/*
 * The families, at the sizes the real game has them — and legends at ZERO,
 * which is the point of it. Amanda is its only card and she is not a prize
 * (collectable.ts), so the shelf gives nothing and the album is 51.
 */
const SERIES_SIZES = new Map([
  ["dragons", 10],
  ["giants", 10],
  ["insects", 10],
  ["plants", 10],
  ["slimes", 10],
  ["furries", 1],
  ["legends", 0],
]);

const seriesOf = (cardId: string) => cardId.split("_")[0];

/**
 * A fixture card's rarity, following the real data's shape: the TENTH card
 * of each full series is its epic — dragons_10_sky_king and the other four.
 * Everything else is common, because the rule only asks about one value.
 */
const rarityOf = (cardId: string) => (cardId.split("_")[1] === "10" ? "epic" : "common");

const base = (over: Partial<Snapshot> = {}): Snapshot => ({
  tutorialDone: false,
  trophies: 0,
  album: new Set(),
  seriesSizes: SERIES_SIZES,
  seriesOf,
  rarityOf,
  ...over,
});

const match = (over: Partial<MatchOutcome> = {}): MatchOutcome => ({
  won: false,
  synergy: false,
  kingUntouched: false,
  againstFriend: false,
  ...over,
});

/**
 * `n` cards of one family, named the way the real ids are.
 *
 * Chuppy by his REAL id, because `achievements.ts` names that one card
 * explicitly — he is his own achievement. A fixture that invented an id for
 * him tested nothing about the rule that mentions him.
 */
/** Everything there is to own — the five tens plus Chuppy. Fifty-one. */
const WHOLE_ALBUM = () => [
  ...family("dragons", 10),
  ...family("giants", 10),
  ...family("insects", 10),
  ...family("plants", 10),
  ...family("slimes", 10),
  ...family("furries", 1),
];

const family = (series: string, n: number) =>
  series === "furries"
    ? ["furries_01_chuppy"].slice(0, n)
    : Array.from({ length: n }, (_, i) => `${series}_${String(i + 1).padStart(2, "0")}_x`);

describe("a fresh account", () => {
  it("has earned nothing", () => {
    expect(earned(base())).toEqual([]);
  });
});

describe("the ladder", () => {
  it("gives nothing in the playroom", () => {
    expect(earned(base({ trophies: 149 }))).toEqual([]);
  });

  it("gives the court at exactly 150", () => {
    expect(earned(base({ trophies: 150 }))).toEqual(["arena_court"]);
  });

  it("gives every rung below you, not just the one you are on", () => {
    // Somebody who arrives at the fuel stop has passed the other three, and
    // a list that only awarded the current rung would leave them permanently
    // missing achievements they plainly earned.
    expect(earned(base({ trophies: 1600 }))).toEqual([
      "arena_court",
      "arena_station",
      "arena_alley",
      "arena_fuel",
    ]);
  });
});

describe("the album", () => {
  it("gives ten cards at ten", () => {
    expect(earned(base({ album: new Set(family("dragons", 10)) }))).toContain("cards_10");
  });

  it("gives half the album at half of what exists", () => {
    // 52 cards exist in these fixtures, so 26.
    const half = [...family("dragons", 10), ...family("giants", 10), ...family("insects", 6)];
    expect(half).toHaveLength(26);
    expect(earned(base({ album: new Set(half) }))).toContain("album_half");
  });

  it("does not give half the album one card short", () => {
    const nearly = [...family("dragons", 10), ...family("giants", 10), ...family("insects", 5)];
    expect(earned(base({ album: new Set(nearly) }))).not.toContain("album_half");
  });

  it("gives the whole album only when nothing is missing", () => {
    const all = WHOLE_ALBUM();
    expect(all).toHaveLength(51);
    expect(earned(base({ album: new Set(all) }))).toContain("album_full");
    const missingOne = new Set(all.slice(0, -1));
    expect(earned(base({ album: missingOne }))).not.toContain("album_full");
  });
});

describe("a whole family", () => {
  it("is ten dragons", () => {
    expect(earned(base({ album: new Set(family("dragons", 10)) }))).toContain("family");
  });

  it("is not nine dragons", () => {
    expect(earned(base({ album: new Set(family("dragons", 9)) }))).not.toContain("family");
  });

  it("is NOT a family of one", () => {
    /*
     * The Furries are a single card today. Owning Chuppy completes them,
     * technically — and calling that "a whole family" would hand the
     * achievement to anyone given the starter card, which is everybody. He
     * has an achievement of his own instead.
     */
    const got = earned(base({ album: new Set(family("furries", 1)) }));
    expect(got).not.toContain("family");
    expect(got).toContain("chuppy");
  });

  it("is not the empty legends shelf either", () => {
    // A family of NONE must not count as complete: "you have all zero of
    // them" is true and is not an achievement.
    expect(earned(base({ album: new Set() }))).not.toContain("family");
  });
});

describe("a legendary monster", () => {
  /*
   * Or, after Google's rule ruled out the old version: *"do the epics, call
   * it מפלצת אגדית."* The id stays `legend` because it is also the icon's
   * filename, and the crown on a card still draws what this rewards.
   */
  it("is one of the five big cards at the end of a series", () => {
    expect(earned(base({ album: new Set(["dragons_10_x"]) }))).toContain("legend");
  });

  it("is not an ordinary card, however many of them you have", () => {
    expect(earned(base({ album: new Set(family("dragons", 9)) }))).not.toContain("legend");
  });

  it("is not Chuppy, who has his own", () => {
    const got = earned(base({ album: new Set(family("furries", 1)) }));
    expect(got).toContain("chuppy");
    expect(got).not.toContain("legend");
  });

  it("is earned once, not once per epic", () => {
    const five = ["dragons_10_x", "giants_10_x", "insects_10_x", "plants_10_x", "slimes_10_x"];
    const got = earned(base({ album: new Set(five) }));
    expect(got.filter((id) => id === "legend")).toHaveLength(1);
  });

  /*
   * The whole reason this moved. Amanda is the only card of the legendary
   * RARITY and she cannot be won, so an album holding every winnable card
   * still has to earn this — otherwise it is unattainable, which Google's
   * checklist item 2.5 forbids outright.
   */
  it("is reachable by somebody who owns everything that can be owned", () => {
    expect(earned(base({ album: new Set(WHOLE_ALBUM()) }))).toContain("legend");
  });
});

describe("a match", () => {
  it("gives the first win for winning", () => {
    expect(earned(base(), match({ won: true }))).toContain("first_win");
  });

  it("gives nothing for losing", () => {
    expect(earned(base(), match({ won: false }))).toEqual([]);
  });

  it("gives the trio whether you won or lost", () => {
    // Building it is the lesson. Losing anyway does not unbuild it.
    expect(earned(base(), match({ won: false, synergy: true }))).toContain("trio");
  });

  it("gives the untouched King only on a win", () => {
    // A King on full health in a match you LOST means the enemy went round
    // him and took the board instead — which is not the thing being
    // rewarded.
    expect(earned(base(), match({ won: true, kingUntouched: true }))).toContain("untouched_king");
    expect(earned(base(), match({ won: false, kingUntouched: true }))).not.toContain(
      "untouched_king",
    );
  });
});

describe("the list itself", () => {
  it("never returns an id that is not one of the eighteen", () => {
    const everything = earned(
      base({
        tutorialDone: true,
        trophies: 9999,
        album: new Set(WHOLE_ALBUM()),
      }),
      match({ won: true, synergy: true, kingUntouched: true, againstFriend: true }),
    );
    for (const id of everything) expect(ACHIEVEMENTS).toContain(id);
  });

  it("awards fifteen of the eighteen to somebody who has done everything", () => {
    // The other three — ten wins, fifty wins, ten chests — are incremental
    // and counted by Google, not here. See `step` in achievements.ts.
    // This number is the reason chests_10 moved: it came back 16, and the
    // extra one was an achievement being decided from a field the account
    // does not have.
    const everything = earned(
      base({
        tutorialDone: true,
        trophies: 9999,
        album: new Set(WHOLE_ALBUM()),
      }),
      match({ won: true, synergy: true, kingUntouched: true, againstFriend: true }),
    );
    expect(new Set(everything).size).toBe(15);
  });
});

/*
 * ═══ READING A FINISHED BATTLE ═══
 *
 * These build a BattleResult by hand rather than running one.
 *
 * The temptation was to set a King down, let `runBattle` fight, and assert on
 * what came out — and that test would have been worth very little: it would
 * pass or fail on the balance of two cards, which changes every time Or tunes
 * a number, and it would never once put a healed King in front of the thing
 * that has to know the difference. `outcomeOf` reads four fields. These are
 * those four fields, including the shapes a real battle makes rarely.
 */

/** A unit, cut down to what `outcomeOf` actually looks at. */
const unit = (over: Record<string, unknown>) =>
  ({
    uid: "u1",
    cardId: "dragons_01_x",
    owner: "A",
    isKing: false,
    hp: 10,
    maxHp: 10,
    flags: {},
    ...over,
  }) as never;

const battle = (over: Record<string, unknown> = {}) =>
  ({
    winner: "A",
    ticks: 100,
    winReason: "kingDown",
    tiebreak: null,
    events: [],
    finalUnits: [],
    frames: [],
    lanes: 4,
    ...over,
  }) as never;

describe("who won", () => {
  it("is you when the winner is your side, whichever side that is", () => {
    expect(outcomeOf(battle({ winner: "B" }), "B", false).won).toBe(true);
    expect(outcomeOf(battle({ winner: "B" }), "A", false).won).toBe(false);
  });

  it("is nobody on a draw", () => {
    expect(outcomeOf(battle({ winner: null }), "A", false).won).toBe(false);
  });
});

describe("a lit trio", () => {
  it("counts when one of YOUR units carried the flag", () => {
    const r = battle({ finalUnits: [unit({ flags: { synergy: true } })] });
    expect(outcomeOf(r, "A", false).synergy).toBe(true);
  });

  it("does not count when it was the OPPONENT's trio", () => {
    const r = battle({ finalUnits: [unit({ owner: "B", flags: { synergy: true } })] });
    expect(outcomeOf(r, "A", false).synergy).toBe(false);
  });

  it("does not count a board with no group lit", () => {
    expect(outcomeOf(battle({ finalUnits: [unit({})] }), "A", false).synergy).toBe(false);
  });
});

describe("the untouched King", () => {
  const king = unit({ uid: "k", isKing: true });
  const hit = (over: Record<string, unknown> = {}) => ({
    tick: 5,
    type: "hit",
    targetUid: "k",
    damage: 7,
    ...over,
  });

  it("is untouched when nothing ever hit him", () => {
    const r = battle({ finalUnits: [king], events: [{ tick: 1, type: "attack", uid: "u1" }] });
    expect(kingWasUntouched(r, "A")).toBe(true);
  });

  it("is not untouched when he took damage", () => {
    expect(kingWasUntouched(battle({ finalUnits: [king], events: [hit()] }), "A")).toBe(false);
  });

  /*
   * The reason this reads events and not the health bar. `healAura` is in the
   * game and several cards carry it, so a King can finish on full health
   * having been beaten most of the way down — and `hp === maxHp` would call
   * that untouched.
   */
  it("is not untouched when he was hurt and then healed back to full", () => {
    const r = battle({ finalUnits: [unit({ uid: "k", isKing: true, hp: 10, maxHp: 10 })], events: [hit()] });
    expect(kingWasUntouched(r, "A")).toBe(false);
  });

  it("ignores a hit that did no damage", () => {
    const r = battle({ finalUnits: [king], events: [hit({ damage: 0 })] });
    expect(kingWasUntouched(r, "A")).toBe(true);
  });

  it("ignores hits on somebody else, and on the other King", () => {
    const r = battle({
      finalUnits: [king, unit({ uid: "ek", owner: "B", isKing: true })],
      events: [hit({ targetUid: "u1" }), hit({ targetUid: "ek" })],
    });
    expect(kingWasUntouched(r, "A")).toBe(true);
  });

  it("is false when you had no King at all", () => {
    expect(kingWasUntouched(battle({ finalUnits: [unit({})] }), "A")).toBe(false);
  });
});

describe("against a friend", () => {
  it("is carried through untouched — the match knows, this does not", () => {
    expect(outcomeOf(battle(), "A", true).againstFriend).toBe(true);
    expect(outcomeOf(battle(), "A", false).againstFriend).toBe(false);
  });
});
