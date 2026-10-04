import type { CSSProperties } from "react";
import { ACTIONS, isPassiveAction } from "../data/catalog";
import { RARITY_META } from "../data/cardMeta";
import { actionArtUrl } from "./ActionCardView";


export function ActionDetailModal({
  actionId,
  onClose,
}: {
  actionId: string;
  onClose: () => void;
}) {
  const card = ACTIONS.get(actionId);
  if (!card) return null;
  const passive = isPassiveAction(actionId);
  const rarity = RARITY_META[card.rarity];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--card-color"]: "#ffb020" } as CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title="סגירה">
          ✕
        </button>
        <div className="modal__banner">
          <div
            className="modal__portrait"
            style={{
              backgroundImage: `url("${actionArtUrl(actionId)}")`,
              backgroundSize: "cover",
              backgroundPosition: "top center",
            }}
          />
          <div className="modal__title">
            <h2>{card.name.he}</h2>
            <p className="modal__subtitle">{card.name.en}</p>
            <div className="modal__badges">
              <span className="badge" style={{ borderColor: rarity.color, color: rarity.color }}>
                {rarity.he}
              </span>
              <span className={`badge${passive ? " badge--king" : ""}`}>
                {passive ? "♾️ פסיבי" : "▶ בלחיצה"}
              </span>
            </div>
          </div>
        </div>

        <div className="modal__section">
          <h3>{passive ? "מה הוא עושה (אוטומטית)" : "מה הוא עושה בלחיצה"}</h3>
          <p className="modal__role">{card.description.he}</p>
        </div>
      </div>
    </div>
  );
}
