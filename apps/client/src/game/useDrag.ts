import { useCallback, useEffect, useRef, useState } from "react";
import { carryOf } from "./carry";
import { sfx } from "./sfx";
import { dragMix } from "./cardSound";

/**
 * Pointer-based drag for placing a card from the hand onto a board slot.
 * Uses Pointer Events so mouse and touch share one path (required for mobile).
 * The board marks drop targets with `data-drop="x-y"` / `data-drop="king"`; on
 * release we hit-test the element under the pointer and report the target.
 */
export interface DragState {
  /** The card being dragged, or null when idle. */
  cardId: string | null;
  /** Where the POINTER is. */
  x: number;
  y: number;
  /**
   * Where the CARD is, which is not the same thing.
   *
   * Or: *"while it is being dragged it moves in the user's hand in its own
   * way. If it is a heavy giant it is a bit 'harder' to carry. Fliers beat
   * their wings and pull ahead."*
   *
   * So the card chases the pointer on a spring instead of being pinned to
   * it, and the spring is tuned per card (carry.ts). A giant is late to
   * every turn and keeps swinging after you stop; a flier arrives ahead of
   * your thumb. Nothing is a special case — it is the same two numbers,
   * set differently.
   */
  cx: number;
  cy: number;
  /** How fast the card is travelling, for the tilt and the effects. */
  vx: number;
  vy: number;
  /** data-drop value currently hovered, or null. */
  over: string | null;
}

const IDLE: DragState = { cardId: null, x: 0, y: 0, cx: 0, cy: 0, vx: 0, vy: 0, over: null };
/** Pointer travel (px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 6;

function dropTargetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const host = el?.closest<HTMLElement>("[data-drop]");
  return host?.dataset.drop ?? null;
}

export function useDrag(onDrop: (cardId: string, target: string) => void) {
  const [drag, setDrag] = useState<DragState>(IDLE);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  // Pending press: we only start dragging once the pointer actually moves, so a
  // simple tap still counts as a click (opening the card details).
  const pending = useRef<{ cardId: string; x: number; y: number } | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const start = useCallback((cardId: string, e: React.PointerEvent) => {
    pending.current = { cardId, x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (p && !dragRef.current.cardId) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
        /*
         * The card starts making its own noise HERE and not in `start`,
         * because `start` is only a finger going down — a tap that opens
         * the card's details never becomes a drag, and it should not spend
         * a second sounding like one. This is the first frame at which the
         * gesture is definitely a carry.
         */
        sfx.drag(dragMix(p.cardId));
        setDrag({
          cardId: p.cardId,
          x: e.clientX,
          y: e.clientY,
          // It starts in your hand rather than flying in from wherever the
          // last drag ended.
          cx: e.clientX,
          cy: e.clientY,
          vx: 0,
          vy: 0,
          over: dropTargetAt(e.clientX, e.clientY),
        });
        return;
      }
      if (!dragRef.current.cardId) return;
      e.preventDefault();
      setDrag((d) => ({ ...d, x: e.clientX, y: e.clientY, over: dropTargetAt(e.clientX, e.clientY) }));
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      pending.current = null;
      // Unconditionally, before the early return: a pointerup with no drag
      // in progress still has to be able to silence one that got away.
      sfx.dragStop();
      if (!d.cardId) return;
      const target = dropTargetAt(e.clientX, e.clientY);
      if (target) onDropRef.current(d.cardId, target);
      setDrag(IDLE);
    };
    /*
     * The card catches up with the pointer on its own clock.
     *
     * In the pointermove handler it would only move when the finger does,
     * which is exactly wrong for the thing being built: a heavy card has to
     * keep travelling after you stop, and a flier has to settle. So the
     * spring runs every frame and the pointer only ever sets the target.
     */
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const d = dragRef.current;
      if (!d.cardId) return;
      const { pull, damp } = carryOf(d.cardId);
      const vx = (d.vx + (d.x - d.cx) * pull) * damp;
      const vy = (d.vy + (d.y - d.cy) * pull) * damp;
      // Asleep: within a pixel of the pointer and barely moving. Stopping
      // here keeps a resting drag from re-rendering sixty times a second.
      if (Math.hypot(vx, vy) < 0.08 && Math.hypot(d.x - d.cx, d.y - d.cy) < 0.6) {
        if (d.vx !== 0 || d.vy !== 0) setDrag((s2) => ({ ...s2, cx: s2.x, cy: s2.y, vx: 0, vy: 0 }));
        return;
      }
      setDrag((s2) => ({ ...s2, cx: s2.cx + vx, cy: s2.cy + vy, vx, vy }));
    };
    frame = requestAnimationFrame(tick);

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      // The hand can be unmounted mid-carry — a match ending under a finger
      // that is still down — and a loop with nothing left to stop it runs
      // for as long as the tab does.
      sfx.dragStop();
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  return { drag, start, dragging: drag.cardId !== null };
}
