import { Icon } from "./Icon";
import { Overlay } from "./Overlay";

/**
 * What a guest may do, and what an account is for.
 *
 * Or's first ruling was everything: reports, friends, shop, album, arena
 * progress. Then he saw a first visit with that many padlocks on it and
 * narrowed it: *"open the album to guests and leave only the shop, friends
 * and online play locked."*
 *
 * That is the better line, and the reason is worth keeping: COLLECTING IS THE
 * GAME. A child who cannot see their album has not been given a reason to
 * want an account, they have been given a reason to leave. What an account
 * buys is not the album — it is KEEPING the album, which a guest genuinely
 * cannot do, because an anonymous account dies with the browser's storage.
 *
 * ═══ LOCKED, NOT HIDDEN ═══
 *
 * The three that remain are drawn and visibly shut rather than removed. A
 * hidden thing persuades nobody. Same reasoning as the locked arenas Or asked
 * for: "so there is something to aim for."
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
  // The first line is the true one, and it is first on purpose: a guest can
  // already SEE their album — what they cannot do is keep it.
  { icon: "deck", he: "האלבום נשמר — גם אם תנקה את הדפדפן או תחליף מכשיר" },
  { icon: "online", he: "לשחק מול אנשים אמיתיים" },
  { icon: "friend", he: "חברים — לראות מי מחובר ולהזמין למשחק" },
  { icon: "gem", he: "חנות נוחות" },
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
    <Overlay onClick={onClose}>
      <div className="modal modal--why" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>
        <h2>עם חשבון זה שלך</h2>
        <p className="why__lead">
          בלי חשבון אפשר לשחק ולאסוף — אבל הכול יושב רק בדפדפן הזה, וברגע
          שתנקה אותו או תעבור למכשיר אחר, הוא ייעלם.
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
    </Overlay>
  );
}
