/**
 * The client side of the prize tunnel.
 *
 * Two calls and a memory. What is ON the track is in @amanda/shared and ships
 * with the game, so the tunnel draws itself completely on a phone with no
 * signal — what the server is asked is only the two things it owns: how far
 * this player has climbed, and which prizes they have already taken.
 *
 * ═══ WHY THE LAST ANSWER IS KEPT HERE ═══
 *
 * The same reason the challenges keep theirs (meta.ts): the strip on the home
 * screen and the panel it opens ask the same question, and a panel that
 * starts from nothing shows a blank track for a whole round trip every time
 * it is opened. The strip's answer is the panel's first frame.
 */
import { TUNNEL, stopsReached, type TunnelLane } from "@amanda/shared";
import { authToken, serverHttp } from "./account";
import { CHESTS_CHANGED } from "./meta";
import { line as t } from "./copy";

export interface TunnelState {
  /** The high-water mark the track is measured against. */
  best: number;
  /** How many stops are open. */
  reached: number;
  claimed: Array<{ stop: number; lane: TunnelLane }>;
  /**
   * True once the server has actually answered.
   *
   * A guest gets 401 and an offline phone gets nothing, and in both cases the
   * track is still drawn — with nothing claimable, which is the truth. The
   * difference matters to the screen: "nothing is waiting" and "we have not
   * been told yet" look identical and mean different things.
   */
  known: boolean;
}

const EMPTY: TunnelState = { best: 0, reached: 0, claimed: [], known: false };

let last: TunnelState = EMPTY;

/** Whatever was last heard. Drawn immediately, refreshed underneath. */
export function lastTunnel(): TunnelState {
  return last;
}

export async function loadTunnel(): Promise<TunnelState> {
  const base = serverHttp();
  if (!base) return last;
  try {
    const token = await authToken();
    if (!token) return last;
    const res = await fetch(`${base}/api/meta/tunnel`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return last;
    const body = (await res.json()) as Omit<TunnelState, "known">;
    last = {
      best: body.best ?? 0,
      reached: body.reached ?? stopsReached(body.best ?? 0),
      claimed: Array.isArray(body.claimed) ? body.claimed : [],
      known: true,
    };
    return last;
  } catch {
    return last;
  }
}

/** Null when it worked; a sentence to show when it did not. */
export async function claimStop(stop: number, lane: TunnelLane): Promise<string | null> {
  const base = serverHttp();
  if (!base) return t("sac7c3e4", "אין חיבור לשרת");
  try {
    const token = await authToken();
    if (!token) return t("s81e3d80", "צריך חשבון");
    const res = await fetch(`${base}/api/meta/tunnel/claim`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ stop, lane }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // Written once and used twice: two copies of one sentence are two ids in
    // the copy document, and Or would have to write the same line twice.
    const sorry = t("s5502460", "לא הצלחתי. נסה שוב.");
    if (res.ok) {
      // Taken, now, without asking anybody: the server has just said so and
      // the next load will say the same thing. Same bargain as a challenge.
      last = { ...last, claimed: [...last.claimed, { stop, lane }] };
      /*
       * ═══ AND THE SHELF HAS TO LOOK AGAIN ═══
       *
       * A chest from the tunnel arrives SHUT, on the home screen's shelf
       * (see the server). The shelf asks what is waiting once, when the home
       * screen mounts — and this panel is opened over a home screen that is
       * already up, so without this the chest is won behind an unchanged
       * list and stays invisible until something remounts it. The same
       * sentence Or caught about a challenge's chest.
       */
      const won = lane === "pass" ? TUNNEL[stop]?.pass : TUNNEL[stop]?.free;
      if (won?.chest && typeof window !== "undefined")
        window.dispatchEvent(new Event(CHESTS_CHANGED));
      return null;
    }
    return (
      {
        locked: t("sa0f25ad", "עוד לא הגעת לתחנה הזאת."),
        claimed: t("sc69e310", "כבר לקחת את הפרס."),
        notForSale: t("sad02391", "המסלול הזה עוד לא נפתח."),
        noSuchStop: sorry,
      }[body.error ?? ""] ?? sorry
    );
  } catch (err) {
    return (err as Error).message;
  }
}

/** Has this prize been taken? */
export function isClaimed(state: TunnelState, stop: number, lane: TunnelLane): boolean {
  return state.claimed.some((c) => c.stop === stop && c.lane === lane);
}

/**
 * How many prizes are sitting there waiting to be taken.
 *
 * The free lane only: the Legendary Pass cannot be claimed yet, and a badge
 * counting prizes nobody can have would be an advertisement wearing a
 * notification's clothes.
 */
export function waiting(state: TunnelState): number {
  if (!state.known) return 0;
  let n = 0;
  for (let i = 0; i < Math.min(state.reached, TUNNEL.length); i++)
    if (!isClaimed(state, i, "free")) n++;
  return n;
}
