import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Plaque } from "./Plaque";
import { CATCHPHRASES, EMOJI } from "@amanda/shared";
import { buyItem, loadShop, type ShopItem } from "../game/account";

/**
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

/** The shelves, in the order a small shop stacks them. */
const SECTIONS: Array<{ kind: ShopItem["kind"]; he: string }> = [
  { kind: "avatar", he: "פרצופים" },
  { kind: "skin", he: "מראה לקלפים" },
  { kind: "emoji", he: "אימוג׳ים" },
  { kind: "phrase", he: "משפטי מחץ" },
  { kind: "chest", he: "תיבות" },
  { kind: "card", he: "קלפים" },
];

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
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { items: list, owned: mine } = await loadShop();
    setItems(list);
    setOwned(mine);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function take(item: ShopItem) {
    setBusy(item.id);
    setNote(null);
    const err = await buyItem(item.id);
    setBusy(null);
    if (err) return setNote(err);
    await refresh();
    // The purse and the album both changed; whoever owns them should look again.
    onBought();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--shop" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>

        <div className="shop__sign">
          <span className="shop__strip" aria-hidden="true" />
          <h2>חנות נוחות</h2>
          <span className="shop__purse">
            <Icon name="gem" size={15} /> {diamonds}
          </span>
        </div>

        {items === null ? (
          <p className="friends__hint">רגע…</p>
        ) : items.length === 0 ? (
          <p className="friends__hint">המדפים עוד ריקים. בקרוב.</p>
        ) : (
          <div className="shop__shelves">
            {SECTIONS.map(({ kind, he }) => {
              const row = items.filter((i) => i.kind === kind);
              if (!row.length) return null;
              return (
                <section className="shelf" key={kind}>
                  <h3 className="shelf__label">{he}</h3>
                  <div className="shelf__row">
                    {row.map((item) => {
                      const mine = owned.includes(item.id);
                      const art = shopItemArt(item);
                      // A phrase tile draws the line itself; see below.
                      const phrase = CATCHPHRASES.find((p) => p.item === item.id);
                      const tooDear = item.price_diamonds > diamonds;
                      return (
                        <div className={`good${mine ? " is-mine" : ""}`} key={item.id}>
                          {/* The picture is not lazy-loaded: the shop is a
                              thing you deliberately open, every tile is on
                              screen at once, and they are 66 pixels across.
                              Deferring them only buys a row of empty circles. */}
                          {/*
                            A catchphrase has no picture, because it IS the
                            picture: what is being sold is how the sentence
                            arrives, so the tile shows the sentence in the
                            treatment you would be buying. A generic gem
                            there would be selling it blind.
                          */}
                          <div className={`good__art${phrase ? " good__art--phrase" : ""}`}>
                            {phrase ? (
                              <Plaque phrase={phrase} />
                            ) : art ? (
                              <img src={art} alt="" />
                            ) : (
                              <Icon name="gem" size={30} />
                            )}
                          </div>
                          {/* The name of a phrase is the phrase, already
                              shown above it. Saying it twice is clutter. */}
                          {!phrase && <b className="good__name">{item.name.he}</b>}
                          {item.blurb?.he && <small className="good__blurb">{item.blurb.he}</small>}
                          {mine ? (
                            <span className="good__mine">
                              <Icon name="ready" size={13} /> שלך
                            </span>
                          ) : (
                            <button
                              className="good__buy"
                              disabled={busy === item.id || tooDear}
                              onClick={() => void take(item)}
                              title={tooDear ? "אין מספיק יהלומים" : undefined}
                            >
                              {item.price_diamonds === 0 ? (
                                "חינם"
                              ) : (
                                <>
                                  <Icon name="gem" size={12} /> {item.price_diamonds}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="shelf__edge" aria-hidden="true" />
                </section>
              );
            })}
          </div>
        )}

        {note && <p className="friends__note">{note}</p>}
      </div>
    </div>
  );
}
