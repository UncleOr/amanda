/**
 * **The elements chart cannot disagree with the engine.**
 *
 * Or asked for it after being told what the elements do: *"an 'elements
 * table' button that opens a popup with a table showing, for each element,
 * which it beats and which beats it."* He asked because he had assumed they
 * were decoration — they multiply every hit by 1.5 or 0.75.
 *
 * A chart of a rule is the kind of thing that is true the day it is written
 * and wrong a month later. These make that impossible: both columns are
 * derived from ELEMENT_COMBAT, which is the constant combat.ts multiplies
 * by, and the two columns are checked against each other.
 */
import { describe, expect, it } from "vitest";
import { ELEMENT_COMBAT, type Element } from "@amanda/shared";
import { elementChart } from "./ElementsTable";
import { ELEMENT_META } from "../data/cardMeta";

const rows = elementChart();
const of = (el: Element) => rows.find((r) => r.el === el)!;

describe("the chart", () => {
  it("has a row for every element the game has", () => {
    expect(rows.map((r) => r.el).sort()).toEqual(Object.keys(ELEMENT_META).sort());
  });

  /*
   * THE MIRROR. "Who beats me" is not a second list to maintain, it is the
   * first one read the other way — so every pairing has to appear in both
   * columns, once each.
   */
  it("is the same table read both ways", () => {
    for (const { el, beats } of rows) {
      for (const loser of beats) {
        expect(of(loser).beatenBy, `${el} beats ${loser}, so ${loser} is beaten by ${el}`).toContain(el);
      }
    }
    for (const { el, beatenBy } of rows) {
      for (const winner of beatenBy) {
        expect(of(winner).beats, `${winner} beats ${el}`).toContain(el);
      }
    }
  });

  /* Straight from the constant the battle multiplies by. */
  it("says what the engine actually does", () => {
    expect(of("fire").beats).toEqual([...ELEMENT_COMBAT.strongVs.fire]);
    expect(of("fire").beatenBy, "water puts fire out").toContain("water");
    expect(ELEMENT_COMBAT.strongMultiplier).toBeGreaterThan(1);
    expect(ELEMENT_COMBAT.weakMultiplier).toBeLessThan(1);
  });

  /*
   * Nothing beats the Assimilator's element and it beats nothing, because it
   * has no element of its own until it steals one on its first hit. An empty
   * row is the truth here, not a gap.
   */
  it("leaves the variable element with no pairings", () => {
    expect(of("variable").beats).toEqual([]);
    expect(of("variable").beatenBy).toEqual([]);
  });

  /* Every element drawn has a picture and a name to draw. */
  it("has a name and an icon for every element in it", () => {
    for (const { el } of rows) {
      expect(ELEMENT_META[el]?.he, el).toBeTruthy();
      expect(ELEMENT_META[el]?.icon, el).toBeTruthy();
    }
  });
});
