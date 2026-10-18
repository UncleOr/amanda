/**
 * Amanda talking you through your first matches.
 *
 * Not a script. She reacts to the card you actually drew and the board you
 * actually built, which is what Or asked for: "a giant? he's static, shoots
 * hard, lots of health — let's put him guarding the King." A fixed sequence
 * would have to pretend it knows what you are holding.
 *
 * Each line fires at most once per match. The rules below describe the game as
 * it really is — a tutorial that teaches a rule the engine does not have is
 * worse than no tutorial at all.
 */
import { CATALOG, SERIES_BY_ID, synergyGroups } from "../data/catalog";
import { line } from "../data/tutorialLines";
import { SCRIPTS } from "./lessonScript";
import type { Card } from "@amanda/shared";
import { line as t } from "./copy";
import { say } from "./lang";

export interface Cue {
  /** Which line this is, so it is only ever said once. */
  id: string;
  text: string;
  /** What to spotlight, if anything. */
  target?: string;
  /**
   * This step is written rather than matched, so it waits for its target
   * instead of being skipped when the board has not been painted yet.
   */
  patient?: boolean;
  /**
   * Move the match on once this step is done — see ScriptStep.advance. There
   * is no clock in a lesson, so the phases have to be caused by something.
   */
  advance?: "panic" | "prebattle";
  /**
   * The highlighted thing IS the action: press it, and that is the step.
   *
   * ═══ THIS WAS WRITTEN DOWN AND NEVER CARRIED ═══
   *
   * `ScriptStep.press` has existed since the day the fight button needed to
   * stop growing a "next" beside it — a next there dismisses the tutorial on
   * a board that never fought. It was set on l1-go and l2-go, and it never
   * arrived: scriptedCue built this object field by field and did not copy
   * it, so every scripted step reached Tutorial.tsx without it.
   *
   * Found by walking stage one in a browser and seeing "press start battle"
   * with a "continue" button underneath.
   */
  press?: "target";
  /**
   * What the player has to actually DO before this step will move on.
   *
   * Without this every step was "read it, press continue" — which is a
   * slideshow with a hole cut in it, not a walkthrough. Tutorial.tsx has
   * always supported waiting (its `done` prop); nothing ever used it.
   *
   * Only the steps where doing the thing is the lesson carry one. "This card
   * is weak, bin it" is advice; "put a King down" is the game refusing to
   * start without one, and a tutorial that lets you skip past it has taught
   * nothing.
   */
  awaits?: Awaits;
}

/**
 * What has to become true before she moves on.
 *
 * Or: *"there shouldn't be a 'got it' button at all. The taps should just be
 * Amanda telling you which card to put down next."* So a step is never read
 * and dismissed — it is answered by doing the thing, and this is the thing,
 * described rather than captured.
 *
 * DESCRIBED, because a callback would close over the board as it was when the
 * step appeared and answer "is a King down?" with whatever was true then,
 * forever. `{ kind: "placements", atLeast: 2 }` is a question the caller asks
 * the LIVE match on every render, which is the only kind that can be right.
 */
export type Awaits =
  | { kind: "king" }
  | { kind: "placements"; atLeast: number }
  | { kind: "bar"; atLeast: number }
  | { kind: "discard"; atLeast: number }
  /*
   * The three the WRITTEN lesson needs (see game/lessonScript.ts). The four
   * above ask "has enough happened"; these three ask "has THE thing
   * happened", which is what a step naming a square and a card has to wait
   * for. "Two cards are down" is not an answer to "put the tree in the guard
   * post".
   */
  /** One of these squares is filled. Keys are `"x-y"`, as BoardGrid writes them. */
  | { kind: "cell"; cells: readonly string[] }
  /** This action card has reached the bar, or been played. */
  | { kind: "action"; id: string; where: "bar" | "used" }
  /** The match has reached this phase. */
  | { kind: "phase"; phase: string };

/**
 * Has this step been carried out?
 *
 * ═══ WHY IT IS A FUNCTION AND NOT A CALLBACK ON THE STEP ═══
 *
 * A callback would close over the board as it was when the step appeared and
 * answer "is a King down?" with whatever was true back then, forever. The
 * gate is DESCRIBED instead, and answered here against the live match on
 * every render — this file has had that bug once already.
 *
 * ═══ AND WHY IT LIVES HERE RATHER THAN IN App.tsx ═══
 *
 * It was a nested ternary in the markup, which held four kinds. The written
 * lesson needs seven, and the fifth is where a ternary chain stops being
 * readable and starts being a place bugs hide.
 */
export function gateMet(awaits: Awaits, view: GateView): boolean {
  /*
   * `Awaits`, not `Awaits | undefined`. It took the optional form for one
   * afternoon and returned `true` for a step with no gate — which Tutorial
   * reads as "already done" and skips instantly. Every ungated line in both
   * lessons disappeared before it could be read, and the tests were happy
   * because they ask the coach what it would SAY, not what the screen does.
   *
   * A step with no gate has no answer here. The caller must not ask.
   */
  switch (awaits.kind) {
    case "king":
      return view.hasKing;
    case "cell":
      return awaits.cells.some((key) => key in view.placements);
    case "action": {
      const chip = view.actionBar.find((a) => a.id === awaits.id);
      return awaits.where === "used" ? !!chip?.used : !!chip;
    }
    case "phase":
      return view.phase === awaits.phase;
    default:
      break;
  }
  /*
   * ═══ OR THE CARD IT IS ABOUT IS GONE ═══
   *
   * "Take it to the bar" and "bin this one" are both about the card IN YOUR
   * HAND. If the hand is empty the card has already gone somewhere — onto
   * the board, into the bin, into the bar — and the step is over however it
   * ended.
   *
   * Without this it waits for a count that can no longer rise. The clock
   * used to hide it: the build phase ran out and dragged everyone forward.
   * Stopping the clock for lessons turned a step nobody noticed into a dead
   * end, with Amanda asking a child to bin a card they are not holding and
   * the bin button greyed out.
   *
   * It applies only to the COUNTING gates. A step that names a square is not
   * about the card in your hand, and letting an empty hand satisfy it would
   * skip the lesson the moment you put the card down somewhere else.
   */
  if (view.hand === null) return true;
  switch (awaits.kind) {
    case "placements":
      return Object.keys(view.placements).length >= awaits.atLeast;
    case "bar":
      return view.actionBar.length >= awaits.atLeast;
    case "discard":
      return view.discardCount >= awaits.atLeast;
  }
}

/** What answering a gate needs to look at. */
export interface GateView {
  phase: string;
  hand: string | null;
  hasKing: boolean;
  placements: Record<string, string>;
  actionBar: Array<{ id: string; used: boolean }>;
  discardCount: number;
}

/** Everything the coach is allowed to look at. */
export interface CoachView {
  phase: string;
  hand: string | null;
  handIsAction: boolean;
  placements: Record<string, string>;
  king: string | null;
  discardCount: number;
  actionBarCount: number;
  /**
   * Which lesson this is. 1 is the walkthrough — King, guard, flyer, action
   * card, bin, series, fog — in Or's order. 2 is the match where she stops
   * explaining the buttons and starts explaining the opponent.
   */
  matchNo?: number;
  /** The opponent's board as it is currently shown. Fogged until panic. */
  opponent?: { placements: Record<string, string>; king: string | null };
}

const card = (id: string | null): Card | null => (id ? (CATALOG.get(id) ?? null) : null);

/** Roughly how good a card is, for "this one is weak" — the same shape the AI uses. */
function worth(c: Card): number {
  return c.stats.hp + c.stats.power * 4;
}

/** The median of the collectable pool, worked out once. */
const MEDIAN_WORTH = (() => {
  const all = [...CATALOG.values()].filter((c) => c.launch).map(worth).sort((a, b) => a - b);
  return all.length ? (all[Math.floor(all.length / 2)] ?? 0) : 0;
})();

/**
 * The series bonus, described accurately.
 *
 * The rule is THREE OF THE SAME SERIES TOUCHING EACH OTHER — sharing an edge,
 * not a corner — and each family has its own bonus rather than all of them
 * doubling power. It used to be three anywhere on the board; Or changed it on
 * 2026-10-06 so that where you put a card matters. Teaching the wrong rule
 * costs more than saying nothing, which is why this sentence says the rule.
 */
function synergyLine(seriesId: string): string | null {
  const s = SERIES_BY_ID.get(seriesId);
  if (!s?.synergy) return null;
  return line("synergy", { bonus: say(s.synergy.name), what: say(s.synergy.description) });
}

/** Which series has a touching group big enough, using the engine's own rule. */
function activeSynergy(view: CoachView): string | null {
  const groups = synergyGroups(view.placements, view.king);
  for (const seriesId of groups.keys()) return seriesId;
  return null;
}

/* ═══════════════ the second lesson: what the opponent put down ═══════════════
 *
 * Or's ask: "if I see the opponent played X it pays me to play Y to defend
 * against him or to hurt him. We need a few strategies like that, maybe for
 * the second tutorial match."
 *
 * Two things make this work, and both are constraints rather than choices:
 *
 *   1. YOU CAN ONLY COUNTER WHAT YOU CAN SEE. The caller passes in only the
 *      cells that are actually revealed, so these rules cannot point at a
 *      card the player is looking at the back of. That matters more than it
 *      sounds: against the computer the opponent's whole board exists from
 *      the first second and is merely hidden, so reading it directly would
 *      have had her name cards nobody could see.
 *
 *      This happens during BUILD, not only in the panic seconds. Their front
 *      row — where the guards, the walls and the swarms sit — is visible for
 *      all ninety seconds, which is the row worth answering and the time to
 *      answer it in.
 *
 *   2. SHE ONLY SAYS IT WHEN IT IS TRUE. Each rule checks the card actually
 *      in your hand against the cards actually on their board. Telling a
 *      child "poison beats a wall" while they hold neither teaches nothing
 *      and costs trust.
 *
 * The matchups themselves are measured, not invented — see docs/COUNTERS.md
 * and packages/engine/src/counters.test.ts.
 */

/** Does this card carry that ability? */
function has(c: Card | null, ability: string): boolean {
  return !!c?.abilities.some((a) => a.type === ability);
}

/** Every card the opponent is currently showing, King included. */
function enemyCards(view: CoachView): Card[] {
  const ids = [
    ...Object.values(view.opponent?.placements ?? {}),
    ...(view.opponent?.king ? [view.opponent.king] : []),
  ];
  return ids.map((id) => card(id)).filter((c): c is Card => c !== null);
}

/** The lane a cell key sits in, for "are these queued up behind each other". */
function laneOf(key: string): number {
  return Number(key.split("-")[1]);
}

/** The most cards the opponent has queued in any single lane. */
function deepestLane(view: CoachView): number {
  const byLane = new Map<number, number>();
  for (const key of Object.keys(view.opponent?.placements ?? {})) {
    const lane = laneOf(key);
    byLane.set(lane, (byLane.get(lane) ?? 0) + 1);
  }
  return Math.max(0, ...byLane.values());
}

/** A card of yours that hits far harder than it can take. */
function glassCannon(view: CoachView): Card | null {
  const mine = [...Object.values(view.placements), ...(view.king ? [view.king] : [])]
    .map((id) => card(id))
    .filter((c): c is Card => c !== null);
  return mine.find((c) => c.stats.power >= c.stats.hp) ?? null;
}

/**
 * What to say about a card you are holding, in Or's shape.
 *
 * He wrote the first line as *"what is it? a dragon. it's strong. it flies.
 * let's put it at the back"* — a name, a trait, a place. The hand is random,
 * so the trait and the place are read off the card that actually turned up
 * rather than hoped for.
 */
function trait(c: Card): string {
  if (c.flying) return t("sc10480b", "הוא מעופף");
  if (c.stats.range === "sniper") return t("s4a2ba08", "הוא צלף");
  if (c.stats.hp >= 800) return t("sdf5d45f", "הוא עבה");
  if (c.stats.power >= c.stats.hp) return t("s46589c2", "הוא חזק");
  if (c.stats.moveSpeed === 0) return t("s6124c70", "הוא לא זז");
  return t("se7147b6", "הוא בסדר גמור");
}

/** Where that card wants to stand, and why in one clause. */
function wants(c: Card): string {
  if (c.flying || c.stats.range === "sniper") return t("s9e7ee3f", "נמקם אותו מאחורה");
  if (c.stats.moveSpeed === 0 && c.stats.hp >= 800) return t("seb09973", "נמקם אותו מקדימה");
  return t("sfe838f6", "נמקם אותו באמצע");
}

function counterCues(view: CoachView, inHand: Card | null): Array<() => Cue | null> {
  const theirs = enemyCards(view);
  const board = ".side--enemy";
  return [
    // Poison vs a wall. Measured: a 300hp poisoner kills a 3,000hp wall that
    // the same card without poison cannot scratch, and armor does not help.
    () => {
      const wall = theirs.find((c) => c.stats.hp >= 1200);
      return has(inHand, "stackingDot") && wall
        ? {
            id: "x-poison",
            text: line("x-poison", { enemy: say(wall.name), card: say(inHand!.name) }),
            target: board,
          }
        : null;
    },

    // A wide swing vs anything that multiplies.
    () => {
      const multiplies = theirs.some(
        (c) => has(c, "splitOnDeath") || has(c, "swarmOnDeath"),
      );
      return has(inHand, "aoeRowAttack") && multiplies
        ? {
            id: "x-wide",
            text: line("x-wide", { card: say(inHand!.name) }),
            target: board,
          }
        : null;
    },

    // A burning lane vs a queue. One lane only, so it needs a real queue.
    () => {
      return has(inHand, "lineDenialDot") && deepestLane(view) >= 2
        ? {
            id: "x-lane",
            text: line("x-lane", { card: say(inHand!.name) }),
            target: board,
          }
        : null;
    },

    // The vacuum vs a board that wants to stay far away.
    () => {
      const keepsDistance = theirs.some(
        (c) => c.flying || c.stats.range === "sniper",
      );
      return has(inHand, "pullVacuum") && keepsDistance
        ? {
            id: "x-pull",
            text: line("x-pull", { card: say(inHand!.name) }),
            target: board,
          }
        : null;
    },

    // The protector half: not "what beats what", but "what sits beside what".
    () => {
      const fragile = glassCannon(view);
      return has(inHand, "damageShareAdjacent") && fragile
        ? {
            id: "x-shield",
            text: line("x-shield", { ally: say(fragile.name), card: say(inHand!.name) }),
            target: ".side--me .board",
          }
        : null;
    },
  ];
}

/**
 * The next thing worth saying, or null.
 *
 * Order matters: the ones that comment on what is in your hand come first,
 * because they stop being true the moment you play it.
 */
/**
 * The next step of a WRITTEN lesson: the first one not yet said.
 *
 * No matching, no conditions — Or wrote the second match out step by step
 * and the only question here is how far through it we are. A step whose
 * moment "never comes" cannot happen, because the deck deals the card each
 * step is about (see game/lessonScript.ts).
 *
 * Returns null when the script runs out, which hands the match back to the
 * reactive rules below — so a child who wanders off the script is not left
 * in silence.
 */
function scriptedCue(view: CoachView, said: Set<string>): Cue | null {
  const script = view.matchNo ? SCRIPTS[view.matchNo] : undefined;
  if (!script) return null;
  /*
   * ═══ NOT DURING THE COUNTDOWN ═══
   *
   * A match opens on three seconds of countdown, and the board is not on the
   * screen yet. Tutorial.tsx gives a step 1.2s to find what it points at and
   * then skips it rather than dead-ending — which is right, and which ate the
   * first two lines of this lesson every single time: she opened on "x-ray, an
   * action card that breaks that rule" with no idea what rule, because "look
   * at my board" had been spoken to a screen that had no board on it.
   *
   * The reactive rules never hit this because they need a card in hand, and
   * during a countdown there is none. A script does not wait for a card.
   */
  if (view.phase !== "build" && view.phase !== "panic") return null;
  const step = script.find((s) => !said.has(s.id));
  if (!step) return null;
  const text = line(step.id);
  if (!text) return null;
  return {
    id: step.id,
    text,
    patient: true,
    ...(step.target ? { target: step.target } : {}),
    ...(step.awaits ? { awaits: step.awaits } : {}),
    ...(step.advance ? { advance: step.advance } : {}),
    ...(step.press ? { press: step.press } : {}),
  };
}

/** Does this lesson have a written script at all? */
function isScripted(view: CoachView): boolean {
  return Boolean(view.matchNo && SCRIPTS[view.matchNo]);
}

export function nextCue(view: CoachView, said: Set<string>): Cue | null {
  /*
   * ORDER IS THE POINT.
   *
   * Or wrote the tutorial as a walkthrough — king, then the giant, then the
   * dragon, then an action card, then a weak one, then changing your mind,
   * then the series bonus, then the fog, then go. The first version answered
   * with whatever happened to be true first, which is reactive but not a
   * walkthrough. These are tried in HIS order, so the first one that applies
   * is always the earliest one still unsaid.
   *
   * A step whose moment never comes is simply skipped rather than stalling
   * the whole sequence behind it — you cannot make someone draw a dragon.
   */
  /*
   * A written lesson wins over every rule below it. The rules describe the
   * game in general; the script describes THIS match, and where both have
   * something to say the script is the one that was approved line by line.
   */
  const scripted = scriptedCue(view, said);
  if (scripted) return scripted;
  /*
   * ═══ AND WHEN A SCRIPT RUNS OUT, SHE STOPS ═══
   *
   * The rules below describe the game in general and were lesson one, back
   * when lesson one was reactive. All three stages are written now, and a
   * stage that has said its last line is OVER — the next thing is the
   * battle, and then its ending.
   *
   * Without this the rules took over the moment a script finished, so stage
   * one — whose last line is "press start battle" — followed it with the
   * series-bonus rule, about three plants nobody was holding. Walked in a
   * browser; it is the line after the last line.
   */
  if (isScripted(view)) return null;

  const inHand = card(view.hand);
  const down = Object.keys(view.placements).length;
  const steps: Array<() => Cue | null> = [
    /*
     * ═══ STICKERS FIRST, THE KING THIRD ═══
     *
     * Or, after playing it: *"only after one more card should you show the
     * King. And then the guard. That's how it makes sense."*
     *
     * He is right, and the old order was mine: the King came first because it
     * is the most important rule. But the first thing a child sees is a card
     * in their hand, and the first thing they want to do is put it somewhere.
     * Opening with a rule about a piece they have not met yet teaches the rule
     * to nobody. Two cards down, and now the King means something.
     */
    () =>
      down === 0 && inHand && !view.handIsAction
        ? {
            id: "first",
            text: line("first", {
              card: say(inHand.name),
              trait: trait(inHand),
              where: wants(inHand),
            }),
            target: ".side--me .board",
            awaits: { kind: "placements", atLeast: 1 },
          }
        : null,

    () =>
      down === 1 && inHand && !view.handIsAction
        ? {
            id: "second",
            text: line("second", {
              card: say(inHand.name),
              trait: trait(inHand),
              where: wants(inHand),
            }),
            target: ".side--me .board",
            awaits: { kind: "placements", atLeast: 2 },
          }
        : null,

    // Now the King, with two of your own cards already on the board.
    () =>
      !view.king && down >= 2 && inHand && !view.handIsAction
        ? {
            id: "king",
            text: line("king"),
            target: ".side--me .slot--king",
            // She waits. The board cannot do anything without one.
            awaits: { kind: "king" },
          }
        : null,

    // Then the one who stands in front of him.
    () =>
      view.king && inHand && inHand.stats.moveSpeed === 0 && inHand.stats.hp >= 800
        ? {
            id: "tank",
            text: line("tank", { card: say(inHand.name) }),
            target: ".side--me .slot--guard",
            // One more than is on the board right now: "something is placed"
            // was already true, so the step answered itself instantly.
            awaits: { kind: "placements", atLeast: down + 1 },
          }
        : null,

    () =>
      view.king && inHand && (inHand.flying || inHand.stats.range === "sniper")
        ? {
            id: "flyer",
            text: line("flyer", {
              card: say(inHand.name),
              moves: inHand.flying ? t("s8f1fa7e", "עף") : t("sc2c8332", "צלף"),
            }),
            target: ".side--me .board",
            awaits: { kind: "placements", atLeast: down + 1 },
          }
        : null,

    // Action cards last: "ואז קלפי פעולה". They are a different kind of
    // object, and a different kind of object before the first one is
    // understood is just noise.
    () =>
      view.handIsAction && view.king
        ? {
            id: "action",
            text: line("action"),
            target: ".hand",
            awaits: { kind: "bar", atLeast: view.actionBarCount + 1 },
          }
        : null,

    // 5. "a weak card. better ones will come. bin it"
    () =>
      view.king && inHand && worth(inHand) < MEDIAN_WORTH * 0.6
        ? {
            id: "weak",
            text: line("weak", { card: say(inHand.name) }),
            target: ".hand",
            awaits: { kind: "discard", atLeast: view.discardCount + 1 },
          }
        : null,

    // 6. "oh, we changed our mind. let's take it back"
    () =>
      view.discardCount > 0
        ? {
            id: "bin",
            text: line("bin"),
            target: ".hand",
          }
        : null,

    // 7. the series bonus — the real rule, not adjacency
    () => {
      const syn = activeSynergy(view);
      const line = syn ? synergyLine(syn) : null;
      return line ? { id: "synergy", text: line, target: ".side--me .board" } : null;
    },

    // 8. "the fog is gone — you can see what they put down"
    () =>
      view.phase === "panic"
        ? {
            id: "fog",
            text: line("fog"),
            target: ".side--enemy",
          }
        : null,

    // 9. "right, let's see what happens"
    () =>
      view.phase === "panic" && said.has("fog")
        ? { id: "go", text: line("go"), target: ".hand .btn-fight" }
        : null,

    /*
     * ═══ SHE IS NEVER SILENT WHILE YOU ARE HOLDING SOMETHING ═══
     *
     * Or: *"the second card that shows up — Amanda doesn't say what to do
     * with it."* She did not, and here is why: every line above has a
     * CONDITION, and when a card matches none of them — not heavy, not
     * flying, not weak, not the second — nothing fired at all. An action card
     * drawn before the King was the worst case: the action line waits for a
     * King, and the card lines skip actions, so the tutorial simply stopped
     * talking with a card in your hand and no way to know what to do.
     *
     * So this is last, it has no condition beyond "you are holding
     * something", and its id counts the board — which makes it fire once per
     * card rather than once per match. In a walkthrough that is the point:
     * every single card gets told where it goes.
     */
    () => {
      if (view.handIsAction)
        return {
          id: `any-bar-${view.actionBarCount}`,
          text: line("action-early"),
          target: ".hand",
          awaits: { kind: "bar", atLeast: view.actionBarCount + 1 },
        };
      return inHand
        ? {
            id: `any-${down}`,
            text: line("any", { card: say(inHand.name), where: wants(inHand) }),
            target: ".side--me .board",
            awaits: { kind: "placements", atLeast: down + 1 },
          }
        : null;
    },
  ];

  if (view.phase !== "build" && view.phase !== "panic") return null;

  /*
   * The second lesson jumps the queue.
   *
   * The walkthrough has already been given once by now, and the thing on
   * screen that actually needs explaining is the board opposite — not where
   * the bin is. It is tried BEFORE the ordered steps so a leftover "you could
   * take from the bin" cannot talk over it.
   */
  if ((view.matchNo ?? 1) >= 2) {
    for (const step of counterCues(view, inHand)) {
      const cue = step();
      if (cue && !said.has(cue.id)) return cue;
    }
  }

  for (const step of steps) {
    const cue = step();
    if (cue && !said.has(cue.id)) return cue;
  }
  return null;
}
