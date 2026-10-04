import type { CSSProperties } from "react";
import { ACTIONS, isPassiveAction } from "../data/catalog";
import { RARITY_META } from "../data/cardMeta";
import { actionArtUrl } from "./ActionCardView";


export function ActionDetailModal({
  actionId,
  onClose,
  onActivate,
  state,
}: {
  actionId: string;
  onClose: () => void;
  /** Present when this card is in the bar and can be played right now. */
  onActivate?: () => void;
  /** Why it cannot be played, when it cannot. */
  state?: "used" | "passive" | null;
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

        {/* Playing the card lives here, where there is room for a real button,
            rather than on a 9px control wedged under a thumbnail. */}
        {(onActivate || state) && (
          <div className="modal__actions">
            {onActivate ? (
              <button className="btn-fight" onClick={onActivate}>
                ▶ הפעל עכשיו
              </button>
            ) : (
              <button className="btn-fight btn-ghost" disabled>
                {state === "used" ? "✔ כבר נוצל" : "♾️ פועל מעצמו"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
