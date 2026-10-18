/**
 * **Every step of the tutorial has exactly one thing to press.**
 *
 * Or, after walking both lessons on his phone:
 *
 * > *"There are a lot of places in the tutorial where you're just left
 * > hanging and it isn't clear what to do, and cards keep arriving. Every
 * > single step of the tutorial has to be guided, with ONE thing to press.
 * > Either 'next', or doing something real on the board. Go step by step and
 * > make sure it's like that in both lessons."*
 *
 * And, from inside a step explaining what the King is worth:
 *
 * > *"Here — you told me what to do but I have no 'next' button (in the first
 * > bubbles either), so that's a problem."*
 *
 * ═══ WHAT WAS ACTUALLY WRONG ═══
 *
 * There used to be a "got it" button on every step and Or asked for it to go,
 * because on a step that says "put the giant in the guard post", doing it is
 * the answer and confirming afterwards is the shape of a form. That was
 * right. What it missed is that most steps are not that kind of step.
 *
 * A step that only EXPLAINS — the King's power is tripled, the fog is why you
 * cannot see their board, these two squares are the guard posts — has nothing
 * to do. With the button gone, the only way past it was to tap the thing
 * being talked about, which nothing said and which is not an action anybody
 * would think of. That is the "left hanging".
 *
 * So the rule, which is exactly Or's:
 *
 *     waiting for an outcome (`awaits`)     → no button; do the thing
 *     the highlight IS the control (`press`) → no button; press the highlight
 *     anything else                          → a real "next" button
 *
 * The middle one earned its place the hard way. The first version of this had
 * only two kinds and put a "next" button on everything without a gate — which
 * includes `l1-go` and `l2-go`, the steps that light up the FIGHT BUTTON.
 * Pressing "next" there dismissed the tutorial and left the player on a build
 * screen with the match unstarted and nobody talking: the exact complaint,
 * recreated by its own fix. The last test in this file is that one.
 *
 * Checked against the SCRIPTS rather than the component, because the scripts
 * are where a new step gets added and where one can quietly land between the
 * kinds.
 */
import { describe, expect, it } from "vitest";
import { LESSON_1, LESSON_2, SCRIPTS, type ScriptStep } from "./lessonScript";
import { LESSONS } from "./lessons";
import { TUTORIAL_LINES } from "../data/tutorialLines";

const HAS_LINE = new Set(TUTORIAL_LINES.map((l) => l.id));

const BOTH: Array<[string, ScriptStep[]]> = [
  ["lesson 1", LESSON_1],
  ["lesson 2", LESSON_2],
];

type Way = "do it on the board" | "press the highlight" | "press next";

/** The step's one instruction, as the player experiences it. */
function wayForward(step: ScriptStep): Way {
  if (step.awaits) return "do it on the board";
  if (step.press === "target") return "press the highlight";
  return "press next";
}

const WAYS: Way[] = ["do it on the board", "press the highlight", "press next"];

describe("every step is guided", () => {
  for (const [name, steps] of BOTH) {
    it(`${name}: every step has one way forward, and it is one of the two`, () => {
      for (const step of steps) {
        expect(WAYS, `${step.id} has no way forward`).toContain(wayForward(step));
      }
      // And the lesson is not all of one kind: a lesson that is only reading
      // is a manual, and one that is only doing never explains anything.
      const ways = steps.map(wayForward);
      expect(ways).toContain("do it on the board");
      expect(ways).toContain("press next");
    });

    /*
     * The half that was broken, named on its own so a regression says which.
     *
     * Any step without `awaits` must get the button. There is no third state
     * — no "tap the highlighted thing", no "tap anywhere" — because those are
     * the two things Or could not find.
     */
    it(`${name}: no step explains something and then leaves you with nothing`, () => {
      const explaining = steps.filter((s) => wayForward(s) === "press next");
      // There are a lot of them, which is why this mattered at all.
      expect(explaining.length).toBeGreaterThan(0);
      for (const step of explaining) {
        expect(step.awaits, `${step.id} would get a button AND a gate`).toBeUndefined();
        expect(step.press, `${step.id} would get a button AND a highlight to press`).toBeUndefined();
      }
    });

    /*
     * A step that says "press this" has to have a this.
     */
    it(`${name}: a press-the-highlight step actually highlights something`, () => {
      for (const step of steps.filter((s) => s.press === "target")) {
        expect(step.target, `${step.id} says press the highlight and has none`).toBeTruthy();
        expect(step.awaits, `${step.id} cannot both wait and be pressed`).toBeUndefined();
      }
    });

    it(`${name}: a step that waits for the board names what it is waiting for`, () => {
      for (const step of steps.filter((s) => s.awaits)) {
        const a = step.awaits!;
        expect(a.kind, `${step.id} has an empty gate`).toBeTruthy();
        if (a.kind === "cell") expect(a.cells.length, `${step.id} waits on no cell`).toBeGreaterThan(0);
        if (a.kind === "action") expect(a.id, `${step.id} waits on no action`).toBeTruthy();
      }
    });

    /*
     * A gate the player cannot see is the same bug in a different place: if a
     * step waits for a card to land on a square, the square has to be lit.
     * Otherwise Amanda is waiting for something she never pointed at, which
     * from the outside is indistinguishable from being stuck.
     */
    it(`${name}: a step that waits for something points at it`, () => {
      for (const step of steps.filter((s) => s.awaits)) {
        expect(step.target, `${step.id} waits for the player but highlights nothing`).toBeTruthy();
      }
    });

    it(`${name}: every step has a line to say`, () => {
      for (const step of steps) {
        expect(HAS_LINE.has(step.id), `${step.id} has no text in tutorialLines.ts`).toBe(true);
      }
    });

    it(`${name}: no step is listed twice`, () => {
      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }

  it("has a script for each lesson, and no more", () => {
    expect(Object.keys(SCRIPTS).map(Number).sort()).toEqual([1, 2]);
    expect(LESSONS.length).toBe(2);
  });
});

/**
 * ═══ A GATE CAN ONLY WAIT FOR A CARD THAT IS COMING ═══
 *
 * Or's other half of the same complaint: *"cards keep arriving"* while you do
 * not know what to do. The deck in lessons.ts is dealt in the order the script
 * talks about it — so a step that waits for `xray` to reach the bar is only
 * answerable if `xray` is in that lesson's deck at all.
 *
 * Without this, a card renamed in the data makes a step wait for ever, and
 * the symptom a child sees is the tutorial freezing on a sentence.
 */
describe("a step never waits for a card the lesson does not deal", () => {
  for (const [name, steps] of BOTH) {
    it(`${name}: every action it waits for is in the deck`, () => {
      const lesson = LESSONS[name === "lesson 1" ? 0 : 1]!;
      const deck = new Set(lesson.deck);
      for (const step of steps) {
        if (step.awaits?.kind !== "action") continue;
        expect(deck.has(step.awaits.id), `${step.id} waits for ${step.awaits.id}, not dealt`).toBe(
          true,
        );
      }
    });
  }
});

/**
 * ═══ THE STEP THAT STARTS THE MATCH ═══
 *
 * Both lessons end by lighting up the fight button, and pressing it is what
 * starts the battle. That step must never carry a continue button: dismissing
 * it instead of pressing the button leaves the player on a finished board
 * with no match, no tutorial and nothing to do — which is the failure the
 * whole "one thing to press" rule exists to prevent, and which the first
 * version of that rule caused.
 */
describe("the last step of a lesson presses the fight button", () => {
  for (const [name, steps] of BOTH) {
    it(`${name}: ends on the fight button, pressed and not dismissed`, () => {
      const last = steps[steps.length - 1]!;
      expect(last.target).toBe(".hand .btn-fight");
      expect(last.press).toBe("target");
      expect(wayForward(last)).toBe("press the highlight");
      // And nothing else may try to step the match at the same time.
      expect(last.advance).toBeUndefined();
    });
  }
});
