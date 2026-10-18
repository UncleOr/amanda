/**
 * **The tutorial and the game hold the same card.**
 *
 * Or, diagnosing this better than I had: *"there is no synchronisation
 * between the tutorial and what the player actually does. It is enough for
 * the player to draw another card from the deck — the tutorial does not know
 * about it and everything is out of step from there on. At any moment the
 * tutorial has to allow exactly one action, and make sure it was really
 * carried out."*
 *
 * The failure is quiet, which is why it survived three rewrites. A step
 * waits for a card on a named square; it goes one square over; the gate is
 * never met; the hand empties; the next card is dealt — and the step is now
 * waiting for a card that has left the game. Nothing throws. Amanda talks
 * about a card the player is not holding, for ever.
 *
 * `handFor` is the answer and it is DERIVED: the deck is dealt in the order
 * the script talks about it, so the Nth step that puts something down wants
 * the Nth card. A `card:` field on every step would say the same thing and
 * would start lying the first time a step moved.
 *
 * These are the properties that make it safe to derive.
 */
import { describe, expect, it } from "vitest";
import { CATALOG, ACTIONS } from "../data/catalog";
import { SCRIPTS, STAGES, handFor } from "./lessonScript";
import { STAGE_LESSONS } from "./lessons";

describe.each([1, 2, 3])("stage %i", (stage) => {
  const steps = SCRIPTS[stage]!;
  const deck = STAGE_LESSONS[stage - 1]!.deck;

  /*
   * THE CONTRACT. A step that waits for a card to be placed is unfinishable
   * unless that card is in the hand — so every one of them has to name one.
   */
  it("knows the card for every step that asks for one", () => {
    steps.forEach((step, i) => {
      if (!step.awaits) return;
      if (step.awaits.kind === "discard") return; // acts on whatever is held
      // Using an action card acts on the bar, not on the hand.
      if (step.awaits.kind === "action" && step.awaits.where !== "bar") return;
      const want = handFor(steps, i, deck);
      expect(want, `${step.id} waits for the player but no card is dealt for it`).toBeTruthy();
    });
  });

  it("only ever names a card this stage actually deals", () => {
    steps.forEach((_s, i) => {
      const want = handFor(steps, i, deck);
      if (want) expect(deck).toContain(want);
    });
  });

  /*
   * Never the same card twice. Two steps expecting one card means the second
   * will be handed something already on the board — which is how a lesson
   * ends up asking a child to place a monster that is standing right there.
   */
  it("never expects one card for two different placements", () => {
    const seen = new Map<string, string>();
    steps.forEach((step, i) => {
      const want = handFor(steps, i, deck);
      if (!want) return;
      const already = seen.get(want);
      expect(already, `${step.id} and ${already} both expect ${want}`).toBeUndefined();
      seen.set(want, step.id);
    });
  });

  it("says nothing about steps that are not about a card", () => {
    steps.forEach((step, i) => {
      if (step.awaits) return;
      expect(handFor(steps, i, deck), `${step.id} is a line, not a placement`).toBeNull();
    });
  });

  /*
   * ═══ THE BIN IS THE CASE THAT BREAKS A NAIVE COUNT ═══
   *
   * Throwing a card away and fetching it back happen TO the card the next
   * placing step is about. If those two steps advanced the count, the step
   * after them would expect the following card — and the tutorial would hand
   * back a different card from the one it had just asked the player to
   * rescue.
   */
  it("does not spend a card on throwing it away", () => {
    const bin = steps.findIndex((s) => s.awaits?.kind === "discard");
    if (bin < 0) return; // not every stage teaches the bin
    const nextPlacement = steps.findIndex((s, i) => i > bin && s.awaits?.kind === "cell");
    expect(nextPlacement, "a bin lesson with nothing to place afterwards").toBeGreaterThan(bin);
    // The card rescued from the bin is the one that then goes down.
    expect(handFor(steps, nextPlacement, deck)).toBe(deck[countBefore(steps, bin)]);
  });
});

/** How many cards the steps before `i` have put on the board. */
function countBefore(
  steps: readonly { awaits?: { kind: string; where?: string } }[],
  i: number,
): number {
  let n = 0;
  for (let k = 0; k < i; k++) {
    const a = steps[k]!.awaits;
    if (a && (a.kind === "cell" || a.kind === "king")) n++;
    else if (a && a.kind === "action" && (a as { where?: string }).where === "bar") n++;
  }
  return n;
}

describe("the decks the stages are dealt", () => {
  /*
   * Every card named must be real, and an action card must be an ACTION —
   * a step that waits for `xray` to reach the bar cannot be answered with a
   * monster, and the hand would hold something unplaceable.
   */
  it("deal real cards, of the right kind", () => {
    for (let stage = 1; stage <= STAGES; stage++) {
      const steps = SCRIPTS[stage]!;
      const deck = STAGE_LESSONS[stage - 1]!.deck;
      steps.forEach((step, i) => {
        const want = handFor(steps, i, deck);
        if (!want) return;
        if (step.awaits?.kind === "action") {
          expect(ACTIONS.has(want), `${step.id} wants ${want} in the bar, which is not an action`).toBe(true);
        } else {
          expect(CATALOG.has(want), `${step.id} wants ${want} on the board, which is not a card`).toBe(true);
        }
      });
    }
  });
});
