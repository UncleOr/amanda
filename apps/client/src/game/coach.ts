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
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
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
 * NOTE for Or: in the game the bonus counts THREE OF THE SAME SERIES ANYWHERE
 * on your board — it is not about them being next to each other, and it is not
 * always "double power": each series has its own bonus. Said plainly here
 * because teaching the wrong rule would cost more than saying nothing.
 */
function synergyLine(seriesId: string): string | null {
  const s = SERIES_BY_ID.get(seriesId);
  if (!s?.synergy) return null;
  return `שלושה מאותה סדרה על הלוח — ${s.synergy.name.he} נדלק. ${s.synergy.description.he}`;
}

/** Which series already has three or more placed. */
function activeSynergy(view: CoachView): string | null {
  const counts = new Map<string, number>();
  const ids = [...Object.values(view.placements), ...(view.king ? [view.king] : [])];
  for (const id of ids) {
    const c = card(id);
    if (!c?.seriesId) continue;
    counts.set(c.seriesId, (counts.get(c.seriesId) ?? 0) + 1);
  }
  for (const [seriesId, n] of counts) {
    const s = SERIES_BY_ID.get(seriesId);
    if (s?.synergy && n >= s.synergy.threshold) return seriesId;
  }
  return null;
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
  for (const step of steps) {
    const cue = step();
    if (cue && !said.has(cue.id)) return cue;
  }
  return null;
}
