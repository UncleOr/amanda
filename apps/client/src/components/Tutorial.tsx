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
}

export interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * ═══ THERE IS NO PLACEMENT ANY MORE ═══
 *
 * What used to live here was `place()`: seventy lines that tried to find
 * somewhere for the bubble which was not the thing the bubble was pointing
 * at. Below, above, beside-and-narrower, and then a last branch whose own
 * comment admitted the game was lost —
 *
 *     Overlapping a board that fills the screen is unavoidable and fine.
 *
 * It is not fine, and Or photographed it three times. But the function was
 * not wrong; the question was. A bubble floating over a screen that was laid
 * out for somebody who already knows the game has to find a gap, and on a
 * 832x384 landscape phone there often is no gap. Every fix I shipped was a
 * fix to one branch of a function that sometimes has no right answer.
 *
 * Or: *"maybe it is worth rethinking the whole approach. Not hiding an
 * existing board, but building a new board where only what you can click
 * appears."*
 *
 * So the bubble has a reserved band of its own at the foot of the screen,
 * and `.app--teaching` gives up exactly that much height while a lesson is
 * running (album.css). They cannot overlap because they are not in the same
 * space — which is a property of the layout rather than an outcome of a
 * calculation, and so it cannot be wrong on a screen size nobody tried.
 *
 * The spotlight stays. Where to press is still worth saying; it just no
 * longer has to be said in a place the words then have to dodge.
 */
export function Tutorial({ steps, onDone }: Props) {
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const step = steps[i];

  const next = useCallback(() => {
    setSpot(null);
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
      /*
       * ═══ ALL OF THEM, NOT THE FIRST OF THEM ═══
       *
       * Or, on the step that explains the series bonus: *"here you need to
       * light all three cards together so it is clear."*
       *
       * This used `querySelector`, which answers with the first match and
       * nothing else. The step points at `.slot--synergy` — the engine's
       * own mark on every card in a lit group — so Amanda said "see the
       * glow around THEM" and ringed one card.
       *
       * The same silence anywhere a step names more than one square: the two
       * crumb corners in stage two, the whole back row in the old lesson
       * two. Each of them has been ringing one square and describing
       * several since they were written.
       *
       * The ring is the union of everything the selector finds. For a
       * single match that is the match, which is every other step.
       */
      /*
       * ═══ A DIALOG IS THE ONLY THING ON THE SCREEN ═══
       *
       * Or, with a photograph of the ring drawn across an open card panel:
       * *"this is not good either."*
       *
       * Tapping an action card opens its detail panel, where the full-size
       * "play it now" button lives — so on that step a modal appears over
       * everything, and the ring went on pointing at the drawer underneath
       * it. Two things claiming to be the thing to press.
       *
       * While a dialog is up it IS the step: no ring, no walls, nothing of
       * ours in the way. The band keeps talking, behind it, which is where
       * it belongs.
       */
      if (document.querySelector(".modal-overlay")) {
        setSpot((was) => (was === null ? was : null));
        return;
      }
      const all = [...document.querySelectorAll(selector)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const el = all[0];
      const b = all.length
        ? all.reduce(
            (acc, e) => {
              const r = e.getBoundingClientRect();
              return {
                top: Math.min(acc.top, r.top),
                left: Math.min(acc.left, r.left),
                right: Math.max(acc.right, r.right),
                bottom: Math.max(acc.bottom, r.bottom),
              };
            },
            {
              top: Infinity,
              left: Infinity,
              right: -Infinity,
              bottom: -Infinity,
            },
          )
        : undefined;
      const box = b && { top: b.top, left: b.left, width: b.right - b.left, height: b.bottom - b.top };
      /*
       * ═══ A TARGET WITH NO SIZE IS NOT A TARGET ═══
       *
       * It used to ask only whether the element EXISTED. An element can
       * exist and be nowhere: inside a collapsed drawer, inside a panel
       * that has not opened, inside anything with `height: 0`. The ring is
       * then drawn at 0x0 in the top-left corner, over nothing, and the
       * step waits for a press that has nowhere to land.
       *
       * Measured in stage three: the x-ray card sits in the action drawer,
       * the drawer was shut, and `.action-chip__main` reported
       * `{top: 0, height: 0, width: 0}` while being perfectly present. The
       * tutorial stopped there with nothing on the screen to do. (That
       * button has since gone — the card in the drawer IS the button now —
       * but the rule it taught is the point and it outlived it.)
       *
       * Treating it as absent is right in both directions — a patient step
       * waits for the drawer to open, and an impatient one gives up and
       * moves on, which are the two behaviours that already exist for a
       * target that is not there.
       */
      if (!el || !box || box.width <= 0 || box.height <= 0) {
        setSpot((was) => (was === null ? was : null));
        return;
      }
      // Only publish a change. Setting a fresh object every frame re-rendered
      // the whole overlay sixty times a second for no reason.
      setSpot((was) =>
        was &&
        was.top === box.top &&
        was.left === box.left &&
        was.width === box.width &&
        was.height === box.height
          ? was
          : box,
      );

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
  /**
   * Does this step want the player to touch the GAME, or only to read?
   *
   * The whole of "one action at a time" turns on this. A step that waits
   * for something (`awaits`) or whose highlight IS the control
   * (`press: "target"`) needs the board underneath to answer a tap.
   * Every other step has exactly one control — the next button in Amanda's
   * band — and the board behind it must not answer anything.
   */
  const wantsAPress = Boolean(step.awaits) || step.press === "target";
  /*
   * A pointing step does not speak until it can point: the ring and the
   * words arrive together or not at all, which is the whole of Or's *"the
   * thing I'm supposed to click isn't always circled"*.
   *
   * It used to render an invisible copy of the bubble first, to measure how
   * tall it came out. Nothing measures it now, so there is nothing to render
   * early and nothing to flash.
   */
  if (pointing && !spot)
    return (
      /*
       * ═══ WAITING IS NOT PERMISSION ═══
       *
       * Or: *"at any moment the tutorial has to allow exactly one action."*
       *
       * Measured, that is already true while a step is POINTING: the four
       * panels that make the dimming real swallow everything except the lit
       * thing, so a finger aimed at the bin lands on a wall. But this
       * branch — a pointing step whose target has not appeared yet, or has
       * no size yet — rendered an empty transparent layer, and for those
       * frames the whole game was live again with nobody saying anything.
       *
       * That is the window his desync comes through: the player does
       * something the step is not expecting, in the gap before it can point
       * at anything. Swallowing the taps costs a few hundred milliseconds of
       * nothing happening, which is what a tutorial that is thinking should
       * look like.
       */
      <div
        className="tut tut--waiting"
        role="dialog"
        aria-live="polite"
        onClick={(e) => e.stopPropagation()}
      />
    );

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
          {/*
            ═══ AND THE HOLE IS ONLY OPEN WHEN THE STEP WANTS A PRESS ═══

            Or: *"at the opening it said 'let's make the cards work
            together', I pressed in the middle where it was marked, and I
            put the dragon on the king. Not good."*

            He is right and it is the same conflation twice over: `target`
            says WHAT TO LOOK AT, and the dimming was reading it as WHAT YOU
            MAY PRESS. On that step the target is `.side--me .board` — the
            whole board — so the whole board was live, the middle of it is
            the crown, and a tap there crowned a dragon.

            Nothing recovers from that. The king card arrives three steps
            later with nowhere to go, and the lesson is wrong for the rest of
            its length.

            A step has exactly one action, which is Or's own rule for this
            tutorial, and which action it is has been written down all along:

              awaits         do the thing on the board  -> the hole is open
              press target   press the lit thing        -> the hole is open
              neither        read it and press "next"   -> the board is SHUT

            So a narrative step still RINGS whatever it is talking about —
            pointing at the board is the right thing to do while describing
            it — and the ring is a picture rather than a door.
          */}
          <div className="tut__wall" onClick={(e) => e.stopPropagation()}>
            {wantsAPress ? (
              <>
                <i style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }} />
                <i style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
                <i
                  style={{
                    top: spot.top,
                    left: 0,
                    width: Math.max(0, spot.left),
                    height: spot.height,
                  }}
                />
                <i
                  style={{
                    top: spot.top,
                    left: spot.left + spot.width,
                    right: 0,
                    height: spot.height,
                  }}
                />
              </>
            ) : (
              // Nothing to press out there: one sheet over the lot.
              <i style={{ inset: 0 }} />
            )}
          </div>
          <div
            className="tut__spot"
            style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          />
        </>
      )}
      {/*
        ═══ AMANDA'S OWN BAND, AT THE FOOT OF THE SCREEN ═══

        Always here, always this tall, whatever the step is pointing at.
        `.app--teaching` gives up exactly this much height while a lesson is
        running, so the band and the game are never in the same pixels and
        the bubble cannot cover the thing it is describing. See album.css.
      */}
      <div className="tut__bubble tut__coach">
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
          {/*
            ═══ THERE IS NO "I KNOW HOW TO PLAY" ═══

            Or: *"the 'I know how to play' is confusing. People press it
            instead of pressing in the middle. Get rid of it. Whoever wants
            to — will press exit at the top."*

            It sat in Amanda's band, beside her words and under the one
            button that moves the lesson on, and it ENDED the tutorial. Two
            controls a few pixels apart, one of which is the way forward and
            the other the way out, is a choice nobody asked to be given —
            and the whole point of this band is that there is one thing to
            press.

            Nothing is lost. The exit button at the top is alive during a
            lesson on purpose, it asks before it does anything, and it does
            NOT mark the tutorial finished — so stopping and coming back
            picks up where it stopped, which this never did.
          */}
        </div>
      </div>
    </div>
  );
}
