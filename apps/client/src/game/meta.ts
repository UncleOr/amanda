/**
 * The client side of nachos and challenges.
 *
 * Three calls, and the shape of all three is the same: the browser asks, the
 * server decides. Nothing in this file works out what a match was worth —
 * `/api/meta/solo` is handed the two boards and re-runs the battle itself (see
 * apps/server/src/solo.ts), so the number that comes back is the server's and
 * the browser is only reporting what it played.
 */
import { authToken, serverHttp } from "./account";
import type { Placement } from "@amanda/engine";
import type { BotLevel, Challenge } from "@amanda/shared";

/** One live challenge, and how far along you are. */
export interface Standing extends Challenge {
  progress: number;
  done: boolean;
  claimed: boolean;
}

/** What a finished match paid. */
export interface Award {
  nachos: number;
  /** Trophies the match added. Only ever from beating the computer. */
  trophies: number;
  /** True when the day's ceiling on solo trophies trimmed what it paid. */
  cappedOut: boolean;
  /** The lifetime count after this match. The bar is this mod NACHOS_PER_CHEST. */
  total: number;
  /** Chest kinds the nacho bar filled. Usually none, sometimes one. */
  chests: string[];
  moved: Array<{ id: string; progress: number; need: number; done: boolean }>;
  /** The server's own grade for the match, 1–10. */
  score?: number;
  won?: boolean;
}

const NOTHING: Award = { nachos: 0, trophies: 0, cappedOut: false, total: 0, chests: [], moved: [] };

/**
 * Today's challenges, with this player's progress.
 *
 * Works signed out: a guest gets the same six at zero, because the point of
 * showing somebody a locked thing is that they can see what is in it.
 */
export async function loadChallenges(): Promise<Standing[]> {
  const base = serverHttp();
  if (!base) return [];
  try {
    const token = await authToken();
    const res = await fetch(`${base}/api/meta`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { challenges?: Standing[] };
    return body.challenges ?? [];
  } catch {
    // A home screen without today's challenges is a home screen. Nothing here
    // is allowed to be the reason a child cannot press play.
    return [];
  }
}

/**
 * Report a match played against the bot, and collect what it was worth.
 *
 * `theirs` is the opponent's board, which the server needs because it replays
 * the battle rather than believing the outcome — and because the board is what
 * vouches for the difficulty setting. Returns nothing at all when there is no
 * account to credit, which includes every guest.
 */
export async function reportSolo(opts: {
  seed: number;
  mine: Placement[];
  theirs: Placement[];
  /**
   * Which setting the bot was on. The server does not simply believe it — it
   * caps the claim by how strong the opponent board actually is, and an easy
   * board is paid as easy whatever this says (packages/shared/src/
   * soloTrophies.ts).
   */
  level: BotLevel;
}): Promise<Award> {
  const base = serverHttp();
  if (!base) return NOTHING;
  try {
    const token = await authToken();
    if (!token) return NOTHING;
    const res = await fetch(`${base}/api/meta/solo`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) return NOTHING;
    return (await res.json()) as Award;
  } catch {
    return NOTHING;
  }
}

/** Take the reward for a finished challenge. Null when it worked. */
export async function claimChallenge(challengeId: string): Promise<string | null> {
  const base = serverHttp();
  if (!base) return "אין חיבור לשרת";
  try {
    const token = await authToken();
    if (!token) return "צריך חשבון";
    const res = await fetch(`${base}/api/meta/claim`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) return null;
    return (
      {
        expired: "האתגר הזה כבר לא פעיל.",
        notDone: "עוד לא סיימת את האתגר.",
        claimed: "כבר לקחת את הפרס.",
      }[body.error ?? ""] ?? "לא הצלחתי. נסה שוב."
    );
  } catch (err) {
    return (err as Error).message;
  }
}
