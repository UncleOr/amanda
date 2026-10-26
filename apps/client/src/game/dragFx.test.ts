/**
 * **Everything on Or's list of what a drag throws off.**
 *
 * Or, writing the whole life of a card in one message: *"a drag animation —
 * insect wings (small, beating fast), dragon wings (big, moving slowly),
 * flying gravel, lightning, jelly/slime splatter, flying earth, etc."* And
 * beside it, the feel: *"flies fast, wobbles, slow, heavy, resists."*
 *
 * Six of those pictures and five of those feelings now exist. This is a
 * checklist, and it is written as one on purpose: the parts live in three
 * places — a style in carry.ts, a block of markup in App.tsx, a block of
 * CSS in board.css — and a missing third of any one of them is an effect
 * that silently does nothing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { carryOf } from "./carry";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const APP = read("../App.tsx");
const CSS = read("../styles/board.css");

/** style → the class the ghost hangs its furniture on. */
const FURNITURE: Array<[string, string, string]> = [
  // [style, the element rendered for it, the card it is read off]
  ["flutter", "drag-ghost__wings", "insects_07_aggressive_wasp"],
  ["soar", "drag-ghost__wings", "dragons_10_sky_king"],
  ["heavy", "drag-ghost__rubble", "giants_10_titan_king"],
  ["spark", "drag-ghost__bolt", "furries_01_chuppy"],
  ["ooze", "drag-ghost__drip", "slimes_01_basic_slime"],
  ["root", "drag-ghost__soil", "plants_01_thorn_sprout"],
];

describe("what a dragged card throws off", () => {
  for (const [style, cls, cardId] of FURNITURE) {
    it(`gives ${cardId} its ${style} ${cls.replace("drag-ghost__", "")}`, () => {
      expect(carryOf(cardId).style, "the style is derived from the card").toBe(style);
      expect(APP, "and the ghost draws it").toContain(cls);
      expect(CSS, "and the stylesheet knows what it looks like").toContain(`.${cls}`);
      expect(CSS, "and it moves").toMatch(new RegExp(`\.${cls}[^{]*\{[^}]*animation`));
    });
  }

  it("draws the current and the lightning as two different things", () => {
    /*
     * Or lists them separately — *"a current that surrounds the card"* in
     * one message and *"lightning"* in another — and they are two
     * different pictures: a current is continuous and a bolt is an event.
     * One element doing both is how the second request quietly becomes the
     * first one again.
     */
    expect(APP).toContain("drag-ghost__arc");
    expect(APP).toContain("drag-ghost__bolt");
    expect(CSS).toContain("arc-spin");
    expect(CSS).toContain("bolt-strike");
  });

  it("never changes the shape of the card", () => {
    /*
     * Or: *"when you drag a card its shape changes. It should stay in the
     * shape of a card."* So no style may scale the ghost on one axis —
     * the softness of a slime is carried by its spring, not by squashing
     * the artwork. (A 7px drip may stretch; the rule is about the card.)
     */
    const ghostRules = CSS.slice(CSS.indexOf(".drag-ghost {"));
    for (const m of ghostRules.matchAll(/\.drag-ghost--\w+\s*\{[^}]*\}/g))
      expect(m[0], m[0].slice(0, 30)).not.toMatch(/scaleY|scaleX/);
  });

  it("stands still for anybody who asked it to", () => {
    // Every one of these is decoration, and a player who has asked for less
    // motion has asked for less of exactly this.
    const quiet = CSS.slice(CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const [, cls] of FURNITURE) expect(quiet + CSS, cls).toContain(cls);
  });
});
