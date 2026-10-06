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
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface Step {
  /** What to put a hole in the dimming over. Missing element → step skipped. */
  target: string;
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

export function Tutorial({ steps, onDone, onQuit }: Props) {
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = steps[i];

  const next = () => {
    if (i + 1 >= steps.length) onDone();
    else setI(i + 1);
  };

  // Follow the target: the board resizes with the window, and a highlight that
  // remembers where something used to be is worse than none.
  useLayoutEffect(() => {
    if (!step) return;
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(step.target);
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

  // A step whose target never appears would be a dead end, so move past it.
  useEffect(() => {
    if (!step) return;
    const t = window.setTimeout(() => {
      if (!document.querySelector(step.target)) next();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [step, i]);

  // Steps that wait for the player to actually do the thing.
  useEffect(() => {
    if (step?.done) next();
  }, [step?.done, i]);

  if (!step) return null;

  // Put the bubble opposite the hole so it never covers what it points at.
  const below = spot ? spot.top + spot.height / 2 < window.innerHeight / 2 : true;
  const bubbleStyle = spot
    ? below
      ? { top: Math.min(spot.top + spot.height + 14, window.innerHeight - 140) }
      : { bottom: Math.min(window.innerHeight - spot.top + 14, window.innerHeight - 140) }
    : { top: "50%" };

  return (
    <div className="tut" role="dialog" aria-live="polite">
      {spot && (
        <div
          className="tut__spot"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}
      <div className="tut__bubble" ref={bubbleRef} style={bubbleStyle}>
        <p className="tut__text">{step.text}</p>
        <div className="tut__row">
          {steps.length > 1 && (
            <span className="tut__dots">
              {steps.map((_, n) => (
                <i key={n} className={n === i ? "is-now" : undefined} />
              ))}
            </span>
          )}
          {step.done === undefined && (
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
