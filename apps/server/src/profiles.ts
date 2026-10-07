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
import type { WebSocket } from "ws";
import type { PlayerCard } from "@amanda/shared";
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
        .select("nickname, avatar, trophies, catchphrase, gender, suspended_until")
        .eq("id", playerId)
        .maybeSingle(),
      sb.from("player_items").select("item_id").eq("player_id", playerId),
    ]);
    if (!row) return;
    profiles.set(ws, {
      nickname: (row.nickname as string | null) ?? null,
      avatar: (row.avatar as string | null) ?? null,
      trophies: (row.trophies as number) ?? 0,
      catchphrase: (row.catchphrase as string | null) ?? null,
      gender: (row.gender as "boy" | "girl" | null) ?? null,
      items: (items ?? []).map((i) => i.item_id as string),
      suspendedUntil: row.suspended_until ? Date.parse(row.suspended_until as string) : 0,
    });
  } catch {
    // A database that cannot be reached must not stop anybody playing.
  }
}

/** Everything known about this connection, or a stranger. */
export function profileOf(ws: WebSocket): Profile {
  return profiles.get(ws) ?? STRANGER;
}

/** Just the part the other player is allowed to see. */
export function cardOf(ws: WebSocket): PlayerCard {
  const { nickname, avatar, trophies, catchphrase, gender } = profileOf(ws);
  return { nickname, avatar, trophies, catchphrase, gender };
}

/** Shop items this connection holds. */
export function itemsOf(ws: WebSocket): readonly string[] {
  return profileOf(ws).items;
}

export function forget(ws: WebSocket): void {
  profiles.delete(ws);
}
