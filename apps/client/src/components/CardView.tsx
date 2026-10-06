import type { CSSProperties } from "react";
import { spriteFor } from "../game/skins";
import { Icon } from "./Icon";
import { KING } from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { ELEMENT_META, RANGE_META, RARITY_META, seriesColor } from "../data/cardMeta";

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
}

/**
 * A card is a fixed template: artwork fills the face, and every piece of
 * furniture (element, flags, name plate, HP/Power) sits at the same coordinates
 * on every single card. Stats are rendered live, so King ×3 and action-card
 * buffs always show the true battle numbers.
 */
export function CardView({
  cardId,
  onClick,
  onInfo,
  size = "medium",
  king = false,
  buff,
  skin,
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
      className={`card card--${size}${art ? " card--art" : ""}`}
      style={style}
      onClick={onClick}
    >
      {/* top-left: element + traits · top-right: king flag + info */}
      <div className="card__top">
        <span className="card__traits">
          <span className="card__element" title={el.he}>
            <Icon name={el.icon} size={13} />
          </span>
          <span title={RANGE_META[card.stats.range].he}>
            <Icon name={RANGE_META[card.stats.range].icon} size={12} />
          </span>
          {card.stats.moveSpeed > 0 && (
            <span title="מסתער">
              <Icon name="move" size={12} />
            </span>
          )}
          {card.flying && (
            <span title="מעופף">
              <Icon name="fly" size={12} />
            </span>
          )}
        </span>
        <span className="card__flags">
          {king && <span className="card__boss" title="בונוס מלך ×3">
              <Icon name="king" size={13} />×3
            </span>}
          {!king && card.midBoss && <span className="card__boss" title="ענק אמצע (מתאים למלך)">
              <Icon name="king" size={13} />
            </span>}
          <span className="card__rarity" title={rarity.he} />
          {onInfo && (
            <button
              type="button"
              className="card__info"
              title="פרטי הקלף"
              onClick={(e) => {
                e.stopPropagation();
                onInfo();
              }}
            >
              ℹ
            </button>
          )}
        </span>
      </div>

      {/* bottom plate: name + stats — identical coordinates on every card */}
      <div className="card__plate">
        <span className="card__name">{card.name.he}</span>
        {size !== "small" && (
          <span className={`card__stats${buffed ? " card__stats--buffed" : ""}`}>
            <span className="stat stat--hp" title="חיים">
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
              <span className="stat stat--pw" title="עוצמה">
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
export function CardBack({ size = "small" }: { size?: "small" | "medium" }) {
  return (
    <div className={`card card--back card--${size}`} aria-label="מוסתר בערפל">
      <span className="card-back__mark">
        <Icon name="hidden" size={20} />
      </span>
    </div>
  );
}
