/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **Deciding whether to buy this one thing.** The goods are the hero: the
 * picture at the size it was drawn, and nothing else competing with it.
 *
 * Or: *"you should be able to go into every item and see its details and its
 * full picture... say, all the explanation that is under every avatar."*
 *
 * Which is two things in one sentence. A shelf tile is 66 pixels across and
 * was carrying a picture, a name, a sentence of blurb and a price — four
 * things in a space that holds one, so the blurb was a grey smear and the
 * picture was a thumbnail of something you could never see properly. The
 * blurb moves here, where there is room for it to be read, and the shelf
 * goes back to being a shelf.
 *
 * And it answers the other half of what a thing IS: an emoji pack shows all
 * of its emoji, not the first one. Or: *"when you open a monster pack you
 * see all its emoji."*
 */
import { useState } from "react";
import {
  CARD_BACKS,
  CARD_PACKS,
  CATCHPHRASES,
  CHESTS,
  EMOJI,
  chestKindOf,
  packPrice,
} from "@amanda/shared";
import { RARITY_META } from "../data/cardMeta";
import { CardBack, CardView } from "./CardView";
import { CardDetailModal } from "./CardDetailModal";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { Plaque } from "./Plaque";
import { priceNow, type ShopItem } from "../game/account";
import { line as t, lineF as tf } from "../game/copy";
import { say } from "../game/lang";
import { shopItemArt } from "./Shop";

const BASE = import.meta.env.BASE_URL;

/**
 * Everything in the pack, drawn.
 *
 * The shelf tile draws the first emoji because a tile has room for one. Here
 * there is room for all of them, and "what am I buying" is the whole question
 * this screen exists to answer.
 */
function PackContents({ pack }: { pack: string }) {
  const inside = EMOJI.filter((e) => e.pack === pack);
  if (!inside.length) return null;
  return (
    <div className="deet__pack">
      {inside.map((e) => (
        <figure key={e.id}>
          <img src={`${BASE}emoji/${e.id}.png`} alt="" />
          <figcaption>{say(e)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ShopDetail({
  item,
  mine,
  taken,
  diamonds,
  busy,
  onBuy,
  onClose,
}: {
  item: ShopItem;
  mine: boolean;
  /**
   * Today's one is already taken. Only a chest can be this: it is not a
   * thing you own, it is one a day — see REPEATABLE in apps/server/src/shop.ts.
   */
  taken: boolean;
  diamonds: number;
  busy: boolean;
  /** Buy `count` of it. One, unless this is a card and a pack was picked. */
  onBuy: (count: number) => void;
  onClose: () => void;
}) {
  const phrase = CATCHPHRASES.find((p) => p.item === item.id);
  const back = CARD_BACKS.find((b) => b.item === item.id);
  const cardId = (item.grants as { cardId?: string }).cardId;
  const pack = EMOJI.some((e) => e.pack === item.id) ? item.id : null;
  /** A chest: what is in it, from the table the server fills it from. */
  const kind = chestKindOf(item.grants);
  const inside = kind ? CHESTS[kind] : null;
  const art = shopItemArt(item);
  const { pay, was } = priceNow(item);
  /*
   * ═══ HOW MANY COPIES ═══
   *
   * Or: *"say I am 6 Flame Dragons short of an upgrade — I will buy a pack
   * of 10 Flame Dragons, then upgrade, and I will also have +2 towards the
   * next upgrade."*
   *
   * Only a card comes in packs; an avatar bought ten times is one avatar.
   * The chips are a choice and the BUTTON is still the only thing that
   * buys, so the screen keeps one thing to press.
   */
  const packs = item.kind === "card" ? CARD_PACKS : null;
  const [many, setMany] = useState(1);
  /** The card's own page, over this one. */
  const [open, setOpen] = useState(false);
  const total = packPrice(pay, many);
  const tooDear = total > diamonds;

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--deet" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("se2cc447", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {/* The thing itself, as big as the panel allows. */}
        <div className={`deet__art${cardId ? " deet__art--card" : ""}`}>
          {phrase ? (
            <Plaque phrase={phrase} />
          ) : back ? (
            <CardBack size="medium" back={back.id} />
          ) : cardId ? (
            /*
             * ═══ AN ORDINARY CARD, AND IT OPENS ═══
             *
             * Or: *"the card does not look good. Make it a normal one, and
             * when you press it you get all the details the way you see a
             * card in the game."*
             *
             * It was drawn at `large`, which is the size the album uses in
             * a panel built for it — in this one the stats ran off the
             * bottom and the fist was cut in half. The same card at the
             * size it is everywhere else fits, and the details it was
             * trying to show all at once are one tap away on the card's own
             * page, at the player's own level.
             */
            <button type="button" className="deet__card" onClick={() => setOpen(true)}>
              <CardView cardId={cardId} size="medium" />
            </button>
          ) : art ? (
            <img src={art} alt="" />
          ) : (
            <Icon name="gem" size={64} />
          )}
        </div>

        {/*
          ═══ THE PLAQUE SHOWS IT, AND THIS SAYS IT ═══

          Or: *"add the text of the full sentence to the catchphrases,
          because in the picture you only see part of it."*

          Both halves are true and they are not the same thing. The plaque
          IS the goods — the shape, the colour, the way the line arrives —
          and it holds itself to one row by shrinking the type, down to 62%
          and no further (see Plaque.tsx), below which a long line is simply
          cut. So the picture is the right picture and it is not always the
          whole sentence.

          Underneath it, in ordinary readable text, is what you are
          actually buying. Not the item's `name` — for a catchphrase that is
          the phrase again — but the phrase itself, wrapped as many lines as
          it needs.
        */}
        {phrase ? (
          <p className="deet__phrase">{say(phrase)}</p>
        ) : (
          <h2 className="deet__name">{say(item.name)}</h2>
        )}
        {/*
          How many you already hold. The card shelf sells COPIES of cards
          you own, so this is the number being added to — and without it the
          page is asking a child to decide on a card they cannot count.
        */}
        {item.copies !== undefined && (
          <p className="deet__have">
            <Icon name="deck" size={15} /> {tf("s0ea3644", "יש לך {0}", item.copies)}
          </p>
        )}
        {item.blurb?.he && <p className="deet__blurb">{say(item.blurb)}</p>}

        {pack && <PackContents pack={pack} />}

        {/*
          ═══ WHAT IS IN THE CHEST ═══

          Or: *"when you press a chest you should be able to see how many
          cards and what range of diamonds you can get in it."*

          Read from the same table the server fills a chest from (chests.ts),
          so it cannot promise eight cards and hand over five. Numbers beside
          their icons rather than a sentence: a chest's contents is a list of
          amounts, and a list of amounts written out as prose is the thing
          that was taken off these tiles in the first place.
        */}
        {inside && (
          <p className="deet__inside">
            <span>
              <Icon name="deck" size={16} /> {inside.cards}
            </span>
            <span>
              <Icon name="gem" size={16} /> {inside.diamonds}
            </span>
            {inside.guarantees && (
              <span className="deet__sure" style={{ color: RARITY_META[inside.guarantees].color }}>
                {RARITY_META[inside.guarantees].he}
              </span>
            )}
          </p>
        )}

        {packs && !mine && (
          <div className="deet__packs">
            {packs.map((n) => (
              <button
                key={n}
                type="button"
                className={`deet__pack-pick${n === many ? " is-on" : ""}`}
                onClick={() => setMany(n)}
              >
                ×{n}
              </button>
            ))}
          </div>
        )}

        {mine ? (
          <span className="deet__mine">
            <Icon name="ready" size={16} /> {t("saafa01a", "כבר שלך")}
          </span>
        ) : taken ? (
          <span className="deet__mine">
            <Icon name="chest" size={16} /> {t("s3df89df", "לקחת היום. תחזור מחר")}
          </span>
        ) : (
          <button
            className={`deet__buy${tooDear ? " is-poor" : ""}`}
            disabled={busy || tooDear}
            onClick={() => onBuy(many)}
          >
            {was !== null && <s>{packPrice(was, many)}</s>}
            {total === 0 ? (
              t("s6508fa9", "קח בחינם")
            ) : (
              <>
                <Icon name="gem" size={16} /> {total}
              </>
            )}
          </button>
        )}
        {tooDear && !mine && !taken && (
          <p className="deet__poor">{t("s02d239a", "אין מספיק יהלומים")}</p>
        )}
      </div>
      {open && cardId && (
        <CardDetailModal
          cardId={cardId}
          onClose={() => setOpen(false)}
          /* At the level the player actually has it at, with the copies
             towards the next one — the same card they see in the album. */
          owned={
            item.copies === undefined
              ? null
              : { copies: item.copies, level: item.level ?? 1 }
          }
        />
      )}
    </Overlay>
  );
}
