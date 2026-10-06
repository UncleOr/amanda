import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { fileReport, recentOpponents, type Opponent } from "../game/account";

/**
 * Reporting a bug, or a player who was unpleasant.
 *
 * ═══ WHAT THIS DELIBERATELY DOES NOT HAVE ═══
 *
 * A free text box naming anybody. You pick from people you have actually
 * played, because the server will only accept one of those — and because
 * offering a child a blank field and asking "who was mean to you" invites
 * them to write a name they are angry about rather than one they met.
 *
 * It also does not promise an outcome. "We will look" is true; "we will
 * punish them" is not something a form gets to decide.
 *
 * Reporting needs a real account, and so does being reported. An anonymous
 * account is free and takes a second: a report from one is a report from
 * nobody, and suspending one punishes nobody.
 */
export function Report({
  onClose,
  initialKind = "bug",
}: {
  onClose: () => void;
  initialKind?: "bug" | "player";
}) {
  const [kind, setKind] = useState<"bug" | "player">(initialKind);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [picked, setPicked] = useState<Opponent | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (kind !== "player" || opponents) return;
    void recentOpponents().then(setOpponents);
  }, [kind, opponents]);

  async function send() {
    setBusy(true);
    const err = await fileReport({
      kind,
      reportedId: picked?.id ?? null,
      aboutMatch: picked?.matchId ?? null,
      message,
    });
    setBusy(false);
    if (err) return setNote(err);
    setSent(true);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--report" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>

        {sent ? (
          <div className="report__done">
            <Icon name="ready" size={56} />
            <h2>קיבלנו.</h2>
            <p>נסתכל על זה. תודה שסיפרת לנו.</p>
            <button className="btn-fight" onClick={onClose}>
              סגור
            </button>
          </div>
        ) : (
          <>
            <h2 className="report__title">לספר לנו משהו</h2>
            <div className="report__kinds">
              <button className={kind === "bug" ? "is-on" : ""} onClick={() => setKind("bug")}>
                <Icon name="warning" size={16} /> משהו לא עובד
              </button>
              <button
                className={kind === "player" ? "is-on" : ""}
                onClick={() => setKind("player")}
              >
                <Icon name="friend" size={16} /> שחקן שהתנהג לא יפה
              </button>
            </div>

            {kind === "player" && (
              <>
                <p className="report__hint">
                  אפשר לדווח רק על מישהו ששיחקת מולו, ורק אם יש לו חשבון.
                </p>
                {opponents === null ? (
                  <p className="report__hint">רגע…</p>
                ) : opponents.length === 0 ? (
                  <p className="report__hint">
                    עוד לא שיחקת מול שחקן רשום. דיווח על שחקן אפשרי רק אחרי משחק
                    כזה.
                  </p>
                ) : (
                  <div className="report__who">
                    {opponents.map((o) => (
                      <button
                        key={o.id}
                        className={picked?.id === o.id ? "is-on" : ""}
                        onClick={() => setPicked(o)}
                      >
                        {o.nickname ?? "בלי שם"}
                        <small>{new Date(o.at).toLocaleDateString("he-IL")}</small>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <textarea
              className="report__text"
              rows={4}
              maxLength={1000}
              value={message}
              placeholder={
                kind === "bug" ? "מה קרה? מה ציפית שיקרה?" : "מה הוא עשה?"
              }
              onChange={(e) => setMessage(e.target.value)}
            />

            {note && <p className="report__note">{note}</p>}

            <div className="result__buttons">
              <button
                className="btn-fight"
                disabled={busy || (kind === "player" && !picked)}
                onClick={() => void send()}
              >
                {busy ? "שולח…" : "שליחה"}
              </button>
              <button className="btn-fight btn-ghost" onClick={onClose}>
                ביטול
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
