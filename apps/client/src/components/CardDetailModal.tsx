import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { ABILITY_LABEL, ELEMENT_META, RANGE_META, RARITY_META } from "../data/cardMeta";
import { LEVELS, RANGE_REACH, levelCost, levelDiamonds, levelMultiplier } from "@amanda/shared";
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
              {/*
                ═══ THE ONE SYMBOL THAT HAD NOWHERE ELSE TO GO ═══

                Taking the icon row off the album tile was Or's call — *"whoever
                wants to go into the symbols will open the card"* — which only
                holds if the card itself says them. Element, rarity and series
                are badges here, range and speed are numbers. Flying was on
                that row and nowhere else, so a flyer stopped being a flyer
                the moment the row went.
              */}
              {card.flying && (
                <span className="badge">
                  <Icon name="fly" size={13} /> {t("s39d10ba", "מעופף")}
                </span>
              )}
              {card.midBoss && (
                <span className="badge badge--king">
                  <Icon name="king" size={13} /> {t("s461e043", "ענק אמצע")}
                </span>
              )}
              {owned && <span className="badge badge--level">{tf("sf0837e4", "רמה {0}", level)}</span>}
            </div>
          </div>
        </div>

        {owned && (
          <div className="modal__level">
            <span className="modal__level-n">
              {tf("se6317ab", "רמה {0}", level)}
              {level < LEVELS.max && <span className="modal__level-next"> / {LEVELS.max}</span>}
            </span>
            <span className="modal__level-bar" aria-hidden="true">
              <i style={{ width: `${(level / LEVELS.max) * 100}%` }} />
            </span>
            {/*
              ═══ TWO NUMBERS AND TWO PICTURES ═══

              Or: *"'1 copies the next level costs 7' is very clumsy — write
              1/7 [card] to the next level + [diamond] [how many diamonds]."*

              It was clumsy because it was two sentences doing one job, and
              the 7 in it was a COST reading as a total. His version is the
              same three facts as a progress fraction, which is the shape
              every other progress in this game already uses.
            */}
            {level < LEVELS.max ? (
              <span className="modal__level-note">
                <b>
                  {owned.copies}/{levelCost(card.rarity, level)}
                </b>
                <Icon name="deck" size={15} />
                {t("s9558b07", "לרמה הבאה")}
                <span className="modal__level-cost">
                  <Icon name="gem" size={13} /> {levelDiamonds(level)}
                </span>
              </span>
            ) : (
              <span className="modal__level-note">{t("s512576d", "· הגעת למקסימום")}</span>
            )}
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
          {/*
            ═══ A RANGE IS A NUMBER OF SQUARES ═══

            Or: *"range — maybe we should put a number there? No metres, a
            number of cards."*

            It said קרוב / רחוק / צלף, which is three words for a thing the
            engine measures exactly: RANGE_REACH in columns, and melee is
            contact. So the number here is the engine's own, not a
            description of it — 0, 3 and 6, where the two front rows touch at
            columns 3 and 4 and the Kings stand about four apart. A sniper
            really can reach the far King and a ranged card really cannot,
            and now the card says which.
          */}
          <Stat
            icon={RANGE_META[card.stats.range].icon}
            label={t("sa3be69c", "טווח")}
            value={RANGE_REACH[card.stats.range]}
          />
        </div>

        {/*
          And WHO it hits, in what order — Or asked for this in the same
          breath as the number, and it is the half the number cannot say.
          Every line here is the engine's rule in pickTarget (simulate.ts):
          a king-hunter works through the guards in the way first, a sniper
          picks the FARTHEST enemy in its lane rather than the nearest, and
          everything else fights what is in front of it.

          DRAFT COPY — Or's words, Or's to finish.
        */}
        <p className="modal__aim">
          {card.targeting === "king"
            ? t("sd4de546", "תוקף את השומרים שבדרך, ואז את המלך.")
            : card.stats.range === "sniper"
              ? t("sa8cdca7", "יורה באויב הרחוק ביותר בקו שלו.")
              : t("s7815a19", "תוקף את מי שמולו בקו שלו.")}
        </p>

        {/*
          ═══ ONE SECTION, NOT TWO ═══

          Or: *"every card says 'abilities' and 'role' — unnecessary, merge
          them."* They were two headings over the same question: what does
          this card DO. The role is the sentence and the abilities are the
          list, so the sentence leads and the list follows.

          And the series synergy is gone from here entirely — his other note:
          *"no need to write the series synergy on every card, all the
          synergies are the same."* It is a rule of the BOARD, not a property
          of this monster, and repeating it on all 53 cards made it look like
          something to compare them by.
        */}
        {(card.role || card.abilities.length > 0) && (
          <div className="modal__section">
            <h3>{t("s8fa9cc4", "יכולות")}</h3>
            {card.role && <p className="modal__role">{say(card.role)}</p>}
            {card.abilities.length > 0 && (
              <ul className="ability-list">
                {card.abilities.map((ab, i) => (
                  <li key={i}>
                    <b>{say(ABILITY_LABEL[ab.type]) || ab.type}</b>
                    {ab.description && <span> — {say(ab.description)}</span>}
                  </li>
                ))}
              </ul>
            )}
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
