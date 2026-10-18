import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t } from "../game/copy";

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
export const LOCKED_REASON = t("s9c73ff4", "צריך חשבון. זה חינם, ושומר את האלבום שלך.");

/** Everything a guest is missing, in the order it is worth wanting. */
export const WHAT_AN_ACCOUNT_GIVES = [
  // The first line is the true one, and it is first on purpose: a guest can
  // already SEE their album — what they cannot do is keep it.
  { icon: "deck", he: t("s3e98614", "האלבום נשמר — גם אם תנקה את הדפדפן או תחליף מכשיר") },
  { icon: "online", he: t("se65df62", "לשחק מול אנשים אמיתיים") },
  { icon: "friend", he: t("s627ac6b", "חברים — לראות מי מחובר ולהזמין למשחק") },
  { icon: "gem", he: t("sa9713fa", "חנות נוחות") },
] as const;

/**
 * A small padlock, for a control that is drawn but shut.
 *
 * It is a `<span>` and not a `<button>` on purpose: the thing underneath is
 * already the button, and nesting one inside another is both invalid and a
 * second thing for a screen reader to announce.
 *
 * ═══ IT WAS AN EYE, AND THAT IS WHY NOBODY COULD READ IT ═══
 *
 * Or, twice. First: *"and what is that thing happening under the text of
 * 'play with friends'?"* Then, with three of them circled in green: *"I don't
 * know what all these purple eyes are, but we've talked about them already,
 * haven't we? If they have no purpose, get rid of them."*
 *
 * They have a purpose — they mark the things a guest cannot have yet — but he
 * was describing the picture exactly. This drew `<Icon name="hidden" />`, and
 * `hidden` in this game's icon set is defined, in so many words, as *"an eye
 * with a thick bar across it, dull grey and violet"*. It is the fog icon: the
 * right picture for a card you cannot see, and nothing at all to do with
 * needing an account. At 12px the bar across it disappears and what is left
 * is a small purple eye.
 *
 * So: an actual padlock. Drawn inline rather than added to the icon set
 * because the set is generated art and this is a 12px piece of furniture —
 * two rounded rectangles and an arc, in `currentColor`, which inherits the
 * accent the badge already uses.
 *
 * If he still does not want them once they look like locks, deleting the four
 * `<Lock />` call sites is the whole job: every one of them sits on a control
 * that is ALREADY gated on tap, so the sign-in card still appears either way.
 */
export function Lock() {
  return (
    <span className="lock" title={LOCKED_REASON} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor">
        {/* the shackle */}
        <path
          d="M8 10V7a4 4 0 0 1 8 0v3"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* the body, filled so it reads as solid at this size */}
        <rect x="4.5" y="10" width="15" height="10.5" rx="2.4" fill="currentColor" stroke="none" />
      </svg>
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
        <button className="modal__close" onClick={onClose} title={t("s59e83a1", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>
        <h2>{t("sde7d6f8", "עם חשבון זה שלך")}</h2>
        <p className="why__lead">
          {t("se86ff27", "בלי חשבון אפשר לשחק ולאסוף — אבל הכול יושב רק בדפדפן הזה, וברגע שתנקה אותו או תעבור למכשיר אחר, הוא ייעלם.")}
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
            <Icon name="king" size={16} /> {t("s29640f4", "להתחבר")}
          </button>
          <button className="btn-fight btn-ghost" onClick={onClose}>
            {t("s88dd08b", "אחר כך")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
