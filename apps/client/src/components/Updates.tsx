import { useEffect } from "react";
import { Icon } from "./Icon";
import { UPDATES, markUpdatesSeen } from "../data/updates";

/**
 * "What's new" — the reason to open the game again.
 *
 * Or asked for it under about and updates: *"updates — what's new in this
 * version, so there is a reason to come back."*
 *
 * ═══ IT MARKS ITSELF READ ON OPENING, NOT ON CLOSING ═══
 *
 * Opening it IS reading it: the whole list is one short screen with no
 * scrolling to do on anything bigger than a phone. Waiting for a close would
 * mean a player who taps it, reads it and switches apps comes back to the
 * same dot — which teaches them the dot means nothing, and the dot is the
 * entire mechanism.
 *
 * The newest entry is at the TOP here and at the END of the list in
 * updates.ts, where appending is the natural way to add one.
 */
export function Updates({ onClose }: { onClose: () => void }) {
  useEffect(markUpdatesSeen, []);
  const newestFirst = [...UPDATES].reverse();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--news" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>
        <h2 className="news__title">
          <Icon name="info" size={20} /> מה חדש
        </h2>

        {newestFirst.length === 0 ? (
          <p className="news__lead">עוד לא קרה כלום. תחזרו.</p>
        ) : (
          <ol className="news__list">
            {newestFirst.map((entry, i) => (
              <li key={entry.id} className={i === 0 ? "is-newest" : ""}>
                <header>
                  <b>{entry.title}</b>
                  <small>{entry.when}</small>
                  {/* Only on the newest, and only as a word — a number here
                      would invite counting things that are not countable. */}
                  {i === 0 && <span className="news__flag">חדש</span>}
                </header>
                <ul>
                  {entry.lines.map((line, n) => (
                    <li key={n}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
