/**
 * **The album, after Or went through it card by card.**
 *
 * Eight notes in one message. These pin the six that are rules rather than
 * pixels — the ones a later tidy-up would quietly undo — by reading the
 * source, because there is no DOM here to render a card into.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RANGE_REACH } from "@amanda/shared";

const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), "utf8");
/** The source from one marker to the next one AFTER it, not to the first in the file. */
const between = (src: string, from: string, to: string) => {
  const a = src.indexOf(from);
  if (a < 0) return "";
  const b = src.indexOf(to, a + from.length);
  return src.slice(a, b < 0 ? undefined : b);
};
const MODAL = read("./CardDetailModal.tsx");
const ALBUM = read("./Album.tsx");
const CARD = read("./CardView.tsx");

describe("the card you have not got", () => {
  /*
   * Or: *"for the places where there is no card yet, put a grey thumbnail of
   * the card + its name, so they see what to aim for."* It was a face-down
   * back, which says something is missing and not WHAT — and wanting one of
   * the gaps is the entire reason to look at an album with gaps in it.
   */
  it("is the card in grey, not a face-down back", () => {
    const grid = between(ALBUM, "{cards.map((card)", "</section>");
    expect(grid).toContain('<CardView cardId={card.id} size="small" ghost />');
    expect(grid, "the back belongs to fog of war, not to a gap").not.toContain("CardBack");
  });

  it("drops the numbers it has no business showing", () => {
    const view = CARD.slice(CARD.indexOf("export function CardView"));
    expect(view, "no icon row").toContain("{!plain && !ghost && <div className=\"card__top\">");
    expect(view, "and no health or power bars").toContain("{!ghost && (");
  });
});

describe("the upgrade button", () => {
  /*
   * Or: *"the upgrade button appears on the card in a way that is hard to
   * see — put it outside the card."* It was absolutely positioned over the
   * artwork, 22px up from the bottom so it would stop covering the name.
   */
  it("is outside the card, not on top of it", () => {
    const cell = between(ALBUM, 'className="album__card"', "</section>");
    const closed = cell.indexOf("</div>\n                      {mine && (");
    expect(closed, "the card's own box closes before the button opens").toBeGreaterThan(-1);
    expect(cell.indexOf("<Upgrade"), "and the button comes after it").toBeGreaterThan(closed);
  });

  /*
   * Or: *"it should say 'to upgrade' and a diamond icon with the number of
   * diamonds it costs beside it. If you do not have enough diamonds the
   * number appears in red and the button looks unpressable."*
   */
  it("always shows the price, and reddens it when the purse is short", () => {
    const up = ALBUM.slice(ALBUM.indexOf("function Upgrade"));
    expect(up).toContain('"לשדרוג"');
    expect(up).toContain('<Icon name="gem"');
    expect(up).toContain('className={canPay ? "" : "is-poor"}');
    expect(up, "and it cannot be pressed").toContain("disabled={busy || !canPay}");
  });
});

describe("the card's own screen", () => {
  /*
   * Or: *"range — maybe we should put a number there? No metres, a number of
   * cards."* The engine measures it exactly, so the number is the engine's
   * own constant rather than a description of it.
   */
  it("shows the range as the engine's own reach", () => {
    expect(MODAL).toContain("value={RANGE_REACH[card.stats.range]}");
    expect(RANGE_REACH.melee, "contact").toBe(0);
    expect(RANGE_REACH.sniper, "across most of the board").toBeGreaterThan(RANGE_REACH.ranged);
  });

  /*
   * And who it hits, in what order. Each line is pickTarget's rule in
   * simulate.ts: a king-hunter clears the guards in the way first, a sniper
   * takes the FARTHEST enemy in its lane, everything else fights what is in
   * front of it.
   */
  it("says who it attacks, by the rule the battle uses", () => {
    const aim = between(MODAL, 'className="modal__aim"', "</p>");
    expect(aim).toContain('card.targeting === "king"');
    expect(aim).toContain('card.stats.range === "sniper"');
  });

  /* Or: *"every card says 'abilities' and 'role' — merge them."* */
  it("has one heading over what the card does, not two", () => {
    expect(MODAL).toContain("{(card.role || card.abilities.length > 0) && (");
    expect(MODAL, "תפקיד was the second heading").not.toContain('"תפקיד"');
  });

  /* Or: *"no need to write the series synergy on every card, all the
     synergies are the same."* It is a rule of the board, not of the monster. */
  it("does not repeat the series synergy on all fifty-three", () => {
    expect(MODAL).not.toContain("modal__synergy");
    expect(MODAL).not.toContain("series.synergy");
  });

  /* Or: *"'1 copies the next level costs 7' is very clumsy — write 1/7
     [card] to the next level + [diamond] [how many diamonds]."* */
  it("counts the copies as a fraction and names both prices", () => {
    const note = MODAL.slice(MODAL.indexOf('className="modal__level-note"'));
    expect(note).toContain("{owned.copies}/{levelCost(card.rarity, level)}");
    expect(note).toContain("levelDiamonds(level)");
    expect(MODAL, "the old sentence is gone").not.toContain("הרמה הבאה עולה");
  });
});
