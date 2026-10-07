import { nachoBar } from "@amanda/shared";
import { Icon } from "./Icon";
import type { Award } from "../game/meta";

/**
 * What the match just paid, on the result screen.
 *
 * Or's whole ask for this loop was that *"the player is always one or two
 * games away from some goal"* — and a reward the player never sees is not a
 * reward, it is a database row. So the moment a battle ends, before anything
 * else on the screen asks what to do next, this says what moved.
 *
 * ═══ IT ARRIVES LATE, AND THAT IS FINE ═══
 *
 * The number comes back from the server, which re-ran the battle itself
 * (apps/server/src/solo.ts), so it is a round trip behind the result. Nothing
 * waits for it: the screen is complete without it and this appears when it
 * lands. A missing answer — no account, no server, a dropped connection —
 * simply draws nothing, which is why every branch below is a guard and not a
 * placeholder.
 */
export function Payout({
  award,
  /**
   * Open the chest that was just won, here, now.
   *
   * Or: *"it would make sense that pressing 'a chest is waiting for you'
   * takes you straight to the chests."* It said where to go and then made you
   * go there — back to the home screen, find the shelf, find the chest. The
   * sentence names the thing; pressing the name should be pressing the thing.
   */
  onOpenChest,
}: {
  award: Award | null;
  onOpenChest?: () => void;
}) {
  if (!award) return null;
  const done = award.moved.filter((c) => c.done).length;
  if (!award.nachos && !award.trophies && !award.chests.length && !done && !award.cappedOut)
    return null;

  return (
    <p className="payout">
      {/* Trophies first: they are the only thing here that moves the arena. */}
      {award.trophies > 0 && (
        <span className="payout__bit payout__bit--cup">
          <Icon name="win" size={17} /> +{award.trophies}
        </span>
      )}
      {award.nachos > 0 && (
        <span className="payout__bit">
          <Icon name="nacho" size={17} /> +{award.nachos}
        </span>
      )}
      {/*
        A chest is the event, so it gets a sentence rather than a number. It
        is already sitting on the home screen by the time this is read — the
        server minted it when the bar filled — and "waiting for you" is where
        to go and look.
      */}
      {award.chests.map((kind, i) => (
        <button
          key={i}
          type="button"
          className="payout__bit payout__bit--chest"
          onClick={onOpenChest}
          disabled={!onOpenChest}
        >
          <Icon name="chest" size={19} /> תיבה מחכה לך!
        </button>
      ))}
      {done > 0 && (
        <span className="payout__bit payout__bit--quest">
          <Icon name="challenge" size={17} />{" "}
          {done === 1 ? "אתגר הושלם" : `${done} אתגרים הושלמו`}
        </span>
      )}
      {/* How close the next one is, so the screen that says "play again"
          also says why. Only when the bar is nearly full — "4 more" is not
          an invitation. */}
      {!award.chests.length && award.nachos > 0 && <NextChestHint award={award} />}
      {/*
        Said, rather than left looking broken.

        A win against the hard bot that pays 4 trophies instead of 12 — or
        nothing at all — is the daily ceiling doing its job, and a number that
        quietly changes is how a player decides the game is buggy. The nachos
        and the challenges carry on regardless, which is the sentence.
      */}
      {award.cappedOut && (
        <span className="payout__near">מספיק גביעים מהבוט להיום — נאצ'וס ואתגרים ממשיכים</span>
      )}
    </p>
  );
}

/**
 * "A bit more and that is a chest."
 *
 * Read off the total the SERVER sent back, not off the account on screen —
 * that copy is the one from before the match, which makes it the only number
 * here that would be wrong. Shown only when the bar is nearly full: "4 more"
 * is a fact, not an invitation.
 *
 * ═══ "נאצ'וס" IS ALREADY PLURAL ═══
 *
 * This had a singular/plural switch on it and wrote "נאצ'וסים" for anything
 * above one. Or: *"of course — you don't say נאצ'וסים. נאצ'וס is already
 * plural."* He is right; it is a loan word that arrived in the plural, and
 * pluralising it again is the English speaker's mistake. There is no switch
 * now because there is nothing to switch between.
 */
function NextChestHint({ award }: { award: Award }) {
  const bar = nachoBar(award.total);
  if (bar.toGo > 2) return null;
  return <span className="payout__near">עוד {bar.toGo} נאצ'וס ותיבה</span>;
}
