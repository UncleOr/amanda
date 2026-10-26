import type { CSSProperties } from "react";
import { ACTIONS, isPassiveAction } from "../data/catalog";
import { RARITY_META } from "../data/cardMeta";
import { Icon } from "./Icon";
import { line as t } from "../game/copy";
import { say } from "../game/lang";

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
  /**
   * === HOW YOU USE IT, ON THE THING YOU USE ===
   *
   * Or: *"and the button to use an action card — put it on the card
   * itself, a button with an arrow on it so it is understood that this is
   * how you use it."*
   *
   * It was a separate button sitting under the card, which is a second
   * object to notice and to aim at. On the face there is no aiming: the
   * card is the thing you want and the arrow on it is the way to spend it.
   *
   * Left out everywhere a card is only being LOOKED at — the album, the
   * gallery, the detail sheet — so an arrow never appears on a card you
   * cannot play right now.
   */
  onUse?: () => void;
  /** What the arrow does, for a title and a screen reader. */
  useLabel?: string;
}

/**
 * An Action Card uses the exact same template as a monster card — artwork face,
 * fixed top row, fixed name plate — but wears one shared gold identity colour so
 * the two kinds of card are never mistaken for one another.
 */
export function ActionCardView({
  actionId,
  size = "medium",
  onClick,
  onInfo,
  used,
  onUse,
  useLabel,
}: Props) {
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
      title={say(card.description)}
    >
      <div className="card__top">
        <span className="card__traits">
          <span className="action-card__kind" title={passive ? t("sba8cb81", "פסיבי — פועל כל הזמן") : t("sff358eb", "קלף פעולה")}>
            {used ? <Icon name="ready" size={13} /> : passive ? "∞" : <Icon name="play" size={12} />}
          </span>
        </span>
        <span className="card__flags">
          <span className="card__rarity" title={say(rarity)} />
          {onInfo && (
            <button
              type="button"
              className="card__info"
              title={t("sbeacb74", "פרטי הקלף")}
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

      {onUse && (
        <button
          type="button"
          className="action-card__use"
          title={useLabel}
          aria-label={useLabel}
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Icon name="play" size={18} />
        </button>
      )}

      <div className="card__plate">
        <span className="card__name">{say(card.name)}</span>
        {size !== "small" && (
          <span className="action-card__tag">{passive ? t("s2ee640d", "פסיבי") : t("sf01886f", "קלף פעולה")}</span>
        )}
      </div>
    </div>
  );
}
