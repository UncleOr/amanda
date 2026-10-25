import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Plaque } from "./Plaque";
import {
  CARD_BACKS,
  CATCHPHRASES,
  EMOJI,
  SHOP_KINDS,
  levelCost,
  type ShopKind,
} from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { CardBack } from "./CardView";
import { priceNow } from "../game/account";
import { buyItem, loadShop, type ShopItem } from "../game/account";
import { Overlay } from "./Overlay";
import { ShopDetail } from "./ShopDetail";
import { line as t } from "../game/copy";
import { say } from "../game/lang";

/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **Finding a thing worth having and paying for it.** The goods are the hero;
 * the shop's own name is a sign over the door.
 *
 * Measured at 844x390 before that was true: the modal was 620x324 inside an
 * 844x390 screen, so a QUARTER OF THE WIDTH was margin on a screen that is
 * already short; the shelves showed 242px of a 693px stack AND each shelf
 * scrolled sideways on top of that (563 visible of 717) — two scroll axes for
 * a seven-year-old. The picture of the thing being sold was 66x66, smaller
 * than the three rows of text under it, the price was 12px, and the shelf you
 * were standing at was labelled in 12px grey while "חנות נוחות", which you
 * already knew because you tapped it, was 21.
 *
 * The shop.
 *
 * Or: "let's add a shop too (free for now) where you can buy avatars, emoji,
 * different card skins and so on. The shop will of course look like a petrol
 * station convenience store."
 *
 * So it is shelves, not a grid of tiles: a strip light along the top, price
 * tags clipped to the shelf edge rather than printed on the item, and the
 * sections stacked the way a small shop stacks them. The arena you are
 * climbing towards is the petrol station, which is the joke — you are
 * shopping inside the final boss's shop.
 *
 * ═══ NOTHING HERE DECIDES ANYTHING ═══
 *
 * Not the price, not whether you can afford it, not whether it is still for
 * sale. Every item is a database row and every purchase is checked and
 * charged on the server (apps/server/src/shop.ts), because a shop that works
 * out the price in the browser is a shop that can be bought from for free.
 * This screen draws rows and reports what the server said.
 */
const BASE = import.meta.env.BASE_URL;

/**
 * What each shelf is called.
 *
 * ═══ `back` WAS MISSING, AND THE GOODS WERE ON THE SHELF THE WHOLE TIME ═══
 *
 * Or: *"there is no way to buy card backs in the shop."* There wasn't — but
 * nothing was unfinished. All six rows were in `shop_items`, active, priced
 * 100-180, with Hebrew names and blurbs, and the server sent every one of
 * them. `kind = 'back'` simply was not in the list this screen loops over, so
 * the screen dropped them on the floor and said nothing.
 *
 * `Record<ShopKind, string>` and not an array, because that is the part that
 * stops it happening again: a kind with no label will not COMPILE. An array
 * was free to be one short, and was.
 */
const SHELF_LABELS: Record<ShopKind, string> = {
  avatar: t("sfcbfca9", "אוואטרים"),
  skin: t("sa52276e", "מראה לקלפים"),
  // Next to "מראה לקלפים" because it is the same shopping decision: what
  // your cards look like, front and back.
  back: t("s0185a61", "גב לקלפים"),
  emoji: t("s63ae982", "אימוג׳ים"),
  phrase: t("se3cd8fd", "משפטי מחץ"),
  chest: t("sd9e67b5", "תיבות"),
  card: t("s26df959", "קלפים"),
};

/**
 * The shelves, in the order a small shop stacks them.
 *
 * The ORDER is the only thing written out by hand here, and shopKinds.test.ts
 * pins that it still names every kind — the labels are already guaranteed by
 * the Record above, but an order list can go one short the same way the old
 * array did.
 */
export const SHELF_ORDER: ShopKind[] = [
  /*
   * The two perishable shelves first, which is how a real shop stacks: the
   * chests are one of each a day and the cards are four of your own, drawn
   * fresh every morning. Everything under them is the same today as it was
   * last week, and will be there when you come back.
   */
  "chest",
  "card",
  "avatar",
  "skin",
  "back",
  "emoji",
  "phrase",
];

const SECTIONS = SHELF_ORDER.map((kind) => ({ kind, he: SHELF_LABELS[kind] }));

/**
 * The picture for a shop item.
 *
 * Exported because the promotion banner on the home screen needs the same
 * answer — Or: "obviously you should also see a picture of what is being
 * advertised." Two copies of this would be two chances to disagree about
 * where an avatar's picture lives.
 */
export function shopItemArt(item: ShopItem): string | null {
  if (item.art) return `${BASE}${item.art}`;
  // An avatar's picture is its id, the same as everywhere else in the game.
  const avatar = (item.grants as { avatar?: string }).avatar;
  if (avatar) return `${BASE}brand/${avatar}.webp`;
  // A card, or a skin for one, is drawn as that card.
  const cardId = (item.grants as { cardId?: string }).cardId;
  if (cardId) return `${BASE}cards/${cardId}.webp`;
  /*
   * An emoji pack is drawn as the first emoji in it — which needs no `art`
   * column and no second place to keep a filename. The item id IS the pack
   * id (see the migration), so the pack can simply be asked what is in it.
   */
  const pack = EMOJI.find((e) => e.pack === item.id);
  return pack ? `${BASE}emoji/${pack.id}.png` : null;
}

/**
 * One thing on a shelf: its picture, its name and what it costs today.
 *
 * A component rather than a loop body because it is drawn in two places now
 * — the offers at the top and the shelf it belongs to — and a tile that said
 * one price in the strip and another on the shelf would be the shop arguing
 * with itself.
 */
function Good({
  item,
  mine,
  taken,
  diamonds,
  onOpen,
}: {
  item: ShopItem;
  mine: boolean;
  /** Today's one has been had. Only a chest can be this; see the server. */
  taken: boolean;
  diamonds: number;
  onOpen: () => void;
}) {
  const art = shopItemArt(item);
  /*
   * The card this tile sells a copy of, when it sells one. `copies` is only
   * ever set on the card shelf (cardShelf.ts), which is what makes it the
   * test for "is this a card you can upgrade" rather than the kind.
   */
  const card =
    item.copies === undefined
      ? null
      : CATALOG.get((item.grants as { cardId?: string }).cardId ?? "");
  // A phrase tile draws the line itself; see below.
  const phrase = CATCHPHRASES.find((p) => p.item === item.id);
  /*
   * And a back tile draws the back, for exactly the same reason: what is
   * being sold IS the picture. These have no `art` column and never will — a
   * back is drawn in CSS, not stored as a file (see cardBacks.ts) — so
   * without this they fell through to the generic gem and the shelf would
   * have been six identical tiles with six different names.
   */
  const back = CARD_BACKS.find((b) => b.item === item.id);
  // What it costs TODAY. The same arithmetic the server does at the till, so
  // a sale cannot be shown and not charged (or the reverse) — see priceNow
  // in shop.ts, and offers.ts for the one item a kind that is marked down.
  const { pay, was } = priceNow(item);
  const tooDear = pay > diamonds;
  return (
    <button
      type="button"
      className={`good${mine || taken ? " is-mine" : ""}${was !== null ? " is-deal" : ""}`}
      onClick={onOpen}
    >
      {/* The picture is not lazy-loaded: the shop is a thing you deliberately
          open, every tile is on screen at once, and they are 66 pixels
          across. Deferring them only buys a row of empty circles. */}
      {/*
        A catchphrase has no picture, because it IS the picture: what is
        being sold is how the sentence arrives, so the tile shows the
        sentence in the treatment you would be buying. A generic gem there
        would be selling it blind.
      */}
      <div
        className={`good__art${phrase ? " good__art--phrase" : ""}${
          back ? " good__art--back" : ""
        }`}
      >
        {phrase ? (
          <Plaque phrase={phrase} />
        ) : back ? (
          <CardBack size="small" back={back.id} />
        ) : art ? (
          <img src={art} alt="" />
        ) : (
          <Icon name="gem" size={30} />
        )}
      </div>
      {/* The name of a phrase is the phrase, already shown above it. Saying
          it twice is clutter. */}
      {!phrase && <b className="good__name">{say(item.name)}</b>}
      {/*
        ═══ HOW FAR THIS CARD IS FROM ITS NEXT LEVEL ═══

        Or: *"in the shop itself, show me under every card how many out of
        how many I have towards the next upgrade. No need to dig, just this
        format: מטמיע הצורות X5 | 6/10"*

        Which is the only thing a copy is FOR, so it is the only thing worth
        saying about one on a tile. Two numbers and a level, in his shape.
      */}
      {card && (
        <span className="good__lvl">
          ×{item.level ?? 1} | {item.copies ?? 0}/{levelCost(card.rarity, item.level ?? 1)}
          {/* Or: *"and if I have 3 out of 10 cards towards the upgrade, make
              it 3/10 [upgrade icon]."* A fraction on its own is a fraction of
              something unsaid; the icon is what says it. */}
          <Icon name="power" size={12} />
        </span>
      )}
      {/*
        The blurb is gone from the shelf and lives in the detail now. Or:
        *"all the explanation that is under every avatar"* — a sentence under
        a 66px tile is a grey smear, and it was the third thing competing
        with a picture that is what is being sold.
      */}
      {mine || taken ? (
        <span className="good__mine">
          <Icon name={taken ? "chest" : "ready"} size={13} />{" "}
          {taken ? t("s52f7e9a", "מחר") : t("s1a96dcd", "שלך")}
        </span>
      ) : (
        <span
          className={`good__buy${tooDear ? " is-poor" : ""}${was !== null ? " is-sale" : ""}`}
        >
          {/* The old price, struck through, is the whole mechanism of a
              sale: a lower number nobody has seen the higher one for is
              just a price. */}
          {was !== null && <s className="good__was">{was}</s>}
          {pay === 0 ? (
            t("s9eddab1", "חינם")
          ) : (
            <>
              <Icon name="gem" size={12} /> {pay}
            </>
          )}
        </span>
      )}
    </button>
  );
}

export function Shop({
  onClose,
  diamonds,
  onBought,
}: {
  onClose: () => void;
  diamonds: number;
  onBought: () => void;
}) {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [owned, setOwned] = useState<string[]>([]);
  /** One of each kind of chest a day: what has already been taken today. */
  const [today, setToday] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /*
   * Which item is open. Or: *"you should be able to go into every item and
   * see its details and its full picture."* A shelf tile is 66px across; it
   * can carry a picture and a price, and everything else it was carrying was
   * carried badly. See ShopDetail.
   */
  const [looking, setLooking] = useState<string | null>(null);
  /*
   * What is cheaper than it says on it. One per kind, drawn for the day by
   * the server; a tile is in the strip exactly when `priceNow` finds a live
   * sale on it, which is the same question the till asks.
   */
  const deals = (items ?? []).filter(
    (i) =>
      priceNow(i).was !== null &&
      /*
       * Not a thing you already have, and not today's chest if you have
       * taken it. An offer you cannot accept is not an offer — it is a tile
       * at the top of the shop saying "שלך", which is the clutter the strip
       * exists to cut through. It is still on its own shelf, marked down.
       */
      !owned.includes(i.id) &&
      !today.includes(i.id),
  );

  const refresh = useCallback(async () => {
    const { items: list, owned: mine, today: taken } = await loadShop();
    setItems(list);
    setOwned(mine);
    setToday(taken);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function take(item: ShopItem, count = 1) {
    setBusy(item.id);
    setNote(null);
    const err = await buyItem(item.id, count);
    setBusy(null);
    if (err) return setNote(err);
    await refresh();
    // The purse and the album both changed; whoever owns them should look again.
    onBought();
  }

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--shop" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s56fa87f", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        <div className="shop__sign">
          <span className="shop__strip" aria-hidden="true" />
          <h2>{t("s4eef1f1", "חנות נוחות")}</h2>
          <span className="shop__purse">
            <Icon name="gem" size={15} /> {diamonds}
          </span>
        </div>

        {items === null ? (
          <p className="friends__hint">{t("s0f95b79", "רגע…")}</p>
        ) : items.length === 0 ? (
          <p className="friends__hint">{t("s947b31f", "המדפים עוד ריקים. בקרוב.")}</p>
        ) : (
          <div className="shop__shelves">
            {/*
              ═══ THE OFFERS, AT THE TOP ═══

              Or: *"and offers at the top of the shop. One product from each
              category."*

              Nothing is decided here. An item is on offer when the price it
              came back with is lower than the price printed on it — the
              server marks one per kind for the day (offers.ts) and both
              sides read it through the same `priceNow`. So this strip cannot
              show a deal the till will not honour: it is drawing the same
              rows as the shelves below, which is also why a tile here and
              the same tile down there say the same number.
            */}
            {deals.length > 0 && (
              <section className="aisle aisle--deals">
                <h3 className="aisle__label">{t("sf66666a", "מבצעים")}</h3>
                <div className="aisle__row">
                  {deals.map((item) => (
                    <Good
                      key={item.id}
                      item={item}
                      mine={owned.includes(item.id)}
                      taken={today.includes(item.id)}
                      diamonds={diamonds}
                      onOpen={() => setLooking(item.id)}
                    />
                  ))}
                </div>
                <span className="aisle__edge" aria-hidden="true" />
              </section>
            )}
            {SECTIONS.map(({ kind, he }) => {
              const row = items.filter((i) => i.kind === kind);
              if (!row.length) return null;
              return (
                <section className="aisle" key={kind}>
                  <h3 className="aisle__label">{he}</h3>
                  <div className="aisle__row">
                    {row.map((item) => (
                      <Good
                        key={item.id}
                        item={item}
                        mine={owned.includes(item.id)}
                        taken={today.includes(item.id)}
                        diamonds={diamonds}
                        onOpen={() => setLooking(item.id)}
                      />
                    ))}
                  </div>
                  <span className="aisle__edge" aria-hidden="true" />
                </section>
              );
            })}
          </div>
        )}

        {note && <p className="friends__note">{note}</p>}
      </div>

      {looking &&
        (() => {
          const item = items?.find((i) => i.id === looking);
          if (!item) return null;
          return (
            <ShopDetail
              item={item}
              mine={owned.includes(item.id)}
              taken={today.includes(item.id)}
              diamonds={diamonds}
              busy={busy === item.id}
              onBuy={(count) => void take(item, count).then(() => setLooking(null))}
              onClose={() => setLooking(null)}
            />
          );
        })()}
    </Overlay>
  );
}
