/**
 * **This screen builds one deck, and says whether it is legal.**
 *
 * Or: *"there should be proper building that shows prices and so on, in a
 * comfortable and fun interface. Deck building is a significant part of the
 * appeal. I want YouTubers showing what decks they built."*
 *
 * ═══ THE HERO IS THE DECK, NOT THE COLLECTION ═══
 *
 * The obvious layout is a big grid of your fifty-one cards with a small tray
 * underneath, because the collection is the bigger thing. It is also the
 * wrong way round: a player comes here to BUILD, and what they are building
 * has to be what they look at. So the deck is the top half, drawn as sixteen
 * slots that fill up, and the album is the drawer under it.
 *
 * That is also what makes the screen worth showing somebody. "I want
 * YouTubers showing what decks they built" is a layout requirement: the thing
 * you screenshot — the sixteen, the name, the back — has to be one frame.
 *
 * ═══ AND NOTHING HERE EXPLAINS ITSELF ═══
 *
 * Per the house rules (.claude/skills/amanda-ui/SKILL.md §6), no sentence
 * anywhere says what a budget is. The counter reads 48/55 and turns red; a
 * card you cannot afford goes grey; a card already in three times stops
 * answering. A child who taps an expensive card and watches the number jump
 * has learnt the rule, and nobody had to write it down.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  CARD_BACKS,
  DECK_RULES,
  autoDeck,
  canAdd,
  cardCost,
  deckCost,
  ownsBack,
  type Card,
  type Deck,
} from "@amanda/shared";
import { CATALOG, SERIES, collectable } from "../data/catalog";
import { CardBack, CardView } from "./CardView";
import { CardDetailModal } from "./CardDetailModal";
import { Icon } from "./Icon";
import { say } from "../game/lang";
import { line as t, lineF as tf } from "../game/copy";
import type { Account } from "../game/account";

const of = (id: string) => CATALOG.get(id);

/*
 * ═══ THE FOUR WAYS TO ORDER FIFTY-ONE CARDS ═══
 *
 * Or: *"sort by power / health / series / price."*
 *
 * Each one falls back to the same tiebreak, which matters more than it
 * sounds: without it two cards of equal power swap places on every render
 * and the grid shimmers while you are trying to read it.
 */
type SortBy = "cost" | "power" | "hp" | "series";

const byId = (a: Card, b: Card) => a.id.localeCompare(b.id);

const ORDER: Record<SortBy, (a: Card, b: Card) => number> = {
  cost: (a, b) => cardCost(b) - cardCost(a) || byId(a, b),
  power: (a, b) => b.stats.power - a.stats.power || byId(a, b),
  hp: (a, b) => b.stats.hp - a.stats.hp || byId(a, b),
  // Within a family, cheapest first: that is how a family reads as a family.
  series: (a, b) => a.seriesId.localeCompare(b.seriesId) || cardCost(a) - cardCost(b) || byId(a, b),
};

/** Deferred so the labels follow a language change, like every other string. */
const SORTS: Array<{ id: SortBy; label: () => string }> = [
  { id: "cost", label: () => t("sa92d994", "מחיר") },
  { id: "power", label: () => t("s57bf777", "עוצמה") },
  { id: "hp", label: () => t("s1950df9", "חיים") },
  { id: "series", label: () => t("s39768fa", "סדרה") },
];

/** How long a press has to last before it is a question rather than a tap. */
const HOLD_MS = 420;

/**
 * A long press, without losing the tap underneath it.
 *
 * Or: *"maybe a long press?"* — for reading a card, while a tap keeps doing
 * the thing you do sixteen times.
 *
 * The movement cancel is what makes it usable in a scrolling drawer: a thumb
 * that has travelled ten pixels is scrolling, not asking a question, and
 * without this every flick down the album would open a card.
 */
function useHold(): (run: () => void) => {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
} {
  const timer = useRef<number | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };

  return (run: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        stop();
        run();
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = from.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    // The same question with a mouse, where holding a button down is nobody's
    // instinct.
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      run();
    },
  });
}

interface Props {
  account: Account | null;
  /** Shop items this player holds, for which backs are theirs. */
  items: readonly string[];
  /** The deck being edited. A new one arrives with no id and no cards. */
  deck: Deck;
  onSave: (deck: Deck) => void;
  onCancel: () => void;
  /** Absent for a deck that has never been saved. */
  onDelete?: () => void;
  /** What went wrong on the last save, if anything. */
  error?: string | null;
  busy?: boolean;
}

export function DeckBuilder({
  account,
  items,
  deck,
  onSave,
  onCancel,
  onDelete,
  error,
  busy,
}: Props) {
  const [name, setName] = useState(deck.name);
  const [cards, setCards] = useState<string[]>(deck.cards);
  const [back, setBack] = useState(deck.back);
  const [picking, setPicking] = useState(false);
  /*
   * ═══ SORTING AND FILTERING ═══
   *
   * Or: *"we also need filtering and sorting. Sort by power / health /
   * series / price; show me only dragons / giants / static / moving."*
   *
   * Fifty-one cards is where a grid stops being a collection you can see and
   * becomes a thing you have to search. Both of these answer questions a
   * builder actually asks — what is cheap, what hits hard, show me the
   * dragons — rather than offering every axis the data happens to have.
   */
  const [sort, setSort] = useState<SortBy>("cost");
  const [only, setOnly] = useState<string>("all");
  /** The card whose full details are open. See useHold. */
  const [detail, setDetail] = useState<string | null>(null);
  const hold = useHold();

  /*
   * Only what you own, in the order and the slice you asked for.
   *
   * A deck you cannot field is not a deck, so the drawer is the ALBUM and not
   * the catalogue.
   */
  const album = useMemo(() => {
    const owned = account?.album;
    const mine = collectable().filter((c) => owned?.has(c.id));
    const kept = mine.filter((c) => {
      if (only === "all") return true;
      if (only === "moves") return c.stats.moveSpeed > 0;
      if (only === "static") return c.stats.moveSpeed === 0;
      return c.seriesId === only;
    });
    return kept.sort(ORDER[sort]);
  }, [account?.album, sort, only]);

  /*
   * Which families this player owns anything from.
   *
   * A chip for a family you have no cards of is a button that empties the
   * screen, and the one thing a filter must never do is make a child think
   * his album has gone.
   */
  const families = useMemo(() => {
    const owned = account?.album;
    const seen = new Set<string>();
    for (const c of collectable()) if (owned?.has(c.id)) seen.add(c.seriesId);
    return SERIES.filter((series) => seen.has(series.id));
  }, [account?.album]);

  const spent = deckCost(cards, of);
  const full = cards.length >= DECK_RULES.size;
  const over = spent > DECK_RULES.budget;

  const copies = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of cards) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [cards]);

  const add = useCallback(
    (id: string) => {
      if (!canAdd(id, of(id), cards, spent)) return;
      setCards((c) => [...c, id]);
    },
    [cards, spent],
  );

  const removeAt = (i: number) => setCards((c) => c.filter((_, k) => k !== i));

  /*
   * The way out for somebody who does not want to build one.
   *
   * Not a shortcut past the screen: it fills the slots and leaves you looking
   * at the result, which you can then take apart. A child who does not know
   * where to start is given a start.
   */
  const fill = () => setCards(autoDeck(album.map((c) => c.id), of));

  const canSave = name.trim().length > 0 && cards.length === DECK_RULES.size && !over && !busy;
  // Said twice — as the placeholder and as the label — and one row in the
  // copy document, not two.
  const nameLabel = t("s0ce23c9", "שם לדק");

  return (
    <div className="builder">
      <header className="builder__top">
        <button className="btn-link builder__back" onClick={onCancel}>
          <Icon name="back" size={15} /> {t("sd87ddf0", "חזרה")}
        </button>
        <input
          className="builder__name"
          value={name}
          maxLength={DECK_RULES.nameMax}
          onChange={(e) => setName(e.target.value)}
          placeholder={nameLabel}
          aria-label={nameLabel}
        />
        <button
          className="builder__backpick"
          onClick={() => setPicking((v) => !v)}
          aria-label={t("sd7b2e93", "גב הקלפים")}
        >
          <CardBack size="small" back={back} />
        </button>
      </header>

      {picking && (
        <div className="builder__backs">
          {CARD_BACKS.map((b) => {
            const mine = ownsBack(b, items);
            return (
              <button
                key={b.id}
                className={`builder__backopt${b.id === back ? " is-on" : ""}${
                  mine ? "" : " is-locked"
                }`}
                disabled={!mine}
                onClick={() => {
                  setBack(b.id);
                  setPicking(false);
                }}
              >
                <CardBack size="small" back={b.id} />
                <span>{say(b)}</span>
                {/* A locked back is drawn rather than hidden: eleven is a list
                    you can look at, and wanting one is the point. */}
                {!mine && <Icon name="hidden" size={12} />}
              </button>
            );
          })}
        </div>
      )}

      <section className="builder__deck" aria-label={t("s1cf2150", "הדק שלי")}>
        <div className="builder__counts">
          <span className={full ? "is-done" : undefined}>
            <Icon name="monster" size={15} /> {cards.length}/{DECK_RULES.size}
          </span>
          <span className={over ? "is-over" : undefined}>
            <Icon name="power" size={15} /> {spent}/{DECK_RULES.budget}
          </span>
          <button className="btn-link builder__fill" onClick={fill}>
            {t("s7ec416f", "מלא לי")}
          </button>
        </div>
        <div className="builder__slots">
          {Array.from({ length: DECK_RULES.size }, (_, i) => {
            const id = cards[i];
            if (!id)
              return (
                <div key={i} className="builder__slot builder__slot--empty" aria-hidden="true" />
              );
            return (
              <button
                key={`${id}-${i}`}
                className="builder__slot"
                onClick={() => removeAt(i)}
                {...hold(() => setDetail(id))}
                title={t("s1776336", "הורד מהדק")}
              >
                <CardView cardId={id} size="small" />
              </button>
            );
          })}
        </div>
      </section>

      {/*
        The two questions a builder asks, as two rows of chips.

        Chips rather than a dropdown: a child reads a word faster than he
        finds a menu, and the chosen one stays lit — which is the whole of
        "what am I looking at" with nothing written down to say it.
      */}
      <div className="builder__sift">
        <div className="builder__chips" role="group" aria-label={t("s3451fcc", "מיון")}>
          {SORTS.map((o) => (
            <button
              key={o.id}
              className={`chip${sort === o.id ? " is-on" : ""}`}
              onClick={() => setSort(o.id)}
            >
              {o.label()}
            </button>
          ))}
        </div>
        <div className="builder__chips" role="group" aria-label={t("sa0f9456", "סינון")}>
          <button className={`chip${only === "all" ? " is-on" : ""}`} onClick={() => setOnly("all")}>
            {t("s4c85e6b", "הכל")}
          </button>
          {families.map((series) => (
            <button
              key={series.id}
              className={`chip${only === series.id ? " is-on" : ""}`}
              onClick={() => setOnly(series.id)}
            >
              {say(series.name)}
            </button>
          ))}
          <button
            className={`chip${only === "moves" ? " is-on" : ""}`}
            onClick={() => setOnly("moves")}
          >
            {t("s91ecd04", "זזים")}
          </button>
          <button
            className={`chip${only === "static" ? " is-on" : ""}`}
            onClick={() => setOnly("static")}
          >
            {t("s3fc66d9", "סטטיים")}
          </button>
        </div>
      </div>

      <section className="builder__album" aria-label={t("s9db8c07", "האלבום שלי")}>
        {album.map((card) => {
          const n = copies.get(card.id) ?? 0;
          const affordable = canAdd(card.id, card, cards, spent);
          return (
            <button
              key={card.id}
              className={`builder__pick${affordable ? "" : " is-spent"}`}
              onClick={() => add(card.id)}
              /*
               * A long press opens the card, a tap adds it.
               *
               * The tap has to stay the cheap one: you do it sixteen times to
               * build a deck and twice to read a card, and the action you
               * repeat gets the whole surface.
               *
               * It works on a card you cannot afford too — "why can I not
               * have this one" is exactly when you want to look at it, and a
               * disabled button still reports a pointer.
               */
              {...hold(() => setDetail(card.id))}
              disabled={!affordable}
            >
              <span className="builder__art">
                <CardView cardId={card.id} size="small" />
                {n > 0 && <span className="builder__copies">×{n}</span>}
              </span>
              {/*
                Under the card, not on it.

                Or: *"put the price under each card, so it does not look
                odd."* It was a badge in the corner of the artwork — a corner
                that already carries a rarity gem and a level, three things
                fighting over the same twenty pixels.
              */}
              <span className="builder__price">
                <Icon name="power" size={10} /> {cardCost(card)}
              </span>
            </button>
          );
        })}
      </section>

      {detail && (
        <CardDetailModal
          cardId={detail}
          owned={account?.album.get(detail) ?? null}
          onClose={() => setDetail(null)}
        />
      )}

      <footer className="builder__foot">
        {error && <p className="warn">{error}</p>}
        <button
          className="btn-fight"
          disabled={!canSave}
          onClick={() => onSave({ ...deck, name, cards, back })}
        >
          {busy ? "…" : t("scba3d8d", "שמור")}
        </button>
        {onDelete && (
          <button className="btn-fight btn-ghost" onClick={onDelete}>
            {t("se0c2a5c", "מחק")}
          </button>
        )}
      </footer>
    </div>
  );
}

/**
 * The shelf: your decks, and which one you are playing with.
 *
 * Or asked for three. Three is few enough to draw them all at once, which is
 * why this is a row of cards rather than a list with an edit pencil — the
 * back and the name ARE the deck, and seeing them beside each other is the
 * whole reason to have more than one.
 */
export function DeckShelfView({
  decks,
  activeId,
  onPlay,
  onEdit,
  onNew,
}: {
  decks: Deck[];
  activeId: string | null;
  onPlay: (id: string) => void;
  onEdit: (deck: Deck) => void;
  onNew: () => void;
}) {
  return (
    <div className="shelf-decks">
      {decks.map((d) => (
        <div key={d.id} className={`deckcard${d.id === activeId ? " is-on" : ""}`}>
          <button className="deckcard__face" onClick={() => onPlay(d.id)}>
            <CardBack size="medium" back={d.back} />
            <b>{d.name}</b>
            <span>
              <Icon name="power" size={12} /> {deckCost(d.cards, of)}
            </span>
          </button>
          <button className="btn-link deckcard__edit" onClick={() => onEdit(d)}>
            {t("sad4a141", "לערוך")}
          </button>
        </div>
      ))}
      {decks.length < DECK_RULES.maxDecks && (
        <button className="deckcard deckcard--new" onClick={onNew}>
          <Icon name="plus" size={26} />
          <b>{tf("s4a9e250", "דק {0}", decks.length + 1)}</b>
        </button>
      )}
    </div>
  );
}
