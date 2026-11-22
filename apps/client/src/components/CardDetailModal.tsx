import type { CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { ABILITY_LABEL, ELEMENT_META, RANGE_META, RARITY_META } from "../data/cardMeta";
import { LEVELS, RANGE_REACH, hovers, levelCost, levelDiamonds, levelMultiplier } from "@amanda/shared";
import { Overlay } from "./Overlay";
import { artUrl, spriteFor } from "../game/skins";
import { say } from "../game/lang";
import { HITS_HE, TARGETING_HE } from "../game/vocab";
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
  const art = sprite ? artUrl(sprite) : null;

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
            {/*
              ═══ WHO THIS MONSTER IS ═══

              Or: *"the story appears in the card details under the name.
              Chuppy, for example: 'the loyal friend who is always with
              you'."*

              Under the name and above the badges, because it belongs to the
              NAME and not to the numbers — it is the only line on this card
              that is not a fact about a fight.

              ⚠ And it is nothing like `role`, which lives two hundred lines
              below in a comment explaining why it must never be shown. That
              one is a note from a designer to a designer. This one is
              written for the child holding the card, which is also why it is
              optional: a monster with nothing to say says nothing.
            */}
            {card.story && <p className="modal__story">{say(card.story)}</p>}
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
              {/*
                ⚠ TWO WORDS, ONE FLAG. Or: *"flying is forwards; hovering is
                on the spot."* See `hovers` in shared — the badge is the
                first place a player meets the word, and a Typhoon Dragon
                badged מעופף beside a movement row reading "in place" is the
                contradiction he was asking about.
              */}
              {card.flying && (
                <span className="badge">
                  <Icon name="fly" size={13} />{" "}
                  {hovers(card) ? t("sf93c6e4", "מרחף") : t("s39d10ba", "מעופף")}
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
          {/*
            ═══ A FLYER HAS TO SAY SO WHERE MOVEMENT IS DESCRIBED ═══

            Or: *"and where do you see on a card whether it flies or walks?
            It should be written in the static/movement section. If it flies
            it has to say so."*

            It WAS said — as a badge at the top, beside element and rarity —
            and that is not where anyone looks for how a thing moves. The
            row that answers "how does it move" answered only "how fast",
            which is half of it.

            The five that make it a real hole are the static flyers:
            Thunderwing, the Typhoon Dragon, the Sky King, the Insect
            Empress and the Floating Brain all have moveSpeed 0, so this row
            said "static" and nothing else — the one word that makes a
            hovering dragon sound like a wall.
          */}
          <Stat
            icon={card.flying ? "fly" : "move"}
            label={t("sefc23b0", "תנועה")}
            value={
              card.stats.moveSpeed > 0
                ? card.flying
                  ? tf("s372d0ea", "עף {0}/ש׳", card.stats.moveSpeed)
                  : tf("s118277a", "הולך {0}/ש׳", card.stats.moveSpeed)
                : card.flying
                  ? t("sa3c82f7", "מרחף")
                  : t("s60fd570", "סטטי")
            }
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
          ═══ WHO IT GOES AFTER, AND WHAT IT CAN REACH ═══

          Or, 22 November 2026, looking at a family: *"I just looked at the
          plants — every one of them says 'attacks whoever is in front of it
          in a straight line' in the description."*

          He was right and it was this block. It knew exactly three answers —
          King-hunter, sniper, everything else — while the engine had seven
          targeting modes, so six of them printed the seventh one's sentence.
          The plants happened to be the family where nothing had been given a
          mode, so the same line appeared ten times in a row and the whole
          family read as one card.

          ⚠ SO IT READS THE VOCABULARY NOW AND NOT A LADDER OF ifs. One
          sentence per mode, in the one place the game keeps them
          (TARGETING_HE in vocab.ts), which is also where the deck-builder
          filter takes its names from — so a card and the button that finds
          it can never call the same thing two things.

          The sniper line stays on top of it, because a sniper's reach
          changes WHICH of the enemies it prefers, not which kind it hunts.
        */}
        <p className="modal__aim">
          {say(TARGETING_HE[card.targeting])}
          {/* ⚠ Not inside a template literal: the copy inventory reads t()
              calls out of the source and does not look inside one, so the
              string became unfindable and copy-verify could not settle its
              id. A separate node costs nothing and stays in the document. */}
          {card.stats.range === "sniper" && (
            <> · {t("sb9c6214", "יורה באויב הרחוק ביותר בקו שלו")}</>
          )}
        </p>

        {/*
          ═══ AND WHETHER IT CAN SHOOT UPWARDS ═══

          Or: *"we need to make a difference between attacking aerial and
          ground targets. There will be ones that attack only on the ground,
          only in the air, and both."*

          Said on the card because it is the one property a player cannot
          work out by looking at the monster: a dragon that cannot hit
          dragons is a real card and nothing about the picture says so.

          Only the two that RESTRICT are printed. "Both" is what most of the
          shelf is and what a child assumes, and a line saying "this card can
          attack anything" on half the cards in the game is the kind of
          sentence this screen has been told twice to stop writing.
        */}
        {card.hits !== "both" && (
          <p className="modal__aim modal__aim--hits">
            <Icon name={card.hits === "air" ? "fly" : "move"} size={13} />{" "}
            {say(HITS_HE[card.hits])}
          </p>
        )}

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
        {/*
          ═══ AND `role` IS NOT FOR THE PLAYER EITHER ═══

          Or: *"I saw the card still has the nonsense I asked to delete, with
          the tank you put on top of it. I asked for all those parts not to
          appear on the cards."*

          He is quoting the Obsidian Egg, whose `role` reads "a ticking bomb
          for the ground floor: place it underneath with a tank on top; by
          the time the tank is breached the timer is up." That is a note
          from a designer to a designer — it names a strategy, a card that
          does not exist by that name, and a word the game never uses — and
          it was being printed on the card as though it were a rule.

          Exactly the same mistake as the series synergy above, which came
          off the card for the same reason a paragraph earlier. `role` stays
          in the data, because it is genuinely useful when balancing; it has
          no business on a card a seven-year-old is reading.
        */}
        {card.abilities.length > 0 && (
          <div className="modal__section">
            <h3>{t("s8fa9cc4", "יכולות")}</h3>
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
