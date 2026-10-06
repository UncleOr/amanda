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
import type { Card } from "@amanda/shared";

export interface Cue {
  /** Which line this is, so it is only ever said once. */
  id: string;
  text: string;
  /** What to spotlight, if anything. */
  target?: string;
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
 * The rule is THREE OF THE SAME FAMILY TOUCHING EACH OTHER — sharing an edge,
 * not a corner — and each family has its own bonus rather than all of them
 * doubling power. It used to be three anywhere on the board; Or changed it on
 * 2026-10-06 so that where you put a card matters. Teaching the wrong rule
 * costs more than saying nothing, which is why this sentence says the rule.
 */
function synergyLine(seriesId: string): string | null {
  const s = SERIES_BY_ID.get(seriesId);
  if (!s?.synergy) return null;
  return `שלושה מאותה סדרה צמודים זה לזה — ${s.synergy.name.he} נדלק. ${s.synergy.description.he}`;
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
            text: `ל${wall.name.he} יש ערימת חיים. ${inHand!.name.he} לא מנסה לנצח אותו במכות — הארס שלו מצטבר בכל פגיעה וממשיך לשרוף גם אחרי שהוא מת. שים אותו מולו.`,
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
            text: `הוא שם משהו שמתפצל כשהוא מת — תהרוג אחד ויהיו שניים. ${inHand!.name.he} מכה כמה נתיבים בבת אחת, וזה בדיוק מה שמבטל את זה. רק אל תשים אותו בקצה, שם חצי מהמכה הולכת לאוויר.`,
            target: board,
          }
        : null;
    },

    // A burning lane vs a queue. One lane only, so it needs a real queue.
    () => {
      return has(inHand, "lineDenialDot") && deepestLane(view) >= 2
        ? {
            id: "x-lane",
            text: `הוא ערם קלפים בטור אחד. ${inHand!.name.he} מבעיר את הנתיב שלפניו — כולם שם משלמים כל שנייה, ושריון לא עוזר. שים אותו מול הטור הזה.`,
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
            text: `הוא בנה משהו שיורה מרחוק ולא מתקרב. ${inHand!.name.he} גורר את כל הקו שלו אליך — ישר לתוך הטווח של השומרים שלך.`,
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
            text: `${fragile.name.he} מכה חזק ושובר בקלות. ${inHand!.name.he} סופג חצי מכל מכה שמכוונת לשכן שלו — שים אותו ממש לידו ותן לו לחיות קצת.`,
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
  const inHand = card(view.hand);
  const steps: Array<() => Cue | null> = [
    // 1. a King, before anything else
    () =>
      !view.king && inHand && !view.handIsAction
        ? {
            id: "king",
            text: "קודם כול מלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר.",
            target: ".side--me .slot--king",
          }
        : null,

    // 2. "a giant? he is static, shoots hard, lots of health — guard the King"
    () =>
      view.king && inHand && inHand.stats.moveSpeed === 0 && inHand.stats.hp >= 800
        ? {
            id: "tank",
            text: `${inHand.name.he}? סטטי, הרבה חיים. הוא לא ילך לשום מקום — שים אותו מול המלך, שם עוצרים את מי שבא אליו.`,
            target: ".side--me .slot--guard",
          }
        : null,

    // 3. "a dragon? light, it flies — to the back, and let it shoot"
    () =>
      view.king && inHand && (inHand.flying || inHand.stats.range === "sniper")
        ? {
            id: "flyer",
            text: `${inHand.name.he} ${inHand.flying ? "עף" : "צלף"} — הוא לא צריך שהדרך תהיה פנויה. שים אותו מאחורה ושיירה משם.`,
            target: ".side--me .board",
          }
        : null,

    // 4. "an action card. we'll use it later"
    () =>
      view.handIsAction
        ? {
            id: "action",
            text: "קלף פעולה. לא מניחים אותו על הלוח — לוקחים אותו לבר ומפעילים כשצריך.",
            target: ".hand",
          }
        : null,

    // 5. "a weak card. better ones will come. bin it"
    () =>
      view.king && inHand && worth(inHand) < MEDIAN_WORTH * 0.6
        ? {
            id: "weak",
            text: `${inHand.name.he} חלש. יגיעו טובים יותר — לפח איתו.`,
            target: ".hand",
          }
        : null,

    // 6. "oh, we changed our mind. let's take it back"
    () =>
      view.discardCount > 0
        ? {
            id: "bin",
            text: "התחרטת? הקלף העליון בפח חוזר. רק הוא, ומה שתיתן במקומו נקבר.",
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
            text: "נגמר הערפל — עכשיו רואים מה היריב שם. שינויים של הרגע האחרון?",
            target: ".side--enemy",
          }
        : null,

    // 9. "right, let's see what happens"
    () =>
      view.phase === "panic" && said.has("fog")
        ? { id: "go", text: "יאללה, בוא נראה מה קורה.", target: ".hand .btn-fight" }
        : null,
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
