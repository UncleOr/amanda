import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CardSchema } from "@amanda/shared";
import { CATALOG } from "../data/catalog";

/**
 * **A line about who the monster is.**
 *
 * Or: *"add me an option to give every monster a 'story' too. Not all of them
 * will have one, but some — mainly the ones with the name. The story appears
 * in the card details under the name. Chuppy, for example: 'the loyal friend
 * who is always with you'."*
 *
 * ═══ WHY THIS IS NOT `role`, WHICH ALREADY EXISTS ═══
 *
 * `role` is a sentence per card that is already in the data and already
 * optional — and it is the one field in this game with a comment beside it
 * saying it must never be shown to a player. Or, about the Obsidian Egg's:
 * *"I saw the card still has the nonsense I asked to delete."* It reads like
 * a strategy memo because that is what it is.
 *
 * So the two are told apart by who they are for, and the only way to keep
 * them apart is to say so where each is used.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const MODAL = read("./CardDetailModal.tsx");
const EDITOR = read("./CardEditor.tsx");
const CSS = read("../styles/modals.css");

describe("the field", () => {
  it("is optional, because most monsters have nothing to say", () => {
    const bare = CATALOG.get("dragons_03_thunderwing")!;
    expect(CardSchema.safeParse({ ...bare, story: undefined }).success).toBe(true);
  });

  /*
   * ⚠ HALF A STORY FAILS VALIDATION. Both halves of a LocalizedString are
   * `min(1)`, so a Hebrew line with an empty English one is a card the panel
   * cannot save — and it would read as "the editor is broken", not as "you
   * left a box empty".
   */
  it("refuses half of one, which is why the editor fills both", () => {
    const bare = CATALOG.get("dragons_03_thunderwing")!;
    expect(CardSchema.safeParse({ ...bare, story: { he: "משהו", en: "" } }).success).toBe(false);
    expect(EDITOR).toContain("[other]: kept || value");
    // And clearing both takes the field off rather than storing two blanks.
    expect(EDITOR).toContain("if (!text && !kept.trim())");
  });

  it("carries Or's own line for Chuppy", () => {
    expect(CATALOG.get("furries_01_chuppy")!.story?.he).toBe("החבר הנאמן שתמיד איתך");
  });

  /*
   * The rest are his to write — he is the copywriter, and a story is the
   * most purely his field in the catalogue. This counts rather than names,
   * so it moves on its own as he fills them in.
   */
  it("leaves the rest empty rather than inventing them", () => {
    const told = [...CATALOG.values()].filter((c) => c.story);
    expect(told.length).toBeGreaterThan(0);
  });
});

describe("where it is shown", () => {
  it("sits under the name, above the badges", () => {
    expect(MODAL).toContain("{card.story && <p className=\"modal__story\">{say(card.story)}</p>}");
    expect(MODAL.indexOf("modal__story")).toBeGreaterThan(MODAL.indexOf("modal__subtitle"));
    expect(MODAL.indexOf("modal__story")).toBeLessThan(MODAL.indexOf("modal__badges"));
  });

  it("is readable rather than grey", () => {
    // It is the one line on the card that is not a fact about a fight, so
    // it is not a unit beside a number. See the UI skill, §3.
    const rule = CSS.slice(CSS.indexOf(".modal__story"), CSS.indexOf(".modal__story") + 300);
    expect(rule).toContain("var(--text)");
    expect(rule).toContain("var(--t-3)");
  });

  it("does not drag `role` onto the card with it", () => {
    // The comment explaining why role is hidden is still the live rule.
    expect(MODAL).not.toContain("card.role");
  });

  it("can be written in the panel, in both languages", () => {
    expect(EDITOR).toContain("סיפור (עברית)");
    expect(EDITOR).toContain("Story (English)");
    expect(EDITOR).toContain("החבר הנאמן שתמיד איתך");
  });
});
