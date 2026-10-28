import { useEffect, useState } from "react";

/**
 * A box to write a fix in, and the history of what was done about them.
 *
 * Or: *"leave me a free box to leave you fixes in, in free language. I will
 * tell you here in this chat to go over all the fixes I left you in the
 * arenas and the cards, and you will go over them, fix them, report what was
 * done, put it into the card's fix history in the admin interface, and clear
 * the box for me."*
 *
 * ═══ WHY THE BOX IS ATTACHED TO THE THING ═══
 *
 * A list of forty notes somewhere else is a list nobody reads in the moment
 * it matters. A note about the Flame Dragon sitting UNDER the Flame Dragon is
 * read by the person who just opened the Flame Dragon — including the person
 * who opened it to change something else, which is exactly when a note like
 * *"his attack feels slow"* is worth seeing.
 *
 * And the history is the same argument pointed backwards: the next time
 * somebody wonders why this card's numbers are odd, the answer is on the
 * card, in the words it was asked for in.
 *
 * ═══ ONE BOX, NOT A THREAD ═══
 *
 * There is exactly one open note per thing (a partial unique index says so),
 * and writing in the box replaces what was there. A thread would mean
 * deciding which of three open notes the panel shows, and the two it hides
 * are the two nobody acts on.
 */
export interface FixNote {
  id: string;
  scope: string;
  target: string;
  note: string;
  status: string;
  done_note: string | null;
  created_at: string;
  done_at: string | null;
}

export interface FixBoxProps {
  scope: "card" | "arena";
  /** A card id or an arena id. */
  target: string;
  notes: readonly FixNote[];
  call: (path: string, body?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  say: (message: string) => void;
  /** Re-read the notes after a write, so every editor sees the same list. */
  reload: () => void | Promise<void>;
}

/** Notes about one thing, newest first. Exported for the dot in the list. */
export function notesFor(
  notes: readonly FixNote[],
  scope: string,
  target: string,
): { open: FixNote | null; done: FixNote[] } {
  const mine = notes.filter((n) => n.scope === scope && n.target === target);
  return {
    open: mine.find((n) => n.status === "open") ?? null,
    done: mine.filter((n) => n.status === "done"),
  };
}

const when = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short" }) : "";

export function FixBox({ scope, target, notes, call, say, reload }: FixBoxProps) {
  const { open, done } = notesFor(notes, scope, target);
  const [text, setText] = useState(open?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [shut, setShut] = useState(true);

  /*
   * ⚠ The draft follows the THING, not every keystroke. Resetting on each
   * render of a new `notes` array would wipe a half-typed note the moment
   * anything else in the panel saved; keying it to the target means picking
   * a different card loads that card's note and nothing else does.
   */
  useEffect(() => {
    setText(open?.note ?? "");
    setShut(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, target]);

  async function save() {
    setBusy(true);
    const r = await call("/api/admin/notes/save", { scope, target, note: text });
    setBusy(false);
    if (r.error) return say(String(r.error));
    say(text.trim() ? "ההערה נשמרה." : "התיבה רוקנה.");
    await reload();
  }

  const dirty = text.trim() !== (open?.note ?? "");

  return (
    <section className="fix">
      <h4 className="ed__h">
        תיקונים
        <small>כתוב כאן מה לתקן, בשפה חופשית. תגיד לי בצ'אט לעבור על התיקונים.</small>
      </h4>
      <textarea
        className="fix__box"
        value={text}
        placeholder="מה לתקן כאן?"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="fix__actions">
        <button disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? "שומר…" : "שמור הערה"}
        </button>
        {open && (
          <span className="fix__since">נשמר {when(open.created_at)} · ממתין</span>
        )}
      </div>

      {done.length > 0 && (
        <div className="fix__log">
          <button className="fix__log-head" onClick={() => setShut((s) => !s)}>
            היסטוריית תיקונים <i>{done.length}</i>
          </button>
          {!shut &&
            done.map((n) => (
              <article className="fix__item" key={n.id}>
                <p className="fix__asked">{n.note}</p>
                <p className="fix__did">{n.done_note}</p>
                <time className="fix__when">{when(n.done_at ?? n.created_at)}</time>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
