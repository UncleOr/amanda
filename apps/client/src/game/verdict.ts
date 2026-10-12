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
      /*
       * `tb`, not `t`. It was `t`, which SHADOWED the translator imported at
       * the top of this file — so the one sentence inside this block is the
       * one sentence in here the codemod could not convert, and it shipped
       * in Hebrew to English players. A four-line scope, a one-letter name,
       * and the bug is invisible because the code still compiles.
       */
      const tb = result.tiebreak!;
      const mine = result.winner === "A" ? tb.b : tb.a;
      const theirs = result.winner === "A" ? tb.a : tb.b;
      return tf(
        "sa74dbef",
        "נגמר הזמן ושני המלכים שרדו — הוכרע לפי חיי המלך: {0} שלך מול {1} של היריב.",
        pct(iWon ? theirs : mine),
        pct(iWon ? mine : theirs),
      );
    }
    case "totalHp":
      return t("sd1c6f72", "נגמר הזמן והמלכים שרדו עם אותו אחוז חיים — הוכרע לפי סך החיים על הלוח.");
    case "aliveCount":
      return t("s3d96736", "נגמר הזמן והחיים היו שווים — הוכרע לפי מספר הקלפים ששרדו.");
    case "coinFlip":
      return t("s9726494", "נגמר הזמן והכול יצא שווה לחלוטין — הוכרע בהטלת מטבע.");
  }
}
