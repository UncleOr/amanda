import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import {
  addableOpponents,
  friendAction,
  listFriends,
  type Friend,
} from "../game/account";
import { Overlay } from "./Overlay";

/**
 * The friends list.
 *
 * Or: "an option to add players to a friends list, to see whether they are
 * online, and to invite them to a game."
 *
 * ═══ WHAT THIS DELIBERATELY DOES NOT HAVE ═══
 *
 * A search box. There is no way here to look for a person by name, and there
 * will not be: the only people ever offered are the ones you have actually
 * played, which the SERVER decides from the match history. A seven-year-old
 * typing names into a box to find strangers is the thing this shape prevents
 * — in both directions.
 *
 * And nobody lands on your list without agreeing. A request waits until the
 * other child accepts it, because "added" would otherwise mean somebody can
 * watch whether a particular child is online.
 *
 * All three rules are enforced on the server (apps/server/src/friends.ts).
 * Nothing here is the gate; this is the way in.
 */
export function Friends({
  onClose,
  onInvite,
  canInvite,
}: {
  onClose: () => void;
  /** Open a room and call them into it. Null while there is no connection. */
  onInvite: ((playerId: string) => void) | null;
  canInvite: boolean;
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [addable, setAddable] = useState<Array<{ id: string; nickname: string | null }> | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setFriends(await listFriends());
  }, []);

  useEffect(() => {
    void refresh();
    /*
     * Who is online changes while the list is open, and the only honest way
     * to show that is to ask again. Ten seconds is slow enough to be free and
     * quick enough that "they just came on" is noticed while you are looking.
     */
    const t = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function act(action: "ask" | "accept" | "remove", id: string) {
    setBusy(id);
    const err = await friendAction(action, id);
    setBusy(null);
    setNote(err);
    await refresh();
    if (!err && action === "ask") setAddable((list) => (list ?? []).filter((o) => o.id !== id));
  }

  async function openAdd() {
    setAdding(true);
    setAddable(await addableOpponents());
  }

  const name = (f: { nickname: string | null }) => f.nickname ?? "בלי שם";

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--friends" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>
        <h2 className="friends__title">חברים</h2>

        {friends === null ? (
          <p className="friends__hint">רגע…</p>
        ) : friends.length === 0 ? (
          <p className="friends__hint">
            עוד אין כאן אף אחד. אפשר להוסיף רק מישהו ששיחקת מולו — שחק, ואז תוכל
            להוסיף אותו.
          </p>
        ) : (
          <ul className="friends__list">
            {friends.map((f) => (
              <li key={f.id} className={`friends__row${f.online ? " is-online" : ""}`}>
                <span className={`friends__dot${f.online ? " is-on" : ""}`} aria-hidden="true" />
                <span className="friends__who">
                  <b>{name(f)}</b>
                  <small>
                    {f.state === "asking"
                      ? "רוצה להיות חבר שלך"
                      : f.state === "asked"
                        ? "מחכה שיאשר"
                        : f.online
                          ? "מחובר"
                          : "לא מחובר"}
                  </small>
                </span>
                <span className="friends__do">
                  {f.state === "asking" ? (
                    <button
                      className="btn-fight btn-small"
                      disabled={busy === f.id}
                      onClick={() => void act("accept", f.id)}
                    >
                      <Icon name="ready" size={14} /> כן
                    </button>
                  ) : (
                    f.state === "friend" &&
                    f.online &&
                    onInvite && (
                      <button
                        className="btn-fight btn-small"
                        disabled={!canInvite}
                        title={canInvite ? "להזמין למשחק" : "אפשר להזמין ממסך הבית"}
                        onClick={() => onInvite(f.id)}
                      >
                        <Icon name="play" size={14} /> שחק
                      </button>
                    )
                  )}
                  <button
                    className="friends__drop"
                    title={f.state === "friend" ? "להסיר" : "לבטל"}
                    disabled={busy === f.id}
                    onClick={() => void act("remove", f.id)}
                  >
                    <Icon name="exit" size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {note && <p className="friends__note">{note}</p>}

        {!adding ? (
          <button className="btn-fight btn-ghost" onClick={() => void openAdd()}>
            <Icon name="plus" size={15} /> להוסיף חבר
          </button>
        ) : (
          <div className="friends__add">
            <p className="friends__hint">
              אפשר להוסיף רק מישהו ששיחקת מולו, ורק אם יש לו חשבון.
            </p>
            {addable === null ? (
              <p className="friends__hint">רגע…</p>
            ) : addable.length === 0 ? (
              <p className="friends__hint">אין כרגע אף אחד להוסיף.</p>
            ) : (
              <div className="friends__candidates">
                {addable.map((o) => (
                  <button
                    key={o.id}
                    disabled={busy === o.id}
                    onClick={() => void act("ask", o.id)}
                  >
                    <Icon name="plus" size={13} /> {name(o)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Overlay>
  );
}
