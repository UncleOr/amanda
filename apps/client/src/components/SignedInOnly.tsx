import { Icon } from "./Icon";

/**
 * What a guest may do, and what an account is for.
 *
 * Or's ruling: *"we should decide what is only available to signed-in users,
 * to encourage everyone to sign in. Reports. Friends. Shop. Album. Arena
 * progress. As far as I'm concerned an anonymous user can only play a one-off
 * against a bot."*
 *
 * ═══ LOCKED, NOT HIDDEN ═══
 *
 * Every one of these is drawn and visibly shut rather than removed. A hidden
 * thing persuades nobody — the whole point is that a child sees the album,
 * the shelf of arenas and the shop, wants them, and asks a grown-up to sign
 * them in. It is the same reasoning as the locked arenas Or asked for: "so
 * there is something to aim for."
 *
 * ═══ "SIGNED IN" MEANS A REAL IDENTITY ═══
 *
 * Everybody already has an account — the game makes an anonymous one on the
 * first visit so a match has somewhere to go. That account is thrown away the
 * moment the browser is cleared, which is exactly why it cannot be the thing
 * that owns an album. `linked` is true once a Google account or an email is
 * attached, and that is the line.
 */
export const LOCKED_REASON = "צריך חשבון. זה חינם, ושומר את האלבום שלך.";

/** Everything a guest is missing, in the order it is worth wanting. */
export const WHAT_AN_ACCOUNT_GIVES = [
  { icon: "deck", he: "אלבום — הקלפים נשמרים" },
  { icon: "win", he: "גביעים, וארנות שנפתחות" },
  { icon: "chest", he: "תיבות ופרסים" },
  { icon: "gem", he: "חנות הנוחות" },
  { icon: "friend", he: "חברים ומשחק מולם" },
  { icon: "online", he: "לשחק מול אנשים אמיתיים" },
] as const;

/**
 * A small padlock, for a control that is drawn but shut.
 *
 * It is a `<span>` and not a `<button>` on purpose: the thing underneath is
 * already the button, and nesting one inside another is both invalid and a
 * second thing for a screen reader to announce.
 */
export function Lock() {
  return (
    <span className="lock" title={LOCKED_REASON} aria-hidden="true">
      <Icon name="hidden" size={12} />
    </span>
  );
}

/**
 * The sign-in invitation: what you are missing, and the way to stop missing
 * it. Shown when a guest reaches for something that needs an account.
 */
export function WhySignIn({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--why" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>
        <h2>עם חשבון זה שלך</h2>
        <p className="why__lead">
          בלי חשבון אפשר לשחק מול הבוט כמה שבא לך — אבל שום דבר לא נשמר, וברגע
          שתנקה את הדפדפן הכול ייעלם.
        </p>
        <ul className="why__list">
          {WHAT_AN_ACCOUNT_GIVES.map((row) => (
            <li key={row.he}>
              <Icon name={row.icon as never} size={17} /> {row.he}
            </li>
          ))}
        </ul>
        <div className="result__buttons">
          <button className="btn-fight" onClick={onSignIn}>
            <Icon name="king" size={16} /> להתחבר
          </button>
          <button className="btn-fight btn-ghost" onClick={onClose}>
            אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
