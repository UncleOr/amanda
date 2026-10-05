import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { ABILITY_LABEL, ELEMENT_META, RANGE_META, RARITY_META } from "../data/cardMeta";

export function CardDetailModal({
  cardId,
  onClose,
}: {
  cardId: string;
  onClose: () => void;
}) {
  const card = CATALOG.get(cardId);
  if (!card) return null;
  const series = SERIES_BY_ID.get(card.seriesId);
  const rarity = RARITY_META[card.rarity];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ "--card-color": card.art.placeholderColor } as CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title="סגירה">
          ✕
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
              {card.midBoss && <span className="badge badge--king">👑 ענק אמצע</span>}
            </div>
          </div>
        </div>

        <div className="modal__stats">
          <Stat icon="❤️" label="חיים" value={card.stats.hp} />
          <Stat icon="⚔️" label="עוצמה" value={card.stats.power} />
          <Stat icon="⏱️" label="קצב תקיפה" value={`${card.stats.attackSpeed}ש׳`} />
          <Stat
            icon="🏃"
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
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="stat">
      <span className="stat__icon">{icon}</span>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  );
}
