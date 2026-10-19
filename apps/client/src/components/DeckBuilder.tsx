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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DECK_RULES,
  autoDeck,
  deckBudget,
  canAdd,
  cardCost,
  deckCost,
  myBacks,
  type Card,
  type Deck,
} from "@amanda/shared";
import { CATALOG, SERIES, collectable } from "../data/catalog";
import { CardBack, CardView } from "./CardView";
import { ElementsTable } from "./ElementsTable";
import { CardDetailModal } from "./CardDetailModal";
import { Icon } from "./Icon";
import { say } from "../game/lang";
import { line as t, lineF as tf } from "../game/copy";
import type { Account } from "../game/account";

const of = (id: string) => CATALOG.get(id);

/*
 * ═══ THE FIVE WAYS TO ORDER FIFTY-ONE CARDS ═══
 *
 * Or: *"sort by power / health / series / price"*, and then, looking at it:
 * *"you can sort alphabetically too."* Which is the one you want when you
 * already know the card's name and only need to find it — a different job
 * from all four of the others, and the reason it was missing is that I had
 * only thought about comparing cards, not about looking one up.
 *
 * Each falls back to the same tiebreak, which matters more than it sounds:
 * without it two cards of equal power swap places on every render and the
 * grid shimmers while you are trying to read it.
 */
type SortBy = "cost" | "power" | "hp" | "series" | "name";

const byId = (a: Card, b: Card) => a.id.localeCompare(b.id);

const ORDER: Record<SortBy, (a: Card, b: Card) => number> = {
  cost: (a, b) => cardCost(b) - cardCost(a) || byId(a, b),
  power: (a, b) => b.stats.power - a.stats.power || byId(a, b),
  hp: (a, b) => b.stats.hp - a.stats.hp || byId(a, b),
  // Within a family, cheapest first: that is how a family reads as a family.
  series: (a, b) => a.seriesId.localeCompare(b.seriesId) || cardCost(a) - cardCost(b) || byId(a, b),
  /*
   * By the name the player is actually reading, not by the id.
   *
   * `localeCompare` with no locale, on purpose: it follows the browser's,
   * which is the one the player set — and Hebrew and English each sort
   * themselves correctly under it while the id ("dragons_01_flame_dragon")
   * sorts under neither.
   */
  name: (a, b) => say(a.name).localeCompare(say(b.name)) || byId(a, b),
};

/** Deferred so the labels follow a language change, like every other string. */
const SORTS: Array<{ id: SortBy; label: () => string }> = [
  { id: "cost", label: () => t("sa92d994", "מחיר") },
  { id: "power", label: () => t("s57bf777", "עוצמה") },
  { id: "hp", label: () => t("s1950df9", "חיים") },
  { id: "series", label: () => t("s39768fa", "סדרה") },
  { id: "name", label: () => t("sa1cd05d", "א-ב") },
];

/*
 * ═══ WHAT YOU CAN ASK THE ALBUM FOR ═══
 *
 * Or: *"you should be able to filter on several options (dragons that move,
 * say). And more filter options — you decide, from what is already there.
 * Just as an example: filter by the ones where something happens after they
 * die (call it 'life after death')."*
 *
 * Two rules come out of that one sentence and they are different rules:
 * **within a group, OR** — dragons or giants — and **between groups, AND** —
 * dragons AND moving. That is what "dragons that move" means, and it is also
 * the only arrangement where adding a group never empties the screen by
 * accident.
 *
 * The groups below are not every axis the data has; they are the ones that
 * actually divide the fifty-one cards. Measured, because a filter that
 * returns forty-nine cards is a button that does nothing:
 *
 *     flying 11 · ranged 11 · hunts the King 5 · after death 7
 *     healers 6 · returns damage 7 · armoured 4 · moving 24 · still 27
 *
 * `has an ability` was the obvious one to add and it is 49 of 51. Left out.
 */
const has = (c: Card, ...types: string[]) =>
  c.abilities.some((a) => types.includes(a.type));

export interface Choice {
  id: string;
  label: () => string;
  test: (c: Card) => boolean;
}

export interface Group {
  id: string;
  label: () => string;
  choices: Choice[];
}

/** Everything except the families, which depend on what this player owns. */
export const FIXED_GROUPS: Group[] = [
  {
    id: "move",
    label: () => t("s7d2f2c0", "תנועה"),
    choices: [
      { id: "moves", label: () => t("s91ecd04", "זזים"), test: (c) => c.stats.moveSpeed > 0 },
      { id: "static", label: () => t("s3fc66d9", "סטטיים"), test: (c) => c.stats.moveSpeed === 0 },
      { id: "fly", label: () => t("s1d926cf", "עפים"), test: (c) => c.flying },
    ],
  },
  {
    id: "fight",
    label: () => t("sfeaf273", "קרב"),
    choices: [
      {
        id: "ranged",
        label: () => t("s2e7ed39", "יורים מרחוק"),
        test: (c) => c.stats.range !== "melee",
      },
      {
        id: "king",
        label: () => t("s2845407", "רודפים את המלך"),
        test: (c) => c.targeting === "king",
      },
    ],
  },
  {
    id: "power",
    label: () => t("sb15ae7e", "יכולת"),
    choices: [
      {
        // Or named this one himself, and the name is better than "onDeath".
        id: "death",
        label: () => t("scae68e4", "חיים אחרי המוות"),
        test: (c) => c.abilities.some((a) => a.trigger === "onDeath"),
      },
      {
        id: "heal",
        label: () => t("s234a399", "מרפאים"),
        test: (c) => has(c, "regen", "healAura"),
      },
      {
        /*
         * Or: *"abilities needs 'returns damage' too."*
         *
         * It was inside "armoured", and it did not belong there: armour is
         * about surviving a hit, and this is about the hit costing the
         * attacker something. Seven cards do it — Spike, Stone Golem, the
         * Iron Guard, Rock the Avenger, the Armour Beetle, Thorn Sprout and
         * the Cactus — and not one of them is armoured as well, so the two
         * do not overlap at all. It was never a sub-case of armour; it was a
         * second thing I had filed under the first.
         */
        id: "reflect",
        label: () => t("s2c85215", "מחזירים נזק"),
        test: (c) => has(c, "damageReflect"),
      },
      {
        /*
         * `armorBreak` was in here too, which was simply wrong: breaking
         * somebody else's armour is an attack. Taking it and the reflectors
         * out leaves four cards that genuinely take less damage, and a
         * filter that means one thing.
         */
        id: "armour",
        label: () => t("s7966a9d", "משוריינים"),
        test: (c) =>
          has(
            c,
            "armorGain",
            "armorAura",
            "damageReductionAura",
            "damageShareAdjacent",
            "knockbackImmune",
          ),
      },
    ],
  },
];

/**
 * OR inside a group, AND between groups — which is what "dragons that move"
 * means — and a group nobody has touched does not get a vote.
 *
 * Exported because this one function is the whole of Or's sentence, and the
 * album it has to be right about is fifty-one cards that no test account
 * owns: see DeckBuilder.filters.test.ts, which runs it over the real
 * catalogue.
 */
export function keep(
  cards: readonly Card[],
  groups: readonly Group[],
  picks: ReadonlySet<string>,
): Card[] {
  const live = groups
    .map((g) => g.choices.filter((c) => picks.has(`${g.id}:${c.id}`)))
    .filter((chosen) => chosen.length > 0);
  if (!live.length) return [...cards];
  return cards.filter((card) => live.every((chosen) => chosen.some((c) => c.test(card))));
}

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
   * The backs this player actually has — plus whatever this deck is already
   * wearing, so the picker can never disagree with the deck. See myBacks.
   */
  const backs = useMemo(() => myBacks(items, back), [items, back]);
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
  /*
   * Every choice that is lit, as "<group>:<choice>".
   *
   * One flat set rather than a set per group: what the screen has to answer
   * on every render is "is this one on", which a flat set answers in one
   * lookup, and the grouping that matters is already in the id.
   */
  const [picks, setPicks] = useState<ReadonlySet<string>>(new Set());
  /** Which of the two menus is open, if either. */
  const [menu, setMenu] = useState<"sort" | "filter" | null>(null);
  /*
   * The elements chart, in the one other place a player is choosing cards.
   * Or asked for it here and in the album in the same breath, and he is
   * right that this is the half that matters: the album is where you look at
   * what you have, and this is where you decide what to take into a fight.
   */
  const [chart, setChart] = useState(false);
  /** The card whose full details are open. See useHold. */
  const [detail, setDetail] = useState<string | null>(null);
  const hold = useHold();
  const sift = useRef<HTMLDivElement>(null);

  /*
   * An open menu closes when you reach past it — and the press that closed
   * it does nothing else.
   *
   * The first version closed on `pointerdown` and stopped there, on the
   * theory that this was enough. It is not, and the measurement said so: a
   * tap on a card in the deck row with the menu open closed the menu AND
   * took the card out of the deck, 15/16 to 14/16, in one press. A child
   * dismissing a menu is not asking for anything underneath it.
   *
   * So the press closes the menu and the CLICK it is about to produce is
   * swallowed, in the capture phase, before it can reach anything. The
   * timeout is for the press that never becomes a click — a scroll, a drag
   * off the edge — so the swallow does not sit there waiting to eat an
   * unrelated tap later.
   */
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (sift.current?.contains(e.target as Node)) return;
      setMenu(null);
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
      const t = window.setTimeout(() => {
        document.removeEventListener("click", swallow, true);
        pending.current = null;
      }, 400);
      /*
       * On the ref and NOT in this effect's cleanup, which is the whole
       * trick: `setMenu(null)` above re-runs the effect, and a cleanup that
       * removed the swallow would take it off again before the click it was
       * put there for ever arrived.
       */
      pending.current = () => {
        window.clearTimeout(t);
        document.removeEventListener("click", swallow, true);
      };
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  // Only on the way out, so nothing is left listening to a dead screen.
  useEffect(() => () => pending.current?.(), []);

  /*
   * Only what you own, in the order and the slice you asked for.
   *
   * A deck you cannot field is not a deck, so the drawer is the ALBUM and not
   * the catalogue.
   */
  /*
   * Which families this player owns anything from.
   *
   * A choice for a family you have no cards of is a button that empties the
   * screen, and the one thing a filter must never do is make a child think
   * his album has gone.
   */
  const groups = useMemo<Group[]>(() => {
    const owned = account?.album;
    const seen = new Set<string>();
    for (const c of collectable()) if (owned?.has(c.id)) seen.add(c.seriesId);
    /*
     * ═══ ONE THING, ONE NAME ═══
     *
     * Tzod, testing: *"it is not clear what the difference is between a
     * family and a series."* Or: *"let's unify to series."*
     *
     * There was no difference. This filter and the sort two screens up both
     * read `seriesId`, and they were called different things — so a player
     * reasonably assumed there were two ideas to learn, and went looking for
     * the second one. The synergy blurb on every card said "family" as well.
     * All of it says סדרה now.
     */
    const series = SERIES.filter((s) => seen.has(s.id));
    return [
      {
        id: "series",
        label: () => t("s20dd468", "סדרה"),
        choices: series.map((series) => ({
          id: series.id,
          label: () => say(series.name),
          test: (c: Card) => c.seriesId === series.id,
        })),
      },
      ...FIXED_GROUPS,
    ];
  }, [account?.album]);

  /*
   * Only what you own, filtered and sorted.
   *
   * A deck you cannot field is not a deck, so the drawer is the ALBUM and not
   * the catalogue.
   */
  const album = useMemo(() => {
    const owned = account?.album;
    const mine = collectable().filter((c) => owned?.has(c.id));
    return keep(mine, groups, picks).sort(ORDER[sort]);
  }, [account?.album, sort, picks, groups]);

  const spent = deckCost(cards, of);
  const full = cards.length >= DECK_RULES.size;
  // Read through deckBudget() and not off DECK_RULES, so the admin panel
  // moves the number the builder enforces AND the number it draws.
  const budget = deckBudget();
  const over = spent > budget;

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
        {/*
          And no way in when there is nothing to choose. A player with one
          back opening a list of one is a control that cannot be used, which
          this screen has learned twice before is not information.
        */}
        {backs.length > 1 && (
          <button
            className="builder__backpick"
            onClick={() => setPicking((v) => !v)}
            aria-label={t("sd7b2e93", "גב הקלפים")}
          >
            <CardBack size="small" back={back} />
          </button>
        )}
      </header>

      {picking && (
        <div className="builder__backs">
          {/*
            ═══ WHAT YOU HAVE, AND NOTHING ELSE ═══

            It used to list all eleven with the unowned ones greyed and
            padlocked. Or: *"I don't need to see everything that could be or
            WILL BE in the shop. Don't forget that one day at Hanukkah we'll
            suddenly bring out a Hanukkah back. Only what I have."*

            The second half is the one I had missed: this list is also the
            roadmap. A back added for a date would show up in every player's
            picker the moment it deployed — named, greyed, and weeks early.
            The shop sells; this chooses. See myBacks in cardBacks.ts.
          */}
          {backs.map((b) => (
            <button
              key={b.id}
              className={`builder__backopt${b.id === back ? " is-on" : ""}`}
              onClick={() => {
                setBack(b.id);
                setPicking(false);
              }}
            >
              <CardBack size="small" back={b.id} />
              <span>{say(b)}</span>
            </button>
          ))}
        </div>
      )}

      <section className="builder__deck" aria-label={t("s1cf2150", "הדק שלי")}>
        <div className="builder__counts">
          <span className={full ? "is-done" : undefined}>
            <Icon name="monster" size={15} /> {cards.length}/{DECK_RULES.size}
          </span>
          <span className={over ? "is-over" : undefined}>
            <Icon name="power" size={15} /> {spent}/{budget}
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
                {/*
                  Or: *"it is not good that you cannot see the names in the
                  deck. Better in two rows, or scrolling sideways."*

                  Scrolling sideways, and here is the arithmetic for why. The
                  sixteen were a 16-column grid on a landscape phone: a 50px
                  card, which fits no name at all. Two rows of eight would
                  give each card 100px — and 300 pixels of a 384px screen,
                  which leaves the album you build FROM with none. A fixed
                  72px card that scrolls keeps the row at the 110px it
                  already costs and gives the name something to sit in.
                */}
                <span className="builder__slotname">{say(of(id)?.name)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/*
        ═══ TWO QUESTIONS, TWO BUTTONS, AND EACH SAYS WHICH IT IS ═══

        Or, with arrows drawn on the screenshot: *"it needs to be clearer
        what is filtering and what is sorting (two buttons would do, one for
        filtering and one for sorting, with a dropdown)."*

        It was two rows of chips that looked identical — same pill, same
        size, same place — and the only thing telling you that the top row
        reordered the album and the bottom row shortened it was knowing. A
        label on a button is the cheapest possible fix and it is the right
        one.

        What the chips were good at is kept: the sort button carries its
        answer ("sort · price"), and the filter button carries its count, so
        "what am I looking at" is still answered without opening anything.
      */}
      <div className="builder__sift" ref={sift}>
        <div className="builder__menu">
          <button
            className={`sift${menu === "filter" ? " is-open" : ""}${picks.size ? " is-on" : ""}`}
            aria-expanded={menu === "filter"}
            onClick={() => setMenu((m) => (m === "filter" ? null : "filter"))}
          >
            {t("sa0f9456", "סינון")}
            {picks.size > 0 && <b> · {picks.size}</b>}
          </button>
          {menu === "filter" && (
            <div className="sift__drop sift__drop--filter">
              {groups.map((g) => (
                <div key={g.id} className="sift__group">
                  <span className="sift__head">{g.label()}</span>
                  <div className="sift__opts">
                    {g.choices.map((c) => {
                      const key = `${g.id}:${c.id}`;
                      return (
                        <button
                          key={key}
                          className={`chip${picks.has(key) ? " is-on" : ""}`}
                          aria-pressed={picks.has(key)}
                          /*
                           * The menu stays open on a pick, which is the whole
                           * difference from the chips: "dragons that move" is
                           * two taps in one place, and a menu that shut after
                           * the first one would make the second a hunt.
                           */
                          onClick={() =>
                            setPicks((p) => {
                              const next = new Set(p);
                              if (!next.delete(key)) next.add(key);
                              return next;
                            })
                          }
                        >
                          {c.label()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {picks.size > 0 && (
                <button className="btn-link sift__clear" onClick={() => setPicks(new Set())}>
                  {t("se3355ce", "לנקות")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="builder__menu">
          <button
            className={`sift${menu === "sort" ? " is-open" : ""}`}
            aria-expanded={menu === "sort"}
            onClick={() => setMenu((m) => (m === "sort" ? null : "sort"))}
          >
            {t("s3451fcc", "מיון")} <b>· {SORTS.find((o) => o.id === sort)?.label()}</b>
          </button>
          {menu === "sort" && (
            <div className="sift__drop">
              <div className="sift__opts">
                {SORTS.map((o) => (
                  <button
                    key={o.id}
                    className={`chip${sort === o.id ? " is-on" : ""}`}
                    aria-pressed={sort === o.id}
                    // One answer, so choosing it is also closing the menu.
                    onClick={() => {
                      setSort(o.id);
                      setMenu(null);
                    }}
                  >
                    {o.label()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* How much of the album you are looking at, when it is not all. */}
        {picks.size > 0 && <span className="builder__shown">{album.length}</span>}

        {/* Beside the two questions about THIS list, the one question about
            the cards in it. See ElementsTable. */}
        <button className="sift sift--chart" onClick={() => setChart(true)}>
          <Icon name="fire" size={14} /> {t("s6502618", "טבלת היסודות")}
        </button>
      </div>

      {chart && <ElementsTable onClose={() => setChart(false)} />}

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
        {/*
          ═══ A DISABLED BUTTON THAT SAYS WHY ═══

          Or: *"when you make a new deck and don't give it a name, it won't
          let you save. Give some indication."*

          Three things can stop a save and two of them are already on the
          screen: the card count and the budget are both printed above, and
          both turn red when they are wrong. The name was the only one with
          no tell at all — the orange button simply did not respond, which
          to a child is a broken game rather than a missing field.

          So only the name gets a line, and only while it is the thing
          missing. Three words, because the screen above it already says
          everything else. New decks are born named now (data/deckNames.ts),
          so this is for somebody who deliberately cleared it.
        */}
        {!name.trim() && <p className="warn">{t("s6bed06a", "צריך שם לדק")}</p>}
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
