/**
 * The moments that earn an achievement, and the only place that watches for
 * them.
 *
 * `achievements.ts` decides WHAT is earned and tells Google; this decides
 * WHEN to ask. The split is on purpose — that file is pure and tested, this
 * one is three `useEffect`s that cannot be — and it is why this file is as
 * short as it is.
 *
 * ═══ WHY A HOOK AND NOT A CALL AT EACH SITE ═══
 *
 * The first draft of this put `report()` wherever something good happened.
 * That is four or five call sites, each of which has to remember to fire,
 * and every new screen is a fifth chance to forget. A player can also earn
 * `cards_10` without a match ending at all — a chest opened on the home
 * screen does it — so "report after a battle" was never going to be enough.
 *
 * One hook, mounted once in App, watching the account. Anything that changes
 * the album, the trophies or the tutorial flag is reported by the fact that
 * it changed, whatever caused it.
 */
import { useEffect, useRef } from "react";
import { CATALOG, collectableBySeries } from "../data/catalog";
import { outcomeOf, report, step, type Snapshot } from "./achievements";
import type { Account } from "./account";
import type { MatchApi } from "./useMatch";

/*
 * How many cards each family can give you — the same count the album screen
 * prints under each series, from the same function, so "a whole family"
 * means on Google's side exactly what the 7/10 on screen means.
 *
 * It excludes the two cards that are not prizes, which is what makes "the
 * whole album" a number anybody can reach: it was 52 and Amanda was one of
 * them. Read fresh each time, because the admin panel can add a card while
 * the game is running.
 */

/**
 * The account as the decider wants it.
 *
 * A guest has no account and still deserves what this match earned, so null
 * is a snapshot rather than a refusal: everything it would have contributed
 * is simply absent, and `earned()` ORs a list together, so nothing is lost
 * but the things a guest genuinely has not got.
 */
function snapshotOf(a: Account | null): Snapshot {
  return {
    tutorialDone: a?.tutorialDone ?? false,
    trophies: a?.trophies ?? 0,
    album: new Set(a ? a.album.keys() : []),
    seriesSizes: collectableBySeries(),
    seriesOf: (cardId) => CATALOG.get(cardId)?.seriesId,
  };
}

export function useAchievements(m: MatchApi): void {
  const account = m.account;

  /*
   * ═══ EVERYTHING THE ACCOUNT ALONE EARNS ═══
   *
   * Keyed on a signature rather than on the account object, which is rebuilt
   * on every refresh and would otherwise re-report the same eleven
   * achievements several times a minute. Unlocking twice is harmless on
   * Google's side; a network call per render is not.
   */
  const sig = account
    ? `${account.tutorialDone}|${account.trophies}|${account.album.size}`
    : "";
  const lastSig = useRef<string | null>(null);
  useEffect(() => {
    if (!account || sig === lastSig.current) return;
    lastSig.current = sig;
    report(snapshotOf(account));
  }, [account, sig]);

  /*
   * ═══ AND WHAT THE MATCH THAT JUST ENDED EARNED ═══
   *
   * Guarded by the identity of the result object, not by the phase: a
   * rematch runs down the same socket and returns to `result` with a new
   * BattleResult, and a phase-only guard would report the first match twice
   * and the second not at all.
   */
  const reported = useRef<unknown>(null);
  useEffect(() => {
    const result = m.result;
    if (m.phase !== "result" || !result || reported.current === result) return;
    reported.current = result;
    /*
     * A lesson is a scripted match against a board Amanda chose, and the
     * playground is both boards being yours. Neither is a win.
     */
    if (m.lesson > 0 || m.playground) return;
    const outcome = outcomeOf(result, m.mySide, m.vsFriend);
    report(snapshotOf(account), outcome);
    if (outcome.won) {
      // Both counters, every win. Google holds the totals; see step().
      step("wins_10");
      step("wins_50");
    }
  }, [m.phase, m.result, m.mySide, m.vsFriend, m.lesson, m.playground, account]);
}
