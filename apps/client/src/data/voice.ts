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
  "כבר הולך?",
  "מה, זהו?",
  "ברצינות?",
  "עכשיו דווקא?",
  "אבל רק התחלנו",
] as const;

export const EXIT_BODY = [
  { m: "הלוח שבנית נמחק. אשמור לך מקום בתפריט שלי, ילד.", f: "הלוח שבנית נמחק. אשמור לך מקום בתפריט שלי, ילדה." },
  "כל מה שבנית הולך לפח. אני אשרוד איכשהו.",
  "הלוח נמחק והקרב לא יקרה. אף אחד לא ידע שהיית כאן.",
  "אני מוחקת את הלוח. אל תדאג, אני זוכרת אותך.",
  "זה נמחק והולך. כולם חוזרים.",
] as const;

export const EXIT_CONFIRM = [
  "כן, אני בורח",
  "כן, מספיק לי",
  "כן, שחרר אותי",
  "כן, ביי",
] as const;

export const EXIT_CANCEL = [
  "לא, אני נשאר",
  { m: "לא, בוא נשחק", f: "לא, בואי נשחק" },
  "התבלבלתי",
  "עוד לא סיימתי",
] as const;

/**
 * The result screen. No emoji here — the crest above the headline is the
 * drawn one, and an emoji beside it is the borrowed art Or wanted gone.
 */
export const WIN_TITLE = [
  "ניצחת! הפעם.",
  "ניצחת. נתתי לך.",
  { m: "יפה, ילד.", f: "יפה, ילדה." },
  "ניצחת. אל תתרגל.",
  "טוב. באמת טוב.",
] as const;

export const LOSE_TITLE = [
  "הפסדת. טעים.",
  "הפסדת. היה נחמד.",
  "זהו. תודה על הארוחה.",
  "הפסדת, וידעת שזה יקרה.",
  "אוי. כמעט.",
] as const;

/** The opponent walked out mid-match. */
export const OPPONENT_LEFT = [
  "היריב ברח. ניצחת בטכני.",
  "הוא ברח. אני לא מאשימה אותו.",
  "נשארת לבד. זה נחשב ניצחון.",
  "היריב נעלם. אכלתי אותו בדרך.",
] as const;

/** The three seconds before the build phase. */
export const COUNTDOWN_LABEL = [
  { m: "התכונן לקרב, ילד", f: "התכונני לקרב, ילדה" },
  { m: "תתארגן, ילד", f: "תתארגני, ילדה" },
  "מתחילים. תנשום.",
  { m: "קדימה, ילד", f: "קדימה, ילדה" },
] as const;

/** The announcement that fills the screen when the fighting starts. */
export const BATTLE_PHASE = [
  "קדימה לקרב!",
  "ועכשיו: לקרב!",
  "בואו נלחם!",
] as const;

/** The moment the boards lock and the battle begins. */
export const BATTLE_START = [
  { m: "הקרב מתחיל, ילד", f: "הקרב מתחיל, ילדה" },
  "ועכשיו נראה מה בנית",
  "מאוחר מדי לשנות",
  { m: "בוא נראה אותך", f: "בואי נראה אותך" },
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
  "מחפשת לך מישהו מתוק",
  "מחפשת לך יריב. סבלנות.",
  "מישהו יבוא. תמיד בא מישהו.",
  "רגע, אני מסדרת לך משחק",
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
    "קודם כול מלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר. גרור מפלצת לאמצע. קלף פעולה ביד? לפח איתו.",
  guards: "שתי המשבצות האלה שומרות עליו. כל עוד מישהו עומד שם, אי אפשר לגעת בו.",
  hand: "זה מה שיש לך ביד. לא מוצא חן בעיניך? לפח. אבל רק הקלף העליון חוזר, אז תחשוב.",
  board: "כל מה שאפשר למלא — למלא. מה שיישאר ריק אני אמלא, וזה לא יהיה נעים.",
  fight: "וכשזה נראה מוכן — ללחוץ. אני כבר מוכנה.",
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
  who: "רגע. לפני הכול — אני מדברת אל ילד או אל ילדה?",
  hello: "אז הגעת. יופי. לפני שנתחיל אני רוצה לדעת את מי אני אוכלת.",
  face: "בחר לך פרצוף. זה מה שאני אזכור.",
  name: "ואיך קוראים לך? תן שם שאפשר לצעוק.",
  age: "ומתי נולדת? זה רק בשבילי. אני אוהבת לדעת כמה זמן חיכיתי.",
} as const;

/** What she says while you are staring at a closed chest. */
export const CHEST_LINES = [
  "משהו בפנים. תפתח כבר.",
  "זכית. אל תתרגש מדי.",
  "קח, הרווחת.",
  { m: "בוא נראה מה יצא לך.", f: "בואי נראה מה יצא לך." },
  "זה לא יפתח את עצמו.",
] as const;
