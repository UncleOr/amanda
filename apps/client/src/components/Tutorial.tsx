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
import type { Awaits } from "../game/coach";
import { line as t } from "../game/copy";

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
   * Wait for the target however long it takes, instead of skipping the step.
   * Set on the steps of a WRITTEN lesson — see the give-up effect below.
   */
  patient?: boolean;
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
  awaits?: Awaits;
  /**
   * The highlighted thing IS the action — press it, and that is the step.
   *
   * No continue button on these: `l1-go` and `l2-go` light up the fight
   * button, and a "next" beside it would end the tutorial on a board that
   * never fought. See lessonScript.ts.
   */
  press?: "target";
  cta?: string;
}

interface Props {
  steps: Step[];
  /** This line has been read — show the next one when there is one. */
  onDone: () => void;
  /** Stop teaching altogether. */
  onQuit?: () => void;
}

export interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Breathing room between the ring and the bubble. */
const GAP = 14;
/** Keep the bubble off the very edge of the screen. */
const EDGE = 10;

/**
 * The highest the bubble may go, which is NOT the top of the screen.
 *
 * ═══ "PART OF THE TUTORIAL IS HIDDEN" ═══
 *
 * Or sent a photograph of it: the bubble's first line cut in half, with the
 * app's top bar and the phone's status bar across it.
 *
 * `.tut` is `position: fixed; inset: 0`, so it is measured against the
 * VIEWPORT — while everything else in the app sits inside a wrapper padded by
 * `env(safe-area-inset-*)`. On a desktop browser those insets are zero and
 * the two agree. In the Android WebView they do not: the status bar is real,
 * the top bar sits below it, and a bubble at `top: 10` is underneath both.
 *
 * Reproduced at 832x384 on the step that lights up both albums: the board
 * fills the screen, so no band above or below it is tall enough, and the
 * last-resort branch put the bubble at `top: EDGE` — over the bar, and over
 * the very thing it was pointing at.
 *
 * Measuring the bar is better than a constant: it is the same answer whether
 * there is a safe-area inset, whether the bar is on this screen at all, and
 * whatever the bar's height turns out to be next month.
 */
function topLimit(): number {
  const bar = document.querySelector(".topbar");
  if (!bar) return EDGE;
  const b = bar.getBoundingClientRect();
  // A bar that is scrolled away or not rendered should not reserve anything.
  return b.height > 0 && b.bottom > 0 ? Math.max(EDGE, b.bottom + GAP) : EDGE;
}

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
export function place(
  spot: Spot,
  bw: number,
  bh: number,
): { top: number; left: number; width?: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const TOP = topLimit();
  const centred = Math.max(EDGE, Math.min((W - bw) / 2, W - bw - EDGE));
  const below = spot.top + spot.height + GAP;
  const above = spot.top - GAP - bh;

  if (below + bh <= H - EDGE) return { top: below, left: centred };
  if (above >= TOP) return { top: above, left: centred };

  /*
   * Beside. The height is a guess — narrowing makes the text wrap further and
   * the bubble grow — so it is re-measured on the next frame and placed again
   * from the real numbers. Vertically centred on the hole, clamped on screen.
   */
  const sideTop = Math.max(TOP, Math.min(spot.top + spot.height / 2 - bh / 2, H - bh - EDGE));
  const roomStart = spot.left - GAP - EDGE;
  const roomEnd = W - (spot.left + spot.width) - GAP - EDGE;
  const widest = Math.max(roomStart, roomEnd);
  if (widest >= MIN_W) {
    const width = Math.min(bw, widest);
    return roomEnd >= roomStart
      ? { top: sideTop, left: spot.left + spot.width + GAP, width }
      : { top: sideTop, left: Math.max(EDGE, spot.left - GAP - width), width };
  }

  /*
   * Nothing clears it: the target is most of the screen, which happens on the
   * step that lights up both albums at once.
   *
   * Take the taller band and sit at its outer edge — and clamp into the space
   * that is actually visible, between the top bar and the bottom of the
   * screen. Overlapping a board that fills the screen is unavoidable and
   * fine; being underneath the status bar is what Or photographed. If the
   * bubble is taller than that space it scrolls (see .tut__bubble in
   * album.css) rather than losing its first line off the top.
   */
  const roomBelow = H - (spot.top + spot.height);
  const lowest = Math.max(TOP, H - bh - EDGE);
  return roomBelow >= spot.top
    ? { top: lowest, left: centred }
    : { top: TOP, left: centred };
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

      /*
       * ═══ AND THE BUBBLE, IN THE SAME LOOP ═══
       *
       * Placing it in an effect of its own measured it ONCE — and the number
       * it measured was the height the bubble had before `place` narrowed it
       * to fit beside the hole, after which the text wrapped onto more lines
       * and it grew back down over the thing it was pointing at.
       *
       * Measured on the action-card drawer at 844x390: placed at y=277 from
       * a 48px bubble that ended up 73, covering 29% of a 698x34 target —
       * and the 29% in the middle, which is where a thumb goes. Which is Or's
       * oldest complaint about this overlay in its last hiding place: *"on
       * some screens the little panel hides the thing I need to do."*
       *
       * A ResizeObserver was the obvious fix and it did not work; this loop
       * is already running every frame to follow the target, it already has
       * the live rect, and it already publishes only real changes. One
       * instrument instead of two, and the height it uses cannot be stale by
       * more than a frame.
       */
      const bub = bubbleRef.current;
      if (bub) {
        const r = bub.getBoundingClientRect();
        if (r.height > 0) {
          const at = place({ top: b.top, left: b.left, width: b.width, height: b.height }, r.width, r.height);
          setBox((was) =>
            was && was.top === at.top && was.left === at.left && was.width === at.width ? was : at,
          );
        }
      }
    };
    const loop = () => {
      measure();
      raf = window.requestAnimationFrame(loop);
    };
    loop();
    return () => window.cancelAnimationFrame(raf);
  }, [step]);

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

  /*
   * A step whose target never appears would be a dead end, so move past it.
   *
   * ═══ EXCEPT A WRITTEN ONE ═══
   *
   * That give-up is right for the RULES: "a dragon? put it at the back" has
   * to be skippable, because you cannot make somebody draw a dragon.
   *
   * It is wrong for a script. Every step of the second lesson is meant to
   * happen, and the first 1.2 seconds of a match is exactly when the board
   * has not been painted yet — so the opening two lines were spoken to a
   * screen with no board on it, skipped, and marked as said. From outside:
   * Amanda opened the lesson with "x-ray, an action card that breaks that
   * rule", with no rule ever mentioned.
   *
   * A patient step waits. If its square genuinely never arrives it holds,
   * which is visible and fixable, rather than silently eating a line.
   */
  useEffect(() => {
    if (!step?.target || step.patient) return;
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
    <div
      className={`tut${pointing ? "" : " tut--talking"}`}
      role="dialog"
      aria-live="polite"
      /*
       * Tapping anywhere still works on a line with nothing to point at. It
       * is no longer the ONLY way out of one — there is a real button now —
       * but a child who taps the screen because the screen is what you tap
       * should not be ignored.
       */
      onClick={pointing ? undefined : next}
    >
      {spot && (
        <>
          {/*
            ═══ ONLY THE LIT THING IS PRESSABLE ═══

            Or: *"the tutorial still isn't smooth. There are screens where it
            isn't clear what to press. You can also click on things outside
            the screen."*

            The dimming here is a box-shadow with a 9999px spread — it is a
            PICTURE of everything being switched off, and nothing more.
            `.tut` is `pointer-events: none` so that the board underneath can
            be touched, which is the whole point of a pointing step; the
            consequence nobody followed through is that the other 95% of the
            screen was touchable too. A child being shown where to put a card
            could open the shop, leave the match, or change the language, and
            the tutorial would carry on talking about the board.

            So the hole is cut for real: four panels around it, each one
            swallowing what lands on it. The dim already tells you where you
            may press; now it is true.

            Four rectangles rather than one clip-path, because the hole has
            rounded corners in the picture and square ones in the maths, and
            a child aiming at the corner of a card should not find a dead
            pixel where the radius was.
          */}
          <div className="tut__wall" onClick={(e) => e.stopPropagation()}>
            <i style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }} />
            <i style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
            <i style={{ top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }} />
            <i
              style={{
                top: spot.top,
                left: spot.left + spot.width,
                right: 0,
                height: spot.height,
              }}
            />
          </div>
          <div
            className="tut__spot"
            style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          />
        </>
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
          {/*
            ═══ ONE THING TO PRESS, ON EVERY SINGLE STEP ═══

            Or: *"there are a lot of places in the tutorial where you're just
            left hanging and it isn't clear what to do, and cards keep
            arriving. Every single step of the tutorial has to be guided, with
            ONE thing to press. Either 'next', or doing something real on the
            board."* And, on a step explaining what the King is worth: *"here
            — you told me what to do but I have no 'next' button (in the first
            bubbles either), so that's a problem."*

            ═══ WHY THERE WASN'T ONE ═══

            There used to be a "got it" button on every step, and Or asked for
            it to go: *"there shouldn't be a 'got it' button at all... the taps
            should just be Amanda telling you which card to put down next."*
            Removing it was right for the steps he was describing — the ones
            that ask you to place a card, where doing it IS the answer and
            confirming afterwards is the shape of a form.

            It was wrong for every other step, and that is most of them. A
            step that just EXPLAINS something — the King is worth triple, the
            fog is why you cannot see their board, these two squares are the
            guard posts — has nothing to do and no button, and advanced only
            if you happened to tap the thing being talked about. Nothing said
            so. Fifteen of the thirty-one steps across the two lessons are
            like that.

            So the rule is now exactly the one Or stated, and it is the thing
            `awaits` already distinguishes:

              a step WAITING for a board action  → no button. Do the thing.
              every other step                   → a real "next" button.

            tutorialFlow.test.ts holds both halves, so a step added later
            cannot land in between and strand somebody.
          */}
          {!step.awaits && step.press !== "target" && (
            <button className="btn-fight tut__next" onClick={next}>
              {step.cta ?? t("sbecf213", "המשך ←")}
            </button>
          )}
          <button className="btn-link tut__skip" onClick={onQuit ?? onDone}>
            {t("s7955b5e", "אני יודע לשחק")}
          </button>
        </div>
      </div>
    </div>
  );
}
