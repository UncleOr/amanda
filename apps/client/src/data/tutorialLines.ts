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
  /*
   * ═══ THE FIRST LESSON, AS OR WROTE IT ═══
   *
   * He wrote this match out himself, line by line, naming the card and the
   * square for every step: *"I'm writing out the tutorial here as I see it,
   * step by step."* The rules above it still exist and still run for anyone
   * who wanders off the script — but in the first match they no longer
   * decide what she says.
   *
   * The two things he put at the top of that message are rules for both
   * lessons and live elsewhere: the exit button at the top always works
   * (App.tsx), and there is no clock (useMatch.ts).
   *
   * The order, the targets and the gates are in game/lessonScript.ts.
   */
  {
    id: "l1-hello",
    he: t("sfbcc457", "היי, אני אמנדה. הגעת כדי להילחם מולי, {kid}? בכיף, אני אראה לך איך עושים את זה."),
    vars: ["kid"],
    when: t("sc39b53f", "המשפט הראשון, לפני שהיא מצביעה על משהו"),
  },
  {
    id: "l1-room",
    he: t("sd9bc88a", "אנחנו כרגע בחדר המשחקים. אם מנצחים פה — מתקדמים למקומות אחרים."),
    vars: [],
    when: t("s9e32cd7", "המשפט השני, עדיין באמצע המסך"),
  },
  {
    id: "l1-albums",
    he: t("sf961c72", "זה האלבום שלי, זה האלבום שלך. כל אחד מדביק עליהם את הקלפים שלו. כשייגמר הזמן — האלבומים נלחמים אחד בשני."),
    vars: [],
    when: t("s6a53354", "שני הלוחות מודגשים"),
  },
  {
    id: "l1-colossus",
    he: t("s62d0dd0", "נתחיל בהדבקות. הנה הקלף הראשון: גולם אבן. קלף עם הרבה כוח ספיגה. נמקם אותו בעמדת השומר."),
    vars: [],
    when: t("s42dbb6c", "גולם אבן ביד, לוח ריק"),
  },
  {
    id: "l1-dragon",
    he: t("s4f0b0c7", "הקלף הבא: פליים דראגון — דרקון חזק. נמקם אותו מאחור. הוא יעופף מעל כולם ויתקוף את האויב."),
    vars: [],
    when: t("sdaca2bb", "פליים דראגון ביד"),
  },
  {
    id: "l1-boost",
    he: t("s195f0f7", "הקלף הבא: בוסט אנרגיה. זה קלף פעולה. ניקח אותו כדי להשתמש בו בהמשך."),
    vars: [],
    when: t("s37af730", "בוסט אנרגיה ביד"),
  },
  {
    id: "l1-bar-open",
    he: t("s1e604c6", "קלפי הפעולה נמצאים כאן, למקרה שנרצה להשתמש בהם."),
    vars: [],
    when: t("sedb61e0", "אחרי שהבוסט נכנס לבר"),
  },
  {
    id: "l1-bar-close",
    he: t("sd597bbf", "טוב, זה לאחר כך. בואו נמשיך."),
    vars: [],
    when: t("s325b7db", "מגירת קלפי הפעולה פתוחה"),
  },
  {
    id: "l1-bin",
    he: t("s5e4cdb0", "קוביית ג'לי — קלף, אממ... לא משהו. בואו נזרוק אותו. יגיעו טובים יותר."),
    vars: [],
    when: t("sb4d2832", "קוביית ג'לי ביד"),
  },
  {
    id: "l1-unbin",
    he: t("s2bd7018", "בעצם — לא בטוח שיגיע משהו טוב יותר. מזל שאפשר להתחרט על הקלף האחרון שזרקתם. הנה, כאן."),
    vars: [],
    when: t("s31f77d0", "מיד אחרי הזריקה"),
  },
  {
    id: "l1-cube",
    he: t("sd4b3818", "אוקיי, קוביית הג'לי בולעת קלפי יריב. נמקם אותה כאן למעלה מאחורה. היא לא תחסום את הדרקון, הוא מעופף."),
    vars: [],
    when: t("s253d8e7", "קוביית הג'לי חזרה מהפח"),
  },
  {
    id: "l1-king",
    he: t("s1ff71ce", "הופה, אבי-הענקים. קלף ענק וחזק. מושלם למשבצת המלך."),
    vars: [],
    when: t("s559179f", "אבי-הענקים ביד"),
  },
  {
    id: "l1-king-why",
    he: t("sd65daae", "הכוח של קלף המלך גדל פי 3, וזה חשוב. אם הוא מת — הפסדתם."),
    vars: [],
    when: t("sb25f12e", "מיד אחרי שהוכתר מלך"),
  },
  {
    id: "l1-troll",
    he: t("s503c2fe", "הופה, עוד ענק. טרול סלע, שמרפא את עצמו. נמקם אותו בעמדת השומר."),
    vars: [],
    when: t("s856075f", "טרול סלע ביד"),
  },
  {
    id: "l1-guards",
    he: t("see01751", "יש לך שני שומרים וזה חשוב מאוד! כל עוד השומרים חיים — המלך בלתי פגיע."),
    vars: [],
    when: t("s045e8b5", "שתי עמדות השומר תפוסות"),
  },
  {
    id: "l1-go",
    he: t("saa20106", "אוקיי, מספיק דיבורים. בואו ניגש לקרב ונראה מה קורה."),
    vars: [],
    when: t("scb6277d", "הכול בנוי, נשאר ללחוץ"),
  },
  {
    id: "l1-crumbs",
    he: t("s408dcff", "שימו לב — כל הריבועים הריקים מתמלאים במפלצות פירורים חלשות. כדאי למלא אותם בזמן!"),
    vars: [],
    when: t("sb842d99", "אחרי הלחיצה על התחל קרב, לפני הספירה"),
  },
  {
    id: "l1-won",
    he: t("s4a756c9", "ניצחת! אבל זה היה קל, כי עזרתי."),
    vars: [],
    when: t("sb08f699", "מסך התוצאה של המשחק הראשון"),
  },
  /*
   * ═══ THE SECOND LESSON IS WRITTEN, NOT REACTED TO ═══
   *
   * Everything above is a RULE — "a giant? put him in front of the King" —
   * which fires against whatever you happen to draw. The lines below are a
   * SCRIPT: Or wrote the second match out step by step, naming the card and
   * the square for each one, and approved it.
   *
   * That is a real difference and it is deliberate. The first match teaches
   * the shape of a turn, and a shape has to survive any hand. The second
   * teaches three specific things — where a family bonus comes from, where a
   * glass cannon does NOT go, and what the panic phase is — and none of the
   * three can be taught by a rule that waits for the right card to turn up.
   *
   * The order they fire in is in game/lessonScript.ts, beside the deck that
   * deals them. Nothing here decides when it is said.
   */
  {
    id: "l2-back",
    he: t("s40cdf63", "חזרת. יפה. עכשיו בוא נדבר על מה שקורה בצד השני."),
    vars: [],
    when: t("s5263775", "פתיחת המשחק השני"),
  },
  {
    id: "l2-fog",
    he: t("s2f0283d", "שים לב ללוח שלי. רואה את השורה הקדמית? זה כל מה שאפשר לראות בשלב הזה."),
    vars: [],
    when: t("s25ea352", "מצביעה על הלוח של היריב, לפני שנגעת בקלף"),
  },
  {
    id: "l2-xray-take",
    he: t("s2feac9e", "רנטגן. קלף פעולה ששובר את הכלל הזה. ניקח אותו ונשתמש בו."),
    vars: [],
    when: t("s66dddf3", "רנטגן ביד"),
  },
  {
    id: "l2-xray-use",
    he: t("s0a71ac4", "עכשיו תלחץ עליו."),
    vars: [],
    when: t("se52f43e", "רנטגן בבר, לפני שהופעל"),
  },
  {
    id: "l2-xray-seen",
    he: t("s734f906", "הנה. שש שניות, כל הלוח שלי פתוח. עצים עתיקים מקדימה, גפנים בפינות."),
    vars: [],
    when: t("s8f6cfb7", "מיד אחרי שהרנטגן הופעל"),
  },
  {
    id: "l2-tree",
    he: t("s68e3bda", "עץ עתיק. 2000 חיים, מתרפא לבד. בדיוק מה שצריך בעמדת השומר."),
    vars: [],
    when: t("sd49b897", "עץ עתיק ביד"),
  },
  {
    id: "l2-cactus",
    he: t("s75ccaa2", "קקטוס: דוקר את מי שנוגע בו. לעמדת השומר השנייה, צמוד לעץ."),
    vars: [],
    when: t("s62b4ae3", "קקטוס ביד, אחרי שהעץ הונח"),
  },
  {
    id: "l2-family",
    he: t("s669ccf5", "מה יש לנו כאן? שני קלפים מאותה סדרה. רואה את צבע המסגרת? בוא נוסיף להם עוד אחד."),
    vars: [],
    when: t("s16619e1", "שני צמחים צמודים על הלוח"),
  },
  {
    id: "l2-sunflower",
    he: t("se1b06e1", "חמנייה. צמח. תדביק אותה צמוד לאחד מהם — לא באלכסון, צמוד ממש."),
    vars: [],
    when: t("s3bb1a6a", "חמנייה ביד"),
  },
  {
    id: "l2-synergy",
    he: t("s2fb50f7", "פוטוסינתזה! שלושה צמחים צמודים מקבלים +20% עוצמה ו+20% חיים. שווה לשים אותם יחד!"),
    vars: [],
    when: t("sd356bf5", "ברגע שהשלישייה נדלקה"),
  },
  {
    id: "l2-chuppy",
    he: t("sa808c9e", "צ'ופי! החבר הכי טוב, עם עוצמת חשמל אדירה — אבל כמעט בלי חיים. מקדימה הוא ימות ראשון. פה עדיף."),
    vars: [],
    when: t("s6d14c48", "צ'ופי ביד"),
  },
  {
    id: "l2-king",
    he: t("s8e82b1e", "אבי-הענקים. למשבצת המלך, כמו בפעם הקודמת."),
    vars: [],
    when: t("s33be16b", "אבי-הענקים ביד"),
  },
  {
    id: "l2-boost-wait",
    he: t("scb28bb8", "בוסט אנרגיה — נותן כוח לכל מה שכבר על הלוח. רק לכל מה שכבר שם. אז לא נשתמש בו עכשיו."),
    vars: [],
    when: t("sb32330d", "בוסט אנרגיה נכנס לבר, הלוח עוד לא מלא"),
  },
  {
    id: "l2-boost-use",
    he: t("s4f2f850", "עכשיו. הלוח שלך מלא. עכשיו תפעיל אותו."),
    vars: [],
    when: t("sceb7841", "הלוח מלא, הבוסט עדיין לא הופעל"),
  },
  {
    id: "l2-panic-king",
    he: t("s8137a86", "פאניקה. עשר השניות האחרונות. תסתכל — המלך שלי נחשף."),
    vars: [],
    when: t("se8e0990", "השנייה הראשונה של הפאניקה"),
  },
  {
    id: "l2-panic-fog",
    he: t("s7c44eb4", "אבל השורה האחורית שלי עדיין חשוכה. גם בפאניקה. בשביל זה היה שווה את הרנטגן."),
    vars: [],
    when: t("s7298202", "בפאניקה, על השורה האחורית המעורפלת"),
  },
  {
    id: "l2-sandstorm",
    he: t("sb0dc9d8", "סופת חול. מערבבת לי את השורה הקדמית. בנית נתיב מול משהו? עכשיו הוא במקום אחר."),
    vars: [],
    when: t("scf7ab2b", "סופת חול ביד, בפאניקה"),
  },
  {
    id: "l2-go",
    he: t("sb32906f", "מספיק. בוא נראה מה בנית."),
    vars: [],
    when: t("s5706d6f", "הכול בנוי, נשאר ללחוץ"),
  },
  {
    id: "l2-won",
    he: t("s39b816e", "ניצחת. והפעם לא עזרתי."),
    vars: [],
    when: t("s88efec6", "מסך התוצאה של המשחק השני"),
  },

  /*
   * ═══ THE TUTORIAL IN THREE STAGES ═══
   *
   * Or, after a tester got lost in the old one: *"let us do the tutorial in
   * three stages. You can always get back to any of the three through the
   * settings menu."*
   *
   *   1  meeting the board — what is mine, what is yours, and the GOAL:
   *      bring down the king. A king and two guards. Three squares.
   *   2  attacking — a dragon at the back that walks in, and a sniper that
   *      does not move at all, plus two squares left empty so the crumb
   *      monsters can be met. Seven squares.
   *   3  strategy — two cards with abilities of their own, a series that
   *      works together, and one action card.
   *
   * The l1-/l2- lines above are the two long matches and are left alone
   * until he has walked these.
   *
   * DRAFTS, like everything else here. He is the copywriter.
   */
  {
    id: "t1-boards",
    he: t("s48f32cf", "זה הלוח שלך, וזה שלי. כל אחד מדביק קלפים, ואז הם נלחמים לבד."),
    vars: [],
    when: t("s1f48200", "השלב הראשון נפתח"),
  },
  {
    id: "t1-goal",
    he: t("sf6aa5f3", "המטרה פשוטה: להפיל את המלך שלי. זה כל המשחק."),
    vars: [],
    when: t("sb195916", "מצביעה על המלך של היריב"),
  },
  {
    id: "t1-king",
    he: t("s45d35b9", "נתחיל מהמלך שלך. הוא חזק פי שלושה — ואם הוא נופל, נגמר. שים אותו בכתר."),
    vars: [],
    when: t("s145b6f6", "מבקשת להניח מלך"),
  },
  {
    id: "t1-guard-1",
    he: t("s7613642", "עכשיו שומר. גולם אבן סופג המון. שים אותו בריבוע שלפני המלך."),
    vars: [],
    when: t("s1cacba3", "השומר הראשון"),
  },
  {
    id: "t1-guard-2",
    he: t("s731677a", "ועוד אחד לידו. טרול סלע מרפא את עצמו."),
    vars: [],
    when: t("sd9c70d7", "השומר השני"),
  },
  {
    id: "t1-guards",
    he: t("s1d80306", "שני השומרים חוסמים את מי שבא על המלך, וגם יורים על מפלצות הפירורים שלי."),
    vars: [],
    when: t("s8a2b4ec", "אחרי שני השומרים"),
  },
  {
    id: "t1-go",
    he: t("se8108d3", "זהו. לחץ 'התחל קרב' ונראה."),
    vars: [],
    when: t("s62770a8", "כפתור הקרב, סוף שלב ראשון"),
  },
  {
    id: "t2-back",
    he: t("sa49f3ac", "את המלך והשומרים אתה כבר יודע. עכשיו נלמד לתקוף."),
    vars: [],
    when: t("s8604d73", "השלב השני נפתח"),
  },
  {
    id: "t2-king",
    he: t("s3119051", "קודם המלך, כמו קודם."),
    vars: [],
    when: t("s678842e", "מלך בשלב שני"),
  },
  {
    id: "t2-guard-1",
    he: t("s9fdd7dc", "ושומר לפניו."),
    vars: [],
    when: t("s8c6294d", "שומר ראשון בשלב שני"),
  },
  {
    id: "t2-guard-2",
    he: t("sb472998", "ועוד אחד."),
    vars: [],
    when: t("s1e9a54b", "שומר שני בשלב שני"),
  },
  {
    id: "t2-dragon",
    he: t("se91ae1c", "פליים דראגון לא נשאר במקום — הוא צועד לתוך השטח שלי. שים אותו מאחור."),
    vars: [],
    when: t("sfdab258", "הדרקון"),
  },
  {
    id: "t2-sniper",
    he: t("s69f9b3c", "טורץ' הוא צלף. הוא לא זז בכלל, הוא יורה מרחוק על הקלף האחרון בשורה שלו. גם הוא מאחור."),
    vars: [],
    when: t("s679b01d", "הצלף"),
  },
  {
    id: "t2-crumbs",
    he: t("sb7288fa", "שני הריבועים האלה נשארו ריקים. כשהקרב מתחיל הם מתמלאים במפלצות פירורים — חלשות, אבל הן שלך."),
    vars: [],
    when: t("s5b0ba65", "מפלצות הפירורים"),
  },
  {
    id: "t2-go",
    he: t("s8960103", "קדימה, תלחץ."),
    vars: [],
    when: t("sa672d5e", "כפתור הקרב, סוף שלב שני"),
  },
  {
    id: "t3-back",
    he: t("s204bf16", "עכשיו החלק המעניין: איך גורמים לקלפים לעבוד יחד."),
    vars: [],
    when: t("sb546dcf", "השלב השלישי נפתח"),
  },
  {
    id: "t3-king",
    he: t("s6f799c9", "מלך קודם, אתה כבר יודע."),
    vars: [],
    when: t("scb00d69", "מלך בשלב שלישי"),
  },
  {
    id: "t3-tree",
    he: t("s48aadae", "לעץ העתיק יש יכולת מיוחדת: הוא מרפא את עצמו כל הזמן. שים אותו לפני המלך."),
    vars: [],
    when: t("s3fc48a2", "היכולת הראשונה"),
  },
  {
    id: "t3-cactus",
    he: t("s87ef3e3", "לקקטוס יש יכולת אחרת: כל מי שתוקף אותו חוטף בחזרה. שים אותו לידו."),
    vars: [],
    when: t("s846cff7", "היכולת השנייה"),
  },
  {
    id: "t3-sunflower",
    he: t("sa11021a", "שניהם מאותה סדרה. שלושה מאותה סדרה שנוגעים זה בזה מקבלים בונוס — אז הנה שלישי."),
    vars: [],
    when: t("sd58578f", "משלימה את הסדרה"),
  },
  {
    id: "t3-synergy",
    he: t("s5b520a1", "רואה את הזוהר סביבם? זאת הסדרה עובדת. פלוס עשרים אחוז עוצמה וחיים, לשלושתם."),
    vars: [],
    when: t("sdcaf626", "הסינרגיה נדלקת"),
  },
  {
    id: "t3-xray",
    he: t("sfa14a97", "ועוד דבר אחד: קלפי פעולה. רנטגן חושף את כל הלוח שלי. קח אותו."),
    vars: [],
    when: t("sa1a422a", "לוקחת את קלף הפעולה"),
  },
  {
    id: "t3-xray-use",
    he: t("s8fa9c1c", "עכשיו תפעיל אותו ותראה מה מחכה לך."),
    vars: [],
    when: t("s7b899d3", "מפעילה את קלף הפעולה"),
  },
  {
    id: "t3-go",
    he: t("s0c9e943", "זהו, אתה יודע לשחק. תלחץ."),
    vars: [],
    when: t("sa19ff29", "כפתור הקרב, סוף שלב שלישי"),
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
