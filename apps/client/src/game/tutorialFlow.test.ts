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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextCue } from "./coach";
import { LESSON_1, LESSON_2, SCRIPTS, STAGES, type ScriptStep } from "./lessonScript";
import { LESSONS, STAGE_LESSONS } from "./lessons";
import { TUTORIAL_LINES } from "../data/tutorialLines";

const HAS_LINE = new Set(TUTORIAL_LINES.map((l) => l.id));

/**
 * Every script in the repository, live or not.
 *
 * The three STAGES are what a player walks today. LESSON_1 and LESSON_2 are
 * the two long matches they replaced; they are still in the file and are
 * still checked here, because a script nobody runs is exactly the one that
 * quietly rots until somebody points the menu back at it.
 *
 * Built from SCRIPTS rather than from named imports, so a fourth stage is
 * covered by every rule below the moment it exists.
 */
const BOTH: Array<[string, ScriptStep[]]> = [
  ...Object.entries(SCRIPTS).map(
    ([n, steps]) => ["stage " + n, steps] as [string, ScriptStep[]],
  ),
  ["the old lesson 1", LESSON_1],
  ["the old lesson 2", LESSON_2],
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

  /*
   * Three scripts and three decks, and the same three. A stage with a script
   * and no deck deals nothing; a deck with no script says nothing. Either
   * way the match opens and never moves, with a child looking at it.
   */
  it("has a script and a deck for each stage, and no more", () => {
    expect(Object.keys(SCRIPTS).map(Number).sort()).toEqual([1, 2, 3]);
    expect(STAGE_LESSONS.length).toBe(STAGES);
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
/**
 * Each script beside the deck it is spoken over.
 *
 * Paired by name rather than by position, because the list above is five
 * scripts long now and the old version looked its deck up with
 * `LESSONS[name === "lesson 1" ? 0 : 1]` — which silently gave every stage
 * the same deck the moment there were more than two.
 */
const WITH_DECKS: Array<[string, ScriptStep[], readonly string[]]> = [
  ...Object.entries(SCRIPTS).map(
    ([n, steps]) =>
      ["stage " + n, steps, STAGE_LESSONS[Number(n) - 1]!.deck] as [
        string,
        ScriptStep[],
        readonly string[],
      ],
  ),
  ["the old lesson 1", LESSON_1, LESSONS[0]!.deck],
  ["the old lesson 2", LESSON_2, LESSONS[1]!.deck],
];

describe("a step never waits for a card the lesson does not deal", () => {
  for (const [name, steps, cards] of WITH_DECKS) {
    it(`${name}: every action it waits for is in the deck`, () => {
      const deck = new Set(cards);
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

/**
 * ═══ A STEP CANNOT POINT AT A SQUARE IT HAS ALREADY FILLED ═══
 *
 * Found by walking stage one in a browser: Amanda placed the king, both
 * guards, and then stopped talking. The screen sat on a finished board with
 * nothing to press and no way on.
 *
 * `data-drop` is the attribute that says "you may drop a card here", so
 * BoardGrid only writes it on an EMPTY cell. A step that points at
 * `[data-drop="3-1"]` after an earlier step waited for a card to land on
 * 3-1 is pointing at an attribute that no longer exists — and a step whose
 * target never appears is skipped, silently, taking the rest of the lesson
 * with it.
 *
 * It is invisible in the script: both steps name the same square and look
 * identical. It is a one-line rule once stated, which is why it is here and
 * not in a comment.
 *
 * The answer when a step genuinely is ABOUT a filled square is a class that
 * survives being filled — `.slot--guard`, `.slot--king`, `.slot--synergy`.
 */
describe("a step never points at a square an earlier step filled", () => {
  const DROP = /\[data-drop="([^"]+)"\]/g;

  for (const [name, steps] of BOTH) {
    it(`${name}: every data-drop it points at is still empty then`, () => {
      const filled = new Set<string>();
      for (const step of steps) {
        for (const m of step.target?.matchAll(DROP) ?? []) {
          const cell = m[1]!;
          expect(
            filled.has(cell),
            `${step.id} points at [data-drop="${cell}"], which an earlier step already filled — ` +
              `use a class that survives being filled, like .slot--guard`,
          ).toBe(false);
        }
        if (step.awaits?.kind === "cell") for (const c of step.awaits.cells) filled.add(c);
      }
    });
  }
});

/**
 * ═══ EVERY FIELD OF A STEP HAS TO SURVIVE THE JOURNEY ═══
 *
 * A written step is copied twice on its way to the screen: `scriptedCue`
 * turns a ScriptStep into a Cue, and App turns a Cue into a Tutorial step.
 * Both used to list the fields by hand, and both forgot the same one.
 *
 * `press: "target"` means "the highlighted thing IS the action — do not put
 * a continue button beside it". It is set on the three steps that light the
 * FIGHT BUTTON, where a continue button dismisses the tutorial on a board
 * that never fought. It was written down, tested, and quietly dropped at
 * both copies, so for weeks it did nothing at all.
 *
 * Found by walking stage one in a browser and reading "press start battle"
 * with a "continue" button underneath it.
 *
 * Both copies are spreads now. This is the rule that says so, because the
 * next person to add a field will be tempted to list them again.
 */
describe("a step reaches the screen whole", () => {
  it("carries press through scriptedCue", () => {
    const steps = SCRIPTS[1]!;
    const last = steps[steps.length - 1]!;
    expect(last.press, "the last step of a stage presses its own target").toBe("target");

    const said = new Set(steps.slice(0, -1).map((s) => s.id));
    const cue = nextCue(
      {
        phase: "build",
        matchNo: 1,
        hand: null,
        handIsAction: false,
        placements: {},
        king: null,
        discardCount: 0,
        actionBarCount: 0,
        opponent: { placements: {}, king: null },
      },
      said,
    );
    expect(cue?.id).toBe(last.id);
    expect(cue?.press, "press was dropped between the script and the cue").toBe("target");
  });

  /*
   * And the layer above, read from the source: App builds the Tutorial step
   * from the cue, and a hand-written field list there loses it just as
   * easily. There is no DOM in this suite, so this reads the spread.
   */
  it("hands the whole cue to the tutorial", () => {
    const app = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
    const at = app.indexOf("setCue({");
    expect(at, "setCue not found").toBeGreaterThan(-1);
    const call = app.slice(at, app.indexOf("}", at) + 1);
    expect(call, "setCue builds a cue field by field; spread it instead").toContain("...next");
  });
});

/**
 * ═══ A STEP THAT ONLY TALKS CANNOT BE PLAYED THROUGH ═══
 *
 * Or: *"at the opening it said 'let's make the cards work together', I
 * pressed in the middle where it was marked, and I put the dragon on the
 * king. Not good."*
 *
 * The opening step of stage three points at `.side--me .board` — the whole
 * board — because that is what it is TALKING about. The dimming read the
 * same selector as "what you may press", so the whole board answered taps,
 * the middle of the board is the crown, and a tap there crowned a dragon.
 * Nothing recovers: the king arrives three steps later with nowhere to go.
 *
 * `target` says what to look at. Whether the game may be touched is a
 * different question with an answer already written on every step:
 *
 *   awaits        do the thing      -> the board answers
 *   press target  press the lit     -> the board answers
 *   neither       read and continue -> the board is shut
 *
 * This pins the two halves: the component asks that question, and no step
 * that only talks points at something a tap could ruin.
 */
describe("a step that only talks", () => {
  const TUTORIAL = readFileSync(
    fileURLToPath(new URL("../components/Tutorial.tsx", import.meta.url)),
    "utf8",
  );

  it("is what the overlay decides on, not the selector", () => {
    expect(TUTORIAL).toMatch(/const wantsAPress =\s*Boolean\(step\.awaits\) \|\| step\.press === "target"/);
    // And the hole is cut only when it is true.
    expect(TUTORIAL).toContain("{wantsAPress ? (");
  });

  /*
   * The other half, and the one that would have caught this from the
   * script alone: a step with nothing to do must not be pointing at a
   * container full of things to do. Ringing the whole board is fine —
   * ringing it while the board is live is not, and the rule above is what
   * makes it fine.
   */
  const RISKY = [".side--me .board", ".boards", ".side--me", ".hand"];

  for (const [name, steps] of BOTH) {
    it(`${name}: every step pointing at a whole area is read-only`, () => {
      for (const step of steps) {
        if (!step.target || !RISKY.includes(step.target)) continue;
        const live = Boolean(step.awaits) || step.press === "target";
        expect(
          live,
          `${step.id} points at ${step.target} AND expects a press — a tap anywhere in there counts`,
        ).toBe(false);
      }
    });
  }
});
