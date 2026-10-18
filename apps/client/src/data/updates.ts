import { line as t } from "../game/copy";
/**
 * What is new in the game, newest first.
 *
 * Or asked for this under "about and updates": *"what's new in this version,
 * so there is a reason to come back."* That is the job — not a changelog. A
 * changelog is for whoever built the thing; this is for a seven-year-old
 * deciding whether to open the game again, so every line is something he can
 * see or do, and nothing here mentions a refactor.
 *
 * ═══ WHY IT IS A FILE AND NOT A TABLE ═══
 *
 * Everything else Or can change without a deploy goes in the database —
 * cards, the shop, the words on the screen. This does not, and the reason is
 * that an update note is about a VERSION. It is true of the build it ships in
 * and it would be a lie on any other one: a player on an old copy reading
 * "now with nachos" when their copy has no nachos is worse than reading
 * nothing. Shipping the notes with the build keeps them true by construction,
 * and means the page works with no network at all.
 *
 * ═══ THE WORDS ARE OR'S ═══
 *
 * He is a copywriter and writes the player-facing strings. These are drafts in
 * roughly the right voice so the screen can be built and looked at; rewrite
 * freely. The only rule is the one above — say what a player can SEE.
 */

export interface Update {
  /** Stable, and the thing "have I read this" is remembered by. Newest sorts last. */
  id: string;
  /** As a player would say it, not a semver. */
  when: string;
  title: string;
  lines: string[];
}

/**
 * Newest LAST, so adding one is appending — and `at(-1)` is "the newest",
 * which is what the unread dot compares against. The screen reverses it.
 */
export const UPDATES: readonly Update[] = [
  {
    id: "2026-10-06-shop",
    when: t("s00ba05b", "אוקטובר 2026"),
    title: t("s8e775e4", "חנות נוחות, חברים, ודיווח"),
    lines: [
      t("sffee556", "נפתחה חנות נוחות — אווטארים, אימוג'ים וקלפים, הכל ביהלומים."),
      t("s945e9ab", "אפשר להוסיף לחברים מישהו ששיחקתם מולו, לראות מי מחובר, ולהזמין אותו למשחק."),
      t("s1f2e3f1", "אפשר להגיד ליריב ארבעה-עשר משפטים מוכנים, וגם לבחור לא לראות הודעות בכלל."),
      t("sc99cf96", "יש כפתור לדווח על באג או על שחקן."),
    ],
  },
  {
    id: "2026-10-07-progress",
    when: t("sb7b7b9a", "אוקטובר 2026"),
    title: t("s9ff5891", "נאצ'וס, אתגרים, וחוגת קושי"),
    lines: [
      t("s86e4a59", "כל משחק נותן נאצ'וס לפי כמה טוב שיחקתם — גם כשמפסידים. כל 5 נאצ'וס זו תיבה."),
      t("s0dce83b", "אתגרים יומיים, שבועיים וחודשיים, עם יהלומים ונאצ'וס בסוף."),
      t("sa6c8b7d", "לבוט יש עכשיו שלוש דרגות: קליל, רגיל וקשה. הקליל באמת קליל."),
      t("s37ceacb", "ניצחון מול הבוט שווה גביעים — רגיל 8, קשה 12."),
      t("sc9e804b", "בתיבות יש יותר קלפים שכבר יש לכם, כדי שיהיה אפשר לשדרג אותם."),
    ],
  },
  /*
   * ═══ DRAFT WORDS, AS THIS FILE SAYS AT THE TOP ═══
   *
   * Five things a player can SEE, chosen from a fortnight of work by that
   * test and no other. What is deliberately NOT here: the launcher icon, the
   * app's name, full screen, landscape, the opening's loading mark. Those
   * are all real and all fixed, and none of them is something a seven-year-
   * old opens the game to find out about — they are what the Play release
   * notes are for, and this screen is not that.
   *
   * The eighteen Play Games achievements are not here either, on purpose:
   * they exist as DRAFTS in the console and nothing is live until somebody
   * presses "Review and publish". A note promising them would be a lie until
   * that happens.
   */
  {
    id: "2026-10-18-backs",
    when: t("sd3f570e", "אוקטובר 2026"),
    title: t("s4adde6c", "גב לקלפים, גביעים ברורים, וטוטריאל שמוביל"),
    lines: [
      t("s1e3d3ef", "אפשר לקנות גב לקלפים בחנות — ורואים אותו לפני הקרב."),
      t("s5197177", "גביעים לפי מי ששיחקתם מולו, ורואים גם כמה ירדו אחרי הפסד."),
      t("sda301f8", "נאצ'וס גם כשמפסידים לבן אדם. מול הבוט הקליל אין נאצ'וס בכלל."),
      t("s89ed441", "הטוטריאל מוביל צעד-צעד — בכל שלב יש דבר אחד ללחוץ."),
      t("s2107a3e", "התחברות עם גוגל שומרת את האלבום שלכם בכל טלפון."),
    ],
  },
];

/** The newest note, or null when there are none. */
export function newestUpdate(): Update | null {
  return UPDATES.length ? UPDATES[UPDATES.length - 1]! : null;
}

const SEEN = "amanda.updates.seen";

/**
 * Has anything arrived since this browser last looked?
 *
 * Kept in localStorage rather than on the account, deliberately: a guest has
 * no account and a guest is exactly who this is trying to bring back. The
 * worst a cleared browser can do is show one dot that was already read.
 */
export function hasUnreadUpdate(): boolean {
  const newest = newestUpdate();
  if (!newest) return false;
  try {
    return localStorage.getItem(SEEN) !== newest.id;
  } catch {
    // A browser that refuses storage shows the dot every visit, which is the
    // harmless direction to be wrong in.
    return true;
  }
}

export function markUpdatesSeen(): void {
  const newest = newestUpdate();
  if (!newest) return;
  try {
    localStorage.setItem(SEEN, newest.id);
  } catch {
    /* nothing to remember it with; the dot stays, which is harmless */
  }
}
