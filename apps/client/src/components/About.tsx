import { useState } from "react";
import { Icon } from "./Icon";

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

type Page = "about" | "privacy" | "a11y" | "terms";

const TABS: Array<{ id: Page; he: string }> = [
  { id: "about", he: "עלינו" },
  { id: "privacy", he: "פרטיות" },
  { id: "a11y", he: "נגישות" },
  { id: "terms", he: "תנאים" },
];

export function About({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<Page>("about");

  return (
    <div className="modal-overlay" onClick={onClose}>
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
          {page === "about" && <AboutUs />}
          {page === "privacy" && <Privacy />}
          {page === "a11y" && <Accessibility />}
          {page === "terms" && <Terms />}
        </div>
      </div>
    </div>
  );
}

function AboutUs() {
  return (
    <>
      <h2>אמנדה</h2>
      <p>
        אמנדה התחילה כחפיסת קלפי מפלצות ובסרט, הרבה לפני שהיא הייתה משחק. היא
        לא נוצרה בשביל מסך — היא נוצרה בשביל שולחן, קלפים ביד, וילדים שמתווכחים
        מי מנצח.
      </p>
      <p>
        המשחק הזה הוא אותה חפיסה, רק שהמפלצות נלחמות לבד. אתם בונים את הלוח,
        ואז מרפים. אמנדה שופטת. אמנדה גם אוכלת.
      </p>

      <h3>הסרט</h3>
      <p>כל הסיפור, במלואו:</p>
      <a className="about__film" href={FILM} target="_blank" rel="noreferrer noopener">
        <Icon name="play" size={18} /> לצפייה בסרט המלא ביוטיוב
      </a>

      <h3>מי עשה את זה</h3>
      <p>
        אור, והוד. אבא ובן. הקלפים, הדמויות והסיפור הם שלהם; המשחק נבנה סביבם.
      </p>
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
