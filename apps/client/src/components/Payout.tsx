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
export function Payout({ award }: { award: Award | null }) {
  if (!award) return null;
  const done = award.moved.filter((c) => c.done).length;
  if (!award.nachos && !award.chests.length && !done) return null;

  return (
    <p className="payout">
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
        <span key={i} className="payout__bit payout__bit--chest">
          <Icon name="chest" size={19} /> תיבה מחכה לך!
        </span>
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
 */
function NextChestHint({ award }: { award: Award }) {
  const bar = nachoBar(award.total);
  if (bar.toGo > 2) return null;
  return (
    <span className="payout__near">
      עוד {bar.toGo} {bar.toGo === 1 ? "נאצ'וס" : "נאצ'וסים"} ותיבה
    </span>
  );
}
