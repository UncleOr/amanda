/**
 * **The thief, and the one rule that makes it a card rather than a cheat.**
 *
 * Or: *"Thief — lets you steal an enemy card (according to what you can SEE:
 * the front row, three rows in panic, or everything if you played the X-Ray).
 * You activate the card, then one press on theirs + one press on an empty
 * square. Alternatively — a drag."*
 *
 * The limit is the whole card. A thief that could take anything would end the
 * fog-of-war: you would simply steal whatever you most wanted out of the row
 * you cannot see, and the back row would stop being a surprise for everybody.
 * What makes it fair is that you may only take something you have already
 * been shown — which means it is strongest in the panic phase, strongest of
 * all behind an x-ray, and nearly blind during the build.
 *
 * There is no jsdom here, so what is pinned is the WIRING: that the rule is
 * stated in the model and not only in the component that draws the board,
 * and that the two things it must never do are refused by name.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACTIONS, isEnemyTargeted, isTargetedAction, isTwoPickAction } from "../data/catalog";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const MATCH = read("./useMatch.ts");

/** The body of the steal branch, from its label to the next effect. */
const branch = (): string => {
  const at = MATCH.indexOf('} else if (effect === "stealEnemyCard") {');
  expect(at, "the steal branch is gone — rename it here too").toBeGreaterThan(-1);
  const next = MATCH.indexOf('} else if (effect === "eraseEnemyCard") {', at);
  return MATCH.slice(at, next > 0 ? next : at + 4000);
};

describe("the thief", () => {
  it("is a card the game knows is aimed, and aimed twice", () => {
    expect(ACTIONS.has("thief"), "thief is missing from action-cards.json").toBe(true);
    expect(isTargetedAction("thief")).toBe(true);
    expect(isEnemyTargeted("thief"), "it starts on their board").toBe(true);
    expect(isTwoPickAction("thief"), "theirs, then yours").toBe(true);
  });

  it("may only take something that is on the screen", () => {
    /*
     * ⚠ CHECKED IN THE MODEL, NOT ONLY BY THE BOARD THAT DREW IT.
     *
     * The screen already makes it impossible: the enemy grid is drawn from
     * `revealedOpponent`, which is the board cut down to what is showing,
     * and BoardGrid only fires `onTarget` for a cell it has drawn something
     * in — so a fogged card is not there to be pressed. That is a happy
     * accident of how the board is built, and happy accidents are exactly
     * what the next refactor takes away. "What you can steal" is a RULE.
     */
    expect(branch(), "the fog is not consulted when the thief takes aim").toContain(
      "revealRef.current(tx, ty)",
    );
  });

  it("reads that rule live rather than from the render it was born in", () => {
    /*
     * ⚠ AND THIS IS THE BUG THAT WAS ALMOST SHIPPED. `applyTargetTo` is
     * memoised on [spend]; `revealOpponentCell` is rebuilt whenever the
     * phase or the x-ray changes. Calling it directly captured the version
     * from the render the callback was made in and kept it for the whole
     * match — so the thief would have judged "can I see that" by the BUILD
     * phase's fog while the player stood in the panic phase looking at
     * three rows.
     *
     * Silent, correct-looking, and wrong only in the direction nobody
     * tests: it refuses a steal that should be allowed.
     */
    expect(MATCH).toContain("revealRef.current = revealOpponentCell;");
    expect(branch(), "the fog rule is captured, not read").not.toContain(
      "!revealOpponentCell(tx, ty)",
    );
  });

  it("cannot take a crown, and cannot drop one on a crown", () => {
    /*
     * A board with no King is not a board — the same reason the eraser
     * wounds a King instead of deleting it — and a crown that changed sides
     * would carry its ×3 and its family bonus across with it.
     */
    const body = branch();
    expect(body, "the crown can be lifted").toContain("if (key === KING_KEY) return;");
    expect(body, "the crown can be landed on").toContain("key !== KING_KEY");
    // And the crown never lights up as a landing square in the first place.
    expect(read("../components/BoardGrid.tsx")).toContain("if (king && !targetEmpty)");
  });

  it("puts it down only on a square that is empty", () => {
    expect(branch(), "it can land on top of one of your own").toContain(
      "!gsRef.current.placements[key]",
    );
  });

  it("takes it off their side as well as putting it on yours", () => {
    /*
     * The half that is easy to forget and impossible to miss once it has
     * happened: a card that is stolen and still standing there is a card
     * the thief COPIED. `eraseEnemyAt` is already exactly this half — it
     * takes the card off the picture AND out of the computer's plan, which
     * are the two places a solo opponent exists — and against a person only
     * their own client can really do it, so the message goes out too.
     */
    const body = branch();
    expect(body, "the card is copied, not taken").toContain("eraseEnemyAt(held.from, 0)");
    expect(body, "a person's board never hears about it").toContain(
      "netRef.current?.hex(id, held.from)",
    );
    // And the receiving end acts on it.
    expect(MATCH).toContain('if (a?.effect === "stealEnemyCard" && cell && cell !== KING_KEY)');
  });

  it("takes it off the playground's other half too, which is a third opponent", () => {
    /*
     * ⚠ FOUND BY DRIVING IT, AND IT CAME BACK A COPIER.
     *
     * The first real run of the thief in the playground ended with the Lava
     * Dragon standing on BOTH sides of the midline. `eraseEnemyAt` knew two
     * opponents — `netOpp`, what the server sent, and `aiPlanRef`, the
     * computer's plan — and the playground's other half is neither: it is
     * `foe`, a board you built yourself.
     *
     * The eraser has had this hole for as long as the playground has
     * existed. Nobody found it because an action card you spend in a
     * sandbox to see what it does is the one place a miss looks like a
     * feature — the card "worked", the board just still had the card on it.
     */
    const at = MATCH.indexOf("const eraseEnemyAt");
    expect(at, "eraseEnemyAt is gone — rename it here too").toBeGreaterThan(-1);
    const body = MATCH.slice(at, MATCH.indexOf("\n  const ", at + 10));
    expect(body, "the playground's half is not an opponent it knows").toContain(
      "playgroundRef.current",
    );
    expect(body, "it edits the server's copy instead of the board on screen").toContain("setFoe(");
  });

  it("does not spend itself on the first press", () => {
    /*
     * Half an aim is not a card played. The swap already worked this way
     * and for the same reason: a player who taps the wrong enemy card and
     * loses the thief for it has been robbed by the game.
     */
    expect(branch()).toContain("return; // still targeting — the card is not spent yet");
  });
});
