import { useEffect, useState } from "react";
import {
  EMOJI_PACKS,
  TAUNTS,
  emojiFromSayId,
  emojiById,
  ownedEmoji,
  sayIdFor,
  tauntById,
} from "@amanda/shared";
import { Icon } from "./Icon";
import { EmojiFace } from "./EmojiFace";

/**
 * Saying something to the other player.
 *
 * Or asked for "emoji and ready-made sentences, in the theme of the game,
 * during the battle and at the end of it". This is the picker and the bubble.
 *
 * There is no text field and there never will be — the reasoning is in
 * packages/shared/src/taunts.ts. Three things worth knowing here:
 *
 *   The picker only offers what can be said NOW. "Good game" belongs at the
 *   end, and offering it while somebody is still building is how a friendly
 *   list starts to read as a sarcastic one.
 *
 *   A bubble is one line, briefly. Not a log, not a history, nothing kept. A
 *   child who wants it to stop has a switch that stops it (see `hearing`),
 *   and nothing to scroll back through afterwards.
 *
 *   THE EMOJI ARE A SECOND ROW, AND SOME OF THEM ARE OWNED. Or: *"the emoji
 *   (illustrated, in the theme!) are also something you buy in the shop or
 *   win in a chest, so that encourages you too."* Which only works if a
 *   player can see that there are more — so the ones you do not have are
 *   drawn locked rather than left out, exactly as the shop and the album are
 *   for a guest.
 */
const SHOW_MS = 4000;

export function SayButton({
  onSay,
  atEnd = false,
  hearing = true,
  onToggleHearing,
  owned = [],
  onWantMore,
}: {
  onSay: (id: string) => void;
  /** True on the result screen, where the end-of-match lines unlock. */
  atEnd?: boolean;
  /** False when the other player's lines are switched off. */
  hearing?: boolean;
  onToggleHearing?: () => void;
  /** Shop items this player holds, for the emoji packs. */
  owned?: readonly string[];
  /** Tapping a locked emoji — opens the shop. Absent means do not offer. */
  onWantMore?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const offered = TAUNTS.filter((t) => atEnd || t.when === "always");
  const mine = ownedEmoji(owned);
  const mineIds = new Set(mine.map((e) => e.id));
  /** The packs this player does not hold, so the row can show what is missing. */
  const missing = EMOJI_PACKS.filter((p) => !owned.includes(p.id));

  return (
    <div className={`say${open ? " say--open" : ""}`}>
      <button
        className="say__handle"
        onClick={() => setOpen((o) => !o)}
        title={open ? "סגירה" : "להגיד משהו"}
        aria-expanded={open}
      >
        <Icon name={open ? "exit" : "friend"} size={16} />
        {!open && <EmojiFace id="wave" size={18} className="say__handle-face" />}
      </button>

      {open && (
        <div className="say__sheet" role="menu">
          {/* The pictures first: they are one tap and the sentences are a read. */}
          <div className="say__faces">
            {mine.map((e) => (
              <button
                key={e.id}
                className="say__face"
                role="menuitem"
                title={e.he}
                onClick={() => {
                  onSay(sayIdFor(e.id));
                  setOpen(false);
                }}
              >
                <EmojiFace id={e.id} size={30} label={e.he} />
              </button>
            ))}
            {/*
              What is missing, as one button rather than a row of padlocks.
              A dozen greyed-out faces is a nag; "there are more" with the
              number is an offer.
            */}
            {onWantMore && missing.length > 0 && (
              <button
                className="say__face say__face--more"
                role="menuitem"
                title="עוד אימוג'ים בחנות"
                onClick={() => {
                  setOpen(false);
                  onWantMore();
                }}
              >
                <Icon name="plus" size={16} />
                <small>עוד</small>
              </button>
            )}
          </div>

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
              <span className="say__emoji">
                <EmojiFace id={t.face} size={22} />
              </span>
              <span className="say__words">{t.he}</span>
            </button>
          ))}
          {/* A sentence's face is always one of the free ones, so nothing in
              the list above can be a picture this player does not have. */}
          {mineIds.size === 0 && <p className="say__none">אין אימוג'ים</p>}
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
 *
 * It renders a sentence OR a bare picture, because the `say` channel carries
 * both: an emoji on its own is bigger and has no words under it, which is the
 * whole point of sending one instead of a line.
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

  if (!said || !show) return null;

  const loneEmoji = emojiFromSayId(said.id);
  if (loneEmoji)
    return (
      <div className={`bubble bubble--face${mine ? " bubble--mine" : ""}`} role="status">
        <EmojiFace id={loneEmoji.id} size={56} label={loneEmoji.he} alive />
      </div>
    );

  const taunt = tauntById(said.id);
  if (!taunt) return null;
  const face = emojiById(taunt.face);

  return (
    <div className={`bubble${mine ? " bubble--mine" : ""}`} role="status">
      <span className="bubble__emoji">
        <EmojiFace id={taunt.face} size={30} label={face?.he} alive />
      </span>
      <span className="bubble__words">{taunt.he}</span>
    </div>
  );
}
