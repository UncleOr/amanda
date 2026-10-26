import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import type { CSSProperties } from "react";
import { BOARD_SIZE, cellKey, type BattleMods } from "../game/useMatch";
import { isCornerKey } from "../data/catalog";
import { line as t } from "../game/copy";

interface Props {
  placements: Record<string, string>;
  king: string | null;
  /**
   * Which side of the screen this board sits on. The front row (depth x=3)
   * always points toward the center, so the two boards face each other:
   * "left" board (you) → front on its right; "right" board (opponent) → front
   * on its left.
   */
  side: "left" | "right";
  reveal?: (x: number, y: number) => boolean;
  revealKing?: boolean;
  interactive?: boolean;
  handActive?: boolean;
  onCellClick?: (x: number, y: number) => void;
  onKingClick?: () => void;
  onCardInfo?: (cardId: string) => void;
  compact?: boolean;
  /** Action-card buffs to reflect in this board's card stats (player only). */
  mods?: BattleMods;
  /** In targeting mode, clicking an occupied cell picks it as the target. */
  targeting?: boolean;
  onTarget?: (x: number, y: number) => void;
  onTargetKing?: () => void;
  /**
   * Which half of the playground this grid is, written into every drop key.
   *
   * Or: *"I need to be able to drag straight onto the board, whatever side I
   * have 'picked' right now."* Both boards are live at once there, so a
   * drop key of "2-1" is ambiguous — it exists on both of them. With this
   * set the keys read "me:2-1" and "enemy:2-1" and the drop knows where it
   * landed. Left out in a real match, where there is only one board you can
   * put anything on.
   */
  dropSide?: "me" | "enemy";
  /** data-drop key currently hovered during a drag (highlights the slot). */
  dragOver?: string | null;
  /** True while a card is being dragged — marks legal empty slots. */
  dragging?: boolean;
  /**
   * Playground: a tap on a FILLED cell edits it — replaces it with the card in
   * hand, or clears it when the hand is empty — instead of opening the card.
   * In a real match a placed card is final, so a tap there can only mean "let
   * me look at it"; on the bench nothing is final and the opposite is true.
   * The ℹ corner still opens the card either way.
   */
  editing?: boolean;
  /** Cells with a second card hidden underneath (Ground Floor). */
  stacked?: Record<string, string>;
  /**
   * Cells currently lit by a series bonus ("king" for the crown).
   *
   * The rule is three of a family TOUCHING, so it is a thing you do with your
   * hands on this screen — and a rule you cannot see while you are arranging
   * the board is a rule you cannot play to.
   */
  synergy?: Set<string>;
  /** How many more cells may still be stacked onto. */
  stackSlots?: number;
  /** True when the four corners are stackable without spending a slot. */
  stackCorners?: boolean;
  /**
   * How many lanes deep this board is. Four everywhere except Amanda's side,
   * which is eight because she faces two players at once.
   *
   * She cannot be drawn as two four-lane boards, which was the first thing
   * tried: her 2×2 King sits at lanes 3 and 4 — exactly across the seam — so
   * each half drew an empty throne of its own and neither showed her.
   */
  lanes?: number;
  /** Top lane of the 2×2 King. Lane 1 on a four-lane board, 3 on Amanda's. */
  kingLane?: number;
  /**
   * Draw only these squares. Everything else is not dimmed — it is not there.
   *
   * ═══ A LESSON IS NOT A GAME WITH THE LIGHTS DOWN ═══
   *
   * Or, after the third time the tutorial came back wrong: *"maybe it is
   * worth rethinking the whole approach. Not hiding an existing board, but
   * building a new board where only what you can click appears."*
   *
   * He is right, and the reason is in the picture he sent: twenty slots, all
   * dimmed, one ringed. Dimming does not simplify a screen, it darkens one —
   * a seven-year-old still sees twenty squares and has to find the lit one.
   * An empty slot is also a drop target, so the dark ones were never only
   * decoration either.
   *
   * Here the lesson's board starts as one square and grows as Amanda
   * introduces them, so the board teaches itself as the words go. Null — the
   * default, and every screen outside the tutorial — draws all of them.
   *
   * "king" is in the set when the crown is part of the lesson yet.
   */
  only?: ReadonlySet<string> | null;
}

const KING_KEY = "king";

/**
 * The two cells directly in front of the King, in its own lanes. The King
 * cannot be attacked while an ally still stands in its lane, so whatever holds
 * these two posts is what keeps it alive — they are the most valuable squares
 * on the board and should look like it.
 */
function isGuardPost(x: number, y: number, kingLane: number): boolean {
  return x === 3 && (y === kingLane || y === kingLane + 1);
}

export function BoardGrid({
  placements,
  king,
  side,
  reveal,
  revealKing = true,
  interactive = false,
  handActive = false,
  onCellClick,
  onKingClick,
  onCardInfo,
  compact = false,
  mods,
  targeting = false,
  onTarget,
  onTargetKing,
  dragOver = null,
  dropSide,
  dragging = false,
  editing = false,
  synergy,
  stacked = {},
  lanes = BOARD_SIZE,
  kingLane = 1,
  stackSlots = 0,
  stackCorners = false,
  only = null,
}: Props) {
  const buffFor = (key: string, cardId: string) => {
    if (!mods) return undefined;
    const buff: { powerAdd?: number; powerMult?: number; hpMult?: number } = {};
    if (mods.boardPowerAdd > 0 && cardId !== "crumb_demon") buff.powerAdd = mods.boardPowerAdd;
    if (mods.boostedCells[key]) {
      buff.powerMult = 1.5;
      buff.hpMult = 1.5;
    }
    return Object.keys(buff).length ? buff : undefined;
  };
  /** Stackable either because a slot is left, or because this is a free corner. */
  const canStackOn = (key: string) => stackSlots > 0 || (stackCorners && isCornerKey(key));
  /** A cell already holding a card that will accept a second one on top. */
  const stackableHere = (key: string, occ?: string) => !!occ && !stacked[key] && canStackOn(key);

  /** The King's 2×2, wherever it sits on a board of this depth. */
  const kingHere = (x: number, y: number) =>
    x >= 1 && x <= 2 && y >= kingLane && y <= kingLane + 1;

  const cells: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < BOARD_SIZE; x++)
    for (let y = 0; y < lanes; y++)
      if (!kingHere(x, y) && (!only || only.has(cellKey(x, y)))) cells.push({ x, y });

  /*
   * The crown is a square like any other as far as `only` is concerned — it
   * appears when the lesson reaches it, which is the step that asks for it.
   * Outside a lesson `only` is null and it is always there.
   */
  const showKing = !only || only.has(KING_KEY);

  /*
   * A drop key, and which board it is on. In a real match a cell is "2-1";
   * in the playground, where both boards take drops at once, it is
   * "enemy:2-1" — see `dropSide`.
   */
  const dropKey = (key: string) => (dropSide ? `${dropSide}:${key}` : key);

  const size = compact ? "small" : "medium";
  // Depth (x) runs horizontally so the two boards face each other; lanes (y)
  // run vertically and align across both boards.
  const colForX = (x: number) => (side === "left" ? x + 1 : BOARD_SIZE - x);
  const rowForY = (y: number) => y + 1;

  return (
    /*
     * `side` is the only honest source for which edge is the inner one. The
     * page is RTL, so "the left board" cannot be inferred from document order
     * or from a logical property — and a spine drawn on the outer edge makes
     * two pages look like two pages rather than one open album.
     */
    <div
      className={`board board--${side}${compact ? " board--compact" : ""}`}
      dir="ltr"
      style={lanes === BOARD_SIZE ? undefined : { "--lanes": lanes } as CSSProperties}
    >
      {showKing && (
      <div
        className={
          `slot slot--king${king ? " slot--filled" : ""}` +
          // An empty crown on YOUR board is the whole warning. It replaced a
          // sentence under the hand that said the same thing in words.
          `${!king && interactive ? " slot--king-empty" : ""}` +
          `${synergy?.has(KING_KEY) ? " slot--synergy" : ""}` +
          `${king && revealKing ? " slot--readable" : ""}` +
          `${targeting && king ? " slot--target" : ""}` +
          `${interactive && dragging && !king ? " slot--droppable" : ""}` +
          `${dragOver === dropKey(KING_KEY) && !king ? " slot--dragover" : ""}`
        }
        data-drop={interactive && !king ? dropKey(KING_KEY) : undefined}
        style={{ gridColumn: "2 / 4", gridRow: `${kingLane + 1} / ${kingLane + 3}` }}
        onClick={() => {
          if (targeting && interactive) {
            if (king) onTargetKing?.();
            return;
          }
          // Looking at a card is always allowed — including the opponent's,
          // once it has been revealed. Only placing one needs an active turn.
          if (editing && interactive) onKingClick?.();
          else if (king && revealKing) onCardInfo?.(king);
          else if (interactive && !king) onKingClick?.();
        }}
      >
        {!revealKing ? (
          <CardBack size="medium" />
        ) : king ? (
          <CardView
            cardId={king}
            size={compact ? "small" : "large"}
            king
            buff={buffFor(KING_KEY, king)}
            onInfo={onCardInfo ? () => onCardInfo(king) : undefined}
          />
        ) : (
          <span className="slot__hint slot__hint--king">
            <Icon name="king" size={22} />
            <b>{t("s3ed5f40", "המלך")}</b>
          </span>
        )}
      </div>
      )}

      {cells.map(({ x, y }) => {
        const key = cellKey(x, y);
        const occ = placements[key];
        const shown = reveal ? reveal(x, y) : true;
        return (
          <div
            key={key}
            className={
              `slot${occ && shown ? " slot--filled slot--readable" : ""}` +
              `${synergy?.has(key) ? " slot--synergy" : ""}` +
              `${isGuardPost(x, y, kingLane) ? " slot--guard" : ""}` +
              `${stacked[key] ? " slot--stacked" : ""}` +
              `${stackableHere(key, occ) ? " slot--stackable" : ""}` +
              `${targeting && occ ? " slot--target" : ""}` +
              `${interactive && dragging && (!occ || stackableHere(key, occ)) ? " slot--droppable" : ""}` +
              `${dragOver === dropKey(key) && (!occ || stackableHere(key, occ)) ? " slot--dragover" : ""}`
            }
            data-drop={interactive && (!occ || stackableHere(key, occ)) ? dropKey(key) : undefined}
            style={{ gridColumn: colForX(x), gridRow: rowForY(y) }}
            onClick={() => {
              if (targeting && interactive) {
                if (occ) onTarget?.(x, y);
                return;
              }
              // With Ground Floor active and a monster in hand, tapping a card
              // you already placed stacks onto it rather than opening it — the
              // ℹ button is still there for a closer look.
              const canStack = interactive && handActive && stackableHere(key, occ);
              if (canStack || (editing && interactive)) {
                onCellClick?.(x, y);
                return;
              }
              if (occ && shown) onCardInfo?.(occ);
              else if (interactive && !occ) onCellClick?.(x, y);
            }}
          >
            {stacked[key] && (
              <span className="slot__stack-mark" title={t("s8845f5f", "יש קלף מתחת. הוא יצוץ כשהעליון ייפול.")}>
                <Icon name="stacked" size={15} />
              </span>
            )}
            {isGuardPost(x, y, kingLane) && !occ && interactive && (
              <span className="slot__guard-mark" title={t("s0e2bdac", "משמר המלך. כאן עוצרים את מי שבא לאכול אותו.")}>
                <Icon name="guard" size={15} />
              </span>
            )}
            {!shown ? (
              <CardBack size={size} />
            ) : occ ? (
              <CardView
                cardId={occ}
                size={size}
                buff={buffFor(key, occ)}
                onInfo={onCardInfo ? () => onCardInfo(occ) : undefined}
              />
            ) : (
              /*
                ═══ AN EMPTY SLOT SHOWS WHAT IT WILL BECOME ═══

                Or: *"if you decided that at some point you stop placing
                cards and it fills up with crumb monsters — let's tell the
                player that."*

                Shown rather than told, which is this game's own standard:
                an empty crown taught the King rule with no words at all.
                Every cell you leave empty is already wearing the Crumb
                Demon it will be filled with, at a fifth opacity, so the
                board says "this is what happens if you stop" by looking
                like it — and the ＋ on top still says you can place here.

                It answers the other half of his question too, the one he
                asked as an aside: *"is it possible I don't have enough
                cards in my deck? A lot of the time I don't cover the
                board."* He is right, and it is the design — an album
                smaller than thirteen monsters cannot fill a board, and
                the gaps are the reason to collect. A player who can SEE
                the gaps filling with crumbs knows that without being told.
              */
              interactive && (
                <>
                  <span className="slot__crumb" aria-hidden="true">
                    <CardView cardId="crumb_demon" size={size} />
                  </span>
                  {handActive && <span className="slot__hint">＋</span>}
                </>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
