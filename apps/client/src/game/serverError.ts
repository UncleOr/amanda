/**
 * The words for a refusal the server sent as a code.
 *
 * Or, going through the English build: *"not all the texts are translated."*
 * Most of what he found was in the client. The rest was in the server, which
 * answered a failed request with a Hebrew sentence and had no way not to —
 * it does not know who asked or what language they chose.
 *
 * So the server names the REASON (see shared/serverErrors.ts) and the words
 * live here, in the client, where they go through the same `line()` the rest
 * of the game uses and land in Or's copy document like everything else.
 *
 * ═══ AN UNKNOWN CODE IS NOT A BUG ═══
 *
 * A phone can run a build for weeks. A server deployed today may answer an
 * app installed in September with a code that app has never heard of, and
 * the one thing that must not happen is a child reading `friend.tooMany` on
 * their screen. Anything unrecognised falls back to the generic "that did
 * not work" — true, useless, and in the right language.
 *
 * An older SERVER is handled too, in the other direction: one that still
 * sends a whole Hebrew sentence has that sentence shown as-is, because a
 * sentence is better than a shrug even when it is the wrong language.
 */
import { isServerError, type ServerError } from "@amanda/shared";
import { line as t, lineF as tf } from "./copy";

/** A code may carry one number, as `code:value` — see shop.poor. */
function split(raw: string): { code: string; value: number | null } {
  const at = raw.indexOf(":");
  if (at < 0) return { code: raw, value: null };
  const value = Number(raw.slice(at + 1));
  return { code: raw.slice(0, at), value: Number.isFinite(value) ? value : null };
}

function words(code: ServerError, value: number | null): string {
  switch (code) {
    // ── friends ──
    case "friend.self":
      return t("sc839803", "זה אתה.");
    case "friend.needAccount":
      return t("s1e4d1ce", "צריך חשבון כדי להוסיף חברים. אפשר להתחבר באזור האישי.");
    case "friend.theyNeedAccount":
      return t("s8c2f055", "לשחקן הזה אין חשבון.");
    case "friend.notPlayed":
      return t("sfb1cb0c", "אפשר להוסיף רק מישהו ששיחקת מולו.");
    case "friend.already":
      return t("s9768947", "אתם כבר חברים.");
    case "friend.pending":
      return t("s73fed82", "כבר ביקשת. מחכים שיאשרו.");
    case "friend.tooMany":
      return t("sa1cbf5f", "יש לך יותר מדי בקשות שמחכות לתשובה.");
    case "friend.noRequest":
      return t("s28541c5", "אין בקשה כזאת.");
    case "friend.codeUnknown":
      return t("sc6d8f34", "אין קוד כזה.");

    // ── upgrading a card ──
    case "level.copies":
      return value === null
        ? t("s1ea1328", "אין מספיק עותקים.")
        : tf("s4cfc2af", "חסרים {0} עותקים.", value);
    case "level.max":
      return t("sd0abc03", "זאת הרמה הכי גבוהה.");
    case "level.notYours":
      return t("sce3da7e", "הקלף הזה עוד לא שלך.");

    // ── reports ──
    case "report.needAccount":
      return t("s0c9162c", "צריך חשבון כדי לדווח על שחקן. אפשר להתחבר באזור האישי.");
    case "report.empty":
      return t("scc4eb78", "ספר לנו מה קרה.");
    case "report.whoAbout":
      return t("s3a38c0a", "על מי מדווחים?");
    case "report.self":
      return t("s8583e14", "זה אתה.");
    case "report.notRegistered":
      return t("se4e8aeb", "אפשר לדווח רק על שחקנים רשומים.");
    case "report.notPlayed":
      return t("s39dfb3e", "אפשר לדווח רק על מישהו ששיחקת מולו.");
    case "report.tooMany":
      return t("s606c355", "דיווחת הרבה. נבדוק, ונחזור אליך.");

    // ── shop ──
    case "shop.gone":
      return t("s9c601a6", "הפריט הזה לא בחנות.");
    case "shop.notYet":
      return t("se01b086", "עוד לא.");
    case "shop.ended":
      return t("s750dee1", "זה כבר נגמר.");
    case "shop.owned":
      return t("s50f7dfe", "זה כבר שלך.");
    case "shop.tomorrow":
      return t("se274fb0", "לקחת אחת היום. תחזור מחר.");
    case "shop.poor":
      return value === null
        ? t("sc59543d", "אין מספיק יהלומים.")
        : tf("s31caecc", "חסרים {0} יהלומים.", value);

    // ── clubs ──
    //
    // Or: *"you do not need to write all these explanations to the user.
    // The user sees only buttons. Give messages only for critical things."*
    //
    // So the vocabulary is small rather than the words being vague: the
    // refusals a child can actually ARRIVE at say what happened, and
    // everything the popup offers no button for says the same short thing.
    case "club.code":
      return t("s0a89ff9", "אין קוד כזה.");
    case "club.full":
      return t("se7ca89b", "המועדון מלא.");
    case "club.name":
      return t("s1b2d4f9", "השם הזה לא מתאים.");
    case "club.asked":
      return t("s11a35c9", "כבר ביקשת קלף. תחזור עוד קצת.");
    case "club.noSpare":
      return t("se6e16aa", "אין לך עותק להעביר.");
    case "club.gave":
      return t("s7f197f3", "כבר תרמת לבקשה הזאת.");
    case "club.warned":
      return t("s28c35c2", "ההודעה שלך נמחקה בגלל מילים אסורות. זו אזהרה — בפעם הבאה תוצא מהמועדון מיד.");
    case "club.removed":
      return t("s1cdcfe4", "ההודעה שלך נמחקה בגלל מילים אסורות. הוצאת מהמועדון.");
    case "club.no":
      return t("s76508b2", "אי אפשר.");

    case "retry":
      return t("s67fd1f6", "לא הצלחתי. נסה שוב.");
  }
}

/**
 * Turn whatever the server said into something a player can read.
 *
 * `null` in, `null` out — so a call site can pass the result of a request
 * straight through without first asking whether it failed.
 */
export function serverError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const { code, value } = split(raw);
  if (isServerError(code)) return words(code, value);
  /*
   * Not a code we know — so the generic failure, always.
   *
   * The first version passed anything containing a space straight through,
   * on the theory that a sentence from an older server beats a shrug. It
   * also passes `you do not have that card` straight through, which is what
   * the level-up endpoint answers: English developer strings, aimed at me,
   * landing on a child's screen. Both directions of "old build" are a
   * problem this cannot actually solve, and the game has not shipped yet, so
   * there are no old builds. What is left is the leak, and this closes it.
   */
  return t("s25ffa6e", "לא הצלחתי. נסה שוב.");
}
