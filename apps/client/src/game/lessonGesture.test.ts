/**
 * **The card is lit too, and the gesture is shown once.**
 *
 * Or, after walking a stage: *"in the tutorial you only see the free
 * squares, but the CARD has to be lit too, so you can see what you are
 * putting down. And there has to be a drag option. And a marking for drag or
 * press. Say, on the first card mark with an arrow animation to press, and
 * on the second card show — you can also drag, with a marking and an
 * animation."*
 *
 * ═══ ONE ASK, TWO BUGS, AND THE SECOND ONE IS INVISIBLE ═══
 *
 * Lighting the card is the visible half. The other half is that the dimming
 * in this tutorial is REAL — walls around the lit thing swallow every tap
 * that lands on them — and a drag begins with a pointerdown ON THE CARD
 * (game/useDrag.ts). So the card was not merely dark: it was under a wall,
 * and for as long as the tutorial has existed the only way to place anything
 * in it was a tap. Opening the hole is what makes dragging possible at all.
 *
 * There is no jsdom here, so what is pinned is the rule and the wiring: that
 * the card is named from the gate rather than written onto each step, that
 * it survives the two copies between the script and the screen, and that the
 * component actually opens a hole over it rather than only drawing a ring.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextCue, type CoachView } from "./coach";
import { SCRIPTS } from "./lessonScript";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const VIEW: CoachView = {
  phase: "build",
  matchNo: 1,
  hand: null,
  handIsAction: false,
  placements: {},
  king: null,
  discardCount: 0,
  actionBarCount: 0,
  opponent: { placements: {}, king: null },
};

/** The cue for step `n` of a stage, by telling the coach the rest was said. */
const cueAt = (stage: number, n: number, view: Partial<CoachView> = {}) => {
  const steps = SCRIPTS[stage]!;
  return nextCue({ ...VIEW, matchNo: stage, ...view }, new Set(steps.slice(0, n).map((s) => s.id)));
};

/** Which steps of a stage are asking for a card to come out of the hand. */
const placingSteps = (stage: number) =>
  SCRIPTS[stage]!.map((s, n) => ({ s, n })).filter(
    ({ s }) => s.awaits && ["cell", "king", "placements"].includes(s.awaits.kind),
  );

describe("a step that wants a card lights the card", () => {
  it("does it on every placing step of every stage", () => {
    /*
     * Read off the scripts rather than listed, so a step added to a lesson
     * is covered the day it is added. That is the whole reason the rule
     * lives on the gate instead of on the step: this file has the scar
     * already — `press` was set on two steps for weeks and never arrived,
     * because the copy listed its fields by hand and missed one.
     */
    for (const stage of Object.keys(SCRIPTS).map(Number)) {
      const placing = placingSteps(stage);
      expect(placing.length, `stage ${stage} asks for no cards at all`).toBeGreaterThan(0);
      for (const { s, n } of placing) {
        expect(cueAt(stage, n)?.also, `${s.id} does not light the card`).toBe(".hand__draggable");
      }
    }
  });

  it("and leaves every other step alone", () => {
    /*
     * A step that is only TALKING must not open a second hole: the hole is
     * what makes a thing pressable, and a live card during "look at their
     * board" is a card that can be placed while Amanda is mid-sentence.
     * This is the same conflation that once let a dragon be crowned.
     */
    for (const stage of Object.keys(SCRIPTS).map(Number)) {
      const placing = new Set(placingSteps(stage).map(({ n }) => n));
      SCRIPTS[stage]!.forEach((s, n) => {
        if (placing.has(n)) return;
        expect(cueAt(stage, n)?.also, `${s.id} lights a card it is not asking for`).toBeUndefined();
      });
    }
  });
});

describe("the gesture is shown twice and then never again", () => {
  it("is press on the first card and drag on the second", () => {
    const placing = placingSteps(1);
    expect(cueAt(1, placing[0]!.n)?.hint).toBe("tap");
    expect(cueAt(1, placing[1]!.n)?.hint).toBe("drag");
    for (const { s, n } of placing.slice(2)) {
      expect(cueAt(1, n)?.hint, `${s.id} is still teaching the gesture`).toBeUndefined();
    }
  });

  it("is not repeated in the later stages", () => {
    /*
     * It is a gesture, not a rule: once you know a card can be dragged you
     * know it for the rest of the game. An arrow at the top of every stage
     * teaches a child that the game thinks they forgot.
     */
    for (const stage of [2, 3]) {
      for (const { n } of placingSteps(stage)) {
        expect(cueAt(stage, n)?.hint, `stage ${stage} teaches the gesture again`).toBeUndefined();
      }
    }
  });

  it("never draws the drag hint with nowhere to drag from", () => {
    /*
     * ⚠ THE ONE WAY THIS BREAKS ON SCREEN. The travelling finger goes from
     * the card to the square, so without a card box there is no journey —
     * it would sit on the spot and pulse, which is the OTHER hint. The
     * component refuses rather than drawing a lie.
     */
    expect(read("../components/Tutorial.tsx")).toContain('step.hint === "drag" && also');
  });
});

describe("the light is a hole, not a glow", () => {
  it("cuts the walls around both of them", () => {
    const src = read("../components/Tutorial.tsx");
    expect(src, "the walls still assume one hole").toContain(
      "wallsAround(also ? [spot, also] : [spot]",
    );
  });

  it("and the card's ring does not paint the dimming a second time", () => {
    /*
     * ⚠ `.tut__spot` makes the darkness with a 9999px spread shadow — the
     * dim IS the hole's shadow. A second ring built the same way lays its
     * own sheet of black over the first one's hole and both holes go dark,
     * which looks exactly like the bug this is fixing.
     */
    const css = read("../styles/album.css");
    const at = css.indexOf(".tut__spot--card {");
    expect(at, "the card's ring has no rule of its own").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    expect(rule).toContain("box-shadow");
    expect(rule, "the card's ring dims the screen again").not.toContain("9999px");
  });
});
