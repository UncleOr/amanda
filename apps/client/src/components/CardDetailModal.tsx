import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { ABILITY_LABEL, ELEMENT_META, RANGE_META, RARITY_META } from "../data/cardMeta";
import { LEVELS, levelCost, levelMultiplier } from "@amanda/shared";
import { Overlay } from "./Overlay";

export function CardDetailModal({
  cardId,
  onClose,
  owned,
}: {
  cardId: string;
  onClose: () => void;
  /** What the player has of this card, when they have an album. */
  owned?: { copies: number; level: number } | null;
}) {
  const card = CATALOG.get(cardId);
  if (!card) return null;
  const series = SERIES_BY_ID.get(card.seriesId);
  const rarity = RARITY_META[card.rarity];
  const level = owned?.level ?? 1;
  const mult = levelMultiplier(level);
  // Shown at the level the player actually has it at, not at the base — the
  // numbers on an upgraded card should be the numbers it fights with.
  const hp = Math.round(card.stats.hp * mult);
  const power = Math.round(card.stats.power * mult);

  return (
    <Overlay onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ "--card-color": card.art.placeholderColor } as CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>

        <div className="modal__banner">
          <div className="modal__portrait" />
          <div className="modal__title">
            <h2>{card.name.he}</h2>
            <p className="modal__subtitle">{card.name.en}</p>
            <div className="modal__badges">
              <span className="badge" style={{ borderColor: rarity.color, color: rarity.color }}>
                {rarity.he}
              </span>
              {card.elements.map((e) => (
                <span key={e} className="badge">
                  <Icon name={ELEMENT_META[e].icon} size={14} /> {ELEMENT_META[e].he}
                </span>
              ))}
              {series && <span className="badge">{series.name.he}</span>}
              {card.midBoss && (
                <span className="badge badge--king">
                  <Icon name="king" size={13} /> ענק אמצע
                </span>
              )}
              {owned && <span className="badge badge--level">רמה {level}</span>}
            </div>
          </div>
        </div>

        {owned && (
          <div className="modal__level">
            <span className="modal__level-n">
              רמה {level}
              {level < LEVELS.max && <span className="modal__level-next"> / {LEVELS.max}</span>}
            </span>
            <span className="modal__level-bar" aria-hidden="true">
              <i style={{ width: `${(level / LEVELS.max) * 100}%` }} />
            </span>
            <span className="modal__level-note">
              {owned.copies} עותקים
              {level < LEVELS.max
                ? ` · הרמה הבאה עולה ${levelCost(card.rarity, level)}`
                : " · הגעת למקסימום"}
            </span>
          </div>
        )}

        <div className="modal__stats">
          <Stat icon="hp" label="חיים" value={hp} />
          <Stat icon="power" label="עוצמה" value={power} />
          <Stat icon="timer" label="קצב תקיפה" value={`${card.stats.attackSpeed}ש׳`} />
          <Stat
            icon="move"
            label="תנועה"
            value={card.stats.moveSpeed > 0 ? `${card.stats.moveSpeed}/ש׳` : "סטטי"}
          />
          <Stat
            icon={RANGE_META[card.stats.range].icon}
            label="טווח"
            value={RANGE_META[card.stats.range].he}
          />
        </div>

        {card.abilities.length > 0 && (
          <div className="modal__section">
            <h3>יכולות</h3>
            <ul className="ability-list">
              {card.abilities.map((ab, i) => (
                <li key={i}>
                  <b>{ABILITY_LABEL[ab.type] ?? ab.type}</b>
                  {ab.description?.he && <span> — {ab.description.he}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {card.role?.he && (
          <div className="modal__section">
            <h3>תפקיד</h3>
            <p className="modal__role">{card.role.he}</p>
          </div>
        )}

        {series && (
          <div className="modal__section modal__synergy">
            <h3>
              סינרגיית סדרה: {series.synergy.name.he} (×{series.synergy.threshold})
            </h3>
            <p>{series.synergy.description.he}</p>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat__icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}
