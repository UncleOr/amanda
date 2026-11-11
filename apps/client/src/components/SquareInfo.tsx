import { SQUARES, type SquareKind } from "@amanda/shared";
import { Icon, type IconName } from "./Icon";
import { Overlay } from "./Overlay";
import { CATALOG } from "../data/catalog";
import { say } from "../game/lang";
import { line as t, lineF as tf } from "../game/copy";

/**
 * **What is in this square.**
 *
 * Or, 11 November 2026: *"pressing a square (ours or the opponent's) opens a
 * popup that shows what is in it."*
 *
 * ═══ WHY IT HAS TO BE A PANEL AND NOT A LABEL ═══
 *
 * The board already says WHICH kind a square is — one colour and one icon
 * each, from the same table this reads. What it cannot say is what the kind
 * DOES, and eight of those sentences are eight sentences: on a 4×4 grid on a
 * landscape phone they would stop being a board.
 *
 * So the grid carries the sign and the panel carries the sentence, which is
 * the same division this game uses everywhere else — the crown is an icon on
 * the board and a rule in the card panel, the guard posts are a mark and a
 * tooltip. A child learns eight squares the way they learned the crown: by
 * pressing the one in front of them.
 *
 * ⚠ IT SAYS WHAT IS STANDING THERE, TOO. Or's words are "what is IN it", and
 * on a square with a card on it the honest answer is two things. On the
 * enemy's board the card may be hidden by the fog — then the square is named
 * and its occupant is not, which is the correct answer rather than a missing
 * one.
 */
export function SquareInfo({
  kind,
  cardId,
  hidden,
  onClose,
}: {
  kind: SquareKind;
  /** What is standing on it, if anything is and if it may be seen. */
  cardId?: string | null;
  /** True when something IS there and the fog is what is stopping you. */
  hidden?: boolean;
  onClose: () => void;
}) {
  const def = SQUARES[kind];
  const card = cardId ? CATALOG.get(cardId) : null;
  return (
    <Overlay onClick={onClose}>
      <div
        className="modal modal--narrow"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--sq" as string]: def.colour }}
      >
        <button className="modal__close" onClick={onClose} title={t("s0c55223", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>
        <div className="sqinfo">
          <span className="sqinfo__badge" aria-hidden="true">
            <Icon name={def.icon as IconName} size={28} />
          </span>
          <div>
            <p className="sqinfo__name">{def.he}</p>
            <p className="sqinfo__note">{def.note}</p>
            {card && (
              <p className="sqinfo__who">{tf("s6088ad8", "עומד כאן: {0}", say(card.name))}</p>
            )}
            {hidden && !card && (
              <p className="sqinfo__who">{t("s02bd5a9", "יש כאן משהו. עוד אי אפשר לראות מה.")}</p>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
