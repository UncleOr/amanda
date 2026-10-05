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
const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://iiviygfltyrsonioyqxm.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_j1lvAt_idYWAzD0WCEJ4ig_PR0egOzG";

/** One card in the album. */
export interface OwnedCard {
  cardId: string;
  /** How many you hold — and so how many times you may place it. */
  copies: number;
  level: number;
}

export interface Account {
  playerId: string;
  trophies: number;
  diamonds: number;
  tutorialDone: boolean;
  /** cardId → what you own of it. */
  album: Map<string, OwnedCard>;
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true } });
  return client;
}

/** True when the build was given somewhere to store accounts. */
export const ACCOUNTS_AVAILABLE = Boolean(URL && KEY);

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
    const existing = await sb.auth.getSession();
    let userId = existing.data.session?.user.id;
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
        sb.from("players").select("trophies, diamonds, tutorial_done").eq("id", userId).maybeSingle(),
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
          tutorialDone: player.tutorial_done ?? false,
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
