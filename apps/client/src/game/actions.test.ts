import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  ACTIVE_ACTIONS,
  PASSIVE_ACTIONS,
  TARGET_EFFECTS,
  isEnemyTargeted,
  isTargetedAction,
} from "../data/catalog";

/**
 * Nine action cards shipped with art, a name and a description but no
 * gameplay at all — they never even entered a deck. These hold the wiring in
 * place: every card that is live has an effect the match loop knows about.
 */
describe("action cards", () => {
  const EFFECTS = new Set([
    "boardPowerBuff",
    "revealBoard",
    "shuffleEnemyFrontRow",
    "upgradeCardTemp",
    "removeCard",
    "freezeEnemy",
    "blockNextActionCard",
    "draw",
    "enableStacking",
    "autoStackCorners",
    "swapOwnCards",
    "eraseEnemyCard",
    "freezeOpponentPlacing",
    "fillBoard",
  ]);

  it("every live action card exists in the data", () => {
    for (const id of [...ACTIVE_ACTIONS, ...PASSIVE_ACTIONS]) {
      expect(ACTIONS.has(id), `${id} missing from action-cards.json`).toBe(true);
    }
  });

  it("every live action card has an effect the game implements", () => {
    for (const id of ACTIVE_ACTIONS) {
      const effect = ACTIONS.get(id)!.effect;
      expect(EFFECTS.has(effect), `${id} has unimplemented effect "${effect}"`).toBe(true);
    }
  });

  it("the cards that need a target are marked as needing one", () => {
    const needsTarget = ["full_refuel", "recall_card", "swap_places", "radioactive_eraser"];
    for (const id of needsTarget) expect(isTargetedAction(id), id).toBe(true);
    for (const id of ["energy_boost", "xray", "time_freeze"]) {
      expect(isTargetedAction(id), id).toBe(false);
    }
    expect(isEnemyTargeted("radioactive_eraser")).toBe(true);
    expect(isEnemyTargeted("full_refuel")).toBe(false);
  });

  /**
   * "Ground floor" was marked as targeted while its effect was only handled on
   * the immediate path, so asking for a target threw its four stacking slots
   * away. Asking for a target is now derived from the effect, and this keeps it
   * that way.
   */
  it("asks for a target only where the effect can use one", () => {
    for (const id of ACTIVE_ACTIONS) {
      const effect = ACTIONS.get(id)!.effect;
      expect(isTargetedAction(id), `${id} (${effect})`).toBe(effect in TARGET_EFFECTS);
    }
  });

  it("the stacking cards act immediately, without a target", () => {
    for (const id of ["ground_floor", "dark_corners"]) {
      expect(isTargetedAction(id), id).toBe(false);
    }
  });

  /*
   * Ten now, and every one that has gone has gone on purpose — which is the
   * only reason to pin a number at all.
   *
   * The recycle bin went first: every player already has one take-back a
   * match without spending a card on it, so the card's whole effect was
   * "the rule you already have, again".
   *
   * Then three more, when Or read the copy document and could not picture
   * the moment any of them happens — *"I can't see how this card happens,
   * let's drop it"* for `triple_draw` and `steel_wall`, and *"we already
   * have one of these"* for `frozen_hands`, which is `time_freeze` twice.
   *
   * The pin is what made this a decision instead of a surprise: dropping
   * them from the data broke this line, which is exactly what it is for.
   */
  it("holds 10 playable action cards, not 5", () => {
    expect(ACTIVE_ACTIONS.length).toBe(10);
  });

  /**
   * ═══ THE SAME RULE, NOW ON THE CARD THAT KEPT IT ═══
   *
   * Freezing someone at the buzzer would end their build with nothing they
   * could do about it, so the card has to go dead before then — and with
   * enough room left that the freeze cannot run past the final whistle.
   *
   * This used to test `frozen_hands`, which Or dropped as a duplicate of
   * `time_freeze`. The rule it protects is not about the card that was
   * dropped, so it moves to the one that stayed rather than going with it:
   * a test deleted alongside its subject takes a real rule with it.
   */
  it("a freeze leaves the victim time to recover", () => {
    const a = ACTIONS.get("time_freeze")!;
    const freeze = Number(a.params!.seconds);
    /*
     * The window the GAME uses, not the one the card happens to carry.
     *
     * `frozen_hands` wrote its own `minBuildSecondsLeft`; `time_freeze`
     * does not and falls back to the 10 in useMatch.ts. Asserting the
     * card's field passed only by accident of which card was being read —
     * this asserts the rule, which is the thing that protects the player.
     */
    const DEFAULT_WINDOW = 10;
    const window = Number(a.params?.minBuildSecondsLeft ?? DEFAULT_WINDOW);
    expect(freeze).toBeGreaterThan(0);
    expect(window).toBeGreaterThan(freeze);
  });

  it("a freeze is played at the opponent, not at a cell", () => {
    expect(isTargetedAction("time_freeze")).toBe(false);
  });
});
