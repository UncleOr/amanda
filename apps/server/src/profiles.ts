/**
 * Who each connected player is, read once and kept for the connection.
 *
 * Three things needed a player's row and were each about to fetch it:
 *
 *   THE VERSUS SCREEN. Or: *"at the start of a match there should be a second
 *   where you see who you are fighting — their trophies, nickname and
 *   picture."* Only the server knows any of that about somebody else.
 *
 *   THE EMOJI PICKER. Some emoji are bought and some are won, so "may this
 *   player send that one" is a question about `player_items`.
 *
 *   THE SUSPENSION CHECK, which already read the row on its own.
 *
 * One query, at the moment the socket says who it is, is the shape that makes
 * sense: it happens while the player is still looking at the menu, nothing is
 * waiting on it, and a match that starts a moment later finds it already
 * there.
 *
 * ═══ NOTHING HERE BLOCKS A GAME ═══
 *
 * Every function below answers something when the database is unreachable, and
 * the answer is always the permissive one. A versus screen with no name is a
 * worse screen; a versus screen that never arrives because a query hung is a
 * match that never starts. Likewise an unknown item list lets a player send
 * the free emoji and nothing more, rather than nothing at all.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebSocket } from "ws";
import { shownAvatar, shownName, type PlayerCard } from "@amanda/shared";
import { db } from "./supabase.js";

export interface Profile extends PlayerCard {
  /** Shop items this player holds — emoji packs, catchphrases, skins. */
  items: string[];
  /** Epoch ms their suspension lifts, or 0. */
  suspendedUntil: number;
}

/**
 * Keyed by the socket rather than the player id, so it goes when they do.
 * A WeakMap because a disconnected socket should not keep a row alive.
 */
const profiles = new WeakMap<WebSocket, Profile>();

/** What somebody with no account, or no database, looks like. */
const STRANGER: Profile = {
  nickname: null,
  avatar: null,
  trophies: 0,
  catchphrase: null,
  gender: null,
  back: null,
  items: [],
  suspendedUntil: 0,
};

/**
 * Read this player's row and remember it for as long as they are connected.
 *
 * Called from the lobby when a socket identifies itself, and deliberately not
 * awaited by anything the player is waiting on.
 */
export async function loadProfile(ws: WebSocket, playerId: string): Promise<void> {
  const sb = db();
  if (!sb) return;
  try {
    const [{ data: row }, { data: items }] = await Promise.all([
      sb
        .from("players")
        .select("nickname, avatar, trophies, catchphrase, gender, suspended_until, active_deck")
        .eq("id", playerId)
        .maybeSingle(),
      sb.from("player_items").select("item_id").eq("player_id", playerId),
    ]);
    if (!row) return;
    /*
     * The back on the deck they are about to play, for the versus screen.
     *
     * A SECOND query rather than an embed, and that is the whole decision:
     * `decks(back)` is ambiguous to PostgREST — `decks` points back at
     * `players` as well — so it would need the constraint name spelled out,
     * and a select string that goes stale takes the WHOLE profile down with
     * it. Names, faces and trophies would vanish from the versus screen
     * because a card back could not be found. Its own query, its own
     * try/catch, and the worst case is a default back.
     */
    const back = await deckBack(sb, row.active_deck as string | null);
    /*
     * ═══ NOBODY ARRIVES WITHOUT A NAME OR A FACE ═══
     *
     * Or: *"in a 1v1 on the computer you don't see the opponent's name"*,
     * and then: *"a player with no nickname gets an automatic handle like
     * the bot's, and a default picture (but not an emoji)."*
     *
     * It was never a display bug. Asked of the database: 113 players, 10
     * with a nickname. The screen that exists to make your opponent a person
     * was introducing nine out of ten of them as "somebody".
     *
     * Filled HERE rather than at the screen, because the opponent's card is
     * built from this row and sent across the wire — so one place covers the
     * versus screen, the board label and the battle banner at once, and the
     * player's own screens get the same answer from shared/identity.ts.
     */
    profiles.set(ws, {
      nickname: shownName(row.nickname as string | null, playerId),
      avatar: shownAvatar(row.avatar as string | null, playerId),
      trophies: (row.trophies as number) ?? 0,
      catchphrase: (row.catchphrase as string | null) ?? null,
      gender: (row.gender as "boy" | "girl" | null) ?? null,
      back,
      items: (items ?? []).map((i) => i.item_id as string),
      suspendedUntil: row.suspended_until ? Date.parse(row.suspended_until as string) : 0,
    });
  } catch {
    // A database that cannot be reached must not stop anybody playing.
  }
}

/**
 * The back on a deck, or null.
 *
 * Null covers every uninteresting case at once: no deck chosen, a deck that
 * was deleted out from under the pointer, an unreachable database. The screen
 * draws the default fog for all of them, which is exactly right — it is what
 * a player who has never opened the builder actually has.
 */
async function deckBack(sb: SupabaseClient, deckId: string | null): Promise<string | null> {
  if (!deckId) return null;
  try {
    const { data } = await sb.from("decks").select("back").eq("id", deckId).maybeSingle();
    return (data?.back as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Everything known about this connection, or a stranger. */
export function profileOf(ws: WebSocket): Profile {
  return profiles.get(ws) ?? STRANGER;
}

/** Just the part the other player is allowed to see. */
export function cardOf(ws: WebSocket): PlayerCard {
  const { nickname, avatar, trophies, catchphrase, gender, back } = profileOf(ws);
  return { nickname, avatar, trophies, catchphrase, gender, back };
}

/** Shop items this connection holds. */
export function itemsOf(ws: WebSocket): readonly string[] {
  return profileOf(ws).items;
}

export function forget(ws: WebSocket): void {
  profiles.delete(ws);
}
