import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENAS, familyOpen } from "@amanda/shared";
import { CATALOG, cardPool } from "../data/catalog";

/**
 * **The opponent cannot field a family you have not met.**
 *
 * Or: *"the bots' decks have to match mine. If I am playing at the train
 * station now, I should not be seeing Machines or Sea Dwellers on the other
 * side."*
 *
 * ═══ WHY THIS WAS WRONG FOR AS LONG AS IT WAS ═══
 *
 * The rule already existed and was already enforced — in the SERVER, for
 * chests (`poolFor` in progress.ts asks `familyOpen` before it may pay out a
 * card). The browser's `cardPool` was written earlier, for a game that had no
 * ladder, and nobody went back to it. So owning a Machine was impossible at
 * 450 trophies and being SHOWN one across the board was routine — which
 * empties the Garage of the only thing an arena does. Meeting a family is
 * supposed to happen to you, once, somewhere.
 *
 * These measure the pool rather than reading the code, because the question
 * is not "is there a filter" but "what does a child at this rung see".
 */
const family = (id: string) => CATALOG.get(id)!.seriesId;
const familiesAt = (best: number) => new Set(cardPool(best).map(family));

describe("what the bot may draw at each rung", () => {
  it("shows a player at the Station no Machines and no Sea Dwellers", () => {
    // Or's own sentence, as an assertion.
    const station = ARENAS.find((a) => a.id === "station")!;
    const seen = familiesAt(station.from);
    expect(seen.has("machines")).toBe(false);
    expect(seen.has("sea")).toBe(false);
    expect(seen.has("insects"), "the Station is where you MEET the insects").toBe(true);
  });

  it("gives a first-evening player only the families of the playroom", () => {
    expect([...familiesAt(0)].sort()).toEqual(["dragons", "furries", "giants", "plants"]);
  });

  it("opens each family exactly at the arena that introduces it, and not before", () => {
    for (const arena of ARENAS) {
      if (!arena.introduces || arena.locked) continue;
      expect(familiesAt(arena.from).has(arena.introduces), `${arena.introduces} at ${arena.id}`).toBe(
        true,
      );
      // One trophy short of arriving is still not having arrived.
      if (arena.from > 0)
        expect(
          familiesAt(arena.from - 1).has(arena.introduces),
          `${arena.introduces} is visible before ${arena.id}`,
        ).toBe(false);
    }
  });

  it("agrees with familyOpen for every card, at every rung", () => {
    // The browser and the server must answer this question the same way, or a
    // chest pays out a card the bot is not allowed to play.
    for (const arena of ARENAS) {
      const allowed = new Set(cardPool(arena.from));
      for (const id of allowed)
        expect(familyOpen(family(id), arena.from), `${id} at ${arena.id}`).toBe(true);
    }
  });

  it("leaves the whole roster to anyone who has climbed to the top", () => {
    const top = ARENAS[ARENAS.length - 1]!;
    expect(familiesAt(top.from).size).toBeGreaterThanOrEqual(familiesAt(0).size + 4);
  });

  /*
   * ⚠ THE WAY A GATE LIKE THIS BREAKS A GAME. A pool too small to fill a
   * board does not throw — it silently deals the same four cards to both
   * sides, or falls through to Crumb Demons. The first evening is the
   * thinnest the pool ever is, so it is the one to measure.
   */
  it("still has enough cards to build a board on the first evening", () => {
    expect(cardPool(0).length).toBeGreaterThanOrEqual(18);
  });

  it("is the whole roster when nobody asks about a ladder", () => {
    // The mirror mode's shared deal and the dev chest door, which are not
    // about one player's progress.
    expect(cardPool().length).toBeGreaterThan(cardPool(0).length);
  });
});

/* ───────────────────────── the wiring ───────────────────────── */

const MATCH = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");
const DRAFT = readFileSync(
  fileURLToPath(new URL("../components/Draft.tsx", import.meta.url)),
  "utf8",
);

describe("every board built from the pool goes through the gate", () => {
  it("asks for BEST trophies, not the ones on screen", () => {
    // Trophies fall after a loss. A family you have met does not become unmet
    // — the same rule familyOpen and the server's chest pool are written to.
    expect(MATCH).toContain(
      "() => accountRef.current?.bestTrophies ?? accountRef.current?.trophies ?? 0,",
    );
  });

  it("leaves no bot board drawing from the whole catalogue", () => {
    /*
     * The real assertion of this file. Every `generateAiPlan` that is NOT
     * handed an explicit deck must be handed the ladder, and a new call site
     * added later is exactly how this bug comes back.
     */
    for (const call of MATCH.match(/generateAiPlan\([^)]*\)/g) ?? []) {
      const handedADeck = /generateAiPlan\((deck|result\.theirs)\b/.test(call);
      if (handedADeck) continue;
      expect(call, `${call} builds from the pool without the ladder`).toMatch(/met\(\)|climbed/);
    }
  });

  it("deals a draft from the families this player has met", () => {
    // Worse than the bot's board, ungated: it would ask him to CHOOSE a
    // family he has not met, and hand the one he refused to the opponent.
    expect(DRAFT).toContain("cardPool(best)");
  });

  it("deals a mirror match from them too", () => {
    expect(MATCH).toContain("matchDeck(null, seed, null, met())");
  });

  it("gives a guest with no album the first evening rather than everything", () => {
    expect(MATCH).toContain("return cardPool(best);");
  });
});
