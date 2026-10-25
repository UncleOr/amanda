/**
 * **An action card is dragged to the bar, not only pressed into it.**
 *
 * Or: *"besides that, action cards need dragging too — you drag them to the
 * bar."*
 *
 * Monsters have been dragged onto the board since the drag existed; an
 * action card was the one thing in the hand you could only ever press a
 * button for. The drag system already took whatever `data-drop` it landed
 * on, so this is four small joins rather than a second drag — and four
 * small joins across three files is exactly the shape of thing that rots
 * quietly, because any one of them going missing leaves a gesture that
 * simply does nothing.
 *
 * Read out of the source, because there is no DOM here to drag in.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
const DRAG = readFileSync(fileURLToPath(new URL("./useDrag.ts", import.meta.url)), "utf8");

describe("dragging an action card to the bar", () => {
  it("makes the bar a drop target, and only when it can take one", () => {
    expect(APP, "the panel carries the target").toContain('data-drop={m.handIsAction');
    // A full bar that still lights up is a promise the drop cannot keep.
    expect(APP).toContain("!m.barFull ? \"actionbar\" : undefined");
  });

  it("picks the card up from the hand", () => {
    // `<ActionCardView />` is self-closing, so the slice ends at the div
    // that holds it rather than at a closing tag that does not exist.
    const at = APP.indexOf("className={`action-hand");
    const hand = APP.slice(at, APP.indexOf("</div>", at));
    expect(hand, "a press on the action card starts a drag").toContain("startDrag(m.hand!, e)");
  });

  it("plays it into the bar on the drop", () => {
    const drop = APP.slice(APP.indexOf("useDrag((_cardId, target)"));
    expect(drop.slice(0, 400)).toContain('target === "actionbar"');
    expect(drop.slice(0, 400)).toContain("m.takeAction()");
  });

  it("draws the thing being carried as an action card", () => {
    // `.card` and an action chip are different components; the ghost drew
    // every dragged id as a monster, which for an action card is a blank.
    expect(APP).toContain("ACTIONS.has(drag.cardId)");
    expect(APP).toContain("<ActionCardView actionId={drag.cardId}");
  });

  it("still resolves a target from whatever is under the pointer", () => {
    // The one thing that must not change: the drag stays generic. A second
    // code path for action cards is how the two drift apart.
    expect(DRAG).toContain('closest<HTMLElement>("[data-drop]")');
  });
});
