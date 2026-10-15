import { describe, expect, it } from "vitest";
import { CATALOG, SERIES_NAMES } from "./content.js";
import { isCollectable } from "@amanda/shared";

/*
 * A challenge nobody can complete.
 *
 * Found on the live site, in the challenge list of a brand-new account, while
 * checking something else: "put a card from the LEGENDARIES in the back row."
 * The legends family has exactly one card — Amanda — and she is `launch:
 * false` and, since she was correctly taken out of the chest pool,
 * uncollectable as well.
 *
 * The card pool had always filtered on `launch`. The series pool took every
 * name in the catalogue.
 */

const playable = [...CATALOG.values()].filter(
  (c) => c.id !== "crumb_demon" && c.launch && isCollectable(c),
);

describe("the families a challenge may name", () => {
  it("every one of them has a card you could actually place", () => {
    const families = new Set(playable.map((c) => c.seriesId));
    for (const id of families) {
      expect(playable.some((c) => c.seriesId === id)).toBe(true);
    }
  });

  it("leaves out the legends, whose only card is the opponent", () => {
    const families = new Set(playable.map((c) => c.seriesId));
    expect(SERIES_NAMES.has("legends")).toBe(true);
    expect(families.has("legends")).toBe(false);
  });

  /*
   * The real assertion, and the one that will catch the next one: the pools
   * are built from the same list, so a family that stops being playable
   * stops being asked about on the same deploy.
   */
  it("keeps the two pools in step", () => {
    const families = new Set(playable.map((c) => c.seriesId));
    const named = [...SERIES_NAMES.keys()].filter((id) => families.has(id));
    expect(named.length).toBe(families.size);
    expect(named.length).toBeGreaterThan(0);
  });
});
