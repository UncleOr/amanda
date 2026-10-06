/**
 * What was in the chest.
 *
 * The server decided the contents and put the cards in the album before this
 * ever runs (apps/server/src/progress.ts), so nothing here can fail and
 * nothing is lost by closing the game half way through. This is a reveal, not
 * a transaction — which is exactly why it is allowed to be slow and enjoyable.
 *
 * Or: "opening a chest is the most 'gaming' moment the game has." It was an
 * icon of a card deck at 96px on a panel. Now there is a painted chest that
 * rattles at you until you tap it, a burst of light when you do, and the cards
 * turn over one at a time — because the whole point of a chest is the moment
 * before you know.
 */
import { useEffect, useState } from "react";
import { CATALOG } from "../data/catalog";
import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import type { Chest } from "../game/account";
import * as V from "../data/voice";

/** How each kind of chest introduces itself, and which painting it is. */
const CHEST_LOOK: Record<string, { he: string; tone: string; art: string }> = {
  // png, not webp: a chest is an object and keeps its transparency, so it sits
  // on the panel instead of on a coloured tile (see process.ts).
  wood: { he: "תיבת עץ", tone: "#b07a3c", art: "chest_wood.png" },
  silver: { he: "תיבת כסף", tone: "#c3cdd8", art: "chest_silver.png" },
  gold: { he: "תיבת זהב", tone: "#f0b429", art: "chest_gold.png" },
};

const BASE = import.meta.env.BASE_URL;

interface Props {
  chest: Chest;
  onClose: () => void;
}

export function ChestReveal({ chest, onClose }: Props) {
  const [opened, setOpened] = useState(false);
  /**
   * The flash, which outlives the chest by a beat.
   *
   * Kept separate from `opened` so the burst can still be on screen while the
   * cards are already turning — the light and the prize overlapping is what
   * makes it feel like one event rather than two screens.
   */
  const [burst, setBurst] = useState(false);
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

  // The flash fades on its own; nothing waits for it.
  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(false), 1100);
    return () => window.clearTimeout(t);
  }, [burst]);

  const open = () => {
    if (opened) return;
    setBurst(true);
    setOpened(true);
  };

  const allShown = shown >= chest.cards.length;

  return (
    <div className="chest" role="dialog">
      <div className={`chest__panel chest__panel--${chest.kind}`}>
        <p className="chest__title" style={{ color: look.tone }}>
          {look.he}
        </p>

        {burst && <div className="chest__burst" aria-hidden="true" />}

        {!opened ? (
          <>
            {/*
              The chest IS the button. A painting with a separate "open"
              control underneath makes the picture scenery; tapping the thing
              itself is the whole gesture.
            */}
            <button
              className="chest__lid"
              onClick={open}
              aria-label={`פתח ${look.he}`}
              style={{ backgroundImage: `url("${BASE}scenes/${look.art}")` }}
            />
            <p className="chest__says">{line}</p>
            <button className="btn-fight chest__open" onClick={open}>
              פתח
            </button>
          </>
        ) : (
          <>
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
                <Icon name="gem" size={22} /> +{chest.diamonds}
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
