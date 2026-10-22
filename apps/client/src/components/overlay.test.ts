/**
 * **One click closes one sheet.**
 *
 * Or: *"watch out for an annoying bug — if I opened an item in the shop and
 * then clicked outside the item, it takes me back to the main menu instead
 * of back to the shop."*
 *
 * The item's sheet and the shop's sheet both closed on the one click. They
 * look unrelated in the DOM — every Overlay is portalled to the end of the
 * body, so they are siblings there — but React dispatches a portal's events
 * up the tree the portal was WRITTEN in, and the item is written inside the
 * shop. So the shop's backdrop handler ran as well.
 *
 * ═══ WHY THIS TEST IS A LOOP AND NOT A RENDER ═══
 *
 * There is no jsdom in this project on purpose, so nothing here can mount a
 * component and click it. What can be tested is the RULE, and the rule is
 * the whole bug: a backdrop handler must stop the event before passing it
 * on. `bubble` below is React's dispatch in four lines — handlers from the
 * innermost outwards, stopping when one says stop — and it is the only part
 * of React's behaviour this depends on.
 */
import { describe, expect, it } from "vitest";
import { sheetClick } from "./Overlay";

/**
 * Dispatch a click through handlers, innermost first, the way React does it
 * for a portal: up the tree it was written in, until something stops it.
 */
function bubble(handlers: Array<(e: never) => void>): void {
  let stopped = false;
  // A click event with only the part any of this depends on.
  const event = {
    stopPropagation() {
      stopped = true;
    },
  } as never;
  for (const handle of handlers) {
    if (stopped) return;
    handle(event);
  }
}

describe("a backdrop click", () => {
  it("closes the sheet it was aimed at", () => {
    let closed = false;
    bubble([sheetClick(() => (closed = true))]);
    expect(closed).toBe(true);
  });

  it("does not also close the sheet underneath", () => {
    // The shop and the item it opened. The click lands on the item's
    // backdrop, which is "take me back to the shop" and nothing more.
    const shut: string[] = [];
    bubble([sheetClick(() => shut.push("item")), sheetClick(() => shut.push("shop"))]);
    expect(shut).toEqual(["item"]);
  });

  it("stops the click even when the sheet does nothing with it", () => {
    // An Overlay with no onClick at all — a sheet you cannot dismiss by
    // tapping outside — must still not be a hole through to the one below.
    const shut: string[] = [];
    bubble([sheetClick(undefined), sheetClick(() => shut.push("shop"))]);
    expect(shut).toEqual([]);
  });

  it("is three sheets deep and still closes one", () => {
    // The album opens a card, the card opens the elements table.
    const shut: string[] = [];
    bubble([
      sheetClick(() => shut.push("table")),
      sheetClick(() => shut.push("card")),
      sheetClick(() => shut.push("album")),
    ]);
    expect(shut).toEqual(["table"]);
  });
});
