import { createPortal } from "react-dom";
import type { MouseEventHandler, ReactNode } from "react";

/**
 * The dark sheet a modal sits on — rendered at the end of `document.body`,
 * never where it was written.
 *
 * ═══ WHY IT CANNOT STAY WHERE IT IS WRITTEN ═══
 *
 * Or: *"the arena opens behind other things and you cannot see it."* He was
 * right, and it was not a z-index that needed one more point.
 *
 * `.modal-overlay` is `position: fixed; inset: 0; z-index: 50` — correct, and
 * both halves of it were being taken away by an ancestor. The arena ladder is
 * written inside the progress panel, and that panel has
 * `backdrop-filter: blur(5px)` on it for the frosted-glass look. A backdrop
 * filter does two things the CSS here never asked for:
 *
 *   it becomes the CONTAINING BLOCK for fixed descendants, so `inset: 0`
 *     stopped meaning the screen and started meaning that panel — the sheet
 *     came out 814x70 in the middle of the home screen instead of covering
 *     the window, and the ladder hung out of it, half of it off the bottom;
 *
 *   it opens a STACKING CONTEXT, so `z-index: 50` stopped being measured
 *     against the page and started being measured against the panel's
 *     siblings — and the panel itself is `z-index: auto`, which loses to the
 *     play cards at 3. Hence "behind other things".
 *
 * Nothing about that is specific to the arena. Any modal written inside any
 * blurred, transformed or filtered box has the same two things done to it,
 * silently, and the symptom is always "the z-index does not work". Chasing it
 * by deleting the blur would fix this one and leave the trap armed.
 *
 * A portal takes the sheet out of the tree it was written in and puts it at
 * the end of the body, where there is no ancestor left to capture it. The
 * component keeps rendering it exactly where it makes sense to READ it.
 */
export function Overlay({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}) {
  return createPortal(
    <div className={`modal-overlay ${className}`.trim()} onClick={onClick}>
      {children}
    </div>,
    document.body,
  );
}
