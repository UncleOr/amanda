import { useState } from "react";
import { Icon } from "./Icon";
import { ageFrom } from "../game/account";
import { Overlay } from "./Overlay";

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
const FILM_SEARCH = "אמנדה המפלצת מסונול כצנלסון";
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
const SONG_SEARCH = "אמנדה המפלצת מסונול כצנלסון";

type Page = "about" | "privacy" | "a11y" | "terms";

const TABS: Array<{ id: Page; he: string }> = [
  { id: "about", he: "עלינו" },
  { id: "privacy", he: "פרטיות" },
  { id: "a11y", he: "נגישות" },
  { id: "terms", he: "תנאים" },
];

export function About({
  onClose,
  birthDate,
}: {
  onClose: () => void;
  /** The account's birth date, or null when nobody has said. */
  birthDate?: string | null;
}) {
  const [page, setPage] = useState<Page>("about");
  // Nobody has said = not an adult. The default has to fall that way.
  const grown = mayFollowLinks(birthDate);

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--about" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
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
      <Icon name="play" size={15} /> {label}: חפשו ביוטיוב{" "}
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
      <h2>אם אתם מפחדים ממפלצות — המשחק הזה לא בשבילכם</h2>
      <p>
        הכירו את אמנדה: המפלצת הכי חזקה באלבום המפלצות. דרקונים יורקי אש, ענקי
        אבן, אפילו צ'ופי המחשמל — כולם ניסו להילחם בה ונכשלו. אמנדה אכלה את
        כולם לארוחת ערב, והיא תשמח לאכול גם אתכם לקינוח.
      </p>
      <p>
        אבל זה לא אומר שאתם צריכים לוותר מראש. אם יש לכם סבלנות ומוח, אם אתם
        יודעים לאסוף את הקלפים הנכונים ולהשתמש בהם בתבונה, אם יש לכם חברים
        שיודעים לשחק טוב כמוכם ובעיקר — אם יש לכם אומץ להתמודד מול המפלצת
        החזקה מכולם — אולי תוכלו לנצח ולהיות מלכי המפלצות.
      </p>
      <p>
        המשחק נוצר על ידי הוד אסולין ואור אסולין, בהשראת הסרט שיצרנו יחד:
        "אמנדה — המפלצת מסונול כצנלסון". מוזמנים לצפות בו ולהעלות לנו קצת את
        הצפיות. תיהנו!
      </p>
      <WayOut href={FILM} search={FILM_SEARCH} label="הסרט המלא" grown={grown} />

      {SONG_YOUTUBE && (
        <>
          <h3>שיר הנושא</h3>
          <p>המוזיקה שמתנגנת כאן היא שלנו. לשמוע אותה במלואה:</p>
          <WayOut href={SONG_YOUTUBE} search={SONG_SEARCH} label="השיר" grown={grown} />
        </>
      )}
    </>
  );
}

function Privacy() {
  return (
    <>
      <h2>מדיניות פרטיות</h2>
      <p className="about__date">עודכן: אוקטובר 2026</p>

      <h3>מה נשמר עליך</h3>
      <ul>
        <li>
          <b>כינוי, אווטאר ומגדר</b> — אם בחרת. אפשר לשחק בלי אף אחד מהם.
        </li>
        <li>
          <b>תאריך לידה</b> — רק כדי לוודא גיל מינימלי של 7. נשמר כתאריך, לא
          כתעודת זהות, ולא משותף עם אף אחד.
        </li>
        <li>
          <b>ההתקדמות שלך</b> — גביעים, יהלומים, הקלפים באלבום, ותוצאות
          המשחקים ששיחקת.
        </li>
        <li>
          <b>חשבון</b> — ברירת המחדל היא חשבון אנונימי בלי שם ובלי אימייל. אם
          בחרת להתחבר עם גוגל או עם אימייל, נשמרת גם כתובת האימייל שלך.
        </li>
      </ul>

      <h3>מה לא נשמר</h3>
      <p>
        אין פרסומות, אין מזהי פרסום, אין מעקב בין אתרים, ואין צ'אט חופשי. אנחנו
        לא אוספים מיקום, אנשי קשר, תמונות או מיקרופון.
      </p>

      <h3>איפה זה יושב</h3>
      <p>
        על שרתי Supabase בפרנקפורט שבגרמניה (האיחוד האירופי). רק אתה יכול לקרוא
        את השורות שלך — בסיס הנתונים חוסם גישה לשורות של מישהו אחר ברמת
        המסד עצמו, לא רק באפליקציה.
      </p>

      <h3>איך מוחקים הכול</h3>
      <p>
        באזור האישי יש <b>מחיקת חשבון</b>. היא מוחקת את החשבון, האלבום, הגביעים
        וההיסטוריה — מיד, בלי תקופת המתנה ובלי לשלוח אימייל. אי אפשר לבטל.
      </p>

      <h3>יצירת קשר</h3>
      <p>
        לשאלות על פרטיות או למחיקת מידע, אפשר לפנות אלינו דרך פרטי הקשר בדף
        החנות.
      </p>
    </>
  );
}

function Accessibility() {
  return (
    <>
      <h2>הצהרת נגישות</h2>
      <p className="about__date">עודכן: אוקטובר 2026</p>
      <p>
        אנחנו משתדלים שהמשחק יהיה נגיש לכמה שיותר אנשים, ומכוונים לתקן הישראלי
        ת"י 5568 ולהנחיות WCAG 2.1 ברמה AA.
      </p>

      <h3>מה כבר נעשה</h3>
      <ul>
        <li>כל הכפתורים נגישים במקלדת וסימון המיקוד נשאר גלוי.</li>
        <li>
          מי שביקש פחות תנועה במערכת ההפעלה — האנימציות נעצרות. זה כולל את
          ההבהובים, הניצוצות והתיבות הקופצות.
        </li>
        <li>אפשר לכבות את הצלילים ואת המוזיקה בנפרד, והבחירה נשמרת.</li>
        <li>אייקונים נושאים תיאור טקסטואלי כשהם עומדים בפני עצמם.</li>
        <li>המשחק עובד לאורך ולרוחב, ובלי לנעול את גודל הטקסט.</li>
      </ul>

      <h3>מה עוד לא</h3>
      <p>
        הקרב עצמו הוא אנימציה גרפית, ואנחנו עדיין עובדים על תיאור טקסטואלי מלא
        של מה שקורה בו. דוח הקרב בסוף כל משחק מתאר את ההתרחשות במילים, וזו
        כרגע הדרך הנגישה לדעת מה קרה.
      </p>

      <h3>נתקלתם בבעיה?</h3>
      <p>ספרו לנו דרך פרטי הקשר בדף החנות, ונתקן.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h2>תנאי שימוש</h2>
      <p className="about__date">עודכן: אוקטובר 2026</p>
      <ul>
        <li>המשחק חינמי. אין רכישות בתוך האפליקציה.</li>
        <li>הגיל המינימלי הוא 7.</li>
        <li>
          הקלפים, הדמויות, האיורים והסיפור הם שלנו. אפשר לשחק, אי אפשר למכור או
          להפיץ אותם.
        </li>
        <li>
          מי שמתנהג לא יפה כלפי שחקנים אחרים עלול להיות מושעה — לזמן קצוב או
          לצמיתות.
        </li>
        <li>
          אנחנו עושים כמיטב יכולתנו שהשמירה תעבוד, אבל המשחק ניתן כמו שהוא. אם
          השרת נופל, האלבום שלכם נשאר — הוא לא שמור במכשיר.
        </li>
      </ul>
    </>
  );
}
