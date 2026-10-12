/**
 * The second lesson, written out step by step.
 *
 * Or wrote this one himself, naming the card and the square for every step,
 * and approved it: *"that's it, approved, including everything you wrote."*
 * So this file is his script in a form the game can run, and the only thing
 * it adds is the machinery to wait for each step to be carried out.
 *
 * ═══ WRITTEN, WHERE THE FIRST LESSON IS REACTIVE ═══
 *
 * coach.ts is a set of RULES — "a giant? he is static and tough, put him in
 * front of the King" — which fire against whatever card you happen to draw.
 * That is right for the first match, whose subject is the shape of a turn,
 * and a shape has to survive any hand.
 *
 * It is wrong for the second, whose subject is three specific things:
 *
 *   - where a family bonus comes from, which needs three particular cards
 *     landing on three particular squares;
 *   - where a glass cannon does NOT go, which needs that glass cannon;
 *   - what the panic phase is, which needs the phase to arrive on cue.
 *
 * None of those can be taught by a rule waiting for the right card to turn
 * up. So the deck below deals a known hand in a known order and the steps
 * point at named squares.
 *
 * ═══ THE SQUARES ARE NAMED, AND THEY ARE REAL ═══
 *
 * A target is a CSS selector, and BoardGrid gives every cell a `data-drop`
 * of `"x-y"` — so `[data-drop="3-1"]` is one square and the spotlight can
 * sit on it. The two GUARD POSTS are (3,1) and (3,2): the front column,
 * level with the King's 2×2. They are where the lesson starts, because they
 * are the squares that keep a King alive.
 */
import type { Awaits } from "./coach";

export interface ScriptStep {
  /** The line, by its id in data/tutorialLines.ts. */
  id: string;
  /** What to spotlight. A selector, often one named square. */
  target?: string;
  /** What has to happen before she moves on. Absent = a continue button. */
  awaits?: Awaits;
  /**
   * Move the MATCH on once this step is done.
   *
   * The panic phase is a thing the lesson has to explain, so the lesson has
   * to be the thing that causes it — there is no clock in a tutorial (Or:
   * *"and there is no time in either match"*), so without this the second
   * half would never arrive. Waiting for panic instead of causing it was the
   * first version, and it waits forever.
   */
  advance?: "panic" | "prebattle";
}

/** The two squares that stand between an attacker and your King. */
export const GUARD_POSTS = ["3-1", "3-2"] as const;
/**
 * The squares that complete a touching trio once the two guard posts hold
 * plants. Both share an edge with a guard post — nothing diagonal, because
 * the engine's rule is edges (see synergy.ts) and the line says so out loud.
 */
const TRIO_COMPLETIONS = ["3-0", "3-3"];
/** The back column: the only place a card with no health belongs. */
const BACK_ROW = ["0-0", "0-1", "0-2", "0-3"];

/** The drawer the action cards sit in, open or shut. */
const BAR = ".actions";

const cells = (list: readonly string[]) =>
  list.map((c) => `[data-drop="${c}"]`).join(", ");

/**
 * ═══ THE FIRST MATCH, IN ORDER ═══
 *
 * Or wrote it out himself, line by line, naming the card and the square for
 * each one. The deck in lessons.ts deals exactly this cast in exactly this
 * order, so every line has the card it is about already in hand.
 *
 * ═══ WHAT THE SQUARES MEAN ═══
 *
 *   3-1, 3-2   the two guard posts: the front column, level with the King
 *   0-0        back row, top — where a flyer belongs
 *   1-0        in front of the flyer, which does not block it
 *
 * His own words for the last one: *"we'll put it up here at the back. It
 * won't block the dragon, he flies."* Which is true of this dragon — Flame
 * Dragon is a flyer in the data, so the sentence is a rule the engine has
 * rather than a nice thing to say.
 */
export const LESSON_1: ScriptStep[] = [
  { id: "l1-albums", target: ".boards" },

  {
    id: "l1-colossus",
    target: `[data-drop="${GUARD_POSTS[0]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[0]] },
  },
  { id: "l1-dragon", target: '[data-drop="0-0"]', awaits: { kind: "cell", cells: ["0-0"] } },

  // ── the action card, and the drawer it lives in ──
  {
    id: "l1-boost",
    target: ".take-action",
    awaits: { kind: "action", id: "energy_boost", where: "bar" },
  },
  { id: "l1-bar-open", target: ".actions__handle" },
  { id: "l1-bar-close", target: ".actions__handle" },

  // ── binning, and changing your mind ──
  { id: "l1-bin", target: ".hand__discard", awaits: { kind: "discard", atLeast: 1 } },
  { id: "l1-unbin", target: ".hand__bin" },
  { id: "l1-cube", target: '[data-drop="1-0"]', awaits: { kind: "cell", cells: ["1-0"] } },

  // ── the crown, and the two squares that keep it ──
  { id: "l1-king", target: ".side--me .slot--king", awaits: { kind: "king" } },
  { id: "l1-king-why", target: ".side--me .slot--king" },
  {
    id: "l1-troll",
    target: `[data-drop="${GUARD_POSTS[1]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[1]] },
  },
  { id: "l1-guards", target: ".side--me .slot--guard" },

  { id: "l1-crumbs", target: ".side--me .board" },
  { id: "l1-go", target: ".hand .btn-fight" },
];

/**
 * ═══ THE SECOND MATCH, IN ORDER ═══
 *
 * Three action cards, each teaching a different thing: RÖNTGEN teaches that
 * the fog exists and that a card can lift it, ENERGY BOOST teaches that WHEN
 * you play something is itself a decision, and SANDSTORM is the excuse to
 * explain the panic phase — which is Or's own: *"of course in step 2 we also
 * explain the panic phase, maybe when we explain shuffling the front row."*
 */
export const LESSON_2: ScriptStep[] = [
  { id: "l2-back" },
  { id: "l2-fog", target: ".side--enemy" },

  // ── the x-ray: the fog, and the one card that lifts it ──
  { id: "l2-xray-take", target: ".hand", awaits: { kind: "action", id: "xray", where: "bar" } },
  { id: "l2-xray-use", target: BAR, awaits: { kind: "action", id: "xray", where: "used" } },
  { id: "l2-xray-seen", target: ".side--enemy" },

  // ── the trio: two guard posts and one square beside them ──
  {
    id: "l2-tree",
    target: `[data-drop="${GUARD_POSTS[0]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[0]] },
  },
  {
    id: "l2-cactus",
    target: `[data-drop="${GUARD_POSTS[1]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[1]] },
  },
  { id: "l2-family", target: cells(GUARD_POSTS) },
  {
    id: "l2-sunflower",
    target: cells(TRIO_COMPLETIONS),
    awaits: { kind: "cell", cells: TRIO_COMPLETIONS },
  },
  // The glow is on the board by now. `slot--synergy` is the engine's own
  // answer to the rule, not a decoration this file switches on — if the three
  // are not really touching, there is nothing here to point at, which is the
  // correct failure.
  { id: "l2-synergy", target: ".side--me .slot--synergy" },

  // ── and where a card with no health goes ──
  { id: "l2-chuppy", target: cells(BACK_ROW), awaits: { kind: "cell", cells: BACK_ROW } },
  { id: "l2-king", target: ".side--me .slot--king", awaits: { kind: "king" } },

  // ── timing: the boost is worth whatever is already down ──
  { id: "l2-boost-wait", target: ".hand", awaits: { kind: "action", id: "energy_boost", where: "bar" } },
  {
    id: "l2-boost-use",
    target: BAR,
    awaits: { kind: "action", id: "energy_boost", where: "used" },
    // Everything is placed and the boost is spent: now the clock would have
    // run out, so the lesson makes it run out.
    advance: "panic",
  },

  // ── panic ──
  { id: "l2-panic-king", target: ".side--enemy .slot--king" },
  { id: "l2-panic-fog", target: ".side--enemy" },
  { id: "l2-sandstorm", target: ".hand", awaits: { kind: "action", id: "sandstorm", where: "used" } },
  /*
   * No `advance` here: a step with a target and no gate is dismissed by
   * TAPPING the target, and the target is the fight button — which starts
   * the battle itself. Advancing as well would step the match twice.
   */
  { id: "l2-go", target: ".hand .btn-fight" },
];

export const SCRIPTS: Record<number, ScriptStep[]> = { 1: LESSON_1, 2: LESSON_2 };
