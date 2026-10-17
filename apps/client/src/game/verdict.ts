import type { BattleResult } from "@amanda/engine";
import { line as t, lineF as tf } from "./copy";

/**
 * Why the battle ended, in a sentence.
 *
 * Shared, because two screens say it: the arena speaks it over the last
 * frame, and the result card prints it underneath. It lived in App.tsx while
 * both of those were in App.tsx; now that they are not, one copy of the
 * wording is the point.
 */
export function verdictText(result: BattleResult, iWon: boolean): string {
  const whose = iWon ? t("s656f60c", "של היריב") : t("s42347b7", "שלך");
  switch (result.winReason) {
    case "kingDown":
      return tf("s38e8e92", "המלך {0} נפל — הקרב הסתיים", whose);
    /*
     * ═══ THREE ENDINGS, NOT FIVE ═══
     *
     * Or: *"you don't need to spell out to the player how the battle was
     * decided in every situation. Either the King died. Or time ran out
     * (and then he'll see who won). Or a coin toss."*
     *
     * The engine still has five reasons and still decides in that order —
     * king health, then total health, then how many cards survived, then
     * the coin. What changed is that four of them are one sentence to the
     * player, because the difference between "decided on total health" and
     * "decided on surviving cards" is a tiebreak rule nobody asked about
     * and everybody has to read.
     *
     * The coin keeps its own line. That one is not a tiebreak the player
     * lost on a technicality — it is the game admitting there was nothing
     * to choose between them, and it is the only one worth a sentence.
     *
     * The percentages went with the wording. `tiebreak` is still on the
     * result for the battle report, which is where a number like that
     * belongs.
     */
    case "kingHp":
    case "totalHp":
    case "aliveCount":
      return t("sbc89487", "הזמן נגמר, הקרב הסתיים");
    case "coinFlip":
      return t("s156d757", "הזמן נגמר, הקרב הסתיים. שניכם בתיקו מוחלט. הטלתי מטבע כדי לקבוע מי המנצח");
  }
}
