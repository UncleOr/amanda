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

/**
 * Picked once per mount, not per render, so the words do not change while the
 * player is reading them. Every caller holds the result in state or a ref.
 */
export function pick(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? "";
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
  "הלוח שבנית נמחק. אשמור לך מקום בתפריט שלי, ילד.",
  "כל מה שבנית הולך לפח. אני אשרוד איכשהו.",
  "הלוח נמחק והקרב לא יקרה. אף אחד לא ידע שהיית כאן.",
  "אני מוחקת את הלוח. אל תדאג, אני זוכרת אותך.",
  "זה נמחק והולך. אתה תחזור, כולם חוזרים.",
] as const;

export const EXIT_CONFIRM = [
  "כן, אני בורח",
  "כן, מספיק לי",
  "כן, שחרר אותי",
  "כן, ביי",
] as const;

export const EXIT_CANCEL = [
  "לא, אני נשאר",
  "לא, בוא נשחק",
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
  "יפה, ילד.",
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
  "התכונן לקרב, ילד",
  "תתארגן, ילד",
  "מתחילים. תנשום.",
  "קדימה, ילד",
] as const;

/** The announcement that fills the screen when the fighting starts. */
export const BATTLE_PHASE = [
  "קדימה לקרב!",
  "ועכשיו: לקרב!",
  "בואו נלחם!",
] as const;

/** The moment the boards lock and the battle begins. */
export const BATTLE_START = [
  "הקרב מתחיל, ילד",
  "ועכשיו נראה מה בנית",
  "מאוחר מדי לשנות",
  "בוא נראה אותך",
] as const;

/** Nothing on the board yet and no King chosen. */
export const NO_KING = [
  "⚠️ עדיין אין מלך",
  "⚠️ בלי מלך אין ממלכה",
  "⚠️ שכחת מלך",
  "⚠️ מי מולך פה?",
] as const;

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
  king: "קודם כול מלך, ילד. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר. גרור מפלצת לאמצע. קלף פעולה ביד? לפח איתו.",
  guards: "שתי המשבצות האלה שומרות עליו. כל עוד מישהו עומד שם, אי אפשר לגעת בו.",
  hand: "זה מה שיש לך ביד. לא מוצא חן בעיניך? לפח. אבל רק הקלף העליון חוזר, אז תחשוב.",
  board: "תמלא את מה שאתה יכול. מה שיישאר ריק — אני אמלא בשבילך, ולא תאהב את זה.",
  fight: "וכשתחשוב שאתה מוכן, תלחץ. אני כבר מוכנה.",
} as const;

/**
 * The first minute. One question per screen, asked by her.
 *
 * She is welcoming in the way she is welcoming — which is to say she has
 * already decided how this ends.
 */
export const ONBOARDING = {
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
  "בוא נראה מה יצא לך.",
  "זה לא יפתח את עצמו.",
] as const;
