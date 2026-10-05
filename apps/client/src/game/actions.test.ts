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
    "recycleDiscard",
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
    for (const id of ["energy_boost", "xray", "recycle_bin"]) {
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

  it("holds 14 playable action cards, not 5", () => {
    expect(ACTIVE_ACTIONS.length).toBe(14);
  });

  /**
   * Freezing someone at the buzzer would end their build with nothing they
   * could do about it, so the card has to go dead before then — and with
   * enough room left that the freeze cannot run past the final whistle.
   */
  it("frozen hands leaves the victim time to recover", () => {
    const a = ACTIONS.get("frozen_hands")!;
    const freeze = Number(a.params!.seconds);
    const window = Number(a.params!.minBuildSecondsLeft);
    expect(freeze).toBeGreaterThan(0);
    expect(window).toBeGreaterThan(freeze);
  });

  it("frozen hands is played at the opponent, not at a cell", () => {
    expect(isTargetedAction("frozen_hands")).toBe(false);
  });
});
