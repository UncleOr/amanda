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
import { CATALOG, SERIES, collectable } from "../data/catalog";
import { CardView } from "./CardView";
import { Icon } from "./Icon";
import { useEffect, useState } from "react";
import { sfx } from "../game/sfx";
import { pressed } from "../game/press";

const BASE = import.meta.env.BASE_URL;
import { LEVELS, levelCost, levelDiamonds, type Card } from "@amanda/shared";
import {
  levelUpCard,
  loadStats,
  type Account,
  type OwnedCard,
  type Stats,
} from "../game/account";
import { LevelUp } from "./LevelUp";
import { ElementsTable } from "./ElementsTable";
import { line as t, lineF as tf } from "../game/copy";
import { say } from "../game/lang";

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

  /*
   * ═══ AN UPGRADE IS AN OCCASION ═══
   *
   * Or: *"and of course when it upgrades, confetti and fireworks and a happy
   * sound."*
   *
   * It used to be a number changing on a tile. A card going from 4 to 5 is
   * the pay-off for every chest since the last one, and it looked like
   * nothing at all — which is also why nobody noticed the button.
   */
  const [levelled, setLevelled] = useState<{ cardId: string; level: number } | null>(null);
  /*
   * ═══ THE RULE THAT WAS WRITTEN DOWN NOWHERE ═══
   *
   * Or, after being told what the elements do: *"let's put an 'elements
   * table' button in the album (and in the deck builder) that opens a popup
   * with an X and a table showing, for each element, which it beats and
   * which beats it."*
   *
   * He asked because he had assumed they were decoration. They multiply
   * every hit by 1.5 or 0.75, and the album is where a player looks at the
   * elements — so it is where the chart belongs. See ElementsTable.
   */
  const [chart, setChart] = useState(false);
  /*
   * Which families are fanned out. Closed is the first state for all of
   * them — see the note by the shelf below — and it is deliberately NOT
   * remembered between visits: the album is a thing you browse, and coming
   * back to seven closed packs is coming back to the shelf.
   */
  const [opened, setOpened] = useState<Set<string>>(new Set());

  /*
   * === THE PARTY STARTS ON THE PRESS, NOT ON THE REPLY ===
   *
   * Or, with a screen recording: *"you press upgrade and it takes a few
   * seconds until anything moves there. Not fun."* Measured off his own
   * recording: the press is at 2.5s and the card's level changes at 4.5s,
   * with nothing at all in between.
   *
   * Everything that made it an occasion — the confetti, the fireworks, the
   * happy sound he asked for — was behind `await`. So an upgrade, which is
   * the pay-off for every chest since the last one, was two seconds of a
   * dead button.
   *
   * The celebration runs now, from what this screen already knows: the card
   * is level N, so it is about to be level N+1, and the server is not
   * needed to work that out. The request goes underneath, and if it is
   * refused the party is taken down and the reason is shown. The check that
   * matters — enough copies, enough diamonds — is on screen already: that
   * is what decides whether this button exists at all.
   */
  async function buyLevel(cardId: string, button: HTMLElement) {
    const mine = album?.get(cardId);
    if (!mine || busy) return;
    setBusy(cardId);
    setNote(null);
    pressed(button, { sound: "win" });
    setLevelled({ cardId, level: mine.level + 1 });

    const out = await levelUpCard(cardId);
    setBusy(null);
    if (out.error) {
      setLevelled(null);
      setNote(out.error);
      return;
    }
    // The server has the last word on the number, and it almost always
    // agrees — but if it does not, the card is what the server says.
    if (out.level && out.level !== mine.level + 1) setLevelled({ cardId, level: out.level });
    onChanged?.();
  }

  const album = account?.album;
  /*
   * Only cards that can be WON are counted or shown — the rule is in
   * @amanda/shared so the chest pool is answering the same question.
   *
   * Two cards are out. The Crumb Demon fills empty cells and is in no real
   * series; counting it made the header disagree with the grid. And Amanda,
   * who is the opponent: she was in the total, so the number this screen
   * exists to answer could never reach its own maximum.
   */
  const collection = collectable();
  const total = collection.length;
  const owned = collection.filter((c) => album?.has(c.id)).length;

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
          <button className="album__chart" onClick={() => setChart(true)}>
            <Icon name="fire" size={15} /> {t("s063eb7a", "טבלת היסודות")}
          </button>
          <button className="btn-fight btn-ghost album__back" onClick={onClose}>
            {t("sdf8896f", "← חזרה")}
          </button>
        </div>
      </header>

      {/* Five words, not two sentences. Or has asked for this more times than
          any other thing in this game, and the audit now reads multi-line JSX
          so it can no longer be slipped past by pressing Enter. */}
      {!account && <p className="album__none">{t("sfb0ff51", "אתה משחק מהדק המלא")}</p>}

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
            <h3 className="record__title">{t("s5c7bb8f", "הקרבות שלך")}</h3>
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
                    k: t("sf9d8dd4", "ניצחונות"),
                    sub: stats.played ? tf("s0ab9316", "{0} מתוך {1}", stats.wins, stats.played) : null,
                    tone: "good",
                  },
                  /*
                   * ═══ AND THEN THERE WERE TWO ═══
                   *
                   * Or: *"in the album there is no need to write how many
                   * chests we collected, and I don't know what 'copies' is —
                   * it should be counted per card, not all of them together,
                   * and it isn't needed. Counting losses either."*
                   *
                   * Three cells gone and nothing lost with them. LOSSES was
                   * the same number twice: the line under the wins already
                   * reads "11 of 19", and the other eight are the losses. The
                   * COPIES total answered a question nobody asks — a copy is
                   * worth something for ONE card, as the ×3 on that card's
                   * corner, and summed across the album it is a number with
                   * no meaning attached. And CHESTS is a thing that happened,
                   * not a thing you have.
                   *
                   * It also made the screen faster: those two cells were the
                   * only reason loadStats counted the chests table and read
                   * every row of player_cards. Opening the album is two
                   * queries now instead of four.
                   */
                  { icon: "win", n: stats.bestTrophies, k: t("s2fd7491", "שיא גביעים"), tone: "gold" },
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
              <div className="record__streak" title={t("s3cfae6d", "הקרבות האחרונים, החדש ביותר ראשון")}>
                {stats.recent.map((won, i) => (
                  <span key={i} className={`record__mark ${won ? "is-win" : "is-loss"}`}>
                    <Icon name={won ? "win" : "lose"} size={17} />
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/*
          ═══ A SHELF OF PACKS, NOT A WALL OF CARDS ═══

          Or: *"yes, let the series be closed as a pack and fan out when you
          press them."*

          Closed is the right first state, and the reason is the same one
          the arena screen gives for its own pack: ten card backs with a
          family's name beside them is a THING — something you own — and a
          row of ten small pictures is an index. The fan is what makes
          opening it worth a press.

          It also answers the measurement at the top of this file. The album
          is fifty-two cards over seven families on a screen 390px tall; a
          shelf of seven packs fits on it at once, and a wall of fifty-two
          never could.
        */}
        {SERIES.map((series) => {
          /*
           * A family with nothing to win in it is not shown at all. That is
           * the legends shelf today: Amanda is its only card and she is not
           * a prize, so an empty row headed 0/0 would be a promise with
           * nothing behind it. It comes back by itself the day she does.
           */
          const cards = collection.filter((c) => c.seriesId === series.id);
          if (!cards.length) return null;
          const have = cards.filter((c) => album?.has(c.id)).length;
          const open = opened.has(series.id);
          return (
            <section key={series.id} className={`album__series${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="album__pack"
                aria-expanded={open}
                onClick={() => {
                  sfx.play(open ? "discard" : "draw");
                  setOpened((was) => {
                    const next = new Set(was);
                    if (next.has(series.id)) next.delete(series.id);
                    else next.add(series.id);
                    return next;
                  });
                }}
              >
                {/* Three backs, stacked and splayed: the shape of a pack. */}
                <span className="album__fan" aria-hidden="true">
                  {cards.slice(0, 3).map((c) => (
                    <i key={c.id} style={{ backgroundImage: `url("${BASE}cards/${c.id}.webp")` }} />
                  ))}
                </span>
                <b className="album__series-name">{say(series.name)}</b>
                <span className="album__series-count">
                  {have}/{cards.length}
                </span>
                {/* A disclosure triangle: the icon set has no chevron, and a
                    play arrow turned ninety degrees is the same shape. */}
                <span className="album__pack-mark" aria-hidden="true">
                  <Icon name="play" size={13} />
                </span>
              </button>
              {open && (
              <div className="album__grid">
                {cards.map((card) => {
                  const mine = album?.get(card.id);
                  return (
                    <div
                      key={card.id}
                      className="album__cell"
                    >
                      {/*
                        ═══ THE CARD, AND THEN THE BUTTON UNDER IT ═══

                        Or: *"the upgrade button appears on the card in a way
                        that is hard to see — put it outside the card."*

                        It was absolutely positioned over the artwork, 22px up
                        from the bottom so it would stop covering the name,
                        which is where a button goes when there is nowhere for
                        it to go. The cell is two things now: the card, and a
                        line beneath it that belongs to the card without
                        sitting on it.
                      */}
                      <div
                        className="album__card"
                        onClick={() => mine && onCardInfo?.(card.id)}
                      >
                      {mine ? (
                        <>
                          <CardView cardId={card.id} size="small" plain />
                          {/* How many times it can go on a board — a
                              different fact from how close an upgrade is,
                              and the one the deck builder cares about. */}
                          <span className="album__copies" title={t("s176d067", "עותקים — כמה פעמים אפשר להניח אותו")}>
                            ×{mine.copies}
                          </span>
                          {/*
                            ═══ THE LEVEL, ON THE CARD ═══

                            Or: *"and some kind of level indicator on the card
                            itself."* It only appeared above level 1, so a
                            card at level 1 looked like a card with no level
                            — and the whole idea that cards HAVE levels was
                            invisible until the first upgrade. Always shown
                            now, and quiet at level 1.
                          */}
                          <span
                            className={`album__level${mine.level > 1 ? " is-up" : ""}`}
                            title={tf("s4308b06", "רמה {0}", mine.level)}
                          >
                            {mine.level}
                          </span>
                        </>
                      ) : (
                        /* What it IS, in grey, instead of a face-down back —
                           an album with gaps is the point, and a gap that
                           names the card is a reason to play another match. */
                        <CardView cardId={card.id} size="small" ghost />
                      )}
                      </div>
                      {mine && (
                        <Upgrade
                          card={card}
                          mine={mine}
                          diamonds={account?.diamonds ?? 0}
                          busy={busy === card.id}
                          onBuy={(button) => void buyLevel(card.id, button)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </section>
          );
        })}
      </div>

      {/*
        Confetti, fireworks and a happy sound — see LevelUp.tsx. It sits
        outside the scrolling list because it takes the whole screen.
      */}
      {chart && <ElementsTable onClose={() => setChart(false)} />}

      {levelled && (
        <LevelUp
          cardId={levelled.cardId}
          level={levelled.level}
          onClose={() => setLevelled(null)}
        />
      )}
    </div>
  );
}

/**
 * **How far off an upgrade is, and what it costs.**
 *
 * Or: *"Ice Dragon has already reached the 4 cards needed for an upgrade.
 * The indicator there needs to be clearer — '3/4 cards to upgrade' — and
 * then an upgrade button (+ what the diamond cost is)."*
 *
 * ═══ WHAT WAS THERE, AND WHY HE MISSED IT ═══
 *
 * A grey `▲ 4` that went gold when you could afford it. Three things wrong
 * with that in one tiny button: 4 is the PRICE and reads as a quantity you
 * have; nothing anywhere said how close you were; and the one moment it
 * mattered — the card is ready — looked like the twenty cards either side of
 * it. He reached the threshold on a card and the game did not tell him.
 *
 * So the progress is always visible and always says what it is counting, and
 * the button only appears when it can actually be pressed. A control you
 * cannot use is not information; a bar that is 3/4 full is.
 */
function Upgrade({
  card,
  mine,
  diamonds,
  busy,
  onBuy,
}: {
  card: Card;
  mine: OwnedCard;
  /** The purse, so the price can say whether it is affordable. */
  diamonds: number;
  busy: boolean;
  /** Takes the button it was pressed on: the confetti comes out of it. */
  onBuy: (button: HTMLElement) => void;
}) {
  if (mine.level >= LEVELS.max) {
    return <span className="album__topped">{t("s3e3750f", "מקסימום")}</span>;
  }

  const need = levelCost(card.rarity, mine.level);
  const price = levelDiamonds(mine.level);
  const have = Math.min(mine.copies, need);
  const ready = mine.copies >= need;
  const canPay = diamonds >= price;

  /*
   * Not ready: a bar and the count. The two numbers Or asked for, and no
   * button — "3/4 cards to upgrade" is the whole message, and a dead button
   * under it would only be something else to press.
   */
  if (!ready) {
    return (
      <span className="album__toup" title={tf("s6c954dd", "{0} מתוך {1} קלפים לשדרוג", have, need)}>
        <i style={{ ["--fill" as string]: `${(have / need) * 100}%` }} aria-hidden="true" />
        {have}/{need}
      </span>
    );
  }

  /*
   * Ready: the button, under the card, carrying the price.
   *
   * Or: *"it should say 'to upgrade' and a diamond icon with the number of
   * diamonds it costs beside it. If you do not have enough diamonds the
   * number appears in red and the button looks unpressable."*
   *
   * So the price is always shown and the purse is what changes: a number
   * that has gone red is a reason to go to the shop, where a button that has
   * simply vanished is a mystery.
   */
  return (
    <button
      className={`album__up${canPay ? " is-ready" : " is-poor"}`}
      disabled={busy || !canPay}
      title={tf("s15650ab", "שדרוג לרמה {0}", mine.level + 1)}
      onClick={(e) => {
        e.stopPropagation();
        onBuy(e.currentTarget);
      }}
    >
      <b>{t("s4f9261a", "לשדרוג")}</b>
      <span className={canPay ? "" : "is-poor"}>
        <Icon name="gem" size={11} /> {price}
      </span>
    </button>
  );
}
