/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **Seeing what you have, and what you are missing.** The cards are the hero;
 * everything else here is furniture.
 *
 * Measured at 844x390 before this was true: the bar took 67px, a drawn cover
 * took 44 and the battle record took 110, so the FIRST CARD began at y=277 of
 * a 390px screen. Seventy-one per cent of the album was spent before the album
 * started, and exactly one row of cards was on screen — on the screen whose
 * whole job is a collection of fifty-two.
 *
 * Deliberately shows the cards you do NOT own as well, face down. An album
 * with gaps is the point — the empty slots are the reason to play another
 * match, and hiding them would hide the whole game.
 */
import { CATALOG, SERIES } from "../data/catalog";
import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import { useEffect, useState } from "react";
import { LEVELS, levelCost } from "@amanda/shared";
import { levelUpCard, loadStats, type Account, type Stats } from "../game/account";

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
  /*
   * Or: the album should hold everything about me THAT IS ABOUT THE GAME — not
   * only which stickers I have, but what I have won and lost and collected.
   * (The personal area holds everything about me as a person.) Counted from
   * the match rows the server wrote, so it cannot disagree with what happened.
   */
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (!account) return;
    let alive = true;
    void loadStats().then((s) => alive && setStats(s));
    return () => {
      alive = false;
    };
  }, [account]);

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
      {/*
        The header carries the one number this screen exists to answer — how
        far along am I — and the way out. It used to carry them the other way
        round: the back button was a blue gradient at 17px and the count was a
        16px chip beside it, so the loudest thing on the album, and the first
        thing in the eye path, was the door.
      */}
      <header className="album__bar">
        <span className="album__count album__count--cards">
          <Icon name="monster" size={22} /> {owned}/{total}
        </span>
        <div className="album__counts">
          {account && (
            <>
              <span className="album__count">
                <Icon name="win" size={16} /> {account.trophies}
              </span>
              <span className="album__count album__count--gem">
                <Icon name="gem" size={15} /> {account.diamonds}
              </span>
            </>
          )}
          <button className="btn-fight btn-ghost album__back" onClick={onClose}>
            ← חזרה
          </button>
        </div>
      </header>

      {/* Five words, not two sentences. Or has asked for this more times than
          any other thing in this game, and the audit now reads multi-line JSX
          so it can no longer be slipped past by pressing Enter. */}
      {!account && <p className="album__none">אתה משחק מהחפיסה המלאה</p>}

      {note && <p className="album__none album__none--warn">{note}</p>}

      <div className="album__scroll">
        {/* The album looks like an album now: a drawn cover above the shelf. */}
        <div className="album__cover" aria-hidden="true" />
        {stats && (
          <section className="record">
            {/*
              Or, on the version this replaced: "very app-like. Gaming. Fun.
              Illustrations." It was a grid of numbers with grey captions under
              them — a settings screen, not a trophy shelf. Each number is now
              a plaque with the game's own icon on it, big enough to look at.
            */}
            <h3 className="record__title">הקרבות שלך</h3>
            <div className="record__grid">
              {(
                [
                  /*
                   * Or: "no need to say 'win percentage' — put ניצחונות under
                   * the 42% and people will get it." He is right, and taking
                   * the label literally would have left TWO plaques saying
                   * ניצחונות, so the count and the percentage are one plaque
                   * now: the percentage is the number, the count is the small
                   * line under it, and nothing is lost.
                   */
                  /*
                   * ═══ THE CUP MEANS GAVI'IM, EVERYWHERE ═══
                   *
                   * Or: "why is the logo for שיא גביעים a crown, and for
                   * ניצחונות a cup?" Because I picked them by feel. The cup
                   * (`win`) is what a trophy looks like in the purse, on the
                   * arena track, in the payout and on the versus screen — so
                   * it was next to the ONE word in this panel that is not
                   * גביעים, while גביעים got a crown. And the crown means the
                   * King piece in eleven other places in this game.
                   *
                   * The cup goes back to trophies, the crown goes back to the
                   * board, and a win is a tick.
                   */
                  {
                    icon: "ready",
                    n: `${stats.played ? Math.round((stats.wins / stats.played) * 100) : 0}%`,
                    k: "ניצחונות",
                    sub: stats.played ? `${stats.wins} מתוך ${stats.played}` : null,
                    tone: "good",
                  },
                  { icon: "lose", n: stats.losses, k: "הפסדים", tone: "bad" },
                  { icon: "win", n: stats.bestTrophies, k: "שיא גביעים", tone: "gold" },
                  { icon: "chest", n: stats.chestsOpened, k: "תיבות", tone: "" },
                  { icon: "deck", n: stats.copiesOwned, k: "עותקים", tone: "" },
                ] as const
              ).map((cell) => (
                <div key={cell.k} className={`record__cell record__cell--${cell.tone || "plain"}`}>
                  <span className="record__icon">
                    <Icon name={cell.icon} size={34} />
                  </span>
                  <span className="record__n">{cell.n}</span>
                  <span className="record__k">{cell.k}</span>
                  {"sub" in cell && cell.sub && <span className="record__sub">{cell.sub}</span>}
                </div>
              ))}
            </div>
            {stats.recent.length > 0 && (
              <div className="record__streak" title="הקרבות האחרונים, החדש ביותר ראשון">
                {stats.recent.map((won, i) => (
                  <span key={i} className={`record__mark ${won ? "is-win" : "is-loss"}`}>
                    <Icon name={won ? "win" : "lose"} size={17} />
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

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
