import { useMemo, useState } from "react";
import { DRAFT_ROUNDS, dealPacks, splitDraft, type DraftResult } from "@amanda/shared";
import { CATALOG, cardPool } from "../data/catalog";
import { CardView } from "./CardView";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { sfx } from "../game/sfx";
import { line as t, lineF as tf } from "../game/copy";

/**
 * THE SCREEN IS FOR: choosing which of two monsters you would rather fight
 * WITH than against.
 *
 * Or: *"draft — what you don't take goes to the opponent."* That sentence is
 * the whole mode and the whole screen. Two cards, one tap, fifteen times.
 *
 * ═══ THE HERO IS THE PAIR ═══
 *
 * Not the counter, not the title. Two big cards side by side with nothing
 * between them is the decision, drawn at the size of a decision — §1, and the
 * reason there is no sentence anywhere on this screen explaining the rule.
 * Tap one, it slides to your pile, the other goes to theirs; by the third
 * pack nobody needs telling.
 *
 * The only words are a count, because fifteen taps with no end in sight is
 * the one thing that would make this feel long.
 */
export function Draft({
  onClose,
  onReady,
  seed,
  best,
}: {
  onClose: () => void;
  onReady: (result: DraftResult) => void;
  /** Given so a draft can be replayed — see dealPacks. */
  seed?: number;
  /**
   * How far this player has climbed.
   *
   * A draft deals the cards for BOTH sides, so Or's rule about the bot's deck
   * lands here harder than anywhere: *"if I am playing at the train station
   * now, I should not be seeing Machines or Sea Dwellers on the other side."*
   * Ungated, this screen would not only show him a family he has not met — it
   * would ask him to choose it, and then hand the one he refused to the
   * opponent.
   */
  best?: number;
}) {
  const packs = useMemo(() => {
    /*
     * Monsters only. `cardPool` is what both boards are built from anyway, so
     * a draft cannot offer a card the game would not have dealt.
     */
    const monsters = cardPool(best).filter((id) => CATALOG.has(id));
    let s = seed ?? Math.floor(Math.random() * 2_000_000_000);
    const rnd = () => {
      // A small deterministic generator, so the same seed deals the same
      // packs. Nothing here needs a good one.
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    return dealPacks(monsters, DRAFT_ROUNDS, rnd);
  }, [seed, best]);

  const [picked, setPicked] = useState<string[]>([]);
  const pack = packs[picked.length];

  const take = (cardId: string) => {
    sfx.play("draw");
    const next = [...picked, cardId];
    setPicked(next);
    if (next.length >= packs.length) onReady(splitDraft(packs, next));
  };

  if (!pack) return null;

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--draft" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s6e44cc7", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {/* How far through. The only words on the screen. */}
        <span className="draft__count">
          {tf("sa74ea1d", "{0} מתוך {1}", String(picked.length + 1), String(packs.length))}
        </span>

        <div className="draft__pair">
          {pack.map((id) => (
            <button key={id} className="draft__pick" onClick={() => take(id)}>
              <CardView cardId={id} size="large" />
            </button>
          ))}
        </div>

        {/* The two piles, so you can see what you have handed over. */}
        <div className="draft__piles">
          <span className="draft__pile">
            <Icon name="friend" size={14} />
            {picked.length}
          </span>
          <span className="draft__pile draft__pile--theirs">
            <Icon name="monster" size={14} />
            {picked.length}
          </span>
        </div>
      </div>
    </Overlay>
  );
}
