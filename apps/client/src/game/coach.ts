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
  const say = (id: string, text: string, target?: string): Cue | null =>
    said.has(id) ? null : { id, text, target };

  // ── the battle is about to start ──
  if (view.phase === "panic")
    return say(
      "panic",
      "נגמר הערפל — עכשיו רואים מה היריב שם. שינויים של הרגע האחרון?",
      ".side--enemy",
    );

  if (view.phase !== "build") return null;

  const inHand = card(view.hand);

  // ── a card in your hand, described by what it actually is ──
  if (view.handIsAction)
    return say("action", "קלף פעולה. לא מניחים אותו על הלוח — לוקחים אותו לבר ומפעילים כשצריך.", ".hand");

  if (inHand) {
    if (!view.king)
      return say(
        "king",
        "קודם כול מלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר.",
        ".side--me .slot--king",
      );

    if (inHand.stats.moveSpeed === 0 && inHand.stats.hp >= 800)
      return say(
        "tank",
        `${inHand.name.he}? סטטי, הרבה חיים. הוא לא ילך לשום מקום — שים אותו מול המלך, שם עוצרים את מי שבא אליו.`,
        ".side--me .slot--guard",
      );

    if (inHand.flying || inHand.stats.range === "sniper")
      return say(
        "flyer",
        `${inHand.name.he} ${inHand.flying ? "עף" : "צלף"} — הוא לא צריך שהדרך תהיה פנויה. שים אותו מאחורה ושיירה משם.`,
        ".side--me .board",
      );

    if (worth(inHand) < MEDIAN_WORTH * 0.6)
      return say(
        "weak",
        `${inHand.name.he} חלש. יגיעו טובים יותר — לפח איתו.`,
        ".hand",
      );
  }

  // ── things that only become true once you have done something ──
  if (view.discardCount > 0)
    return say(
      "bin",
      "התחרטת? הקלף העליון בפח חוזר. רק הוא, ומה שתיתן במקומו נקבר.",
      ".hand",
    );

  const syn = activeSynergy(view);
  if (syn) {
    const line = synergyLine(syn);
    if (line) return say("synergy", line, ".side--me .board");
  }

  if (Object.keys(view.placements).length >= 4 && view.actionBarCount === 0)
    return say("bar", "קלפי פעולה יושבים בבר למטה עד שתפעיל אותם. עד שלושה.", ".actions");

  return null;
}
