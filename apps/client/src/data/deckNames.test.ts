/**
 * **Every new deck arrives with a name that fits.**
 *
 * Or: *"when you make a new deck and don't give it a name, it won't let you
 * save. Give some indication — and also give every deck a random name when
 * you open it."*
 *
 * The save button was merely DISABLED on an empty name: no message, no
 * reason, nothing to read. A child who has just chosen sixteen cards presses
 * the only orange button on the screen and the game does nothing at all.
 *
 * Two properties, and the second one is the one a reviewer would miss:
 *
 *   a name, always     or the bug is back for whoever draws the empty slot
 *   short enough       or it arrives already cut off in a field that holds 18
 *
 * The second is why this is a test and not a glance. `nameMax` is a number
 * in @amanda/shared that somebody may lower, and a name that no longer fits
 * is not an error anywhere — it is just a deck called "דק מפלצת".
 */
import { describe, expect, it } from "vitest";
import { DECK_RULES } from "@amanda/shared";
import { DECK_NAMES, newDeckName } from "./deckNames";

describe("the name a new deck is born with", () => {
  it("is never empty", () => {
    // Many draws, because the bug being fixed is one empty value in a list.
    for (let i = 0; i < 200; i++) expect(newDeckName().trim()).not.toBe("");
  });

  it("fits the field it lands in", () => {
    for (const name of DECK_NAMES) {
      const text = name();
      expect([...text].length, `"${text}" is longer than nameMax`).toBeLessThanOrEqual(
        DECK_RULES.nameMax,
      );
    }
  });

  /*
   * Or asked for a RANDOM name, which is only true of a list. One name would
   * satisfy every other test here and none of what he asked for.
   */
  it("is drawn from several", () => {
    expect(DECK_NAMES.length).toBeGreaterThanOrEqual(4);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(newDeckName());
    expect(seen.size).toBeGreaterThan(1);
  });

  it("has no duplicates in the list", () => {
    const all = DECK_NAMES.map((n) => n());
    expect(new Set(all).size).toBe(all.length);
  });

  /*
   * The names are built with `t()`, which falls back to the Hebrew when no
   * copy document is loaded — which is exactly the state these tests run in.
   * A name that came back as its own id would pass every check above.
   */
  it("gives words, not copy ids", () => {
    for (const name of DECK_NAMES) expect(name()).not.toMatch(/^s[0-9a-f]{7}$/);
  });
});
