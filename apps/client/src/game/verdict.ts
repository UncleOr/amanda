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
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  switch (result.winReason) {
    case "kingDown":
      return tf("s313e3b4", "המלך {0} נפל — זה מסיים את הקרב מיד.", whose);
    case "kingHp": {
      const t = result.tiebreak!;
      const mine = result.winner === "A" ? t.b : t.a;
      const theirs = result.winner === "A" ? t.a : t.b;
      return `נגמר הזמן ושני המלכים שרדו — הוכרע לפי חיי המלך: ${pct(
        iWon ? theirs : mine,
      )} שלך מול ${pct(iWon ? mine : theirs)} של היריב.`;
    }
    case "totalHp":
      return t("sd1c6f72", "נגמר הזמן והמלכים שרדו עם אותו אחוז חיים — הוכרע לפי סך החיים על הלוח.");
    case "aliveCount":
      return t("s3d96736", "נגמר הזמן והחיים היו שווים — הוכרע לפי מספר הקלפים ששרדו.");
    case "coinFlip":
      return t("s9726494", "נגמר הזמן והכול יצא שווה לחלוטין — הוכרע בהטלת מטבע.");
  }
}
