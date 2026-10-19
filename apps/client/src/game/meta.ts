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
import { line as t } from "./copy";

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
 * The last answer the server gave, kept so the panel can open instantly.
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * Or: *"the challenges window takes a long time to open."* It did, and the
 * reason was not the server being slow. The list only draws once it has data
 * (`if (!live.length) return null`), and opening the panel mounted a FRESH
 * copy that started from nothing and asked again — so every open was a whole
 * round trip of blank panel, every time, including the second time.
 *
 * Meanwhile the button on the home screen had already asked the same question
 * and had the answer sitting in a state hook nobody else could reach.
 *
 * So the answer is remembered here, where both of them can see it. The panel
 * paints from it on its first frame and the refresh lands underneath; the
 * only open that still waits is the first one of the visit, which is the one
 * where there is genuinely nothing to show yet.
 */
let lastChallenges: Standing[] = [];

/** What the server last said, without asking it again. Possibly stale, never wrong-shaped. */
export function challengesSoFar(): Standing[] {
  return lastChallenges;
}

/*
 * ═══ AND WHEN IT CHANGES, WHOEVER IS SHOWING IT HEARS ═══
 *
 * Or: *"when you take a challenge the green dot is still there, and it takes
 * a while to go away."*
 *
 * It did, and the wait was a round trip. The dot on the home screen counts
 * the remembered answer, and the remembered answer only ever changed when
 * the SERVER was asked again — so taking a prize left the button counting a
 * challenge that had just been claimed, until the next fetch came back. On
 * the screen that is a prize taken, a prize flying up to the bar, a panel
 * closing, and a dot still sitting there saying there is something to take.
 *
 * The claim is known here the moment the server says yes. So it is written
 * down here, and anybody showing it is told.
 */
type Listener = (live: Standing[]) => void;
const challengeWatchers = new Set<Listener>();

/** Hear about every change to the remembered challenges. Returns the way off. */
export function watchChallenges(fn: Listener): () => void {
  challengeWatchers.add(fn);
  return () => {
    challengeWatchers.delete(fn);
  };
}

/** The same list with one challenge marked taken. Pure, so it can be tested. */
export function markClaimed(live: Standing[], challengeId: string): Standing[] {
  return live.map((c) => (c.id === challengeId ? { ...c, claimed: true } : c));
}

function remember(live: Standing[]): void {
  lastChallenges = live;
  for (const fn of challengeWatchers) fn(live);
}

/** A gold chest and some diamonds, because it is your birthday. */
export interface BirthdayGift {
  diamonds: number;
  /** The age just turned, or 0 when no birth year is on file. */
  age: number;
}

/*
 * ═══ THE PRESENT ARRIVES ON SOMEBODY ELSE'S REQUEST ═══
 *
 * The birthday is minted by `/api/meta` — the call the home screen makes for
 * today's challenges — because that is the first thing that happens when the
 * game opens, and a present you have to go and fetch is not one.
 *
 * Which means the component that ASKS is the challenges badge, and the
 * component that has to SHOW it is App. A module-level handoff rather than a
 * prop, and it works in either order: a watcher that subscribes after the
 * answer landed is told immediately.
 *
 * ═══ AND WHETHER THE PARTY HAS BEEN THROWN IS A LOCAL QUESTION ═══
 *
 * It used to be the server's: it reported a birthday only on the visit that
 * minted the chest, and Or lost his to that. The server deployed before the
 * browser did, so the old build threw away a field it had never heard of —
 * and the row said `birthday_year = 2026` for ever after. The present was in
 * his album; the party never happened.
 *
 * The server now says "it is your birthday" all day, every time it is asked,
 * and THIS decides whether it has already been celebrated here. A year in
 * localStorage: wrong only if somebody clears their browser on their own
 * birthday, which costs them a second showing of a card they liked.
 */
const SHOWN = "amanda.birthday.shown";

function alreadyShown(year: number): boolean {
  try {
    return localStorage.getItem(SHOWN) === String(year);
  } catch {
    // A private window has no shelf to leave it on. Showing it twice is a
    // better failure than not showing it at all.
    return false;
  }
}

let pending: BirthdayGift | null = null;
const watchers = new Set<(gift: BirthdayGift) => void>();

export function onBirthday(fn: (gift: BirthdayGift) => void): () => void {
  if (pending) fn(pending);
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** Once it has been shown, it is over for this year. */
export function birthdayShown(): void {
  pending = null;
  try {
    localStorage.setItem(SHOWN, String(new Date().getFullYear()));
  } catch {
    /* see alreadyShown */
  }
}

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
    const body = (await res.json()) as { challenges?: Standing[]; birthday?: BirthdayGift | null };
    if (body.birthday && !alreadyShown(new Date().getFullYear())) {
      pending = body.birthday;
      for (const w of watchers) w(body.birthday);
    }
    // Only a real answer is remembered. An empty one means the server could
    // not be reached, and replacing a good list with nothing would make the
    // panel go blank on a dropped connection.
    if (body.challenges?.length) remember(body.challenges);
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
  if (!base) return t("sbd36b97", "אין חיבור לשרת");
  try {
    const token = await authToken();
    if (!token) return t("s7a0587d", "צריך חשבון");
    const res = await fetch(`${base}/api/meta/claim`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      /*
       * Claimed, now, without asking anybody. The server has just said so,
       * and the next fetch will say the same thing a second later — see
       * watchChallenges for what that second cost.
       */
      remember(markClaimed(lastChallenges, challengeId));
      return null;
    }
    return (
      {
        expired: t("sc65088a", "האתגר הזה כבר לא פעיל."),
        notDone: t("sc6b6e23", "עוד לא סיימת את האתגר."),
        claimed: t("s1322daa", "כבר לקחת את הפרס."),
      }[body.error ?? ""] ?? t("sbf13716", "לא הצלחתי. נסה שוב.")
    );
  } catch (err) {
    return (err as Error).message;
  }
}
