/**
 * The player's account and album.
 *
 * A player never signs in. An anonymous account is created the first time the
 * game is opened, the database hands it a starting album (see
 * `grant_starter_album` in db/README.md), and later — when there is an
 * installed app — that same account can be linked to Google Play Games or Game
 * Center without any of this moving.
 *
 * EVERYTHING HERE IS OPTIONAL. If there are no keys, or the network is down,
 * or the account cannot be made, the game falls back to what it has always
 * done: a deck drawn at random from the whole catalog. A missing database must
 * never be the reason a child cannot play.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Publishable, and meant to be: row level security is what protects the data,
 * not the key. Overridable at build time for a different environment.
 */
/*
 * NOT called `URL`.
 *
 * It was, and that shadowed the global `URL` CONSTRUCTOR for this whole
 * module — so `new URL(...)` was calling a string, and every Google sign-in
 * died with "URL is not a constructor" (minified, on Or's screen, to "hh is
 * not a constructor"). The two places that need the real one are
 * comeBackTo() and cleanOAuthFromUrl(), both added in the same commit that
 * introduced the bug.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://iiviygfltyrsonioyqxm.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_j1lvAt_idYWAzD0WCEJ4ig_PR0egOzG";

/** One card in the album. */
export interface OwnedCard {
  cardId: string;
  /** How many you hold — and so how many times you may place it. */
  copies: number;
  level: number;
}

/** The youngest we let anyone play online. Mirrored by a CHECK on the row. */
export const MIN_AGE = 7;

export interface Account {
  playerId: string;
  trophies: number;
  diamonds: number;
  tutorialDone: boolean;
  nickname: string | null;
  avatar: string | null;
  /** ISO yyyy-mm-dd, or null when they have not been asked yet. */
  birthDate: string | null;
  /**
   * Who Amanda is talking to. Null is a real answer — "did not say" — and
   * falls back to the masculine, which is the Hebrew default.
   */
  gender: "boy" | "girl" | null;
  /**
   * Lifetime nachos. The bar on the home screen is the remainder — see
   * packages/shared/src/nachos.ts — and this never goes down, which is the
   * whole point of it next to trophies.
   */
  nachos: number;
  /** True once a real identity is attached and the album is safe. */
  linked: boolean;
  /** cardId → what you own of it. */
  album: Map<string, OwnedCard>;
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!SUPABASE_URL || !KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, KEY, { auth: { persistSession: true } });
  return client;
}

/**
 * Tell me when the signed-in person changes.
 *
 * ═══ WHY THIS WAS MISSING AND WHY IT MATTERS ═══
 *
 * The account was read exactly once, at boot. That is fine for every ordinary
 * visit — and wrong for the one case that is giving trouble: coming back from
 * Google. The code in the URL is exchanged for a session ASYNCHRONOUSLY by
 * supabase-js, and if that lands even a moment after the one read, the game
 * holds the old anonymous account and the player is looking at a screen that
 * says they are not signed in while the library believes they are.
 *
 * Subscribing closes that for good: whenever a session appears, changes, or
 * is refreshed, the game looks again. It also covers signing in from another
 * tab, and a token refresh after the laptop was shut.
 */
export function onAccountChange(fn: () => void): () => void {
  const sb = db();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event) => {
    // SIGNED_IN fires on every tab focus in some versions; the cheap guard is
    // that the caller re-reads and compares, which it does.
    if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED")
      fn();
  });
  return () => data.subscription.unsubscribe();
}

/**
 * What this page load saw of a sign-in, in a few words.
 *
 * Or has now hit the Google problem twice, and each time the only thing to go
 * on was "it comes back not signed in". This is the smallest thing that turns
 * that into a fact: it records what the browser actually arrived with, and
 * the profile screen prints it. It is not for players — it is so that the one
 * person debugging it can read it off a screenshot.
 */
let authTrace = "";
export function getAuthTrace(): string {
  return authTrace;
}

/** True when the build was given somewhere to store accounts. */
export const ACCOUNTS_AVAILABLE = Boolean(SUPABASE_URL && KEY);

/**
 * The match server over plain HTTP, for the small API beside the socket.
 * Derived from the websocket URL so there is only one address to configure.
 */
const SERVER_HTTP = (import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : ""))
  .replace(/^ws:/, "http:")
  .replace(/^wss:/, "https:");

/**
 * Whatever went wrong with the last sign-in, for the profile screen to show.
 *
 * Kept rather than thrown because the game must start regardless — but
 * silently starting it as a different person is what the bug was.
 */
let lastAuthError: string | null = null;
export function takeAuthError(): string | null {
  const e = lastAuthError;
  lastAuthError = null;
  return e;
}

/**
 * Where Google should send the player back to.
 *
 * ═══ A FIXED ADDRESS, NOT `window.location.href` ═══
 *
 * It used to be whatever URL the player happened to be on. That is one URL on
 * a good day and a different one on every other: a query string somebody was
 * sent, a leftover `?code=` from a previous attempt, a hash. Supabase only
 * honours a redirect that MATCHES ITS ALLOW-LIST, and silently falls back to
 * the project's Site URL when it does not — so an unexpected query string
 * does not produce an error, it produces a player who lands somewhere else
 * entirely and wonders why they are not signed in.
 *
 * One canonical address instead: the app's own base. It is the same every
 * time, it is the one written in docs/SUPABASE-SETUP.md, and it is therefore
 * the one that can actually be allow-listed and checked.
 */
function comeBackTo(): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  return url.toString();
}

/** Is this page load a return from an OAuth provider, and did it go well? */
function oauthReturn(): { code: string | null; error: string | null } {
  if (typeof window === "undefined") return { code: null, error: null };
  const q = new URLSearchParams(window.location.search);
  // Implicit-flow providers put it in the hash instead.
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const err = q.get("error_description") ?? q.get("error") ?? h.get("error_description") ?? h.get("error");
  return { code: q.get("code"), error: err };
}

/**
 * Take the sign-in debris out of the address bar.
 *
 * Not cosmetic: a `?code=` left in the URL is a code that gets re-submitted on
 * every reload and on every share of that link, and it is already spent.
 */
function cleanOAuthFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const k of ["code", "error", "error_description", "error_code", "state"])
    url.searchParams.delete(k);
  if (url.hash.includes("access_token") || url.hash.includes("error")) url.hash = "";
  window.history.replaceState({}, "", url.toString());
}

/**
 * Sign in (silently, anonymously) and read the album back.
 *
 * Returns null on any failure at all, which the caller treats as "play without
 * an account". The reason is logged rather than shown: a child does not need
 * to read about a network error, they need the game to start.
 */
export async function loadAccount(): Promise<Account | null> {
  const sb = db();
  if (!sb) return null;
  try {
    /*
     * ═══ COMING BACK FROM GOOGLE IS NOT THE SAME AS ARRIVING ═══
     *
     * Or: "it doesn't connect me to Google after I pick a Google account."
     *
     * This function used to do one thing when there was no session: create a
     * brand new anonymous one. On an ordinary first visit that is exactly
     * right. On the way back from Google it is a disaster — the sign-in is
     * still in flight, and making a new guest account throws away the one the
     * player was being signed into and leaves them looking at an empty album,
     * which reads as "it didn't work" because it didn't.
     *
     * A return from Google carries `?code=` (or `?error=`). While one is in
     * the URL, nothing here will create an account: either the exchange
     * succeeds and that is the session, or it fails and the failure is
     * REPORTED rather than papered over with a new guest.
     */
    const returning = oauthReturn();
    authTrace = [
      returning.code ? "code:yes" : "code:no",
      returning.error ? `err:${returning.error.slice(0, 40)}` : null,
      window.matchMedia?.("(display-mode: standalone)").matches ? "pwa" : "browser",
    ]
      .filter(Boolean)
      .join(" · ");
    if (returning.error) {
      cleanOAuthFromUrl();
      /*
       * ═══ "Identity is already linked to another user" ═══
       *
       * This is the one Or actually hit, and the trace on his screen is what
       * named it. It means the Google account he picked is already attached
       * to an Amanda account he made earlier — so LINKING it to the guest
       * account in this browser can never succeed, no matter how many times
       * he tries.
       *
       * There is a right answer and it is not an error message: sign him
       * INTO that account. He gets his real album back. What he loses is
       * whatever this browser collected as a guest, which was never saved
       * anywhere and is the entire reason to sign in.
       *
       * `linkGoogle` has this fallback already — but it only runs when
       * linkIdentity fails IMMEDIATELY. This failure happens at Supabase,
       * after the trip to Google, and comes home as a parameter in the URL,
       * so nothing on the client was left to catch it.
       */
      if (/already.*linked|identity_already_exists/i.test(returning.error)) {
        lastAuthError = null;
        const { error } = await sb.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: comeBackTo() },
        });
        // The browser is leaving for Google; nothing after this runs.
        if (!error) return null;
        lastAuthError = "חשבון הגוגל הזה כבר שייך לחשבון אחר, ולא הצלחתי להיכנס אליו.";
      } else {
        lastAuthError = returning.error;
      }
      // Fall through: the player still gets to play, as a guest, and the
      // profile screen can tell them what happened.
    }

    const existing = await sb.auth.getSession();
    let userId = existing.data.session?.user.id;
    authTrace += existing.data.session
      ? existing.data.session.user.is_anonymous
        ? " · session:guest"
        : " · session:signed-in"
      : " · session:none";

    if (!userId && returning.code) {
      // supabase-js exchanges the code itself when it can. If we are here it
      // did not — most often because the verifier it stored is not in this
      // browsing context, which is what an in-app browser on a phone does.
      lastAuthError =
        "ההתחברות לגוגל לא הושלמה. נסה שוב מהדפדפן הרגיל ולא מתוך אפליקציה אחרת.";
      cleanOAuthFromUrl();
      return null;
    }
    if (returning.code) cleanOAuthFromUrl();

    if (!userId) {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      userId = data.user?.id;
    }
    if (!userId) return null;

    // The row and its starting album are created by a trigger on sign-up, so
    // on a brand new account these can race it. One retry covers that.
    for (let attempt = 0; attempt < 2; attempt++) {
      const [{ data: player }, { data: cards }] = await Promise.all([
        sb
          .from("players")
          .select("trophies, diamonds, nachos, tutorial_done, nickname, avatar, birth_date, gender")
          .eq("id", userId)
          .maybeSingle(),
        sb.from("player_cards").select("card_id, copies, level").eq("player_id", userId),
      ]);
      if (player) {
        const album = new Map<string, OwnedCard>();
        for (const row of cards ?? [])
          album.set(row.card_id, {
            cardId: row.card_id,
            copies: row.copies,
            level: row.level,
          });
        return {
          playerId: userId,
          trophies: player.trophies ?? 0,
          diamonds: player.diamonds ?? 0,
          nachos: player.nachos ?? 0,
          tutorialDone: player.tutorial_done ?? false,
          nickname: player.nickname ?? null,
          avatar: player.avatar ?? null,
          birthDate: player.birth_date ?? null,
          gender: (player.gender as "boy" | "girl" | null) ?? null,
          linked: existing.data.session?.user.is_anonymous === false,
          album,
        };
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    return null;
  } catch (err) {
    console.warn("[account] playing without an account:", err);
    return null;
  }
}

/**
 * Remember that the tutorial has been seen.
 *
 * Written by the player rather than the server, unusually — whether you have
 * watched it is a preference, not a prize, and the worst you can do by lying
 * about it is see it twice. Mirrored in localStorage so a guest with no
 * account is not taught the game every single time they open it.
 */
const SEEN_KEY = "amanda.tutorial.done";

export function tutorialSeenLocally(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export async function markTutorialDone(): Promise<void> {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private browsing; the account copy below still covers it */
  }
  const sb = db();
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (id) await sb.from("players").update({ tutorial_done: true }).eq("id", id);
  } catch (err) {
    console.warn("[account] could not record the tutorial", err);
  }
}

/**
 * Ask the match server to spend copies and raise a card a level.
 *
 * It goes to the server rather than straight to the database because the price
 * depends on the card's RARITY, and only the server has both the catalog and
 * the right to write. The player's own token goes with it, and the server
 * reads who they are from that token rather than from anything we send.
 */
export async function levelUpCard(cardId: string): Promise<{ error?: string; level?: number }> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return { error: "אין חיבור לשרת" };
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: "אין חשבון" };
    const res = await fetch(`${SERVER_HTTP}/api/level-up`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ cardId }),
    });
    const out = (await res.json()) as { error?: string; level?: number };
    return res.ok ? { level: out.level } : { error: out.error ?? "לא הצליח" };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** A chest the server has already decided the contents of. */
export interface Chest {
  id: string;
  kind: string;
  cards: string[];
  diamonds: number;
  earnedAt: string;
}

/**
 * The newest chest the player has not been SHOWN yet.
 *
 * The server opens a chest at the moment it awards one — the cards are in the
 * album before this is ever called — so opening it on screen is a reveal, not
 * a transaction. Nothing here can fail, and closing the game half way through
 * loses nothing.
 *
 * Which ones have been seen is kept locally: it is the one part of this worth
 * nothing to cheat at, and keeping it out of the database means a chest can
 * never get stuck half-shown.
 */
const SEEN_CHESTS = "amanda.chests.seen";

/**
 * The chests you have won and not opened yet.
 *
 * They sit on the home screen until you do. Winning used to open them in the
 * same breath, which meant "an unopened chest" could not exist — and an
 * unopened chest is the thing that makes you come back tomorrow.
 */
export async function unopenedChests(): Promise<Chest[]> {
  const sb = db();
  if (!sb) return [];
  try {
    const { data: auth } = await sb.auth.getSession();
    const id = auth.session?.user.id;
    if (!id) return [];
    const { data } = await sb
      .from("chests")
      .select("id, kind, contents, earned_at")
      .eq("player_id", id)
      .is("opened_at", null)
      .order("earned_at", { ascending: true });
    return (data ?? []).map((row) => {
      const contents = (row.contents ?? {}) as { cards?: string[]; diamonds?: number };
      return {
        id: row.id,
        kind: row.kind,
        cards: contents.cards ?? [],
        diamonds: contents.diamonds ?? 0,
        earnedAt: row.earned_at,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Break the seal on one.
 *
 * The SERVER grants the contents — what is inside was decided when the match
 * was won and the client is only asking for it to be handed over. Returns what
 * was in it, or null if anything went wrong, in which case the chest is still
 * there to try again.
 */
export async function openChest(chestId: string): Promise<Chest | null> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return null;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${SERVER_HTTP}/api/chest/open`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ chestId }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ok?: boolean;
      kind?: string;
      cards?: string[];
      diamonds?: number;
    };
    if (!body.ok) return null;
    return {
      id: chestId,
      kind: body.kind ?? "wood",
      cards: body.cards ?? [],
      diamonds: body.diamonds ?? 0,
      earnedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function newestUnseenChest(): Promise<Chest | null> {
  const sb = db();
  if (!sb) return null;
  try {
    const { data: auth } = await sb.auth.getSession();
    const id = auth.session?.user.id;
    if (!id) return null;
    const { data } = await sb
      .from("chests")
      .select("id, kind, contents, earned_at")
      .eq("player_id", id)
      .order("earned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_CHESTS) ?? "[]") as string[];
    } catch {
      /* no storage; the chest simply shows again, which is harmless */
    }
    if (seen.includes(data.id)) return null;
    const contents = (data.contents ?? {}) as { cards?: string[]; diamonds?: number };
    return {
      id: data.id,
      kind: data.kind,
      cards: contents.cards ?? [],
      diamonds: contents.diamonds ?? 0,
      earnedAt: data.earned_at,
    };
  } catch (err) {
    console.warn("[account] could not read the chest", err);
    return null;
  }
}

export function markChestSeen(id: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_CHESTS) ?? "[]") as string[];
    localStorage.setItem(SEEN_CHESTS, JSON.stringify([id, ...seen].slice(0, 30)));
  } catch {
    /* ignore */
  }
}

/** Everything the game knows about how you have done. */
export interface Stats {
  played: number;
  wins: number;
  losses: number;
  /** Most recent first: true for a win. Used for the little streak row. */
  recent: boolean[];
  chestsOpened: number;
  copiesOwned: number;
  bestTrophies: number;
}

/**
 * Read the player's record back out.
 *
 * Counted from the match rows the server wrote rather than from a running
 * total on the player, so it cannot drift from what actually happened — and
 * nothing a client does can inflate it.
 */
export async function loadStats(): Promise<Stats | null> {
  const sb = db();
  if (!sb) return null;
  try {
    const { data: auth } = await sb.auth.getSession();
    const id = auth.session?.user.id;
    if (!id) return null;
    const [{ data: matches }, { count: chests }, { data: player }, { data: cards }] =
      await Promise.all([
        sb
          .from("matches")
          .select("winner, played_at")
          .or(`player_a.eq.${id},player_b.eq.${id}`)
          .order("played_at", { ascending: false })
          .limit(100),
        sb
          .from("chests")
          .select("id", { count: "exact", head: true })
          .eq("player_id", id),
        sb.from("players").select("best_trophies").eq("id", id).maybeSingle(),
        sb.from("player_cards").select("copies").eq("player_id", id),
      ]);
    const rows = matches ?? [];
    const recent = rows.map((m) => m.winner === id);
    return {
      played: rows.length,
      wins: recent.filter(Boolean).length,
      losses: recent.filter((w) => !w).length,
      recent: recent.slice(0, 10),
      chestsOpened: chests ?? 0,
      copiesOwned: (cards ?? []).reduce((sum, c) => sum + (c.copies ?? 0), 0),
      bestTrophies: player?.best_trophies ?? 0,
    };
  } catch (err) {
    console.warn("[account] could not read the record", err);
    return null;
  }
}

/**
 * Whole years between a yyyy-mm-dd and today.
 *
 * The date is split by hand rather than handed to `new Date(string)`, which
 * reads "2019-10-07" as midnight UTC and would then be compared against a
 * local today. East of UTC, late in the evening, that is a whole day out —
 * and a day out on an age gate is a child let in early.
 */
export function ageFrom(birthDate: string): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const b = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const beforeBirthday =
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Save the things a player says about themselves. */
export async function saveProfile(patch: {
  nickname?: string;
  avatar?: string;
  birthDate?: string;
  gender?: "boy" | "girl";
}): Promise<string | null> {
  const sb = db();
  if (!sb) return "אין חיבור לשרת";
  if (patch.birthDate && ageFrom(patch.birthDate) < MIN_AGE)
    return `צריך להיות בן ${MIN_AGE} לפחות`;
  try {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) return "אין חשבון";
    const row: Record<string, string> = {};
    if (patch.nickname !== undefined) row.nickname = patch.nickname;
    if (patch.avatar !== undefined) row.avatar = patch.avatar;
    if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
    if (patch.gender !== undefined) row.gender = patch.gender;
    const { error } = await sb.from("players").update(row).eq("id", id);
    // The age floor is also a CHECK on the row, so a client that skipped the
    // test above still cannot write a birthday that is too recent.
    return error ? error.message : null;
  } catch (err) {
    return (err as Error).message;
  }
}

/** Sign in with an email and password, keeping the album you already have. */
export async function linkEmail(email: string, password: string): Promise<string | null> {
  const sb = db();
  if (!sb) return "אין חיבור לשרת";
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session?.user) return "צריך להתחיל לשחק קודם";
    // updateUser on an anonymous account attaches the credentials to it rather
    // than creating a second, empty one.
    const { error } = await sb.auth.updateUser({ email, password });
    return error ? error.message : null;
  } catch (err) {
    return (err as Error).message;
  }
}

/**
 * Attach a Google account to the anonymous one the player already has.
 *
 * This is LINKING, not signing in. The player has been playing since their
 * first tap and already owns cards; Google is how that album survives a new
 * phone. `linkIdentity` keeps the same user id, so trophies, copies and levels
 * all stay exactly where they are — signing in afresh would have stranded them
 * under a second account.
 *
 * Returns an error message to show, or null when the redirect is on its way.
 */
/** Somebody you have actually played, and when. */
export interface Opponent {
  id: string;
  nickname: string | null;
  matchId: string;
  at: string;
}

/**
 * Who there is to report.
 *
 * The SERVER decides this list, from the matches table — a report can only
 * name somebody you have really met, and that rule cannot live in the browser
 * because the browser is where it would be edited out.
 */
export async function recentOpponents(): Promise<Opponent[]> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return [];
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return [];
    const res = await fetch(`${SERVER_HTTP}/api/report/opponents`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return [];
    return ((await res.json()) as { opponents?: Opponent[] }).opponents ?? [];
  } catch {
    return [];
  }
}

/** File a report. Returns a message to show the player, or null when it went. */
export async function fileReport(input: {
  kind: "bug" | "player";
  reportedId?: string | null;
  aboutMatch?: string | null;
  message: string;
}): Promise<string | null> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return "אין חיבור לשרת";
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return "צריך חשבון כדי לדווח";
    const res = await fetch(`${SERVER_HTTP}/api/report`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    return body.ok ? null : (body.error ?? "לא הצליח");
  } catch (err) {
    return (err as Error).message;
  }
}

export interface Friend {
  id: string;
  nickname: string | null;
  /** "friend" · "asked" (you asked them) · "asking" (they asked you). */
  state: "friend" | "asked" | "asking";
  online: boolean;
}

/**
 * One call for everything about friends.
 *
 * All of it goes through the server, because every rule that makes this safe
 * for a seven-year-old is checked there: you may only ask somebody you have
 * actually played, and they have to say yes. See apps/server/src/friends.ts.
 */
async function friendsCall<T>(path: string, body: unknown, fallback: T): Promise<T> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return fallback;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return fallback;
    const res = await fetch(`${SERVER_HTTP}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function listFriends(): Promise<Friend[]> {
  return (await friendsCall<{ friends?: Friend[] }>("/api/friends", {}, {})).friends ?? [];
}

/** People you have played who are not on your list yet — the only candidates. */
export async function addableOpponents(): Promise<Array<{ id: string; nickname: string | null }>> {
  const r = await friendsCall<{ opponents?: Array<{ id: string; nickname: string | null }> }>(
    "/api/friends/addable",
    {},
    {},
  );
  return r.opponents ?? [];
}

/** Ask / accept / remove. Returns a message for the player, or null. */
export async function friendAction(
  action: "ask" | "accept" | "remove",
  playerId: string,
): Promise<string | null> {
  const r = await friendsCall<{ ok?: boolean; error?: string }>(
    `/api/friends/${action}`,
    { playerId },
    { error: "אין חיבור לשרת" },
  );
  return r.ok ? null : (r.error ?? "לא הצליח");
}

export interface ShopItem {
  id: string;
  kind: "avatar" | "emoji" | "skin" | "card" | "chest";
  name: { he: string; en?: string };
  blurb?: { he: string; en?: string } | null;
  grants: Record<string, unknown>;
  price_diamonds: number;
  art: string | null;
  sort: number;
}

/** What is on the shelves, and what is already yours. */
export async function loadShop(): Promise<{ items: ShopItem[]; owned: string[] }> {
  const empty = { items: [], owned: [] };
  if (!SERVER_HTTP) return empty;
  try {
    const sb = db();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const res = await fetch(`${SERVER_HTTP}/api/shop`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: "{}",
    });
    const body = (await res.json()) as { items?: ShopItem[]; owned?: string[] };
    return { items: body.items ?? [], owned: body.owned ?? [] };
  } catch {
    return empty;
  }
}

/** Buy one thing. Returns a message for the player, or null. */
export async function buyItem(itemId: string): Promise<string | null> {
  const r = await friendsCall<{ ok?: boolean; error?: string }>(
    "/api/shop/buy",
    { itemId },
    { error: "אין חיבור לשרת" },
  );
  return r.ok ? null : (r.error ?? "לא הצליח");
}

export interface Notice {
  id: string;
  kind: "gift" | "offer" | "chest" | "friend" | "news";
  title: { he: string; en?: string };
  body: { he: string; en?: string } | null;
  action: string | null;
  read_at: string | null;
  created_at: string;
}

/** What the game has to tell you, newest first. */
export async function loadInbox(): Promise<{ notices: Notice[]; unread: number }> {
  return friendsCall<{ notices: Notice[]; unread: number }>(
    "/api/inbox",
    {},
    { notices: [], unread: 0 },
  );
}

/** Mark the lot as read — an inbox here is a list you open, not one you manage. */
export async function markInboxRead(): Promise<void> {
  await friendsCall("/api/inbox/read", {}, {});
}

/**
 * Sign out, and come back as somebody else.
 *
 * Deliberately NOT a plain signOut. Every player has an account from their
 * first second, so a signed-out game is a game with no album — the next thing
 * that happens has to be a new anonymous account, or the child is staring at
 * a broken screen wondering what they did.
 *
 * The album of the account being left is untouched and lives in the database;
 * signing back in with the same Google account brings all of it back.
 */
/**
 * Delete this account, for good.
 *
 * Both app stores have required this since 2022: an app that lets you make an
 * account must let you delete it from inside the app. We only had it in the
 * admin panel, which is not the same thing and would have failed review.
 *
 * The server deletes the auth user and the database cascades the rest —
 * verified against the live schema rather than assumed: players references
 * auth.users on delete cascade, and chests and player_cards reference players
 * the same way. Match rows survive with the player set to null, so somebody
 * else's history does not develop holes.
 */
export async function deleteAccount(): Promise<string | null> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return "אין חיבור לשרת";
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return "אין חשבון";
    const res = await fetch(`${SERVER_HTTP}/api/account/delete`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!body.ok) return body.error ?? "לא הצליח";
    await sb.auth.signOut();
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

export async function switchAccount(): Promise<void> {
  const sb = db();
  if (!sb) return;
  try {
    await sb.auth.signOut();
    await sb.auth.signInAnonymously();
  } catch {
    /* worst case the next load makes one */
  }
}

/**
 * Is this account allowed into the admin panel?
 *
 * Asked of the SERVER, which is the only thing that can answer: the admins
 * table is unreachable from the browser on purpose. A false here hides a
 * link; it is not what protects anything.
 */
export async function isAdmin(): Promise<boolean> {
  const sb = db();
  if (!sb || !SERVER_HTTP) return false;
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token || data.session?.user.is_anonymous) return false;
    const res = await fetch(`${SERVER_HTTP}/api/admin/whoami`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return false;
    return !!(await res.json()).ok;
  } catch {
    return false;
  }
}

export async function linkGoogle(): Promise<string | null> {
  const sb = db();
  if (!sb) return "אין חיבור לשרת";
  try {
    const { data: session } = await sb.auth.getSession();
    const user = session.session?.user;
    if (!user) return "צריך להתחיל לשחק קודם";
    if (!user.is_anonymous) return "כבר מחובר";

    const { error } = await sb.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: comeBackTo() },
    });
    if (!error) return null;

    /*
     * "identity_already_exists" means this Google account is attached to an
     * account they made before — on another device, or on an earlier visit.
     * Linking cannot succeed and never will, so the right move is to sign them
     * INTO that account instead of refusing. They get their real album back;
     * what they have collected in this browser since was never saved anywhere,
     * which is the thing signing in is for.
     */
    if (error.message.toLowerCase().includes("already")) {
      const { error: signInError } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: comeBackTo() },
      });
      return signInError ? signInError.message : null;
    }
    return error.message;
  } catch (err) {
    return (err as Error).message;
  }
}

/**
 * The player's own access token, for a call to our server.
 *
 * Every `/api/...` call proves who it is with this and the server reads the
 * player id out of it — never from the body, or anyone could spend anyone's
 * diamonds. Null when there is nobody signed in, including a guest whose
 * anonymous session has not been created yet.
 */
export async function authToken(): Promise<string | null> {
  const sb = db();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Where our own small API lives, or "" when the game is running without one. */
export function serverHttp(): string {
  return SERVER_HTTP;
}

/** True once the account is a real one and the album is safe. */
export function isLinked(): Promise<boolean> {
  const sb = db();
  if (!sb) return Promise.resolve(false);
  return sb.auth.getSession().then(({ data }) => data.session?.user.is_anonymous === false);
}

/**
 * The cards a match deck is built from, with duplicates for duplicate copies —
 * so holding three of something really does mean three on the board.
 *
 * An album too small to fill a hand is not padded here. Running thin IS the
 * game: the empty cells become Crumb Demons, and that is what makes collecting
 * mean something.
 */
export function albumToPool(album: Map<string, OwnedCard>): string[] {
  const pool: string[] = [];
  for (const { cardId, copies } of album.values())
    for (let i = 0; i < copies; i++) pool.push(cardId);
  return pool;
}
