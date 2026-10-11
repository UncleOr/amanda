import { useState } from "react";
import { Icon } from "./Icon";
import { ageFrom } from "../game/account";
import { Overlay } from "./Overlay";
import { replayIntro } from "../game/intro";
import { line as t, lineF as tf } from "../game/copy";

/**
 * About, and the legal pages the stores will not publish us without.
 *
 * ═══ A WARNING THAT BELONGS IN THE CODE AND NOT ON THE SCREEN ═══
 *
 * I wrote these. They are accurate — every fact in the privacy page was
 * checked against what the game actually does, including the region the
 * database sits in — but accurate is not the same as legally sufficient, and
 * this is a product for seven-year-olds, which is the most regulated category
 * there is. Before publishing, somebody who does this for a living should read
 * the privacy page and the terms.
 *
 * What is TRUE here and worth keeping true:
 *   - the list of what is collected matches account.ts exactly
 *   - the database really is in Frankfurt (Supabase eu-central-1)
 *   - deleting an account really does delete everything, by cascade from
 *     auth.users, which was verified against the live schema rather than
 *     assumed
 *   - the accessibility page claims only what has actually been done
 *
 * CONTACT IS A PLACEHOLDER. Or's address is not in here, because publishing
 * somebody's email is his decision and not mine.
 */

const FILM = "https://www.youtube.com/watch?v=Z0h80PW_YJA";
/** What to search for, when a link is not allowed. */
const FILM_SEARCH = t("s4c6892c", "אמנדה המפלצת מסונול כצנלסון");
/**
 * Old enough to be handed a link out of a children's app.
 *
 * Apple's Kids Category forbids links that leave the app without a parental
 * gate, and Google's Families Policy expects the same care. Or's answer, and
 * it is the right one: for anybody who has not said they are an adult, the
 * link becomes WORDS — "search YouTube for…" — which is not a link at all and
 * so cannot be tapped into somewhere else. An adult gets the link.
 *
 * Spotify is dropped entirely rather than gated. Or: "we can give up on
 * Spotify." One fewer door is better than one more gate.
 */
const GROWN_UP = 18;

/**
 * May this person be handed a link that leaves the game?
 *
 * Exported so it can be tested, because the answer is what two app stores
 * will be checking. The default when nobody has said their age is NO — a
 * missing birth date is a child until proven otherwise, which is the only
 * direction this is safe to be wrong in.
 */
export function mayFollowLinks(birthDate: string | null | undefined): boolean {
  if (!birthDate) return false;
  const age = ageFrom(birthDate);
  // ageFrom returns 0 for anything it cannot parse, which lands on "no".
  return age >= GROWN_UP;
}
/**
 * The theme song, where people can go and hear it in full.
 *
 * Either one may be emptied and simply will not render — a link that goes
 * nowhere is worse than no link.
 */
const SONG_YOUTUBE: string = "https://www.youtube.com/watch?v=yDtnLcs_A0M";
const SONG_SEARCH = t("s8c8128f", "אמנדה המפלצת מסונול כצנלסון");

type Page = "about" | "privacy" | "a11y" | "terms";

const TABS: Array<{ id: Page; he: string }> = [
  { id: "about", he: t("sa1ba3d6", "עלינו") },
  { id: "privacy", he: t("s4bda300", "פרטיות") },
  { id: "a11y", he: t("s4947c25", "נגישות") },
  { id: "terms", he: t("s16ab030", "תנאים") },
];

export function About({
  onClose,
  birthDate,
  start,
}: {
  onClose: () => void;
  /** The account's birth date, or null when nobody has said. */
  birthDate?: string | null;
  /**
   * Which page to open on.
   *
   * Play Console asks for a privacy policy URL, and "open the app, tap
   * אודות, tap פרטיות" is not a URL. `?legal=privacy` is one, and it
   * points at the policy the game actually shows rather than a second copy
   * kept somewhere else that drifts from it.
   */
  start?: Page;
}) {
  const [page, setPage] = useState<Page>(start ?? "about");
  // Nobody has said = not an adult. The default has to fall that way.
  const grown = mayFollowLinks(birthDate);

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--about" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("sd1e2d62", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        <nav className="about__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={page === t.id ? "is-on" : ""}
              onClick={() => setPage(t.id)}
            >
              {t.he}
            </button>
          ))}
        </nav>

        <div className="about__body">
          {page === "about" && <AboutUs grown={grown} />}
          {page === "privacy" && <Privacy />}
          {page === "a11y" && <Accessibility />}
          {page === "terms" && <Terms />}
        </div>
      </div>
    </Overlay>
  );
}

/**
 * A way to reach something outside the game — as a link for an adult, and as
 * words for everybody else.
 *
 * The words are the whole point. "Search YouTube for X" is text: there is
 * nothing to tap, nothing that opens a browser, and nothing a seven-year-old
 * can follow by accident. That is what satisfies Apple's Kids Category and
 * Google's Families Policy without a password-shaped gate that a child would
 * only find annoying.
 */
function WayOut({
  href,
  search,
  label,
  grown,
}: {
  href: string;
  search: string;
  label: string;
  grown: boolean;
}) {
  if (grown)
    return (
      <a className="about__film" href={href} target="_blank" rel="noreferrer noopener">
        <Icon name="play" size={18} /> {label}
      </a>
    );
  return (
    <p className="about__search">
      <Icon name="play" size={15} /> {tf("sc87eb06", "{0}: חפשו ביוטיוב", label)}{" "}
      <b>&ldquo;{search}&rdquo;</b>
    </p>
  );
}

function AboutUs({ grown }: { grown: boolean }) {
  /*
   * ═══ EVERY WORD BELOW IS OR'S ═══
   *
   * He is a copywriter and he sent this as finished copy. What was here
   * before was my draft, and the difference is the whole argument for the
   * rule: mine described the game ("Amanda began as a deck of cards"), his
   * dares you to play it. Nothing here is to be tidied, shortened or
   * rephrased — if a line needs to change, it changes because Or changed it.
   *
   * The only thing the code decides is where the film link goes, and that is
   * not a copy decision: a link out of a children's app needs a grown-up
   * (see WayOut and GROWN_UP above), so for anybody who has not said they are
   * one the last sentence ends in words instead of a door.
   */
  return (
    <>
      <h2>{t("s315003f", "אם אתם מפחדים ממפלצות — המשחק הזה לא בשבילכם")}</h2>
      <p>
        {t("sb21002c", "הכירו את אמנדה: המפלצת הכי חזקה באלבום המפלצות. דרקונים יורקי אש, ענקי אבן, אפילו צ'ופי המחשמל — כולם ניסו להילחם בה ונכשלו. אמנדה אכלה את כולם לארוחת ערב, והיא תשמח לאכול גם אתכם לקינוח.")}
      </p>
      <p>
        {t("s00f650e", "אבל זה לא אומר שאתם צריכים לוותר מראש. אם יש לכם סבלנות ומוח, אם אתם יודעים לאסוף את הקלפים הנכונים ולהשתמש בהם בתבונה, אם יש לכם חברים שיודעים לשחק טוב כמוכם ובעיקר — אם יש לכם אומץ להתמודד מול המפלצת החזקה מכולם — אולי תוכלו לנצח ולהיות מלכי המפלצות.")}
      </p>
      <p>
        {t("s7a86ff4", "המשחק נוצר על ידי הוד אסולין ואור אסולין, בהשראת הסרט שיצרנו יחד: “אמנדה — המפלצת מסונול כצנלסון”. מוזמנים לצפות בו ולהעלות לנו קצת את הצפיות. תיהנו!")}
      </p>
      <WayOut href={FILM} search={FILM_SEARCH} label={t("sf8961a7", "הסרט המלא")} grown={grown} />

      {/*
        The opening film plays once, on a first visit, and then never again on
        its own. This is the way back to it — for the time Hod wants to show
        somebody, which is the only reason it is worth keeping at all.
      */}
      <button className="btn-fight btn-ghost about__replay" onClick={replayIntro}>
        {t("s2173639", "לראות שוב את הפתיח")}
      </button>

      {SONG_YOUTUBE && (
        <>
          <h3>{t("sce69090", "שיר הנושא")}</h3>
          <p>{t("sf085dc3", "המוזיקה שמתנגנת כאן היא שלנו. לשמוע אותה במלואה:")}</p>
          <WayOut href={SONG_YOUTUBE} search={SONG_SEARCH} label={t("s9b547f8", "השיר")} grown={grown} />
        </>
      )}
    </>
  );
}

function Privacy() {
  return (
    <>
      <h2>{t("s02cec25", "מדיניות פרטיות")}</h2>
      <p className="about__date">{t("sbfac0cb", "עודכן: אוקטובר 2026")}</p>

      <h3>{t("sda5279b", "מה נשמר עליך")}</h3>
      <ul>
        <li>
          <b>{t("s9a31259", "כינוי, אווטאר ומגדר")}</b> {t("sc5a94ee", "— אם בחרת. אפשר לשחק בלי אף אחד מהם.")}
        </li>
        <li>
          <b>{t("s2dcc96e", "תאריך לידה")}</b> {t("s7bf0944", "— רק כדי לוודא גיל מינימלי של 7. נשמר כתאריך, לא")}
          {t("s680df67", "כתעודת זהות, ולא משותף עם אף אחד.")}
        </li>
        <li>
          <b>{t("sb82d9bb", "ההתקדמות שלך")}</b> {t("sb049d69", "— גביעים, יהלומים, הקלפים באלבום, ותוצאות")}
          {t("sbf10f6b", "המשחקים ששיחקת.")}
        </li>
        <li>
          <b>חשבון</b> {t("sfcd6056", "— ברירת המחדל היא חשבון אנונימי בלי שם ובלי אימייל. אם")}
          {t("se0c1408", "בחרת להתחבר עם גוגל או עם אימייל, נשמרת גם כתובת האימייל שלך.")}
        </li>
      </ul>

      <h3>{t("s0e064c8", "מה לא נשמר")}</h3>
      <p>
        {t("s3d74007", "אין פרסומות, אין מזהי פרסום, אין מעקב בין אתרים, ואין צ'אט חופשי. אנחנו לא אוספים מיקום, אנשי קשר, תמונות או מיקרופון.")}
      </p>

      <h3>{t("s17cae8a", "איפה זה יושב")}</h3>
      <p>
        {t("s5b4f8cf", "על שרתי Supabase בפרנקפורט שבגרמניה (האיחוד האירופי). רק אתה יכול לקרוא את השורות שלך — בסיס הנתונים חוסם גישה לשורות של מישהו אחר ברמת המסד עצמו, לא רק באפליקציה.")}
      </p>

      <h3>{t("sa910811", "איך מוחקים הכול")}</h3>
      <p>
        באזור האישי יש <b>{t("see1a564", "מחיקת חשבון")}</b>{t("sd864a74", ". היא מוחקת את החשבון, האלבום, הגביעים")}
        {t("s0d6ac9b", "וההיסטוריה — מיד, בלי תקופת המתנה ובלי לשלוח אימייל. אי אפשר לבטל.")}
      </p>

      <h3>{t("scf1e0b8", "יצירת קשר")}</h3>
      <p>
        {t("s55a8220", "לשאלות על פרטיות או למחיקת מידע: amanda@orasul.in")}
      </p>
    </>
  );
}

function Accessibility() {
  return (
    <>
      <h2>{t("s3bbb564", "הצהרת נגישות")}</h2>
      <p className="about__date">{t("s98d6639", "עודכן: אוקטובר 2026")}</p>
      <p>
        אנחנו משתדלים שהמשחק יהיה נגיש לכמה שיותר אנשים, ומכוונים לתקן הישראלי
        ת"י 5568 ולהנחיות WCAG 2.1 ברמה AA.
      </p>

      <h3>{t("s9e45ede", "מה כבר נעשה")}</h3>
      <ul>
        <li>{t("s0b8e183", "כל הכפתורים נגישים במקלדת וסימון המיקוד נשאר גלוי.")}</li>
        <li>
          {t("s1897e21", "מי שביקש פחות תנועה במערכת ההפעלה — האנימציות נעצרות. זה כולל את ההבהובים, הניצוצות והתיבות הקופצות.")}
        </li>
        <li>{t("s12cb0a6", "אפשר לכבות את הצלילים ואת המוזיקה בנפרד, והבחירה נשמרת.")}</li>
        <li>{t("s0ec6329", "אייקונים נושאים תיאור טקסטואלי כשהם עומדים בפני עצמם.")}</li>
        <li>{t("s99b2530", "המשחק עובד לאורך ולרוחב, ובלי לנעול את גודל הטקסט.")}</li>
      </ul>

      <h3>{t("s1bd53f9", "מה עוד לא")}</h3>
      <p>
        {t("s7e382b5", "הקרב עצמו הוא אנימציה גרפית, ואנחנו עדיין עובדים על תיאור טקסטואלי מלא של מה שקורה בו. דוח הקרב בסוף כל משחק מתאר את ההתרחשות במילים, וזו כרגע הדרך הנגישה לדעת מה קרה.")}
      </p>

      <h3>{t("s9e79aac", "נתקלתם בבעיה?")}</h3>
      <p>{t("se71be7a", "ספרו לנו דרך פרטי הקשר בדף החנות, ונתקן.")}</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h2>{t("s1c1af17", "תנאי שימוש")}</h2>
      <p className="about__date">{t("sadf3694", "עודכן: אוקטובר 2026")}</p>
      <ul>
        <li>{t("s2b98856", "המשחק חינמי. אין רכישות בתוך האפליקציה.")}</li>
        <li>{t("sab731f2", "הגיל המינימלי הוא 7.")}</li>
        <li>
          {t("s7b2b5d0", "הקלפים, הדמויות, האיורים והסיפור הם שלנו. אפשר לשחק, אי אפשר למכור או להפיץ אותם.")}
        </li>
        <li>
          {t("sc9d7902", "מי שמתנהג לא יפה כלפי שחקנים אחרים עלול להיות מושעה — לזמן קצוב או לצמיתות.")}
        </li>
        <li>
          {t("s2724777", "אנחנו עושים כמיטב יכולתנו שהשמירה תעבוד, אבל המשחק ניתן כמו שהוא. אם השרת נופל, האלבום שלכם נשאר — הוא לא שמור במכשיר.")}
        </li>
      </ul>
    </>
  );
}
