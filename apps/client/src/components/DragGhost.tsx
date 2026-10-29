import type { DragFx } from "@amanda/shared";
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
 * without anybody writing a keyframe for it.
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
 *
 * ═══ AND THE EFFECT IS NOT THE CARRY ═══
 *
 * It used to be: `carry.style` chose both how the card moved and what came
 * off it. Or asked for them as two separate choices, so the furniture is
 * keyed on `fxOf` now (game/dragFx.ts) and the ghost carries both classes.
 */

/**
 * The effects that are simply N identical pieces, drawn over the card.
 *
 * Sixteen of these as sixteen hand-written blocks would be the thing this
 * file was extracted to avoid. The four below the table are the ones that
 * genuinely are not alike: wings go BEHIND the card, lightning is three
 * layers at once, and the two that tear at the ground share the dust.
 */
const PIECES: Partial<Record<DragFx, [cls: string, count: number]>> = {
  drips: ["drag-ghost__drip", 5],
  embers: ["drag-ghost__ember", 5],
  bubbles: ["drag-ghost__bubble", 5],
  frost: ["drag-ghost__frost", 4],
  leaves: ["drag-ghost__leaf", 4],
  smoke: ["drag-ghost__smoke", 3],
  gears: ["drag-ghost__gear", 3],
  fluff: ["drag-ghost__fluff", 5],
  venom: ["drag-ghost__venom", 3],
  stars: ["drag-ghost__star", 4],
  sand: ["drag-ghost__sand", 6],
};

function Pieces({ fx }: { fx: DragFx }) {
  const piece = PIECES[fx];
  if (!piece) return null;
  const [cls, count] = piece;
  return (
    <span className={cls} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function DragGhost({ drag }: { drag: DragState }) {
  if (!drag.cardId) return null;

  const carry = carryOf(drag.cardId);
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
      {/*
        Jelly, for anything with no bones in it — Or: *"jelly/slime
        splatter"* — and the ten he asked for afterwards. A blob stretches,
        lets go and falls, which is the one thing that says a thing is WET
        rather than merely green; the other ten are in board.css beside it.
      */}
      <Pieces fx={fx} />
    </div>
  );
}
