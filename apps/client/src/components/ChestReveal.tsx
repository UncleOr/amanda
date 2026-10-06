/**
 * What was in the chest.
 *
 * The server decided the contents and put the cards in the album before this
 * ever runs (apps/server/src/progress.ts), so nothing here can fail and
 * nothing is lost by closing the game half way through. This is a reveal, not
 * a transaction — which is exactly why it is allowed to be slow and enjoyable.
 *
 * Cards turn over one at a time rather than all at once, because the whole
 * point of a chest is the moment before you know.
 */
import { useEffect, useState } from "react";
import { CATALOG } from "../data/catalog";
import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import type { Chest } from "../game/account";
import * as V from "../data/voice";

/** How each kind of chest introduces itself. */
const CHEST_LOOK: Record<string, { he: string; tone: string }> = {
  wood: { he: "תיבת עץ", tone: "#b07a3c" },
  silver: { he: "תיבת כסף", tone: "#c3cdd8" },
  gold: { he: "תיבת זהב", tone: "#f0b429" },
};

interface Props {
  chest: Chest;
  onClose: () => void;
}

export function ChestReveal({ chest, onClose }: Props) {
  const [opened, setOpened] = useState(false);
  /** How many cards have been turned over so far. */
  const [shown, setShown] = useState(0);
  const look = CHEST_LOOK[chest.kind] ?? CHEST_LOOK.wood!;
  const [line] = useState(() => V.pick(V.CHEST_LINES));

  // Turn them over one at a time once it is open.
  useEffect(() => {
    if (!opened || shown >= chest.cards.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), 420);
    return () => window.clearTimeout(t);
  }, [opened, shown, chest.cards.length]);

  const allShown = shown >= chest.cards.length;

  return (
    <div className="chest" role="dialog">
      <div className="chest__panel" style={{ borderColor: look.tone }}>
        {!opened ? (
          <>
            <p className="chest__title" style={{ color: look.tone }}>
              {look.he}
            </p>
            <button className="chest__lid" onClick={() => setOpened(true)} aria-label="פתח">
              <Icon name="deck" size={96} />
              <span className="chest__shine" style={{ background: look.tone }} />
            </button>
            <p className="chest__says">{line}</p>
            <button className="btn-fight" onClick={() => setOpened(true)}>
              פתח
            </button>
          </>
        ) : (
          <>
            <p className="chest__title" style={{ color: look.tone }}>
              {look.he}
            </p>
            <div className="chest__cards">
              {chest.cards.map((id, i) => (
                <div key={`${id}-${i}`} className={`chest__card${i < shown ? " is-up" : ""}`}>
                  {i < shown && CATALOG.has(id) ? (
                    <CardView cardId={id} size="small" />
                  ) : (
                    <CardBack size="small" />
                  )}
                </div>
              ))}
            </div>
            {chest.diamonds > 0 && allShown && (
              <p className="chest__gems">
          <Icon name="gem" size={20} /> +{chest.diamonds}
        </p>
            )}
            <button className="btn-fight" disabled={!allShown} onClick={onClose}>
              {allShown ? "יפה" : "…"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
