/**
 * Amanda teaching you to play, the first time you build a board.
 *
 * Deliberately NOT a wall of rules. The explanatory text was just stripped out
 * of the game because a manual is not a game; this is the other half of that
 * decision — the rules get taught once, in her voice, pointing at the thing
 * being talked about, and then they are never mentioned again.
 *
 * Each step spotlights a real element by selector. If an element is not on
 * screen the step is skipped rather than pointing at nothing, so a tutorial
 * can never strand a player in front of an empty highlight.
 *
 * ═══ THE THREE THINGS OR REPORTED, AND WHAT EACH ONE WAS ═══
 *
 * *"On some screens the little panel hides the thing I need to do."* The old
 * placement picked above-or-below from the spotlight's CENTRE and then clamped
 * the result into the screen. On a 390px-tall landscape phone the clamp wins:
 * `innerHeight - 140` is 250, so a bubble meant to sit below a tall target
 * was pulled back up on top of it. It now MEASURES itself, tries each side in
 * turn, and takes the first position that does not overlap the hole.
 *
 * *"The thing I'm supposed to click isn't always circled."* When a selector
 * matched nothing the bubble appeared anyway, centred, ringing nothing, for
 * the 1.2s before the step gave up. A step with a target now waits for the
 * target: no ring, no bubble.
 *
 * *"After I click, it should move on by itself."* It only did that for the two
 * steps carrying `awaits`. Every other step sat there with a "got it" button
 * after the player had already done the thing it asked for.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface Step {
  /**
   * What to put a hole in the dimming over. Missing element → step skipped.
   *
   * Null is a line with nothing to point at — the introduction, where she is
   * talking rather than teaching. Those render centred and carry a button.
   */
  target: string | null;
  text: string;
  /**
   * When present, the step waits for the player to DO the thing and there is
   * no continue button. It is a value the parent recomputes every render, not
   * a callback: a callback captured the match state from the render that built
   * the step list, so it answered "has a King been placed?" with whatever was
   * true when the tutorial started, forever.
   */
  done?: boolean;
  /**
   * What the player has to do, as the coach named it. Carried here only so the
   * caller can turn it into `done` on every render; this component never reads
   * it — a gate frozen at the moment a step appeared is the bug it replaced.
   */
  awaits?: "king" | "placed";
  cta?: string;
}

interface Props {
  steps: Step[];
  /** This line has been read — show the next one when there is one. */
  onDone: () => void;
  /** Stop teaching altogether. */
  onQuit?: () => void;
}

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Breathing room between the ring and the bubble. */
const GAP = 14;
/** Keep the bubble off the very edge of the screen. */
const EDGE = 10;

/** Narrower than this and the words stop being readable. */
const MIN_W = 190;

/**
 * Where to put the bubble so it never covers the thing it is pointing at.
 *
 * Tried in order: below, above, then beside — and BESIDE IS ALLOWED TO MAKE
 * IT NARROWER. That last part is the whole fix. The board on a landscape
 * phone is 211x275 inside 844x390: no band above or below is tall enough for
 * a 91px bubble, but there are 368 spare pixels to its left. A bubble that
 * insists on its full 380 cannot use them, so it gives up and lands on top of
 * the thing it is describing — which is exactly what Or saw.
 */
function place(
  spot: Spot,
  bw: number,
  bh: number,
): { top: number; left: number; width?: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const centred = Math.max(EDGE, Math.min((W - bw) / 2, W - bw - EDGE));
  const below = spot.top + spot.height + GAP;
  const above = spot.top - GAP - bh;

  if (below + bh <= H - EDGE) return { top: below, left: centred };
  if (above >= EDGE) return { top: above, left: centred };

  /*
   * Beside. The height is a guess — narrowing makes the text wrap further and
   * the bubble grow — so it is re-measured on the next frame and placed again
   * from the real numbers. Vertically centred on the hole, clamped on screen.
   */
  const sideTop = Math.max(EDGE, Math.min(spot.top + spot.height / 2 - bh / 2, H - bh - EDGE));
  const roomStart = spot.left - GAP - EDGE;
  const roomEnd = W - (spot.left + spot.width) - GAP - EDGE;
  const widest = Math.max(roomStart, roomEnd);
  if (widest >= MIN_W) {
    const width = Math.min(bw, widest);
    return roomEnd >= roomStart
      ? { top: sideTop, left: spot.left + spot.width + GAP, width }
      : { top: sideTop, left: Math.max(EDGE, spot.left - GAP - width), width };
  }

  // Nothing clears it. Take the taller band and sit at its outer edge.
  const roomBelow = H - (spot.top + spot.height);
  return roomBelow >= spot.top
    ? { top: Math.max(EDGE, H - bh - EDGE), left: centred }
    : { top: EDGE, left: centred };
}

export function Tutorial({ steps, onDone, onQuit }: Props) {
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [box, setBox] = useState<{ top: number; left: number; width?: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = steps[i];

  const next = useCallback(() => {
    setSpot(null);
    setBox(null);
    if (i + 1 >= steps.length) onDone();
    else setI(i + 1);
  }, [i, steps.length, onDone]);

  // Follow the target: the board resizes with the window, and a highlight that
  // remembers where something used to be is worse than none.
  useLayoutEffect(() => {
    if (!step?.target) return;
    const selector = step.target;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setSpot((was) => (was === null ? was : null));
        return;
      }
      const b = el.getBoundingClientRect();
      // Only publish a change. Setting a fresh object every frame re-rendered
      // the whole overlay sixty times a second for no reason.
      setSpot((was) =>
        was && was.top === b.top && was.left === b.left && was.width === b.width && was.height === b.height
          ? was
          : { top: b.top, left: b.left, width: b.width, height: b.height },
      );
    };
    const loop = () => {
      measure();
      raf = window.requestAnimationFrame(loop);
    };
    loop();
    return () => window.cancelAnimationFrame(raf);
  }, [step]);

  // Place the bubble once it and the hole have both been measured.
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el || !spot) return;
    const r = el.getBoundingClientRect();
    const at = place(spot, r.width, r.height);
    setBox((was) =>
      was && was.top === at.top && was.left === at.left && was.width === at.width ? was : at,
    );
  }, [spot, step]);

  /*
   * ═══ DOING THE THING IS THE ANSWER ═══
   *
   * Or: *"after I click, the panel should move on by itself, without me
   * pressing 'got it'."* Being told to tap something, tapping it, and then
   * being asked to confirm that you were told is the shape of a form, not of
   * a game.
   *
   * `pointerup` rather than `pointerdown` so the app's own handler has run and
   * the board has already changed by the time she moves on. A step carrying
   * `awaits` is left alone: it is waiting for an OUTCOME, and a tap on the
   * board that places nothing must not count as having placed something.
   */
  useEffect(() => {
    if (!step?.target || step.awaits) return;
    const selector = step.target;
    const onUp = (e: PointerEvent) => {
      const el = document.querySelector(selector);
      if (el && e.target instanceof Node && el.contains(e.target)) next();
    };
    document.addEventListener("pointerup", onUp, true);
    return () => document.removeEventListener("pointerup", onUp, true);
  }, [step, next]);

  // A step whose target never appears would be a dead end, so move past it.
  useEffect(() => {
    if (!step?.target) return;
    const selector = step.target;
    const t = window.setTimeout(() => {
      if (!document.querySelector(selector)) next();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [step, i, next]);

  // Steps that wait for the player to actually do the thing.
  useEffect(() => {
    if (step?.done) next();
  }, [step?.done, i, next]);

  if (!step) return null;

  /*
   * A pointing step does not speak until it can point. The ring and the words
   * arrive together or not at all — which is the whole of "the thing I'm
   * supposed to click isn't always circled".
   */
  const pointing = step.target !== null;
  if (pointing && (!spot || !box)) {
    return (
      <div className="tut" role="dialog" aria-live="polite">
        {/* Measured off-screen so the placement above has real numbers to work
            with on the very first frame rather than a guess. */}
        <div className="tut__bubble tut__bubble--measuring" ref={bubbleRef} aria-hidden="true">
          <p className="tut__text">{step.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tut" role="dialog" aria-live="polite">
      {spot && (
        <div
          className="tut__spot"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}
      <div
        className={`tut__bubble${pointing ? " tut__bubble--at" : " tut__bubble--mid"}`}
        ref={bubbleRef}
        style={
          pointing && box
            ? { top: box.top, left: box.left, ...(box.width ? { width: box.width } : {}) }
            : undefined
        }
      >
        <p className="tut__text">{step.text}</p>
        <div className="tut__row">
          {steps.length > 1 && (
            <span className="tut__dots">
              {steps.map((_, n) => (
                <i key={n} className={n === i ? "is-now" : undefined} />
              ))}
            </span>
          )}
          {/* No button on a step that is waiting for the player to act: she
              has asked for something, and the doing of it is the answer. */}
          {step.done === undefined && (!pointing || step.cta !== undefined) && (
            <button className="btn-fight" onClick={next}>
              {step.cta ?? "הבנתי"}
            </button>
          )}
          <button className="btn-link tut__skip" onClick={onQuit ?? onDone}>
            אני יודע לשחק
          </button>
        </div>
      </div>
    </div>
  );
}
