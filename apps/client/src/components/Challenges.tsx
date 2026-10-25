import { useCallback, useEffect, useState } from "react";
import { periodEndsOn, type Period } from "@amanda/shared";
import {
  challengesSoFar,
  claimChallenge,
  loadChallenges,
  watchChallenges,
  type Standing,
} from "../game/meta";
import { flyReward } from "../game/reward";
import { Icon } from "./Icon";
import { Lock } from "./SignedInOnly";
import { line as t, lineF as tf } from "../game/copy";
import { say } from "../game/lang";

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
  daily: t("sfbba2d0", "היום"),
  weekly: t("sb2dcc21", "השבוע"),
  monthly: t("scbbd32e", "החודש"),
};

/** How long is left, in the roundest words that are still true. */
function timeLeft(period: Period): string {
  const ends = new Date(`${periodEndsOn(period)}T00:00:00+03:00`).getTime();
  const hours = Math.max(0, Math.round((ends - Date.now()) / 3_600_000));
  if (hours < 1) return t("sa421571", "עוד פחות משעה");
  if (hours < 24) return tf("sde4b772", "עוד {0} שעות", hours);
  const days = Math.round(hours / 24);
  return days === 1 ? t("s58b31e8", "עוד יום") : tf("sa1356f2", "עוד {0} ימים", days);
}

export function Challenges({
  signedIn,
  /** Run this, or show the sign-in prompt — see SignedInOnly.tsx. */
  gated,
  /** Run after a reward is taken, so the purse on screen catches up. */
  onClaimed,
  /**
   * Run the moment the server says yes, BEFORE the prize flies.
   *
   * Or: *"I had a challenge, I pressed to take the things, but I didn't see
   * any cool animation."*
   *
   * On a phone this list is a modal over the home screen (see App.tsx), and
   * the places the prize flies TO — the diamond in the purse, the nacho bar
   * — are on the home screen, still in the DOM and completely covered by
   * that modal. So the animation ran every time, correctly, underneath an
   * opaque panel.
   *
   * The caller uses this to close the panel first. Nothing is lost by
   * closing it: the button has already done its job, and the prize landing
   * in the bar is the thing that replaces it.
   */
  onTaking,
  /** Bumped by the caller after a match, to re-read the progress. */
  reloadKey,
}: {
  signedIn: boolean;
  gated: (open: () => void) => () => void;
  onClaimed?: () => void;
  onTaking?: () => void;
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

  /*
   * ═══ THE PRIZE IS SEEN TO MOVE ═══
   *
   * Or: *"when you take a challenge's prize there should be an animation of
   * what was taken — the trophy, say — bursting open in a fun way, and then
   * flying up to the bar, and the numbers there going up."*
   *
   * Before this, pressing "take" turned the row grey and a number somewhere
   * else was different afterwards. Nothing connected the two, which is the
   * whole of what a prize IS: this came from that.
   *
   * The token leaves the ROW's own prize icon rather than the button, because
   * that icon is the thing being won — the gem or the nacho the child has
   * been looking at while the bar filled.
   *
   * And the reload waits for it to land. Reloading first made the count
   * change while the token was still in the air, so it arrived at a total
   * that had already gone up; see reward.ts.
   */
  const take = async (id: string, button: HTMLElement) => {
    setBusy(id);
    setError(null);
    const prize = live.find((c) => c.id === id)?.reward;
    const flyFrom = button.closest("li")?.querySelector(".quests__pay");
    const { why } = await claimChallenge(id);
    setBusy(null);
    if (why) {
      setError(why);
      return;
    }
    /*
     * Get out of the way before the prize flies — see onTaking. The
     * rectangle was measured above, while the button was still on screen,
     * so the flight still starts from where the player pressed.
     */
    onTaking?.();
    if (prize && flyFrom) {
      await flyReward({
        icon: prize.diamonds ? "gem" : "nacho",
        // Both are optional in the type and exactly one is ever set.
        amount: prize.diamonds ?? prize.nachos ?? 0,
        from: flyFrom.getBoundingClientRect(),
      });
    }
    reload();
    onClaimed?.();
  };

  // Nothing to show is not an error: the server may simply not be reachable,
  // and an empty box on the home screen is worse than no box.
  if (!live.length) return null;

  const showing = live.filter((c) => c.period === tab);
  const ready = (c: Standing) => c.done && !c.claimed;

  return (
    <section className="quests" aria-label={t("se995a4a", "אתגרים")}>
      <header className="quests__head">
        <h2>
          <Icon name="challenge" size={18} /> {t("s4b399e6", "אתגרים")}
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
                {waiting > 0 && <i className="quests__dot" aria-label={t("s8037b61", "יש פרס לקחת")} />}
              </button>
            );
          })}
        </nav>
      </header>

      <p className="quests__clock">{timeLeft(tab)}</p>

      <ul className="quests__list">
        {showing.map((c) => (
          <li key={c.id} className={ready(c) ? "is-ready" : c.claimed ? "is-done" : ""}>
            <span className="quests__what">{say(c)}</span>
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
              <span className="quests__taken">{t("sb752d13", "נלקח")}</span>
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
                onClick={
                  signedIn ? (e) => void take(c.id, e.currentTarget) : gated(() => {})
                }
              >
                {busy === c.id ? "…" : t("s1d3665c", "לקחת")}
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
  /*
   * ═══ AND THE MOMENT A PRIZE IS TAKEN ═══
   *
   * Or: *"when you take a challenge the green dot is still there, and it
   * takes a while to go away."*
   *
   * The dot is counted from the remembered answer, and that used to change
   * only when the server was asked again. Taking a prize happens in the
   * panel, which closes — and this button, still mounted underneath, went on
   * counting a challenge that had just been claimed until a fetch came back.
   *
   * meta.ts knows the moment the server says yes. This listens.
   */
  useEffect(() => watchChallenges((live) => setReady(count(live))), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button className="quests__open" onClick={onOpen}>
      <Icon name="challenge" size={20} />
      <span>{t("sac7fc13", "אתגרים")}</span>
      {ready > 0 && <i className="quests__dot quests__dot--big">{ready}</i>}
    </button>
  );
}
