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
   * The highlighted thing IS the action: press it, and that is the step.
   *
   * ═══ WHY THIS HAD TO BECOME EXPLICIT ═══
   *
   * Or: *"every single step has to be guided, with ONE thing to press.
   * Either 'next', or doing something real on the board."* Which gives two
   * kinds of step, and `awaits` already told them apart — so a "next" button
   * went on everything without a gate.
   *
   * That is wrong for a handful of steps where the thing being pointed at is
   * itself the control, and catastrophically wrong for two of them: `l1-go`
   * and `l2-go` light up the FIGHT BUTTON. A "next" button there dismisses
   * the tutorial and leaves the player standing on a build screen with the
   * match unstarted and nobody talking — which is precisely the "left
   * hanging" he was complaining about, reintroduced by the fix for it.
   *
   * So there are three kinds, and the third one says so out loud rather than
   * being inferred from the absence of something.
   */
  press?: "target";
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
  { id: "l1-bar-open", target: ".actions__handle", press: "target" },
  { id: "l1-bar-close", target: ".actions__handle", press: "target" },

  // ── binning, and changing your mind ──
  { id: "l1-bin", target: ".hand__discard", awaits: { kind: "discard", atLeast: 1 } },
  { id: "l1-unbin", target: ".hand__bin", press: "target" },
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
  /*
   * The last step of the match, and the one that starts it. The fight button
   * is the only thing lit and pressing it is the step — a "next" button here
   * would end the tutorial on a board that never fought.
   */
  { id: "l1-go", target: ".hand .btn-fight", press: "target" },
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
  /*
   * The same trap as t1-guards, and it was shipped: this pointed at
   * `cells(GUARD_POSTS)` after two steps had just filled both of them, so
   * the selector matched nothing and the lesson went quiet. `.slot--guard`
   * is on those squares whether or not something is standing there.
   */
  { id: "l2-family", target: ".side--me .slot--guard" },
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
   * No `advance` here: the target is the fight button, and pressing it starts
   * the battle itself. Advancing as well would step the match twice.
   */
  { id: "l2-go", target: ".hand .btn-fight", press: "target" },
];


/**
 * ═══ THE TUTORIAL IN THREE STAGES ═══
 *
 * Or, after a tester got lost in the old one: *"let us do the tutorial in
 * three stages. You can always get back to any of the three through the
 * settings menu. In every step it is clear what to press — an arrow and
 * 'next', or something on the board, as appropriate."*
 *
 * These are short on purpose. The two lessons above are fifteen and
 * nineteen steps of one long match each; a child who loses the thread at
 * step nine has to start the whole thing again. Seven, eight and nine, with
 * an ending in between, is three places to stop.
 *
 * ═══ AND THE BOARD IS THE SIZE OF THE LESSON ═══
 *
 * `squaresBy` reads these scripts and draws exactly the squares they name,
 * so the counts below are his: *"a board of three squares"*, then *"seven
 * squares — a king, two guards, two attackers and two more squares that
 * fill with crumb monsters"*. The squares are not written down anywhere
 * else; they are what the steps point at.
 */

/** Behind the King: where something that walks in, or shoots, belongs. */
const BACK_LEFT = "0-1";
const BACK_RIGHT = "0-2";
/** Where the card fetched back out of the bin goes: out of everyone way. */
const BACK_CORNER = "0-0";
/** The two front corners, left empty on purpose in stage two. */
const CRUMB_CORNERS = ["3-0", "3-3"];

/**
 * ── one: this is a board, and that is the goal ──
 *
 * Three squares and nothing else. The only two things it teaches are where
 * the crown goes and why the two squares in front of it matter — which is
 * also, as Or put it, *"what the aim is: to bring down the king."*
 */
export const STAGE_1: ScriptStep[] = [
  { id: "t1-boards", target: ".boards" },
  { id: "t1-goal", target: ".side--enemy .slot--king" },
  { id: "t1-king", target: ".side--me .slot--king", awaits: { kind: "king" } },
  {
    id: "t1-guard-1",
    target: `[data-drop="${GUARD_POSTS[0]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[0]] },
  },
  {
    id: "t1-guard-2",
    target: `[data-drop="${GUARD_POSTS[1]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[1]] },
  },
  /*
   * ═══ POINT AT THE SLOT, NOT AT THE DROP TARGET ═══
   *
   * This said `cells(GUARD_POSTS)` and the tutorial died on it. A cell only
   * carries `data-drop` while it is EMPTY — it is the attribute that says
   * "you may drop here" — so by the time Amanda wants to talk about the two
   * guards she just had you place, the selector matches nothing at all.
   *
   * `.slot--guard` is on those two squares whether or not anything is
   * standing on them, which is what a step ABOUT them needs.
   */
  { id: "t1-guards", target: ".side--me .slot--guard" },
  { id: "t1-go", target: ".hand .btn-fight", press: "target" },
];

/**
 * ── two: the two ways a card reaches the other side ──
 *
 * One that walks — Flame Dragon, moveSpeed 1.5, *"advances into enemy
 * territory"* in its own role text — and one that never moves at all:
 * Thunderwing is the catalogue's only `range: "sniper"`, and it shoots the
 * last enemy card in its lane as long as it has a clear line.
 *
 * The two corners are left empty on purpose, because that is the lesson:
 * what happens to a square you did not use.
 */
export const STAGE_2: ScriptStep[] = [
  { id: "t2-back", target: ".side--me .board" },
  { id: "t2-king", target: ".side--me .slot--king", awaits: { kind: "king" } },
  {
    id: "t2-guard-1",
    target: `[data-drop="${GUARD_POSTS[0]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[0]] },
  },
  {
    id: "t2-guard-2",
    target: `[data-drop="${GUARD_POSTS[1]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[1]] },
  },
  {
    id: "t2-dragon",
    target: `[data-drop="${BACK_LEFT}"]`,
    awaits: { kind: "cell", cells: [BACK_LEFT] },
  },
  {
    id: "t2-sniper",
    target: `[data-drop="${BACK_RIGHT}"]`,
    awaits: { kind: "cell", cells: [BACK_RIGHT] },
  },
  /*
   * ═══ THE BIN, AND THE ONE WAY BACK OUT OF IT ═══
   *
   * Or: *"add throw-away and take-from-bin to stage two."* They were in the
   * old lesson one, which is where he saw them, and stage one is three
   * cards now — a child meeting the board for the first time does not need
   * to be taught regret.
   *
   * Three steps, because it is three ideas: a card can be thrown away, one
   * card can be fetched back, and then it still has to go somewhere. The
   * recovered card gets the back corner — Or's own line for this in the
   * old lesson was *"we'll put it up here at the back"*.
   *
   * This is the eighth square of a board he specified as seven. The seven
   * were the attack lesson; the bin arrived afterwards and has to be put
   * down somewhere. Both crumb corners survive, so the square you did not
   * use still fills with a monster, which was the point of them.
   */
  { id: "t2-bin", target: ".hand__discard", awaits: { kind: "discard", atLeast: 1 } },
  { id: "t2-unbin", target: ".hand__bin", press: "target" },
  {
    id: "t2-cube",
    target: `[data-drop="${BACK_CORNER}"]`,
    awaits: { kind: "cell", cells: [BACK_CORNER] },
  },
  /*
   * Pointed at, never placed on. This is the one step whose square is drawn
   * BECAUSE she mentions it and for no other reason — which is exactly what
   * squaresBy is for, and why the crumb corners are not listed anywhere.
   */
  { id: "t2-crumbs", target: cells(CRUMB_CORNERS) },
  { id: "t2-go", target: ".hand .btn-fight", press: "target" },
];

/**
 * ── three: cards that do something, together ──
 *
 * Two abilities a child can watch happen — the Ancient Tree heals itself,
 * the Cactus hurts whoever hits it — and then the thing those two were
 * really for: they are both plants, so a third plant beside them lights the
 * series bonus. And one action card, which is the last mechanic there is.
 *
 * `3-0` completes the trio because the engine's rule is shared EDGES, not
 * corners (synergy.ts), and 3-0 touches 3-1.
 */
const TRIO_THIRD = "3-0";

export const STAGE_3: ScriptStep[] = [
  { id: "t3-back", target: ".side--me .board" },
  { id: "t3-king", target: ".side--me .slot--king", awaits: { kind: "king" } },
  {
    id: "t3-tree",
    target: `[data-drop="${GUARD_POSTS[0]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[0]] },
  },
  {
    id: "t3-cactus",
    target: `[data-drop="${GUARD_POSTS[1]}"]`,
    awaits: { kind: "cell", cells: [GUARD_POSTS[1]] },
  },
  {
    id: "t3-sunflower",
    target: `[data-drop="${TRIO_THIRD}"]`,
    awaits: { kind: "cell", cells: [TRIO_THIRD] },
  },
  // The glow is the engine's own answer to the rule. If the three are not
  // really touching there is nothing here to point at, which is the correct
  // failure rather than a line that lies.
  { id: "t3-synergy", target: ".side--me .slot--synergy" },
  { id: "t3-xray", target: ".take-action", awaits: { kind: "action", id: "xray", where: "bar" } },
  /*
   * ═══ POINT AT THE DRAWER, WHICH IS ALWAYS THERE ═══
   *
   * Three goes at this, and the two wrong ones are worth writing down.
   *
   * Pointing at the CARD inside (`.action-chip__main`) looked exact and was
   * a dead end: taking an action card leaves the drawer SHUT, so the button
   * exists in the document at 0x0 and the step waited for a press with
   * nowhere to land. Walked at 832x384: no ring, no words, a build screen
   * and nothing to do — which is the complaint this whole rewrite is about.
   *
   * Opening it in a step of its own was worse, because a handle that opens
   * also CLOSES: run it when the drawer happens to be open and the lesson
   * shuts the thing it is about to point into.
   *
   * The drawer itself is visible either way — shut it is the handle, open it
   * is the handle and the cards — and every press inside it moves the player
   * forward. The gate is the card being USED, so opening the drawer does not
   * satisfy it by accident.
   */
  { id: "t3-xray-use", target: BAR, awaits: { kind: "action", id: "xray", where: "used" } },
  { id: "t3-go", target: ".hand .btn-fight", press: "target" },
];

/**
 * The three stages, by number.
 *
 * LESSON_1 and LESSON_2 are kept above and are no longer reachable: they are
 * two long matches, and Or has asked for three short ones. Nothing is deleted
 * until he has walked these.
 */
export const SCRIPTS: Record<number, ScriptStep[]> = { 1: STAGE_1, 2: STAGE_2, 3: STAGE_3 };

/** How many stages there are. One number, read by the menu and by the ending. */
export const STAGES = Object.keys(SCRIPTS).length;

/**
 * Every square a stage ever draws.
 *
 * The GROWING set is what the build screen shows step by step; this is the
 * whole of it, which is what the buzzer needs — a lesson board must not fill
 * with crumb monsters on squares the lesson never showed. See fillGs.
 */
export function lessonSquares(n: number): ReadonlySet<string> | null {
  const steps = SCRIPTS[n];
  return steps ? squaresBy(steps, steps.length - 1) : null;
}

/**
 * **Which squares exist by the time a lesson has reached step `i`.**
 *
 * Or, after the third time the tutorial came back wrong: *"maybe it is worth
 * rethinking the whole approach. Not hiding an existing board, but building a
 * new board where only what you can click appears."*
 *
 * ═══ DERIVED FROM THE SCRIPT, NEVER WRITTEN DOWN ═══
 *
 * The obvious shape is a `shows: [...]` on every step. It is also the shape
 * that goes wrong: two lists saying nearly the same thing drift the first
 * time a step is reordered, and the symptom is Amanda pointing at a square
 * that is not drawn — the exact failure this is replacing.
 *
 * So there is one list. A step already names its square twice over — as the
 * thing to spotlight (`target`) and as the thing to wait for (`awaits`) — and
 * this reads both. A square exists from the moment Amanda first mentions it
 * and never goes away again, so the board grows as the lesson goes and a
 * child is never looking at a square nobody has talked about.
 *
 * `null` is the honest answer for a step that points at something which is
 * not a square — the enemy side, the action drawer, the fight button. There
 * is nothing to add and nothing to take away, so the board stays as it was.
 */
const DROP = /\[data-drop="([^"]+)"\]/g;

export function squaresBy(steps: readonly ScriptStep[], i: number): ReadonlySet<string> {
  const out = new Set<string>();
  for (const step of steps.slice(0, i + 1)) {
    // Named as the thing to point at.
    if (step.target) for (const m of step.target.matchAll(DROP)) if (m[1]) out.add(m[1]);
    // And as the thing to wait for, which is the same square said twice on
    // most steps and the only mention on none — read both, cost nothing.
    if (step.awaits?.kind === "cell") for (const key of step.awaits.cells) out.add(key);
    // The crown has its own selector rather than a data-drop, because it is a
    // 2x2 and not a cell. It is still a square the lesson introduces.
    if (step.awaits?.kind === "king" || step.target?.includes("slot--king")) out.add("king");
  }
  return out;
}

/**
 * **Which card must be in the player's hand when this step begins.**
 *
 * Or, diagnosing the tutorial better than I had: *"there is no
 * synchronisation between the tutorial and what the player actually does.
 * It is enough for the player to draw another card from the deck — the
 * tutorial does not know about it and everything is out of step from there
 * on. At any moment the tutorial has to allow exactly one action, and make
 * sure it was really carried out."*
 *
 * He is right, and the drift is worse than a cosmetic one. A step waits for
 * a card to land on a named square; the player drops it one square over,
 * the gate is never met, the hand empties, the next card is dealt — and the
 * step is now waiting for a card that is no longer in the game. Nothing
 * fails. Amanda simply talks about a card the player is not holding, for
 * ever.
 *
 * ═══ DERIVED, NOT DECLARED ═══
 *
 * A `card:` field on every step is the obvious shape and it is the one that
 * rots: twenty-six lines beside a deck, and the first reorder makes them
 * lie. The deck is already dealt in the order the script talks about it, so
 * the answer is a count — the Nth step that asks for a card to be PUT
 * somewhere wants the Nth card.
 *
 * Only steps that place something consume a card. Binning and fetching back
 * out of the bin happen TO the card the next placing step is about, so they
 * do not advance the count; that is what makes the old bin lesson work at
 * all, and getting it wrong would have the tutorial undo the bin it just
 * asked for.
 *
 * Returns null for a step that is not about a card in hand. The caller
 * leaves the hand alone then — a narrative step must not reach into the
 * game.
 */
function consumes(step: ScriptStep): boolean {
  const a = step.awaits;
  if (a?.kind === "cell" || a?.kind === "king") return true;
  /*
   * Taking an action card moves it from the hand to the bar, which spends a
   * card. USING one, later, acts on something already in the bar and the
   * hand is somewhere else entirely — counting that would shift every step
   * after it onto the wrong card.
   */
  return a?.kind === "action" && a.where === "bar";
}

export function handFor(
  steps: readonly ScriptStep[],
  i: number,
  deck: readonly string[],
): string | null {
  const step = steps[i];
  if (!step || !consumes(step)) return null;
  let used = 0;
  for (let n = 0; n < i; n++) if (consumes(steps[n]!)) used++;
  return deck[used] ?? null;
}
