/**
 * The album: every card in the game, and what you have of it.
 *
 * Deliberately shows the cards you do NOT own as well, face down. An album
 * with gaps is the point — the empty slots are the reason to play another
 * match, and hiding them would hide the whole game.
 */
import { CATALOG, SERIES } from "../data/catalog";
import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import { useState } from "react";
import { LEVELS, levelCost } from "@amanda/shared";
import { levelUpCard, type Account } from "../game/account";

interface Props {
  account: Account | null;
  onClose: () => void;
  onCardInfo?: (cardId: string) => void;
  /** Re-read the album after a level is bought. */
  onChanged?: () => void;
}

export function Album({ account, onClose, onCardInfo, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function buyLevel(cardId: string) {
    setBusy(cardId);
    const out = await levelUpCard(cardId);
    setBusy(null);
    setNote(out.error ?? null);
    if (!out.error) onChanged?.();
  }

  const album = account?.album;
  // Only cards that belong to a series are collectable, and only those are
  // shown below. The Crumb Demon fills empty cells and is in the catalog but
  // in no series — counting it made the header disagree with the grid.
  const collectable = [...CATALOG.values()].filter((c) => SERIES.some((s) => s.id === c.seriesId));
  const total = collectable.length;
  const owned = collectable.filter((c) => album?.has(c.id)).length;

  return (
    <div className="album">
      <header className="album__bar">
        <button className="btn-fight btn-online" onClick={onClose}>
          ← חזרה
        </button>
        <div className="album__counts">
          <span className="album__count">
            <Icon name="monster" size={16} /> {owned}/{total}
          </span>
          {account && (
            <>
              <span className="album__count">
                <Icon name="win" size={16} /> {account.trophies}
              </span>
              <span className="album__count album__count--gem">
                💎 {account.diamonds}
              </span>
            </>
          )}
        </div>
      </header>

      {!account && (
        <p className="album__none">
          אין לך עדיין אלבום משלך — אתה משחק מהחפיסה המלאה. כשיהיה חשבון, מה
          שתאסוף יישמר כאן.
        </p>
      )}

      {note && <p className="album__none album__none--warn">{note}</p>}

      <div className="album__scroll">
        {SERIES.map((series) => {
          const cards = [...CATALOG.values()].filter((c) => c.seriesId === series.id);
          if (!cards.length) return null;
          const have = cards.filter((c) => album?.has(c.id)).length;
          return (
            <section key={series.id} className="album__series">
              <h3 className="album__series-name">
                {series.name.he}
                <span className="album__series-count">
                  {have}/{cards.length}
                </span>
              </h3>
              <div className="album__grid">
                {cards.map((card) => {
                  const mine = album?.get(card.id);
                  return (
                    <div
                      key={card.id}
                      className={`album__cell${mine ? "" : " album__cell--missing"}`}
                      onClick={() => mine && onCardInfo?.(card.id)}
                    >
                      {mine ? (
                        <>
                          <CardView cardId={card.id} size="small" />
                          <span className="album__copies" title="עותקים — כמה פעמים אפשר להניח אותו">
                            ×{mine.copies}
                          </span>
                          {mine.level > 1 && (
                            <span className="album__level">רמה {mine.level}</span>
                          )}
                          {/* Width or height: keep the copies to put more of it
                              on the board, or spend them to make one stronger. */}
                          {mine.level < LEVELS.max && (
                            <button
                              className="album__up"
                              disabled={
                                busy === card.id || mine.copies < levelCost(card.rarity, mine.level)
                              }
                              title={`שדרוג לרמה ${mine.level + 1} — עולה ${levelCost(card.rarity, mine.level)} עותקים`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void buyLevel(card.id);
                              }}
                            >
                              ▲ {levelCost(card.rarity, mine.level)}
                            </button>
                          )}
                        </>
                      ) : (
                        <CardBack size="small" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
