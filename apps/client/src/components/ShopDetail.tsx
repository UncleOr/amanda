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
import { CARD_BACKS, CATCHPHRASES, EMOJI } from "@amanda/shared";
import { CardBack, CardView } from "./CardView";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { Plaque } from "./Plaque";
import { priceNow, type ShopItem } from "../game/account";
import { line as t } from "../game/copy";
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
  onBuy: () => void;
  onClose: () => void;
}) {
  const phrase = CATCHPHRASES.find((p) => p.item === item.id);
  const back = CARD_BACKS.find((b) => b.item === item.id);
  const cardId = (item.grants as { cardId?: string }).cardId;
  const pack = EMOJI.some((e) => e.pack === item.id) ? item.id : null;
  const art = shopItemArt(item);
  const { pay, was } = priceNow(item);
  const tooDear = pay > diamonds;

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--deet" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("se2cc447", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {/* The thing itself, as big as the panel allows. */}
        <div className="deet__art">
          {phrase ? (
            <Plaque phrase={phrase} />
          ) : back ? (
            <CardBack size="medium" back={back.id} />
          ) : cardId ? (
            <CardView cardId={cardId} size="large" />
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
        {item.blurb?.he && <p className="deet__blurb">{say(item.blurb)}</p>}

        {pack && <PackContents pack={pack} />}

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
            onClick={onBuy}
          >
            {was !== null && <s>{was}</s>}
            {pay === 0 ? (
              t("s6508fa9", "קח בחינם")
            ) : (
              <>
                <Icon name="gem" size={16} /> {pay}
              </>
            )}
          </button>
        )}
        {tooDear && !mine && !taken && (
          <p className="deet__poor">{t("s02d239a", "אין מספיק יהלומים")}</p>
        )}
      </div>
    </Overlay>
  );
}
