import { useCallback, useEffect, useState } from "react";
import { periodEndsOn, type Period } from "@amanda/shared";
import { challengesSoFar, claimChallenge, loadChallenges, type Standing } from "../game/meta";
import { Icon } from "./Icon";
import { Lock } from "./SignedInOnly";

/**
 * Today's challenges, on the home screen.
 *
 * Or asked for them to be *"prominent, pretty and inviting on the main
 * screen"*, which rules out the usual place for them — a tab inside a menu
 * nobody opens. They sit in the column with the arena ladder and the nacho
 * bar, because all three answer the same question: what am I two games away
 * from.
 *
 * ═══ WHY A GUEST SEES THEM ═══
 *
 * Unclaimed and at zero, but visible. Or's rule for the whole screen after he
 * saw how many padlocks a first visit had on it — *"open the album to guests,
 * leave only the shop, friends and online play locked"* — and the same logic
 * applies here: a hidden thing persuades nobody. A child who can see that
 * today's challenge pays fourteen diamonds has a reason to ask to be signed
 * in. A child who sees nothing does not.
 */

const WHEN: Record<Period, string> = {
  daily: "היום",
  weekly: "השבוע",
  monthly: "החודש",
};

/** How long is left, in the roundest words that are still true. */
function timeLeft(period: Period): string {
  const ends = new Date(`${periodEndsOn(period)}T00:00:00+03:00`).getTime();
  const hours = Math.max(0, Math.round((ends - Date.now()) / 3_600_000));
  if (hours < 1) return "עוד פחות משעה";
  if (hours < 24) return `עוד ${hours} שעות`;
  const days = Math.round(hours / 24);
  return days === 1 ? "עוד יום" : `עוד ${days} ימים`;
}

export function Challenges({
  signedIn,
  /** Run this, or show the sign-in prompt — see SignedInOnly.tsx. */
  gated,
  /** Run after a reward is taken, so the purse on screen catches up. */
  onClaimed,
  /** Bumped by the caller after a match, to re-read the progress. */
  reloadKey,
}: {
  signedIn: boolean;
  gated: (open: () => void) => () => void;
  onClaimed?: () => void;
  reloadKey?: unknown;
}) {
  /*
   * Seeded from what the server last said, so the panel has something to draw
   * on its very first frame. Or: *"the challenges window takes a long time to
   * open."* It was opening empty and then waiting — see challengesSoFar.
   */
  const [live, setLive] = useState<Standing[]>(challengesSoFar);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which period is showing. Daily first: it is the one that expires soonest. */
  const [tab, setTab] = useState<Period>("daily");

  const reload = useCallback(() => {
    void loadChallenges().then(setLive);
  }, []);

  useEffect(reload, [reload, reloadKey]);

  const take = async (id: string) => {
    setBusy(id);
    setError(null);
    const failed = await claimChallenge(id);
    setBusy(null);
    if (failed) setError(failed);
    else {
      reload();
      onClaimed?.();
    }
  };

  // Nothing to show is not an error: the server may simply not be reachable,
  // and an empty box on the home screen is worse than no box.
  if (!live.length) return null;

  const showing = live.filter((c) => c.period === tab);
  const ready = (c: Standing) => c.done && !c.claimed;

  return (
    <section className="quests" aria-label="אתגרים">
      <header className="quests__head">
        <h2>
          <Icon name="challenge" size={18} /> אתגרים
        </h2>
        <nav className="quests__tabs">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => {
            const waiting = live.filter((c) => c.period === p && ready(c)).length;
            return (
              <button
                key={p}
                className={p === tab ? "is-on" : ""}
                onClick={() => setTab(p)}
                title={timeLeft(p)}
              >
                {WHEN[p]}
                {/* A dot, not a number: "there is something here" is the whole
                    message, and a badge that counts invites counting. */}
                {waiting > 0 && <i className="quests__dot" aria-label="יש פרס לקחת" />}
              </button>
            );
          })}
        </nav>
      </header>

      <p className="quests__clock">{timeLeft(tab)}</p>

      <ul className="quests__list">
        {showing.map((c) => (
          <li key={c.id} className={ready(c) ? "is-ready" : c.claimed ? "is-done" : ""}>
            <span className="quests__what">{c.he}</span>
            <span className="quests__bar" aria-hidden="true">
              <i style={{ width: `${Math.min(1, c.progress / c.need) * 100}%` }} />
            </span>
            <span className="quests__count">
              {c.progress}/{c.need}
            </span>
            <span className="quests__pay">
              {c.reward.diamonds ? (
                <>
                  <Icon name="gem" size={14} /> {c.reward.diamonds}
                </>
              ) : (
                <>
                  <Icon name="nacho" size={14} /> {c.reward.nachos}
                </>
              )}
            </span>
            {c.claimed ? (
              <span className="quests__taken">נלקח</span>
            ) : (
              /*
               * A LOCK, not a dead button.
               *
               * A guest who finishes today's challenge and finds a greyed-out
               * "take" has been told nothing. The padlock is the same one on
               * the shop and on online play, and pressing it opens the same
               * "what an account gives you" prompt — which is the whole
               * mechanism Or asked for: a child wants the thing and asks to
               * be signed in.
               */
              <button
                className="quests__take"
                disabled={!c.done || busy === c.id}
                onClick={signedIn ? () => void take(c.id) : gated(() => {})}
              >
                {busy === c.id ? "…" : "לקחת"}
                {!signedIn && <Lock />}
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="warn">{error}</p>}
    </section>
  );
}

/**
 * The same challenges, as a button — for a screen with no room for the list.
 *
 * It asks the server the same question the list does, which looks wasteful
 * and is not: the answer is tiny, it is asked once when the screen opens, and
 * the alternative is lifting the state into the home screen so that a block
 * which is usually not rendered can tell a button which usually is not what
 * to say. One small fetch is cheaper than that coupling.
 *
 * The COUNT is of challenges that are finished and unclaimed — not of
 * challenges. "3" meaning "there are three today" is noise; "3" meaning
 * "three rewards are sitting there" is the reason to tap.
 */
export function ChallengeButton({
  onOpen,
  reloadKey,
}: {
  onOpen: () => void;
  reloadKey?: unknown;
}) {
  const count = (live: Standing[]) => live.filter((c) => c.done && !c.claimed).length;
  // Seeded from the remembered answer for the same reason the list is: the
  // dot should not have to wait for a round trip to say what it already knows.
  const [ready, setReady] = useState(() => count(challengesSoFar()));
  useEffect(() => {
    void loadChallenges().then((live) => setReady(count(live)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return (
    <button className="quests__open" onClick={onOpen}>
      <Icon name="challenge" size={20} />
      <span>אתגרים</span>
      {ready > 0 && <i className="quests__dot quests__dot--big">{ready}</i>}
    </button>
  );
}
