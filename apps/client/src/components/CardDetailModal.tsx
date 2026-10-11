import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { ABILITY_LABEL, ELEMENT_META, RANGE_META, RARITY_META } from "../data/cardMeta";
import { LEVELS, levelCost, levelMultiplier } from "@amanda/shared";
import { Overlay } from "./Overlay";
import { spriteFor } from "../game/skins";
import { say } from "../game/lang";
import { line as t, lineF as tf } from "../game/copy";

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
  // The same resolution CardView does, so a skin the player owns is the
  // picture here too rather than only on the board.
  const sprite = card.art.sprite ? spriteFor(card.id, card.art.sprite) : null;
  const art = sprite ? `${import.meta.env.BASE_URL}${sprite}` : null;

  return (
    <Overlay onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ "--card-color": card.art.placeholderColor } as CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title={t("s2027844", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        <div className="modal__banner">
          {/*
            The card's own artwork, where there is any.
            
            This was a bare `<div className="modal__portrait" />` — a square of
            `--card-color` and nothing else. Which is correct for a card that
            has no picture yet, and wrong for the 53 that do: the one screen a
            player opens in order to LOOK at a card was the one screen that did
            not show it.

            The placeholder colour stays underneath as the background, so a
            card without art still gets the tile it always had, and a slow
            image has something to be slow over.
          */}
          <div
            className="modal__portrait"
            style={art ? { backgroundImage: `url("${art}")` } : undefined}
          />
          <div className="modal__title">
            <h2>{say(card.name)}</h2>
            <p className="modal__subtitle">{card.name.en}</p>
            <div className="modal__badges">
              <span className="badge" style={{ borderColor: rarity.color, color: rarity.color }}>
                {say(rarity)}
              </span>
              {card.elements.map((e) => (
                <span key={e} className="badge">
                  <Icon name={ELEMENT_META[e].icon} size={14} /> {say(ELEMENT_META[e])}
                </span>
              ))}
              {series && <span className="badge">{say(series.name)}</span>}
              {card.midBoss && (
                <span className="badge badge--king">
                  <Icon name="king" size={13} /> {t("s461e043", "ענק אמצע")}
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
                ? " " + tf("sad22ee6", "· הרמה הבאה עולה {0}", levelCost(card.rarity, level))
                : " " + t("s512576d", "· הגעת למקסימום")}
            </span>
          </div>
        )}

        <div className="modal__stats">
          <Stat icon="hp" label={t("sa1b7d2c", "חיים")} value={hp} />
          <Stat icon="power" label={t("s4173ded", "עוצמה")} value={power} />
          <Stat icon="timer" label={t("s4763941", "קצב תקיפה")} value={tf("s26ebf92", "{0}ש׳", card.stats.attackSpeed)} />
          <Stat
            icon="move"
            label={t("sefc23b0", "תנועה")}
            value={card.stats.moveSpeed > 0 ? tf("s9546375", "{0}/ש׳", card.stats.moveSpeed) : t("s60fd570", "סטטי")}
          />
          <Stat
            icon={RANGE_META[card.stats.range].icon}
            label={t("sa3be69c", "טווח")}
            value={say(RANGE_META[card.stats.range])}
          />
        </div>

        {card.abilities.length > 0 && (
          <div className="modal__section">
            <h3>{t("s8fa9cc4", "יכולות")}</h3>
            <ul className="ability-list">
              {card.abilities.map((ab, i) => (
                <li key={i}>
                  <b>{say(ABILITY_LABEL[ab.type]) || ab.type}</b>
                  {ab.description && <span> — {say(ab.description)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {card.role && (
          <div className="modal__section">
            <h3>{t("s8efe7ee", "תפקיד")}</h3>
            <p className="modal__role">{say(card.role)}</p>
          </div>
        )}

        {series && (
          <div className="modal__section modal__synergy">
            <h3>
              סינרגיית סדרה: {say(series.synergy.name)} (×{series.synergy.threshold})
            </h3>
            <p>{say(series.synergy.description)}</p>
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
