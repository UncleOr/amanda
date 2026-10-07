import type { BattleResult } from "@amanda/engine";

/**
 * Why the battle ended, in a sentence.
 *
 * Shared, because two screens say it: the arena speaks it over the last
 * frame, and the result card prints it underneath. It lived in App.tsx while
 * both of those were in App.tsx; now that they are not, one copy of the
 * wording is the point.
 */
export function verdictText(result: BattleResult, iWon: boolean): string {
  const whose = iWon ? "של היריב" : "שלך";
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  switch (result.winReason) {
    case "kingDown":
      return `המלך ${whose} נפל — זה מסיים את הקרב מיד.`;
    case "kingHp": {
      const t = result.tiebreak!;
      const mine = result.winner === "A" ? t.b : t.a;
      const theirs = result.winner === "A" ? t.a : t.b;
      return `נגמר הזמן ושני המלכים שרדו — הוכרע לפי חיי המלך: ${pct(
        iWon ? theirs : mine,
      )} שלך מול ${pct(iWon ? mine : theirs)} של היריב.`;
    }
    case "totalHp":
      return "נגמר הזמן והמלכים שרדו עם אותו אחוז חיים — הוכרע לפי סך החיים על הלוח.";
    case "aliveCount":
      return "נגמר הזמן והחיים היו שווים — הוכרע לפי מספר הקלפים ששרדו.";
    case "coinFlip":
      return "נגמר הזמן והכול יצא שווה לחלוטין — הוכרע בהטלת מטבע.";
  }
}
