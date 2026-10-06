import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import { BOARD_SIZE, cellKey, isKingCell, type BattleMods } from "../game/useMatch";
import { isCornerKey } from "../data/catalog";

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
}

const KING_KEY = "king";

/**
 * The two cells directly in front of the King, in its own lanes. The King
 * cannot be attacked while an ally still stands in its lane, so whatever holds
 * these two posts is what keeps it alive — they are the most valuable squares
 * on the board and should look like it.
 */
function isGuardPost(x: number, y: number): boolean {
  return x === 3 && (y === 1 || y === 2);
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
  dragging = false,
  editing = false,
  synergy,
  stacked = {},
  stackSlots = 0,
  stackCorners = false,
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

  const cells: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < BOARD_SIZE; x++)
    for (let y = 0; y < BOARD_SIZE; y++) if (!isKingCell(x, y)) cells.push({ x, y });

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
    <div className={`board board--${side}${compact ? " board--compact" : ""}`} dir="ltr">
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
          `${dragOver === KING_KEY && !king ? " slot--dragover" : ""}`
        }
        data-drop={interactive && !king ? KING_KEY : undefined}
        style={{ gridColumn: "2 / 4", gridRow: "2 / 4" }}
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
            <b>המלך</b>
          </span>
        )}
      </div>

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
              `${isGuardPost(x, y) ? " slot--guard" : ""}` +
              `${stacked[key] ? " slot--stacked" : ""}` +
              `${stackableHere(key, occ) ? " slot--stackable" : ""}` +
              `${targeting && occ ? " slot--target" : ""}` +
              `${interactive && dragging && (!occ || stackableHere(key, occ)) ? " slot--droppable" : ""}` +
              `${dragOver === key && (!occ || stackableHere(key, occ)) ? " slot--dragover" : ""}`
            }
            data-drop={interactive && (!occ || stackableHere(key, occ)) ? key : undefined}
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
              <span className="slot__stack-mark" title="יש קלף מתחת. הוא יצוץ כשהעליון ייפול.">
                <Icon name="stacked" size={15} />
              </span>
            )}
            {isGuardPost(x, y) && !occ && interactive && (
              <span className="slot__guard-mark" title="משמר המלך. כאן עוצרים את מי שבא לאכול אותו.">
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
              interactive && handActive && <span className="slot__hint">＋</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
