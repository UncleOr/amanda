import type { CSSProperties } from "react";
import { KING } from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { ELEMENT_META, RANGE_META, RARITY_META, seriesColor } from "../data/cardMeta";

interface StatBuff {
  powerAdd?: number;
  powerMult?: number;
  hpMult?: number;
}

interface Props {
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
export function CardView({ cardId, onClick, onInfo, size = "medium", king = false, buff }: Props) {
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
  const art = card.art.sprite ? `${import.meta.env.BASE_URL}${card.art.sprite}` : null;

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
            {el.icon}
          </span>
          <span title={RANGE_META[card.stats.range].he}>{RANGE_META[card.stats.range].icon}</span>
          {card.stats.moveSpeed > 0 && <span title="מסתער">🏃</span>}
          {card.flying && <span title="מעופף">🕊️</span>}
        </span>
        <span className="card__flags">
          {king && <span className="card__boss" title="בונוס מלך ×3">👑×3</span>}
          {!king && card.midBoss && <span className="card__boss" title="ענק אמצע (מתאים למלך)">👑</span>}
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
              <i className="stat__icon">❤</i>
              <b>{hp}</b>
            </span>
            <span className="stat stat--pw" title="עוצמה">
              <i className="stat__icon">⚔</i>
              <b>{power}</b>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/** A face-down card (fog of war). */
export function CardBack({ size = "small" }: { size?: "small" | "medium" }) {
  return (
    <div className={`card card--back card--${size}`}>
      <span className="card-back__mark">❓</span>
    </div>
  );
}
