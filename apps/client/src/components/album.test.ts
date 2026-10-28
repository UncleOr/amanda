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
import { CATALOG } from "../data/catalog";

/** Every card, for the rules that have to hold across all of them. */
const CATALOG_CARDS = [...CATALOG.values()];

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
    // Or: *"instead of 'לשדרוג' on a card write 'שדרוג'."* A button says
    // what it does, and the preposition was doing nothing.
    expect(up).toContain('"שדרוג"');
    expect(up).not.toContain('"לשדרוג"');
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

  /*
   * Or: *"every card says 'abilities' and 'role' — merge them."* They were
   * merged; then `role` came off the card altogether.
   *
   * Or: *"the card still has the nonsense I asked to delete, with the tank
   * you put on top of it. I asked for all those parts not to appear."* He
   * means the Obsidian Egg's `role`, which is a note between designers — it
   * names a strategy and a card that does not exist by that name — printed
   * on the card as though it were a rule.
   *
   * The field stays in the data because it is useful for balancing, so the
   * thing to guard is that the SCREEN never reads it again.
   */
  it("says what the card does once, and never reads `role`", () => {
    expect(MODAL, "תפקיד was the second heading").not.toContain('"תפקיד"');
    expect(MODAL, "role is a designer's note, not card text").not.toContain("card.role");
    expect(MODAL).toContain("{card.abilities.length > 0 && (");
  });

  /*
   * Or: *"where do you see on a card whether it flies or walks? It should
   * be written in the movement section. If it flies it has to say so."*
   *
   * It was a badge at the top and nothing in the row that answers how the
   * thing moves — which for the five static flyers meant that row said
   * "static" and stopped there.
   */
  it("says how it moves, not only how fast", () => {
    // The icon sits ABOVE the label on the element, so it is not inside the
    // value slice — two assertions, not one.
    expect(MODAL, "the icon follows it").toContain('icon={card.flying ? "fly" : "move"}');
    const move = between(MODAL, 'label={t("sefc23b0"', "/>");
    expect(move, "a flyer is named in the movement row").toContain("card.flying");
    // The five that have no speed to print: a hovering dragon is not a wall.
    const still = CATALOG_CARDS.filter((c) => c.flying && c.stats.moveSpeed === 0);
    expect(still.length, "static flyers exist, so that branch is reachable").toBeGreaterThan(0);
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

/**
 * ═══ TWO VIEWS AND A FILTER ═══
 *
 * Or: *"at the top make a switch between two views — album (like before:
 * all the cards laid out in advance and stuck down) or packs (like it is
 * now). And make a filter button that shows only stickers that are
 * upgradeable."*
 *
 * Three rules here that a later tidy-up would undo without noticing, and
 * the first two are the ones that make the filter honest.
 */
describe("the album's two views", () => {
  it("lays every pack open in the album view", () => {
    expect(ALBUM).toContain("const open = flat || onlyUp || opened.has(series.id)");
  });

  it("opens them for the filter too", () => {
    // A filter whose results are inside closed packs has found nothing as
    // far as anybody can see. `onlyUp` is in the same expression for that
    // reason, and the test is here so it stays there.
    expect(ALBUM).toContain("onlyUp ||");
  });

  it("counts the whole family even while showing part of it", () => {
    // "3/10" has to go on meaning three of the family's ten, however few
    // of them are on screen. The filter narrows `cards`; the count reads
    // `all`.
    expect(ALBUM).toContain("const cards = onlyUp && toWin ? all.filter((c) => readyToLevel(c.id)) : all;");
    expect(ALBUM).toContain("`${have}/${all.length}`");
  });

  /*
   * Or: *"you forgot Amanda's series, the one with only Amanda in it — at
   * the bottom of the album."* It was skipped because nothing in it can be
   * won, and a shelf headed 0/0 looked like an empty promise. The answer is
   * the one the arena ladder already uses for a shut door: no number,
   * because there is no number — a padlock.
   */
  it("shows the shelf you cannot win from, with a padlock instead of a count", () => {
    expect(ALBUM).toContain("const toWin = winnable.length > 0 && met;");
    expect(ALBUM).toContain("`${have}/${all.length}`");
    expect(ALBUM).toContain("<Lock />");
    // And it is not in the upgrade filter, where every row is a thing to do.
    expect(ALBUM).toContain("if (onlyUp && !toWin) return null;");
  });

  /*
   * Or: *"the album needs a padlock on the series that have not opened yet
   * too. Reminder that if I have already reached an arena, its series is
   * open even if I have dropped back."*
   *
   * Two rules in two sentences. The first is the lock; the second is which
   * number it is read against, and it is the one that would have been got
   * wrong — `trophies` falls after a loss, so an album written against it
   * would RE-LOCK the Insects for a child who had a bad evening, taking a
   * shelf away from them for losing four matches.
   */
  it("locks a family he has not reached yet", () => {
    expect(ALBUM).toContain("const met = familyOpen(series.id, climbed);");
  });

  it("reads it against the high-water mark, so a bad evening takes nothing back", () => {
    expect(ALBUM).toContain(
      "const climbed = account?.bestTrophies ?? account?.trophies ?? 0;",
    );
  });

  it("says where a locked shelf opens, in Hebrew somebody would say", () => {
    // `atArena`, not "ב" + the name: ב and ה collapse (בהמוסך is not a word).
    expect(ALBUM).toContain("const opensAt = met ? null : ARENAS.find((a) => a.introduces === series.id);");
    expect(ALBUM).toContain("atArena(say(opensAt.name))");
  });

  it("calls a card ready on copies alone, not on the purse", () => {
    /*
     * Deliberate: the filter answers "what have I collected enough of".
     * Hiding a card because the diamonds are gone would make the list
     * change when you spend money somewhere else entirely — and the button
     * under the card already says, in red, when you cannot afford it.
     */
    /*
     * It lives in game/upgradable.ts now rather than inside this component.
     * Or: *"give me a small green mark on the album if I have cards that can
     * be upgraded"* — and a dot on the home screen that disagreed with this
     * screen's own filter would be worse than no dot, so there is one rule
     * and two readers.
     */
    const rule = readFileSync(
      fileURLToPath(new URL("../game/upgradable.ts", import.meta.url)),
      "utf8",
    );
    const ready = between(rule, "export function readyToLevel", "}");
    expect(ready).toContain("mine.copies >= levelCost(card.rarity, mine.level)");
    expect(ready, "nothing about diamonds").not.toContain("diamonds");
    expect(ALBUM, "and the album asks it rather than keeping its own").toContain(
      "readyToLevelIn(album, cardId)",
    );
  });

  it("shows pictures rather than words for the two views", () => {
    /*
     * Or: *"on the packs/album view button use icons instead. In Hebrew
     * and in English of course."* The header already carries a count,
     * trophies, diamonds, the elements table and a way out; two more words
     * in it is a row of words.
     *
     * The word survives as the accessible name, which is the one job a
     * picture cannot do.
     */
    const views = between(ALBUM, 'className="album__views"', "</div>");
    expect(views, "a stack for the packs").toContain('<Icon name="stacked"');
    expect(views, "and a grid for the album").toContain('<Icon name="deck"');
    expect(views.match(/aria-label=/g) ?? [], "both still say what they are").toHaveLength(2);
  });

  it("says something when the filter finds nothing", () => {
    expect(ALBUM).toContain("onlyUp && !collection.some((c) => readyToLevel(c.id))");
  });

  it("does not disable the pack header, which would grey out its name", () => {
    // A real `disabled` takes the browser's own grey for the text, and on
    // this panel that made the family's NAME vanish — the one thing the
    // row exists to say.
    expect(ALBUM).toContain("aria-disabled={flat || onlyUp}");
    // Not `toContain`: "aria-disabled={flat..." contains "disabled={flat..."
    expect(ALBUM, "and nothing turned it back into a disabled attribute").not.toMatch(
      /[\s{]disabled=\{flat/,
    );
  });
});
