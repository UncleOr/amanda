import type { DragState } from "../game/useDrag";
import { carryOf } from "../game/carry";
import { fxOf } from "../game/dragFx";
import { ACTIONS } from "../data/catalog";
import { ActionCardView } from "./ActionCardView";
import { CardView } from "./CardView";

/**
 * ═══ THE CARD IN YOUR HAND ═══
 *
 * Or: *"while it is being dragged it moves in the user's hand in its
 * own way. If it is a heavy giant it is a bit 'harder' to carry.
 * Fliers beat their wings and pull ahead. Chuppy gives off a current
 * and 'electrifies'."*
 *
 * It follows the CARD, not the pointer — they are different places now
 * (useDrag), and the gap between them is the whole effect. The tilt is
 * the direction it is travelling, so a card thrown left leans left
 * without anybody writing a keyframe for it, and the class is what
 * gives the fliers their wingbeat and the electric ones their crackle.
 *
 * ═══ WHY THIS IS A COMPONENT AND NOT STILL IN App.tsx ═══
 *
 * Or: *"let me also see the card in the panel and hear its voice, and maybe
 * drag it and see how it looks."* The panel has to show the carry, and a
 * second copy of these hundred lines would be a workbench that drifts from
 * the game — which is worse than no workbench, because it is believed. The
 * arena preview had exactly that bug a week ago with its hand-typed list of
 * five families.
 *
 * So there is one of these, App.tsx renders it over the board and the card
 * editor renders it over its own little stage, and neither of them knows
 * what a flier looks like.
 */
export function DragGhost({ drag }: { drag: DragState }) {
  if (!drag.cardId) return null;

  const carry = carryOf(drag.cardId);
  /*
   * How it MOVES and what it THROWS OFF are two questions now — Or asked to
   * choose them separately per card (dragFx.ts). They agree unless somebody
   * said otherwise, so every card that looked right still does.
   */
  const fx = fxOf(drag.cardId);
  // It leans into its own movement, and a flier runs ahead of your
  // thumb rather than trailing it.
  const lean = Math.max(-carry.tilt, Math.min(carry.tilt, drag.vx * 1.6));
  return (
    <div
      className={`drag-ghost drag-ghost--${carry.style} drag-ghost--fx-${fx}`}
      style={{
        left: drag.cx + drag.vx * carry.lead,
        top: drag.cy + drag.vy * carry.lead,
        ["--lean" as string]: `${lean}deg`,
      }}
    >
      {/*
        The wings go BEFORE the card in the DOM so the card paints
        over their hinges — they grow out from behind it rather than
        being stuck on the front of it.
      */}
      {(fx === "wings" || fx === "wingsBig") && (
        <span className="drag-ghost__wings" aria-hidden="true">
          <i />
          <i />
        </span>
      )}
      {/* An action card is not a monster and does not draw like one. */}
      {ACTIONS.has(drag.cardId) ? (
        <ActionCardView actionId={drag.cardId} size="medium" />
      ) : (
        <CardView cardId={drag.cardId} size="medium" />
      )}
      {fx === "lightning" && (
        <>
          <span className="drag-ghost__arc" aria-hidden="true">
            <i />
            <i />
          </span>
          {/*
            ═══ AND ACTUAL LIGHTNING ═══

            Or's list of what a drag should throw off names
            *"lightning"* on its own, beside the wings and the
            gravel. What was here was a CURRENT — two rings running
            around the card — which is the other thing he asked for
            and is not this. A current is continuous and a bolt is
            an event, and the difference is the whole of why he
            listed them separately.

            Three of them, on different clocks, each struck for
            about a tenth of a second and gone. The zigzag is a
            clip-path rather than an image: a bolt is a shape, and
            a shape that the compositor can draw costs nothing.
          */}
          <span className="drag-ghost__bolt" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="drag-ghost__spark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </>
      )}
      {/*
        Jelly, for anything with no bones in it. Or: *"jelly/slime
        splatter"*. Five drips on their own clocks, leaving from
        different points along the bottom edge — a blob stretches,
        lets go and falls, which is the one thing that says a thing
        is WET rather than merely green.
      */}
      {fx === "drips" && (
        <span className="drag-ghost__drip" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {/*
        And earth, for anything being pulled out of the ground. Or:
        *"flying earth"* — which belongs to the card that RESISTS,
        because the thing that throws soil is something coming up by
        the roots rather than something walking about on it.
      */}
      {fx === "soil" && (
        <>
          <span className="drag-ghost__soil" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="drag-ghost__dust" aria-hidden="true" />
        </>
      )}
      {fx === "rubble" && (
        <>
          <span className="drag-ghost__rubble" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="drag-ghost__dust" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
