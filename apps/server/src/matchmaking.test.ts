import { describe, expect, it } from "vitest";
import { albumPower, albumsComparable, cardPower } from "@amanda/shared";
import { PATIENCE_SECONDS, findPair, trophyWindow, wouldPair, type Waiting } from "./matchmaking.js";

/**
 * Or's complaint, in his own words: "there must not be a situation where all
 * his cards are fourteen levels stronger than mine."
 *
 * Trophies cannot prevent that, because trophies measure skill: a careful
 * player with a thin album climbs and a careless one with a deep album does
 * not, so matching on trophies alone pairs exactly the two people whose
 * boards are least alike. These tests pin the two rules that answer it.
 */

const SEC = 1000;
const now = 1_000_000;

function waiting(
  name: string,
  trophies: number | null,
  albumPower: number | null,
  waitedSeconds = 0,
): Waiting<string> {
  return { who: name, trophies, albumPower, since: now - waitedSeconds * SEC };
}

describe("how much album somebody has", () => {
  it("a legendary is worth more than a common, and not absurdly more", () => {
    const common = cardPower({ rarity: "common", level: 1, copies: 1 });
    const legendary = cardPower({ rarity: "legendary", level: 1, copies: 1 });
    expect(legendary).toBeGreaterThan(common);
    // Six commons, not sixty: one lucky chest must not read as a year of play.
    expect(legendary / common).toBeLessThanOrEqual(8);
  });

  it("levels count, through the same multiplier the battle uses", () => {
    const one = cardPower({ rarity: "common", level: 1, copies: 1 });
    const ten = cardPower({ rarity: "common", level: 10, copies: 1 });
    // Level 10 is a card and a half in a battle, so it is here too.
    expect(ten / one).toBeCloseTo(1.9, 1);
  });

  it("spare copies add something, with a sharply diminishing hand", () => {
    const one = cardPower({ rarity: "common", level: 1, copies: 1 });
    const two = cardPower({ rarity: "common", level: 1, copies: 2 });
    const fifty = cardPower({ rarity: "common", level: 1, copies: 50 });
    expect(two).toBeGreaterThan(one);
    // The fiftieth spare copy is worth nothing; hoarding is not a strategy
    // for inflating this number.
    expect(fifty).toBe(cardPower({ rarity: "common", level: 1, copies: 9 }));
  });

  it("an empty album is worth nothing and does not throw", () => {
    expect(albumPower([])).toBe(0);
  });
});

describe("the album gap that may not be crossed", () => {
  it("two beginners are always comparable", () => {
    // The fraction is meaningless at this size, and a new player must never
    // be left queuing because their album is small.
    expect(albumsComparable(0, 10)).toBe(true);
    expect(albumsComparable(6, 12)).toBe(true);
  });

  it("refuses the case Or described", () => {
    // One album of commons at level 1, another of the same cards at level 10
    // and then some: this is "fourteen levels stronger than mine".
    const thin = albumPower(
      Array.from({ length: 10 }, () => ({ rarity: "common", level: 1, copies: 1 })),
    );
    const deep = albumPower(
      Array.from({ length: 10 }, () => ({ rarity: "legendary", level: 10, copies: 6 })),
    );
    expect(albumsComparable(thin, deep)).toBe(false);
  });

  it("allows two albums that are merely a bit apart", () => {
    expect(albumsComparable(100, 80)).toBe(true);
    expect(albumsComparable(100, 40)).toBe(false);
  });
});

describe("the trophy window", () => {
  it("starts narrow", () => {
    expect(trophyWindow(0)).toBeLessThan(200);
  });

  it("widens the longer somebody waits", () => {
    expect(trophyWindow(10 * SEC)).toBeGreaterThan(trophyWindow(0));
  });

  it("stops narrowing the search entirely once patience runs out", () => {
    // Somebody better than everybody online still has to play somebody.
    expect(trophyWindow(PATIENCE_SECONDS * SEC)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("pairing", () => {
  it("will not pair a thin album with a deep one, however long they wait", () => {
    const a = waiting("beginner", 600, 20, 600);
    const b = waiting("collector", 600, 400, 600);
    // Ten minutes of waiting each, identical trophies — and still no.
    expect(wouldPair(a, b, now)).toBe(false);
    expect(findPair([a, b], now)).toBeNull();
  });

  it("pairs two comparable albums even when trophies are far apart, after a wait", () => {
    const a = waiting("one", 100, 100, PATIENCE_SECONDS + 1);
    const b = waiting("two", 1600, 95, 0);
    expect(wouldPair(a, b, now)).toBe(true);
  });

  it("will not pair far-apart trophies immediately", () => {
    const a = waiting("one", 100, 100);
    const b = waiting("two", 1600, 95);
    expect(wouldPair(a, b, now)).toBe(false);
  });

  it("lets one player's patience count for both", () => {
    // Otherwise a newcomer's narrow window keeps rejecting the person who has
    // been waiting longest, which is precisely backwards.
    const patient = waiting("patient", 100, 100, PATIENCE_SECONDS + 1);
    const fresh = waiting("fresh", 1600, 95, 0);
    expect(wouldPair(patient, fresh, now)).toBe(true);
  });

  it("matches a guest with anybody — they have no record to be outmatched on", () => {
    const guest = waiting("guest", null, null);
    const veteran = waiting("veteran", 1600, 900);
    expect(wouldPair(guest, veteran, now)).toBe(true);
  });

  it("serves whoever has waited longest first", () => {
    const longest = waiting("longest", 500, 100, 30);
    const close = waiting("close", 505, 100, 1);
    const closer = waiting("closer", 501, 100, 0);
    const pair = findPair([closer, close, longest], now);
    // `closer` is the tidiest match for `close` — but `longest` has been
    // there half a minute and gets served first.
    expect(pair?.[0].who).toBe("longest");
  });

  it("gives the longest waiter their closest available partner", () => {
    const longest = waiting("longest", 500, 100, 30);
    const far = waiting("far", 900, 100, 5);
    const near = waiting("near", 520, 100, 5);
    expect(findPair([far, near, longest], now)?.[1].who).toBe("near");
  });

  it("pairs nobody when there is nobody", () => {
    expect(findPair([], now)).toBeNull();
    expect(findPair([waiting("alone", 100, 100)], now)).toBeNull();
  });

  it("never pairs somebody with themselves", () => {
    const solo = waiting("solo", 100, 100);
    expect(wouldPair(solo, solo, now)).toBe(false);
  });
});
