import { describe, expect, it } from "vitest";
import { ARENAS, familyOpen } from "@amanda/shared";
import { liveChallenges } from "./meta.js";
import { CATALOG } from "./content.js";

/**
 * **A challenge cannot send you after a monster you have not met.**
 *
 * Or: *"the challenges have to match the arena I am in. I have a challenge to
 * fight with the Leviathan and I have not even reached the Pool."*
 *
 * ═══ THE LAST PLACE THAT STILL DREW FROM THE WHOLE CATALOGUE ═══
 *
 * `familyOpen` has gated the chests, the album and every bot board for a
 * while now. The challenge pool was built once at boot from every launch
 * card in the game, with no player anywhere near it — so a player in the
 * Games Room could be told to play a match with a card that cannot be in
 * their album, cannot come out of their chests and cannot be fielded against
 * them. An errand with no door, worth two nachos.
 *
 * Measured over a year of dates rather than one, because the draw is
 * deterministic in the date: a single day proves nothing about the day after.
 */
const DAYS = Array.from({ length: 370 }, (_, i) => new Date(2026, 0, 1 + i));

/** Every card and family a rung's challenges name, over a year. */
function named(best: number): { cards: Set<string>; families: Set<string> } {
  const cards = new Set<string>();
  const families = new Set<string>();
  for (const day of DAYS)
    for (const c of liveChallenges(day, best)) {
      if (c.goal.kind === "playCard") cards.add(c.goal.cardId);
      if (c.goal.kind === "placeSeries") families.add(c.goal.seriesId);
    }
  return { cards, families };
}

describe("what a challenge may ask for", () => {
  it("names nobody a player at that rung has not met", () => {
    for (const arena of ARENAS) {
      const { cards, families } = named(arena.from);
      for (const id of cards) {
        const card = CATALOG.get(id)!;
        expect(familyOpen(card.seriesId, arena.from), `${id} at ${arena.id}`).toBe(true);
      }
      for (const f of families)
        expect(familyOpen(f, arena.from), `${f} at ${arena.id}`).toBe(true);
    }
  });

  it("is Or's own sentence, as an assertion", () => {
    // "I have a challenge to fight with the Leviathan and I have not even
    // reached the Pool." The Pool is where the Sea Dwellers are met.
    const pool = ARENAS.find((a) => a.id === "pool")!;
    const before = named(pool.from - 1);
    expect([...before.cards].some((id) => CATALOG.get(id)!.seriesId === "sea")).toBe(false);
    expect(before.families.has("sea")).toBe(false);
    // And at the Pool itself they are fair game.
    expect(familyOpen("sea", pool.from)).toBe(true);
  });

  it("still gives a beginner enough to ask about", () => {
    // A gate that leaves nothing to name is a gate that empties the screen.
    const { cards, families } = named(0);
    expect(cards.size, "a year of dailies names almost nobody").toBeGreaterThan(8);
    expect(families.size).toBeGreaterThan(2);
  });

  it("opens up as you climb", () => {
    const top = ARENAS[ARENAS.length - 1]!;
    expect(named(top.from).families.size).toBeGreaterThan(named(0).families.size);
  });

  it("gives a guest the first evening's families rather than everything", () => {
    expect(named(0).families).toEqual(named(ARENAS[0]!.from).families);
  });
});

/**
 * ⚠ AND THE ID MUST NOT SAY WHICH POOL IT CAME FROM.
 *
 * The tidier design — the rung in the id, one id meaning one challenge for
 * ever — was written first and then taken out, because `claim` finds a
 * challenge by id in the player's CURRENT list: a challenge finished at the
 * Games Room and not yet claimed would become "expired" the moment its owner
 * reached the Pitch. 150 trophies is five wins, so that is the first evening
 * and not a rare day.
 */
describe("the id of a challenge", () => {
  it("survives climbing a rung", () => {
    const day = new Date(2026, 4, 12);
    const low = liveChallenges(day, 0).map((c) => c.id);
    for (const arena of ARENAS)
      expect(liveChallenges(day, arena.from).map((c) => c.id), arena.id).toEqual(low);
  });

  it("still names the day and the period it belongs to", () => {
    const ids = liveChallenges(new Date(2026, 4, 12), 0).map((c) => c.id);
    expect(ids.filter((id) => id.startsWith("d:2026-05-12:"))).toHaveLength(3);
    expect(ids.filter((id) => id.startsWith("m:2026-05:"))).toHaveLength(1);
  });
});
