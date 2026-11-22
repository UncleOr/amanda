import { useState } from "react";
import { SQUARES, SQUARE_KINDS } from "@amanda/shared";
import { Icon, type IconName } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t } from "../game/copy";

/** Has this player been shown what the special squares are? */
const KEY = "amanda.squares.seen";

export function squaresIntroSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markSquaresIntroSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private browsing: they will be shown it once more, which is survivable */
  }
}

/**
 * **Two screens, the first time the ground stops being flat.**
 *
 * Or, 14 November 2026: *"and it needs to be that the first time you reach
 * an arena and there is a special spot there will be a tutorial like that
 * which shows it (2 screens like that), and that this tutorial is also in
 * the settings."*
 *
 * ═══ WHY IT IS NOT A LESSON ═══
 *
 * The three stages are a WALKTHROUGH: Amanda points at a square, waits for
 * you to put a card on it, and will not move on until you do. That is right
 * for the board, the crown and the guard posts, which are things you do.
 *
 * A special square is a thing you READ. There is no move to teach — you
 * already know how to place a card — only a fact: the ground is not flat any
 * more, there are eight kinds, and tapping one tells you which. A
 * walkthrough for that would be a walkthrough for a sentence.
 *
 * So: two screens, a button, and it never comes back. Which is also why the
 * same component is the entry in Settings — a thing you read is a thing you
 * may want to read again, and a lesson you have to replay to re-read is the
 * complaint he has made about this game twice.
 */
export function SquaresIntro({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const last = page === 1;
  return (
    <Overlay onClick={onClose}>
      <div className="modal sqintro" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s5956a08", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {page === 0 ? (
          <>
            <h2 className="sqintro__title">{t("s131483c", "הלוח השתנה")}</h2>
            <p className="sqintro__line">
              {t(
                "s6de79ee",
                "מהארנה השנייה יש על כל לוח כמה ספוטים — גם אצלך וגם אצל היריב. הם מוגרלים מחדש בכל משחק.",
              )}
            </p>
            <p className="sqintro__line">
              {t(
                "s0cb5115",
                "כל ספוט עושה משהו לקלף שעומד עליו. לוחצים עליו ורואים מה הוא עושה.",
              )}
            </p>
            {/*
              A picture of the thing, not a description of it: the badge that
              will be on the board, at the size it will be on the board.
            */}
            <div className="sqintro__demo" aria-hidden="true">
              <span className="sqintro__cell" style={{ ["--sq" as string]: SQUARES.hospital.colour }}>
                <Icon name={SQUARES.hospital.icon as IconName} size={16} />
              </span>
              <span className="sqintro__cell" style={{ ["--sq" as string]: SQUARES.minefield.colour }}>
                <Icon name={SQUARES.minefield.icon as IconName} size={16} />
              </span>
              <span className="sqintro__cell" style={{ ["--sq" as string]: SQUARES.bunker.colour }}>
                <Icon name={SQUARES.bunker.icon as IconName} size={16} />
              </span>
            </div>
          </>
        ) : (
          <>
            <h2 className="sqintro__title">{t("s6b2a759", "שמונה ספוטים")}</h2>
            <ul className="sqintro__list">
              {SQUARE_KINDS.map((kind) => (
                <li key={kind} style={{ ["--sq" as string]: SQUARES[kind].colour }}>
                  <span className="sqintro__cell">
                    <Icon name={SQUARES[kind].icon as IconName} size={15} />
                  </span>
                  <b>{SQUARES[kind].he}</b>
                </li>
              ))}
            </ul>
            <p className="sqintro__line sqintro__line--last">
              {t(
                "s29b9b76",
                "את הספוטים של היריב רואים בדיוק כמו את הקלפים שלו — קודם רק את השורה הראשונה, ובפאניקה עוד.",
              )}
            </p>
          </>
        )}

        <div className="sqintro__row">
          {/* Two dots: this is two screens and it says so, the way the
              lesson band says how many steps are left. */}
          <span className="sqintro__dots">
            {[0, 1].map((n) => (
              <i key={n} className={n === page ? "is-now" : undefined} />
            ))}
          </span>
          <button
            className="btn-fight"
            onClick={() => (last ? onClose() : setPage(1))}
          >
            {last ? t("sfbacb23", "יאללה") : t("sf70973e", "המשך ←")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
