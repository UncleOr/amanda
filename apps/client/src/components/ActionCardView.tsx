import type { CSSProperties } from "react";
import { ACTIONS, isPassiveAction } from "../data/catalog";
import { RARITY_META } from "../data/cardMeta";
import { Icon } from "./Icon";

/** Where the generated artwork for an action card lives. */
export function actionArtUrl(id: string): string {
  return `${import.meta.env.BASE_URL}cards/${id}.webp`;
}

interface Props {
  actionId: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
  onInfo?: () => void;
  /** Dim the face once a one-shot action has been spent. */
  used?: boolean;
}

/**
 * An Action Card uses the exact same template as a monster card — artwork face,
 * fixed top row, fixed name plate — but wears one shared gold identity colour so
 * the two kinds of card are never mistaken for one another.
 */
export function ActionCardView({ actionId, size = "medium", onClick, onInfo, used }: Props) {
  const card = ACTIONS.get(actionId);
  if (!card) return null;

  const rarity = RARITY_META[card.rarity];
  const passive = isPassiveAction(actionId);

  const style: CSSProperties = {
    "--rarity-color": rarity.color,
    "--series-color": "#ffb020",
    backgroundImage: `url("${actionArtUrl(actionId)}")`,
  } as CSSProperties;

  return (
    <div
      className={`card card--${size} card--art action-card${used ? " action-card--used" : ""}`}
      style={style}
      onClick={onClick}
      title={card.description.he}
    >
      <div className="card__top">
        <span className="card__traits">
          <span className="action-card__kind" title={passive ? "פסיבי — פועל כל הזמן" : "קלף פעולה"}>
            {used ? <Icon name="ready" size={13} /> : passive ? "∞" : <Icon name="play" size={12} />}
          </span>
        </span>
        <span className="card__flags">
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

      <div className="card__plate">
        <span className="card__name">{card.name.he}</span>
        {size !== "small" && (
          <span className="action-card__tag">{passive ? "פסיבי" : "קלף פעולה"}</span>
        )}
      </div>
    </div>
  );
}
