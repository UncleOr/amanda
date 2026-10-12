import { line as t } from "../game/copy";
/**
 * The lines Amanda has more than one of.
 *
 * Most text in the game says the same thing every time, because most text is
 * telling you something you need to know. These ten are different: they are
 * moments, not information, and a moment that repeats word for word stops
 * landing. So each one holds several lines and picks one.
 *
 * Or writes these. `pnpm copy` lists every variant separately in docs/COPY.md
 * with its own id, so a line can be rewritten, and `pnpm copy:apply` puts it
 * back here. Adding a variant means adding a line to an array — nothing else
 * in the game needs to know.
 */

/*
 * ═══ HEBREW HAS A GENDER AND THE PLAYER HAS ONE TOO ═══
 *
 * Or: "let the player choose at the start whether they are a boy or a girl and
 * fit all the microcopy to it. In most cases give something unisex — 'לשחק עם
 * חברים' instead of 'תביא חבר' — but say 'בוא ילד' should become 'בואי ילדה'."
 *
 * Both halves of that, and the first half matters more. A line written so it
 * does not need to know is better than a line written twice: fewer strings for
 * Or to write, nothing to keep in sync, and nothing to get wrong for a player
 * who has not said. So most of this file is now unisex, and only the lines
 * where Amanda is TALKING TO YOU — where the Hebrew genuinely cannot sit on
 * the fence — carry two forms.
 *
 * A line with two forms is written `{ m, f }`. Unknown gender falls back to
 * the masculine, which is the Hebrew default and what every string here said
 * before anyone was asked.
 */

export type Gender = "boy" | "girl" | null;

/** A line that has to know who it is talking to. */
export interface Gendered {
  m: string;
  f: string;
}

export type Line = string | Gendered;

/** Who the game is currently talking to. Set once the account is known. */
let gender: Gender = null;
export function setGender(g: Gender): void {
  gender = g;
}
export function getGender(): Gender {
  return gender;
}

/** One line, resolved for whoever is playing. */
export function say(line: Line): string {
  if (typeof line === "string") return line;
  return gender === "girl" ? line.f : line.m;
}

/**
 * Picked once per mount, not per render, so the words do not change while the
 * player is reading them. Every caller holds the result in state or a ref.
 */
export function pick(lines: readonly Line[]): string {
  return say(lines[Math.floor(Math.random() * lines.length)] ?? "");
}

/** Leaving a match in progress — the question, and the two answers. */
export const EXIT_TITLE = [
  t("sf076071", "כבר הולך?"),
  t("s2631ad1", "מה, זהו?"),
  t("sb4c1729", "ברצינות?"),
  t("s3bfb17f", "עכשיו דווקא?"),
  t("s4515ae6", "אבל רק התחלנו"),
] as const;

export const EXIT_BODY = [
  { m: t("sb749f7c", "הלוח שבנית נמחק. אשמור לך מקום בתפריט שלי, ילד."), f: t("sf823ea4", "הלוח שבנית נמחק. אשמור לך מקום בתפריט שלי, ילדה.") },
  t("s41bc2a0", "כל מה שבנית הולך לפח. אני אשרוד איכשהו."),
  t("s841d0a1", "הלוח נמחק והקרב לא יקרה. אף אחד לא ידע שהיית כאן."),
  t("s4f08f6b", "אני מוחקת את הלוח. אל תדאג, אני זוכרת אותך."),
  t("s10d5f41", "זה נמחק והולך. כולם חוזרים."),
] as const;

export const EXIT_CONFIRM = [
  t("s627f20a", "כן, אני בורח"),
  t("sd44f6f7", "כן, מספיק לי"),
  t("s0211124", "כן, שחרר אותי"),
  t("s3630815", "כן, ביי"),
] as const;

export const EXIT_CANCEL = [
  t("sb86d2ab", "לא, אני נשאר"),
  { m: t("sdc2715c", "לא, בוא נשחק"), f: t("s54722a8", "לא, בואי נשחק") },
  t("s420c05d", "התבלבלתי"),
  t("s07e484c", "עוד לא סיימתי"),
] as const;

/**
 * The result screen. No emoji here — the crest above the headline is the
 * drawn one, and an emoji beside it is the borrowed art Or wanted gone.
 */
export const WIN_TITLE = [
  t("s5bd3e69", "ניצחת! הפעם."),
  t("s322e6c0", "ניצחת. נתתי לך."),
  { m: t("s072fa2f", "יפה, ילד."), f: t("s47dce22", "יפה, ילדה.") },
  t("sad1cc07", "ניצחת. אל תתרגל."),
  t("sd1f0cd1", "טוב. באמת טוב."),
] as const;

export const LOSE_TITLE = [
  t("s6b08edc", "הפסדת. טעים."),
  t("s609bca4", "הפסדת. היה נחמד."),
  t("s621af20", "זהו. תודה על הארוחה."),
  t("sbc1c615", "הפסדת, וידעת שזה יקרה."),
  t("sbdbc574", "אוי. כמעט."),
] as const;

/** The opponent walked out mid-match. */
export const OPPONENT_LEFT = [
  t("s4e10573", "היריב ברח. ניצחון טכני!"),
  t("s3a0ee19", "הוא ברח. אני לא מאשימה אותו."),
  t("sdb10f2b", "נשארת לבד. זה נחשב ניצחון."),
  t("s0176373", "היריב נעלם. אכלתי אותו בדרך."),
] as const;

/** The three seconds before the build phase. */
export const COUNTDOWN_LABEL = [
  { m: t("s1661c13", "התכונן לקרב, ילד"), f: t("s0f9d55a", "התכונני לקרב, ילדה") },
  { m: t("s34b7fb9", "תתארגן, ילד"), f: t("s5361c59", "תתארגני, ילדה") },
  t("s353737f", "מתחילים. תנשום."),
  { m: t("s5656766", "קדימה, ילד"), f: t("s9175f67", "קדימה, ילדה") },
] as const;

/** The announcement that fills the screen when the fighting starts. */
export const BATTLE_PHASE = [
  t("s36e79b6", "קדימה לקרב!"),
  t("sf842646", "ועכשיו: לקרב!"),
  t("sf43f6cb", "בואו נלחם!"),
] as const;

/** The moment the boards lock and the battle begins. */
export const BATTLE_START = [
  { m: t("sa21c01f", "הקרב מתחיל, ילד"), f: t("sd988a9d", "הקרב מתחיל, ילדה") },
  t("s647d2f6", "ועכשיו נראה מה בנית"),
  t("s361ec57", "מאוחר מדי לשנות"),
  { m: t("s32acee8", "בוא נראה אותך"), f: t("s6f30a3c", "בואי נראה אותך") },
] as const;

/** Nothing on the board yet and no King chosen. */
/*
 * Gone, on purpose. Or (2026-10-06): "the line that says there is no King —
 * all of its versions — comes out, an icon will do."
 *
 * He is right, and it is worth saying why: the missing King is already drawn
 * on the board, in the empty middle slot with a crown in it. A sentence
 * underneath was the same fact a second time, in words, every time you looked
 * down at your hand. The empty crown now simply asks for attention instead
 * (see .slot--king--empty).
 */

/** Waiting for someone to play against. */
export const SEARCHING = [
  t("s69104e2", "מחפשת לך מישהו מתוק"),
  t("s43db7a1", "מחפשת לך יריב. סבלנות."),
  t("s95c7718", "מישהו יבוא. תמיד בא מישהו."),
  t("s4fa0459", "רגע, אני מסדרת לך משחק"),
] as const;

/**
 * The tutorial, once, in her voice.
 *
 * Five lines, not a manual. Each one is said while the thing it is about is
 * lit up, which is why none of them has to describe where anything is. She
 * teaches you properly on purpose — she does not mind you getting better.
 */
export const TUTORIAL = {
  // Says "a monster", and says what to do when you are holding something else.
  // The step waits for a King to actually be placed, and a new player holding
  // an action card has no way to do that — being told to drag a card they
  // cannot drag is a dead end.
  king:
    t("s50cc39e", "קודם כול מלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר. גרור מפלצת לאמצע. קלף פעולה ביד? לפח איתו."),
  guards: t("s54b2c21", "שתי המשבצות האלה שומרות עליו. כל עוד מישהו עומד שם, אי אפשר לגעת בו."),
  hand: t("s2e30355", "זה מה שיש לך ביד. לא מוצא חן בעיניך? לפח. אבל רק הקלף העליון חוזר, אז תחשוב."),
  board: t("sdc4abc1", "כל מה שאפשר למלא — למלא. מה שיישאר ריק אני אמלא, וזה לא יהיה נעים."),
  fight: t("sb496ba8", "וכשזה נראה מוכן — ללחוץ. אני כבר מוכנה."),
} as const;

/**
 * The first minute. One question per screen, asked by her.
 *
 * She is welcoming in the way she is welcoming — which is to say she has
 * already decided how this ends.
 */
export const ONBOARDING = {
  /*
   * Asked FIRST, before anything else, because every line after it is
   * addressed to somebody and Hebrew makes you choose. Deliberately phrased
   * as her being nosy rather than as a form field.
   */
  who: t("s0a11063", "רגע. לפני הכול — אני מדברת אל ילד או אל ילדה?"),
  hello: t("scae72fe", "אז הגעת. יופי. לפני שנתחיל אני רוצה לדעת את מי אני אוכלת."),
  face: t("s0d5203b", "בחר לך פרצוף. זה מה שאני אזכור."),
  name: t("s9836b0a", "ואיך קוראים לך? תן שם שאפשר לצעוק."),
  age: t("s82a43b6", "ומתי נולדת? זה רק בשבילי. אני אוהבת לדעת כמה זמן חיכיתי."),
} as const;

/** What she says while you are staring at a closed chest. */
export const CHEST_LINES = [
  t("s42071fe", "משהו בפנים. תפתח כבר."),
  t("sb72299f", "זכית. אל תתרגש מדי."),
  t("se3b46b6", "קח, הרווחת."),
  { m: t("se56f9ce", "בוא נראה מה יצא לך."), f: t("sd4cc59c", "בואי נראה מה יצא לך.") },
  t("s6e563e0", "זה לא יפתח את עצמו."),
] as const;
