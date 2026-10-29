/**
 * ═══ WHAT COMES OFF A CARD WHILE IT IS IN THE AIR ═══
 *
 * Or: *"let me choose, for every monster… a drag animation out of a list of
 * animations"* — a separate question from how it moves, which is why this is
 * a separate file.
 *
 * It was not separate. `carryOf().style` decided both, so a card could not be
 * heavy without shedding stones and could not shed stones without being
 * heavy. Nobody noticed because the two always agreed — the derivation
 * produced them together — and they only stop agreeing the moment somebody is
 * allowed to choose, which is what Or just asked for.
 *
 * So: the default is still the pairing that always held (a flier gets wings,
 * a slime drips), and it is read off the EFFECTIVE carry rather than the
 * derived one — pick "heavy" for a card and the stones follow it, unless you
 * also pick otherwise. One choice should not need a second choice to look
 * right.
 */
import type { CarryStyle, DragFx } from "@amanda/shared";
import { carryOf } from "./carry";
import { cardFor } from "./preview";

/** The pairing that held before anyone could choose, kept as the default. */
export const FX_FOR_STYLE: Record<CarryStyle, DragFx> = {
  steady: "none",
  heavy: "rubble",
  flutter: "wings",
  soar: "wingsBig",
  spark: "lightning",
  ooze: "drips",
  root: "soil",
};

/** What this card throws off: what Or chose, or what its carry implies. */
export function fxOf(cardId: string): DragFx {
  return cardFor(cardId)?.drag?.fx ?? FX_FOR_STYLE[carryOf(cardId).style];
}
