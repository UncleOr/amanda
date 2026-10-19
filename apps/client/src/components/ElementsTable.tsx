/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **Which element beats which.** One table, ten rows, nothing else.
 *
 * Or asked for it after being told what the elements actually do: *"let's
 * put an 'elements table' button in the album (and in the deck builder) that
 * opens a popup with an X and a table showing, for each element, which it
 * beats and which beats it (name + picture)."*
 *
 * He asked because he had assumed they were decoration — *"the element of
 * each monster (fire, ice and so on) does nothing, right?"* — and they are
 * not: every hit is multiplied by 1.5 against the element it is strong
 * against and by 0.75 against the one that is strong against it. A rule
 * that changes every number in a battle and was written down nowhere a
 * player could look.
 *
 * Both halves come from ELEMENT_COMBAT, which is the same constant the
 * engine multiplies by. There is no second copy of the chart here to drift
 * out of date — see elementChart below, and chart.test.ts for the proof
 * that the two columns are each other's mirror.
 */
import { Fragment } from "react";
import { ELEMENT_COMBAT, type Element } from "@amanda/shared";
import { ELEMENT_META } from "../data/cardMeta";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t } from "../game/copy";
import { say } from "../game/lang";

/** The order they are listed in, which is the order the game declares them. */
const ELEMENTS = Object.keys(ELEMENT_META) as Element[];

export interface ElementRow {
  el: Element;
  /** Takes 1.5x damage from this one. */
  beats: Element[];
  /** Deals 0.75x damage to this one. */
  beatenBy: Element[];
}

/**
 * The chart, both ways round.
 *
 * `strongVs` only says who an element is strong AGAINST. "Who beats me" is
 * the same table read the other way, and deriving it rather than writing it
 * out is the whole point: a change to one line of config moves both columns
 * of this table at once.
 */
export function elementChart(): ElementRow[] {
  const strong = ELEMENT_COMBAT.strongVs as Record<Element, readonly Element[]>;
  return ELEMENTS.map((el) => ({
    el,
    beats: [...strong[el]],
    beatenBy: ELEMENTS.filter((other) => strong[other].includes(el)),
  }));
}

function Pills({ list }: { list: Element[] }) {
  // An element with no entry is not an empty cell — see the Assimilator,
  // which has no element of its own until it steals one.
  if (!list.length) return <span className="elements__none">—</span>;
  return (
    <>
      {list.map((e) => (
        <span key={e} className="elements__pill" style={{ borderColor: ELEMENT_META[e].color }}>
          <Icon name={ELEMENT_META[e].icon} size={15} /> {say(ELEMENT_META[e])}
        </span>
      ))}
    </>
  );
}

export function ElementsTable({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClick={onClose}>
      <div className="modal elements" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("sb74f47e", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>
        <h2 className="elements__title">{t("s76b7982", "טבלת היסודות")}</h2>
        <div className="elements__grid">
          <span className="elements__head" />
          {/* The multiplier beside the word it means, which is the one shape
              a number this small is allowed to take. */}
          <span className="elements__head">
            {t("s814ec0e", "מנצח את")} <b>×{ELEMENT_COMBAT.strongMultiplier}</b>
          </span>
          <span className="elements__head">
            {t("s960cb19", "מנוצח על ידי")} <b>×{ELEMENT_COMBAT.weakMultiplier}</b>
          </span>
          {elementChart().map(({ el, beats, beatenBy }) => (
            <Fragment key={el}>
              <span className="elements__who" style={{ color: ELEMENT_META[el].color }}>
                <Icon name={ELEMENT_META[el].icon} size={19} /> {say(ELEMENT_META[el])}
              </span>
              <span className="elements__list">
                <Pills list={beats} />
              </span>
              <span className="elements__list">
                <Pills list={beatenBy} />
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
