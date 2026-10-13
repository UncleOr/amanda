import { describe, expect, it } from "vitest";
import { earned, ACHIEVEMENTS, type Snapshot, type MatchOutcome } from "./achievements";

/*
 * The eighteen Or approved, and whether they are earned.
 *
 * This is the only part of Play Games that can be tested at all: the native
 * side does not exist in a browser and the Android wrapper that would carry
 * it is built on a machine that is not this one. So everything that can be
 * decided in JavaScript is decided in `earned`, and these pin it.
 */

const SERIES_SIZES = new Map([
  ["dragons", 10],
  ["giants", 10],
  ["insects", 10],
  ["plants", 10],
  ["slimes", 10],
  ["furries", 1],
  ["legends", 1],
]);

const seriesOf = (cardId: string) => cardId.split("_")[0];

const base = (over: Partial<Snapshot> = {}): Snapshot => ({
  tutorialDone: false,
  trophies: 0,
  album: new Set(),
  seriesSizes: SERIES_SIZES,
  seriesOf,
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
    const all = [
      ...family("dragons", 10),
      ...family("giants", 10),
      ...family("insects", 10),
      ...family("plants", 10),
      ...family("slimes", 10),
      ...family("furries", 1),
      ...family("legends", 1),
    ];
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
     * Two of the seven families are a single card today. Owning Chuppy
     * completes the Furries, technically — and calling that "a whole family"
     * would hand out the achievement to anyone who happens to be given the
     * starter card, which is everybody.
     *
     * Those two cards have achievements of their own instead.
     */
    const only = new Set([...family("furries", 1), ...family("legends", 1)]);
    const got = earned(base({ album: only }));
    expect(got).not.toContain("family");
    expect(got).toContain("chuppy");
    expect(got).toContain("legend");
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
        album: new Set([
          ...family("dragons", 10),
          ...family("giants", 10),
          ...family("insects", 10),
          ...family("plants", 10),
          ...family("slimes", 10),
          ...family("furries", 1),
          ...family("legends", 1),
        ]),
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
        album: new Set([
          ...family("dragons", 10),
          ...family("giants", 10),
          ...family("insects", 10),
          ...family("plants", 10),
          ...family("slimes", 10),
          ...family("furries", 1),
          ...family("legends", 1),
        ]),
      }),
      match({ won: true, synergy: true, kingUntouched: true, againstFriend: true }),
    );
    expect(new Set(everything).size).toBe(15);
  });
});
