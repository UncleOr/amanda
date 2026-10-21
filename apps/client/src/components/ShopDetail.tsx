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
  diamonds,
  busy,
  onBuy,
  onClose,
}: {
  item: ShopItem;
  mine: boolean;
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

        {/* A catchphrase's name IS the phrase, drawn above. Saying it twice
            is the clutter Or asked to take off the shelf. */}
        {!phrase && <h2 className="deet__name">{say(item.name)}</h2>}
        {item.blurb?.he && <p className="deet__blurb">{say(item.blurb)}</p>}

        {pack && <PackContents pack={pack} />}

        {mine ? (
          <span className="deet__mine">
            <Icon name="ready" size={16} /> {t("saafa01a", "כבר שלך")}
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
        {tooDear && !mine && <p className="deet__poor">{t("s02d239a", "אין מספיק יהלומים")}</p>}
      </div>
    </Overlay>
  );
}
