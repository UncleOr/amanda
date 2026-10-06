import { useEffect, useState } from "react";
import { TAUNTS, tauntById } from "@amanda/shared";
import { Icon } from "./Icon";

/**
 * Saying something to the other player.
 *
 * Or asked for "emoji and ready-made sentences, in the theme of the game,
 * during the battle and at the end of it". This is the picker and the bubble.
 *
 * There is no text field and there never will be — the reasoning is in
 * packages/shared/src/taunts.ts. The two things worth knowing here:
 *
 *   The picker only offers what can be said NOW. "Good game" belongs at the
 *   end, and offering it while somebody is still building is how a friendly
 *   list starts to read as a sarcastic one.
 *
 *   A bubble is one line, briefly. Not a log, not a history, nothing kept. A
 *   child who wants it to stop has a switch that stops it (see `hearing`),
 *   and nothing to scroll back through afterwards.
 */
const SHOW_MS = 4000;

export function SayButton({
  onSay,
  atEnd = false,
  hearing = true,
  onToggleHearing,
}: {
  onSay: (id: string) => void;
  /** True on the result screen, where the end-of-match lines unlock. */
  atEnd?: boolean;
  /** False when the other player's lines are switched off. */
  hearing?: boolean;
  onToggleHearing?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const offered = TAUNTS.filter((t) => atEnd || t.when === "always");

  return (
    <div className={`say${open ? " say--open" : ""}`}>
      <button
        className="say__handle"
        onClick={() => setOpen((o) => !o)}
        title={open ? "סגירה" : "להגיד משהו"}
        aria-expanded={open}
      >
        <Icon name={open ? "exit" : "friend"} size={16} />
        {!open && <span className="say__handle-emoji">👋</span>}
      </button>

      {open && (
        <div className="say__sheet" role="menu">
          {onToggleHearing && (
            /*
             * The way out, where the way in is.
             *
             * A child who does not want to see the other player's messages
             * should not have to report anybody or go hunting in a settings
             * screen — the switch is in the same sheet as the messages.
             */
            <button
              className={`say__one say__mute${hearing ? "" : " is-off"}`}
              role="menuitemcheckbox"
              aria-checked={!hearing}
              onClick={onToggleHearing}
            >
              <span className="say__emoji">
                <Icon name={hearing ? "soundOn" : "soundOff"} size={17} />
              </span>
              <span className="say__words">
                {hearing ? "לא לראות הודעות" : "להראות הודעות שוב"}
              </span>
            </button>
          )}
          {offered.map((t) => (
            <button
              key={t.id}
              className="say__one"
              role="menuitem"
              onClick={() => {
                onSay(t.id);
                setOpen(false);
              }}
            >
              <span className="say__emoji">{t.emoji}</span>
              <span className="say__words">{t.he}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One line, over the board of whoever said it.
 *
 * `at` is a timestamp rather than a boolean so that saying the SAME line
 * twice still shows twice — with a boolean the second one would look like
 * nothing happened.
 */
export function SaidBubble({
  said,
  mine = false,
}: {
  said: { id: string; at: number } | null;
  mine?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!said) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [said?.id, said?.at]);

  const taunt = said ? tauntById(said.id) : undefined;
  if (!taunt || !show) return null;

  return (
    <div className={`bubble${mine ? " bubble--mine" : ""}`} role="status">
      <span className="bubble__emoji">{taunt.emoji}</span>
      <span className="bubble__words">{taunt.he}</span>
    </div>
  );
}
