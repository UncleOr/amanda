import { CardView, CardBack } from "./CardView";
import { BOARD_SIZE, cellKey, isKingCell, type BattleMods } from "../game/useMatch";

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
  const cells: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < BOARD_SIZE; x++)
    for (let y = 0; y < BOARD_SIZE; y++) if (!isKingCell(x, y)) cells.push({ x, y });

  const size = compact ? "small" : "medium";
  // Depth (x) runs horizontally so the two boards face each other; lanes (y)
  // run vertically and align across both boards.
  const colForX = (x: number) => (side === "left" ? x + 1 : BOARD_SIZE - x);
  const rowForY = (y: number) => y + 1;

  return (
    <div className={`board${compact ? " board--compact" : ""}`} dir="ltr">
      <div
        className={
          `slot slot--king${king ? " slot--filled" : ""}` +
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
          if (king && revealKing) onCardInfo?.(king);
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
          <span className="slot__hint">👑 המלך</span>
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
              `${isGuardPost(x, y) ? " slot--guard" : ""}` +
              `${targeting && occ ? " slot--target" : ""}` +
              `${interactive && dragging && !occ ? " slot--droppable" : ""}` +
              `${dragOver === key && !occ ? " slot--dragover" : ""}`
            }
            data-drop={interactive && !occ ? key : undefined}
            style={{ gridColumn: colForX(x), gridRow: rowForY(y) }}
            onClick={() => {
              if (targeting && interactive) {
                if (occ) onTarget?.(x, y);
                return;
              }
              if (occ && shown) onCardInfo?.(occ);
              else if (interactive && !occ) onCellClick?.(x, y);
            }}
          >
            {isGuardPost(x, y) && !occ && interactive && (
              <span className="slot__guard-mark" title="משמר המלך — כאן עוצרים את מי שבא אליו">
                🛡
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
