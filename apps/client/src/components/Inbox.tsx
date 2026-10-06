import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { loadInbox, markInboxRead, type Notice } from "../game/account";

/**
 * What the game has to tell you.
 *
 * Or: "and for the app we will also need notifications — to tell a player
 * about gifts, offers and so on."
 *
 * This is the in-app half, and it is deliberately the half that exists first.
 * A push notification is the SAME row delivered a second way; building the row
 * and the inbox now means push later is "also send this over the wire" rather
 * than a feature designed from scratch under a deadline.
 *
 * It also matters for the age rating: under Google's Families Policy,
 * notifications to children are restricted and need consent, and that is a
 * question on the IARC form. Having the inbox working while push is not yet
 * sent is the right order to be in when filling it in.
 *
 * Opening the list marks everything read. An inbox in a children's game is
 * something you open, not something you manage one line at a time — the badge
 * going away when you look is the whole interaction.
 */
const KIND_ICON: Record<Notice["kind"], string> = {
  gift: "chest",
  offer: "gem",
  chest: "chest",
  friend: "friend",
  news: "report",
};

function when(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return new Date(iso).toLocaleDateString("he-IL");
}

export function Inbox({ onClose, onAction }: { onClose: () => void; onAction: (a: string) => void }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { notices: list } = await loadInbox();
      setNotices(list);
      // Looking IS reading. Done after the list is in hand so the unread marks
      // are still visible on the ones that were new a moment ago.
      await markInboxRead();
    })();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--inbox" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>
        <h2 className="friends__title">הודעות</h2>

        {notices === null ? (
          <p className="friends__hint">רגע…</p>
        ) : notices.length === 0 ? (
          <p className="friends__hint">אין כלום חדש. כשתהיה מתנה, היא תופיע כאן.</p>
        ) : (
          <ul className="inbox__list">
            {notices.map((n) => (
              <li key={n.id} className={`inbox__row${n.read_at ? "" : " is-new"}`}>
                <span className="inbox__icon">
                  <Icon name={(KIND_ICON[n.kind] ?? "report") as never} size={18} />
                </span>
                <span className="inbox__text">
                  <b>{n.title.he}</b>
                  {n.body?.he && <small>{n.body.he}</small>}
                  <i>{when(n.created_at)}</i>
                </span>
                {n.action && (
                  <button
                    className="btn-fight btn-small"
                    onClick={() => {
                      onAction(n.action!);
                      onClose();
                    }}
                  >
                    לראות
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
