import { line as t } from "../game/copy";
/**
 * Every word Amanda says while she is teaching, in one place.
 *
 * Or: *"by the way, in the admin panel give me an option to edit it too."*
 *
 * They used to be template literals scattered through coach.ts, which made
 * them unreachable from anywhere else — you cannot put a text box in an admin
 * panel around a string that only exists inside a closure. This is the same
 * shape the cards, the series and the catchphrases already use: the game
 * ships complete, and a row in the database is an OVERRIDE of one line rather
 * than the line itself. Delete the row and the shipped words come back.
 *
 * ═══ THE BRACES ARE REAL ═══
 *
 * `{card}` and friends are filled in from the card actually in hand, because
 * the hand is random and a fixed script would have to pretend it knows what
 * you drew. Every line lists the slots it has. A slot that is not filled is
 * replaced with nothing rather than left as `{card}` on a child's screen — an
 * admin who deletes a brace should get a shorter sentence, not a bug report.
 */

export interface TutorialLine {
  id: string;
  /** The shipped words. A database row may replace this and nothing else. */
  he: string;
  /** Which `{slots}` this line may use. Shown in the admin panel. */
  vars: readonly string[];
  /** When she says it, for whoever is editing. */
  when: string;
}

export const TUTORIAL_LINES: readonly TutorialLine[] = [
  {
    id: "hello-1",
    he: t("sec89d42", "היי, אני אמנדה. באת להילחם מולי, ילד? בוא נלמד איך עושים את זה."),
    vars: [],
    when: t("s9484b03", "ההקדמה, לפני שהיא מצביעה על משהו"),
  },
  {
    id: "hello-2",
    he: t("sad8f4bf", "אנחנו בחדר המשחקים. אם תנצח אותי פה תוכל להתקדם למקומות אחרים. זה האלבום שלי, זה האלבום שלך. אנחנו מדביקים מדבקות, ובסוף הן ילחמו."),
    vars: [],
    when: t("s6da50a2", "ההקדמה, שורה שנייה"),
  },
  {
    id: "first",
    he: t("sf6e019c", "נתחיל בהדבקות. הנה הקלף הראשון — {card}. {trait}. {where}."),
    vars: ["card", "trait", "where"],
    when: t("s3b5a80d", "הקלף הראשון, על לוח ריק"),
  },
  {
    id: "second",
    he: t("sdd3544e", "עוד אחד: {card}. {trait}. {where}."),
    vars: ["card", "trait", "where"],
    when: t("s8231a88", "הקלף השני"),
  },
  {
    id: "king",
    he: t("s267eda8", "ועכשיו המלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר."),
    vars: [],
    when: t("s5384124", "אחרי שני קלפים, כשאין עדיין מלך"),
  },
  {
    id: "tank",
    he: t("s2e3ddc3", "{card}? סטטי, הרבה חיים. הוא לא ילך לשום מקום — שים אותו מול המלך, שם עוצרים את מי שבא אליו."),
    vars: ["card"],
    when: t("scbdee8f", "קלף כבד וסטטי ביד, אחרי שיש מלך"),
  },
  {
    id: "flyer",
    he: t("s5877095", "{card} {moves} — הוא לא צריך שהדרך תהיה פנויה. שים אותו מאחורה ושיירה משם."),
    vars: ["card", "moves"],
    when: t("s9bfb295", "מעופף או צלף ביד"),
  },
  {
    id: "action",
    he: t("sc22b303", "קלף פעולה. לא מניחים אותו על הלוח — לוקחים אותו לבר ומפעילים כשצריך."),
    vars: [],
    when: t("s17dc9b0", "קלף פעולה ביד, אחרי שיש מלך"),
  },
  {
    id: "any",
    he: "{card}. {where}.",
    vars: ["card", "where"],
    when: t("s21cb509", "כל קלף אחר ביד — שלא נאמר עליו משהו ספציפי יותר"),
  },
  {
    id: "action-early",
    he: t("sb3dff27", "זה קלף פעולה — הוא לא יושב על הלוח. קח אותו לבר שמתחת."),
    vars: [],
    when: t("s1643dc2", "קלף פעולה ביד לפני שיש מלך"),
  },
  {
    id: "weak",
    he: t("se947507", "{card} חלש. יגיעו טובים יותר — לפח איתו."),
    vars: ["card"],
    when: t("s52db857", "קלף חלש משמעותית מהממוצע"),
  },
  {
    id: "bin",
    he: t("sb491c42", "התחרטת? הקלף העליון בפח חוזר. רק הוא, ומה שתיתן במקומו נקבר."),
    vars: [],
    when: t("s2ca2d8b", "אחרי שנזרק קלף ראשון לפח"),
  },
  {
    id: "synergy",
    he: t("s0f0bc4e", "שלושה מאותה סדרה צמודים זה לזה — {bonus} נדלק. {what}"),
    vars: ["bonus", "what"],
    when: t("sfc7ee43", "כששלושה מאותה סדרה נוגעים זה בזה"),
  },
  {
    id: "fog",
    he: t("s658fd0b", "נגמר הערפל — עכשיו רואים מה היריב שם. שינויים של הרגע האחרון?"),
    vars: [],
    when: t("s2fae425", "בתחילת שלב הפאניקה"),
  },
  {
    id: "go",
    he: t("sfce8645", "יאללה, בוא נראה מה קורה."),
    vars: [],
    when: t("s2fe9cd5", "הדבר האחרון לפני הקרב"),
  },
  {
    id: "x-poison",
    he: t("sec0b1a9", "ל{enemy} יש ערימת חיים. {card} לא מנסה לנצח אותו במכות — הארס שלו מצטבר בכל פגיעה וממשיך לשרוף גם אחרי שהוא מת. שים אותו מולו."),
    vars: ["enemy", "card"],
    when: t("s0a06b79", "ארס ביד מול קיר חיים של היריב"),
  },
  {
    id: "x-wide",
    he: t("sefad056", "הוא שם משהו שמתפצל כשהוא מת — תהרוג אחד ויהיו שניים. {card} מכה כמה נתיבים בבת אחת, וזה בדיוק מה שמבטל את זה. רק אל תשים אותו בקצה, שם חצי מהמכה הולכת לאוויר."),
    vars: ["card"],
    when: t("sa0e51a2", "מכת רוחב ביד מול משהו שמתרבה"),
  },
  {
    id: "x-lane",
    he: t("se750bda", "הוא ערם קלפים בטור אחד. {card} מבעיר את הנתיב שלפניו — כולם שם משלמים כל שנייה, ושריון לא עוזר. שים אותו מול הטור הזה."),
    vars: ["card"],
    when: t("sf7d19d0", "הצתת נתיב ביד מול טור עמוס"),
  },
  {
    id: "x-pull",
    he: t("se17e5e8", "הוא בנה משהו שיורה מרחוק ולא מתקרב. {card} גורר את כל הקו שלו אליך — ישר לתוך הטווח של השומרים שלך."),
    vars: ["card"],
    when: t("s4c27fff", "שואב ביד מול יריב ששומר מרחק"),
  },
  {
    id: "x-shield",
    he: t("se565ab8", "{ally} מכה חזק ושובר בקלות. {card} סופג חצי מכל מכה שמכוונת לשכן שלו — שים אותו ממש לידו ותן לו לחיות קצת."),
    vars: ["ally", "card"],
    when: t("s5a0fcb1", "סופג ביד כשיש לך קלף שביר שמכה חזק"),
  },
] as const;

const SHIPPED = new Map(TUTORIAL_LINES.map((l) => [l.id, l.he]));

/**
 * What the admin panel has replaced, if anything.
 *
 * A module-level map rather than a hook: `nextCue` is a pure function called
 * from an effect, and threading a dozen strings through every call site to
 * reach it would be the tail wagging the dog. Set once when the live state
 * arrives, read wherever a line is built.
 */
let overrides = new Map<string, string>();

export function setTutorialOverrides(rows: Array<{ id: string; he: string }>): void {
  overrides = new Map(rows.filter((r) => r.he?.trim()).map((r) => [r.id, r.he]));
}

/** The shipped words for a line, for the admin panel to show beside the box. */
export function shippedLine(id: string): string {
  return SHIPPED.get(id) ?? "";
}

/**
 * One line, with its slots filled.
 *
 * An unknown id returns an empty string, which `nextCue` treats as "nothing to
 * say" — better than an exception thrown at a seven-year-old mid-match because
 * somebody renamed a step.
 */
export function line(id: string, vars: Record<string, string> = {}): string {
  const raw = overrides.get(id) ?? SHIPPED.get(id) ?? "";
  return raw.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "").replace(/\s{2,}/g, " ").trim();
}
