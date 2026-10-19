import type { CSSProperties } from "react";
import { spriteFor } from "../game/skins";
import { Icon } from "./Icon";
import { KING, cardBack } from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { ELEMENT_META, RANGE_META, RARITY_META, seriesColor } from "../data/cardMeta";
import { say } from "../game/lang";
import { line as t } from "../game/copy";

interface StatBuff {
  powerAdd?: number;
  powerMult?: number;
  hpMult?: number;
}

/**
 * A number small enough to fit on a card: 1300 becomes 1.3K, 2000 becomes 2K.
 *
 * Or asked for this and it is the right call — the plate on a board card is a
 * few millimetres wide on a phone, and four digits there are not a number,
 * they are texture. The exact figure is on the card's own screen.
 *
 * Deliberately plain Latin "K" rather than a Hebrew abbreviation: it is what
 * every other game a child plays uses, and it survives being 9 pixels tall.
 */
export function short(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  // 2K rather than 2.0K; 1.3K rather than 1.25K.
  return `${k < 10 ? Math.round(k * 10) / 10 : Math.round(k)}K`;
}

interface Props {
  /** An owned skin to draw instead of the card's own art. */
  skin?: string | null;
  cardId: string;
  onClick?: () => void;
  onInfo?: () => void;
  size?: "small" | "medium" | "large";
  /** Show the ×3 HP/Power King bonus in the displayed stats. */
  king?: boolean;
  /** Action-card stat modifiers to reflect in the displayed numbers. */
  buff?: StatBuff;
  /**
   * No icon row across the top.
   *
   * Or, about the album: *"the symbols at the top of the card don't look
   * good. We can take them off — whoever wants to go into the symbols will
   * open the card."* Four 12px glyphs on a 74px tile are texture, not
   * information, and the card's own screen has room to say the same things
   * in words.
   */
  plain?: boolean;
  /**
   * A card you have not got: the picture, grey, with its name.
   *
   * Or: *"for the places where there is no card yet, put a grey thumbnail of
   * the card + its name, so they see what to aim for."* It was a face-down
   * back, which says "something is missing" and not WHAT — and the whole
   * reason to look at an album with gaps in it is to want one of them.
   */
  ghost?: boolean;
}

/**
 * A card is a fixed template: artwork fills the face, and every piece of
 * furniture (element, flags, name plate, HP/Power) sits at the same coordinates
 * on every single card. Stats are rendered live, so King ×3 and action-card
 * buffs always show the true battle numbers.
 */
/**
 * The strongest card there is, for scaling the edge bars.
 *
 * Measured rather than written down: adding a card with more health than
 * anything before it should move the scale, not run off the end of it.
 */
const MAX_HP = Math.max(...[...CATALOG.values()].map((c) => c.stats.hp));
const MAX_POWER = Math.max(...[...CATALOG.values()].map((c) => c.stats.power));

/**
 * How full a bar is, 0 to 1.
 *
 * ═══ THE SCALE IS A SQUARE ROOT, AND THAT IS A CHOICE ═══
 *
 * Health runs from 200 to 5,555 and the median is 600. On a straight scale
 * nine cards in ten would be a stub two pixels tall and the Titan King would
 * be the only one you could see — which tells a player nothing about the
 * choice in front of them.
 *
 * A square root keeps the ORDER exact and compresses the distance: four
 * times the health shows twice the bar. It is a deliberate distortion of
 * magnitude in exchange for a difference you can see at 63 pixels, and the
 * real numbers are one tap away on the card itself.
 */
function fill(value: number, max: number): number {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(1, Math.sqrt(value / max));
}

export function CardView({
  cardId,
  onClick,
  onInfo,
  size = "medium",
  king = false,
  buff,
  skin,
  plain = false,
  ghost = false,
}: Props) {
  const card = CATALOG.get(cardId);
  if (!card) return null;

  const el = ELEMENT_META[card.elements[0]!];
  const rarity = RARITY_META[card.rarity];
  const b = buff ?? {};
  const baseHp = card.stats.hp * (b.hpMult ?? 1);
  const basePower = card.stats.power * (b.powerMult ?? 1) + (b.powerAdd ?? 0);
  const hp = Math.round(baseHp * (king ? KING.hpMultiplier : 1));
  const power = Math.round(basePower * (king ? KING.powerMultiplier : 1));
  const buffed = !!(b.powerAdd || b.powerMult || b.hpMult);
  const sprite = card.art.sprite ? spriteFor(card.id, card.art.sprite, skin) : null;
  const art = sprite ? `${import.meta.env.BASE_URL}${sprite}` : null;

  const style: CSSProperties = {
    "--card-color": card.art.placeholderColor,
    "--rarity-color": rarity.color,
    // frame + name plate are tinted by SERIES so synergy groups read instantly
    "--series-color": seriesColor(card.seriesId),
    ...(art ? { backgroundImage: `url("${art}")` } : {}),
  } as CSSProperties;

  return (
    <div
      className={`card card--${size}${art ? " card--art" : ""}${ghost ? " card--ghost" : ""}`}
      style={style}
      onClick={onClick}
    >
      {/* top-left: element + traits · top-right: king flag + info */}
      {!plain && !ghost && <div className="card__top">
        <span className="card__traits">
          <span className="card__element" title={say(el)}>
            <Icon name={el.icon} size={13} />
          </span>
          <span title={say(RANGE_META[card.stats.range])}>
            <Icon name={RANGE_META[card.stats.range].icon} size={12} />
          </span>
          {card.stats.moveSpeed > 0 && (
            <span title={t("s5379cdd", "מסתער")}>
              <Icon name="move" size={12} />
            </span>
          )}
          {card.flying && (
            <span title={t("sd75b53b", "מעופף")}>
              <Icon name="fly" size={12} />
            </span>
          )}
        </span>
        <span className="card__flags">
          {king && <span className="card__boss" title={t("sd3446ed", "בונוס מלך ×3")}>
              <Icon name="king" size={13} />×3
            </span>}
          {!king && card.midBoss && <span className="card__boss" title={t("s4aa3080", "ענק אמצע (מתאים למלך)")}>
              <Icon name="king" size={13} />
            </span>}
          <span className="card__rarity" title={say(rarity)} />
          {onInfo && (
            <button
              type="button"
              className="card__info"
              title={t("sdf7d9b8", "פרטי הקלף")}
              onClick={(e) => {
                e.stopPropagation();
                onInfo();
              }}
            >
              ℹ
            </button>
          )}
        </span>
      </div>}

      {/*
        ═══ THE EDGES CARRY THE NUMBERS ═══

        Or: *"on mobile the cards don't look good. After you place them you
        see loads of text instead of simply the picture of the monster...
        maybe on the two sides of the card a blue bar and a red bar showing
        attack power and defence, the length of the coloured line being the
        length of the power."*

        Measured first: a card on a phone board is 63x82, and 45 of those 82
        pixels were the icon row and the name plate. More than half the card
        was furniture, and the monster — the only thing a player is actually
        choosing between — was behind it.

        So the two numbers move to the edges, where they cost four pixels of
        width and no height at all. Blue on the left is health, red on the
        right is power, and they do not swap in English: the meaning is the
        side, so the side is physical and not logical.
      */}
      {!ghost && (
        <>
          <span
            className="card__bar card__bar--hp"
            style={{ "--fill": fill(hp, MAX_HP) } as CSSProperties}
            aria-hidden="true"
          />
          <span
            className="card__bar card__bar--pw"
            style={{ "--fill": fill(power, MAX_POWER) } as CSSProperties}
            aria-hidden="true"
          />
        </>
      )}

      {/* bottom plate: name + stats — identical coordinates on every card */}
      <div className="card__plate">
        <span className="card__name">{say(card.name)}</span>
        {size === "large" && (
          <span className={`card__stats${buffed ? " card__stats--buffed" : ""}`}>
            <span className="stat stat--hp" title={t("sd3b512b", "חיים")}>
              <Icon name="hp" size={13} className="stat__icon" />
              <b>{short(hp)}</b>
            </span>
            {/*
              Or: "on mobile the numbers on the cards look bad. I suggest we
              show only hearts on the cards once they are stuck to the board."
              A card on the board is 1/12th of a half-board on a phone — two
              four-digit numbers on that plate is a grey smear. Health is the
              one you watch during a fight; power is one tap away on the card
              itself, where there is room to read it.
            */}
            {size === "large" && (
              <span className="stat stat--pw" title={t("s415a2b6", "עוצמה")}>
                <Icon name="power" size={13} className="stat__icon" />
                <b>{short(power)}</b>
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A card hidden by fog of war. The cloud is drawn in CSS; the mark underneath
 * is deliberately almost invisible — enough to feel a shape in there, not
 * enough to read as a label.
 */
export function CardBack({
  size = "small",
  back,
}: {
  size?: "small" | "medium";
  /**
   * Which design. Omitted everywhere the game hides a card for its own
   * reasons — the fog over an opponent's board is the fog, not a thing
   * either player chose — and given only where the deck's own back is the
   * point: the builder, and the shop. See cardBacks.ts.
   */
  back?: string;
}) {
  const look = cardBack(back);
  return (
    <div
      className={`card card--back card--${size}${back ? ` back--${look.id}` : ""}`}
      aria-label={back ? say(look) : t("se274434", "מוסתר בערפל")}
    >
      <span className="card-back__mark">
        <Icon name={look.mark as never} size={20} />
      </span>
    </div>
  );
}
