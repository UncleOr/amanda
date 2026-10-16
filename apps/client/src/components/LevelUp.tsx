/**
 * **A card just got stronger.**
 *
 * Or: *"and of course when it upgrades, confetti and fireworks and a happy
 * sound."*
 *
 * ═══ THE PAY-OFF LOOKED LIKE NOTHING ═══
 *
 * Levelling a card is the longest loop in the game: four copies of one card
 * out of fifty-one, which is a dozen chests and a week of evenings. The
 * moment it happened, a 4 became a 5 on a tile forty pixels wide. Everything
 * else that matters in this game takes the screen — a new card, climbing an
 * arena — and the one thing you have to WORK for did not.
 *
 * So it does now, with the same shell as the others (Celebrate.tsx) and the
 * card itself as the thing being shown, because the card is what changed.
 *
 * It announces; it does not grant. The level was bought from the server
 * before this drew (api.ts, /api/level-up), which is also where the copies
 * and the diamonds were charged.
 */
import { levelMultiplier } from "@amanda/shared";
import { Celebrate } from "./Celebrate";
import { CardView } from "./CardView";
import { CATALOG } from "../data/catalog";
import { say } from "../game/lang";
import { line as t, lineF as tf } from "../game/copy";

export function LevelUp({
  cardId,
  level,
  onClose,
}: {
  cardId: string;
  /** The level just reached. */
  level: number;
  onClose: () => void;
}) {
  const card = CATALOG.get(cardId);
  /*
   * How much stronger, as a percentage of the base card.
   *
   * The number IS the reward, and it is the one thing a level has never said
   * out loud. "Level 5" means nothing to a seven-year-old; "+40% stronger"
   * is the sentence that explains why he spent four cards on it.
   */
  const gain = Math.round((levelMultiplier(level) - 1) * 100);

  return (
    <Celebrate
      kicker={t("sc54710e", "שדרוג!")}
      title={say(card?.name)}
      onClose={onClose}
    >
      <div className="levelup__card">
        <CardView cardId={cardId} size="large" />
        <span className="levelup__badge">{level}</span>
      </div>
      <span className="party__gems">{tf("s63923f0", "חזק ב-{0}%", gain)}</span>
      <button className="btn-fight" onClick={onClose}>
        {t("sfe8cfe5", "מגניב!")}
      </button>
    </Celebrate>
  );
}
