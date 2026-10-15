/**
 * Friends.
 *
 * Or: "an option to add players to a friends list, to see whether they are
 * online, and to invite them to a game."
 *
 * ═══ THE SAME TWO RULES AS REPORTING, FOR THE SAME REASON ═══
 *
 *   YOU MAY ONLY ASK SOMEBODY YOU HAVE PLAYED. There is no search by name.
 *   The candidate list comes from the matches table, so a child cannot go
 *   looking for strangers — and neither can anybody go looking for a child.
 *
 *   AND THEY HAVE TO SAY YES. A friendship is two accepted rows, written only
 *   when the other person accepts. Without that, "add" would be a way to
 *   watch whether a particular child is online, which is not a feature.
 *
 * Both ends must be real accounts, exactly as for reporting: an anonymous one
 * is free, thrown away on the next browser clear, and cannot meaningfully be
 * anybody's friend.
 *
 * Every rule is checked here. The table has no write policy at all, so there
 * is no second path to it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ROOM_CODE_ALPHABET, shownAvatar, shownName } from "@amanda/shared";
import { isRegistered, recentOpponents } from "./reports.js";

/** How many requests one person may have waiting for an answer. */
const MAX_PENDING_OUT = 20;

export interface FriendRow {
  id: string;
  nickname: string | null;
  /*
   * ═══ A FRIEND IS A PERSON, NOT A NAME AND A DOT ═══
   *
   * Or: *"it should show a friend's name and profile picture and
   * connected/not connected… tapping should open a friend's board — how many
   * diamonds he has, which arena he is in, how many cards he has got."*
   *
   * Everything here is already public between two people who have agreed to
   * be friends — it is what the versus screen shows you about an opponent —
   * and it costs one query, because they are all columns on the same row.
   */
  avatar: string | null;
  trophies: number;
  diamonds: number;
  /** How many monsters are in their album. */
  cards: number;
  /** "friend" · "asked" (you asked them) · "asking" (they asked you). */
  state: "friend" | "asked" | "asking";
  online: boolean;
}

interface Profile {
  nickname: string | null;
  avatar: string | null;
  trophies: number;
  diamonds: number;
  cards: number;
}

/** Everything the list shows about a set of people, in two round trips. */
async function profilesOf(sb: SupabaseClient, ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map();
  const [{ data: players }, { data: owned }] = await Promise.all([
    sb.from("players").select("id, nickname, avatar, trophies, diamonds").in("id", ids),
    /*
     * One row per card they own, counted here rather than with a grouped
     * count: PostgREST cannot group, and 51 rows per friend is nothing
     * against the round trip a second query would cost.
     */
    sb.from("player_cards").select("player_id").in("player_id", ids),
  ]);
  const cards = new Map<string, number>();
  for (const row of owned ?? []) {
    const id = row.player_id as string;
    cards.set(id, (cards.get(id) ?? 0) + 1);
  }
  return new Map(
    (players ?? []).map((p) => [
      p.id as string,
      {
        /*
         * The automatic handle and face, exactly as the versus screen and
         * the battle banner use them — see shared/identity.ts. Nine players
         * in ten have never chosen either, and a friends list of blanks is
         * the same bug as an opponent called "somebody".
         */
        nickname: shownName(p.nickname as string | null, p.id as string),
        avatar: shownAvatar(p.avatar as string | null, p.id as string),
        trophies: (p.trophies as number) ?? 0,
        diamonds: (p.diamonds as number) ?? 0,
        cards: cards.get(p.id as string) ?? 0,
      },
    ]),
  );
}

/**
 * Everyone on this player's list, in all three states.
 *
 * `isOnline` is passed in rather than looked up: who is connected is the
 * WebSocket server's business and lives in memory, not in the database.
 */
export async function listFriends(
  sb: SupabaseClient,
  playerId: string,
  isOnline: (id: string) => boolean,
): Promise<FriendRow[]> {
  const { data } = await sb
    .from("friends")
    .select("player_id, friend_id, status")
    .or(`player_id.eq.${playerId},friend_id.eq.${playerId}`);

  const rows = data ?? [];
  const out = new Map<string, FriendRow["state"]>();
  for (const r of rows) {
    const mine = r.player_id === playerId;
    const other = mine ? (r.friend_id as string) : (r.player_id as string);
    if (r.status === "accepted") {
      // An accepted friendship is two rows; either one proves it.
      out.set(other, "friend");
    } else if (!out.has(other)) {
      out.set(other, mine ? "asked" : "asking");
    }
  }

  const ids = [...out.keys()];
  const profiles = await profilesOf(sb, ids);
  return ids
    .map((id) => ({
      id,
      nickname: profiles.get(id)?.nickname ?? null,
      avatar: profiles.get(id)?.avatar ?? null,
      trophies: profiles.get(id)?.trophies ?? 0,
      diamonds: profiles.get(id)?.diamonds ?? 0,
      cards: profiles.get(id)?.cards ?? 0,
      state: out.get(id)!,
      online: isOnline(id),
    }))
    // Whoever is waiting for an answer first, then whoever can actually play.
    .sort((a, b) => {
      const rank = (f: FriendRow) => (f.state === "asking" ? 0 : f.online ? 1 : 2);
      return rank(a) - rank(b) || (a.nickname ?? "").localeCompare(b.nickname ?? "");
    });
}

/**
 * People you have played who are not on your list yet — the only people you
 * are ever offered. Returns an error message for the player, or the list.
 */
export async function addableOpponents(
  sb: SupabaseClient,
  playerId: string,
): Promise<Array<{ id: string; nickname: string | null }>> {
  const played = await recentOpponents(sb, playerId, 15);
  if (!played.length) return [];
  const { data } = await sb
    .from("friends")
    .select("player_id, friend_id")
    .or(`player_id.eq.${playerId},friend_id.eq.${playerId}`);
  const known = new Set<string>();
  for (const r of data ?? []) known.add(r.player_id === playerId ? r.friend_id : r.player_id);
  return played
    .filter((o) => !known.has(o.id))
    .map((o) => ({ id: o.id, nickname: o.nickname }));
}

/** Ask somebody to be friends. Returns an error for the player, or null. */
export async function askFriend(
  sb: SupabaseClient,
  playerId: string,
  otherId: string,
  /*
   * A request that came from a code skips the "you have played them" rule.
   *
   * That rule exists so nobody can reach a child they have never met. A code
   * is the same protection by another route: the only way to have somebody's
   * is for them to have told you, which IS the consent the rule stands in
   * for. Everything else — both registered, not already friends, not
   * yourself — still applies.
   */
  opts?: { viaCode?: boolean },
): Promise<string | null> {
  if (playerId === otherId) return "friend.self";
  if (!(await isRegistered(sb, playerId)))
    return "friend.needAccount";
  if (!(await isRegistered(sb, otherId))) return "friend.theyNeedAccount";

  // The rule that matters, unless they handed you their code.
  if (!opts?.viaCode) {
    const played = await recentOpponents(sb, playerId, 15);
    if (!played.some((o) => o.id === otherId)) return "friend.notPlayed";
  }

  const { data: existing } = await sb
    .from("friends")
    .select("player_id, status")
    .or(`and(player_id.eq.${playerId},friend_id.eq.${otherId}),and(player_id.eq.${otherId},friend_id.eq.${playerId})`);

  for (const r of existing ?? []) {
    if (r.status === "accepted") return "friend.already";
    // They asked you first — asking back is accepting.
    if (r.player_id === otherId) return await acceptFriend(sb, playerId, otherId);
    return "friend.pending";
  }

  const { count } = await sb
    .from("friends")
    .select("*", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING_OUT) return "friend.tooMany";

  const { error } = await sb
    .from("friends")
    .insert({ player_id: playerId, friend_id: otherId, status: "pending" });
  return error ? "retry" : null;
}

/**
 * Say yes. Writes BOTH rows accepted, so "am I their friend" and "are they
 * mine" can never disagree.
 */
export async function acceptFriend(
  sb: SupabaseClient,
  playerId: string,
  otherId: string,
): Promise<string | null> {
  const { data: ask } = await sb
    .from("friends")
    .select("status")
    .eq("player_id", otherId)
    .eq("friend_id", playerId)
    .maybeSingle();
  if (!ask) return "friend.noRequest";

  const { error } = await sb
    .from("friends")
    .upsert(
      [
        { player_id: otherId, friend_id: playerId, status: "accepted" },
        { player_id: playerId, friend_id: otherId, status: "accepted" },
      ],
      { onConflict: "player_id,friend_id" },
    );
  return error ? "retry" : null;
}

/** Remove, decline, or take back a request — all of them are these two rows. */
export async function removeFriend(
  sb: SupabaseClient,
  playerId: string,
  otherId: string,
): Promise<string | null> {
  const { error } = await sb
    .from("friends")
    .delete()
    .or(`and(player_id.eq.${playerId},friend_id.eq.${otherId}),and(player_id.eq.${otherId},friend_id.eq.${playerId})`);
  return error ? "retry" : null;
}

/** Is this person actually my accepted friend? Used before an invite. */
export async function areFriends(
  sb: SupabaseClient,
  playerId: string,
  otherId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("friends")
    .select("status")
    .eq("player_id", playerId)
    .eq("friend_id", otherId)
    .eq("status", "accepted")
    .maybeSingle();
  return !!data;
}


/* ───────────── a code you can read out ───────────── */

/**
 * ═══ WHY A CODE AT ALL ═══
 *
 * Or: *"add a way to add a friend with a matching code, like a game."*
 *
 * The only way onto somebody's list was to have PLAYED them — see
 * addableOpponents, and that rule is the right one for strangers, because it
 * means nobody can look up a child they have never met. It is useless for
 * the case Or actually has: two children in the same room, who want to be
 * friends before they have played.
 *
 * A code they say out loud is the same permission in a different shape. You
 * cannot guess one (31^6 is 887 million) and you cannot enumerate them — the
 * only way to have somebody's is for them to have given it to you, which is
 * exactly the consent the played-you rule was standing in for.
 */
const CODE_ALPHABET = ROOM_CODE_ALPHABET;
const CODE_LENGTH = 6;

function newCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++)
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

/**
 * This player's code, made the first time they ask for it.
 *
 * The unique index is what settles a collision: a duplicate insert fails and
 * the next attempt draws again. Three attempts against 887 million is more
 * than enough, and the alternative — checking first — is a race.
 */
export async function friendCode(sb: SupabaseClient, playerId: string): Promise<string | null> {
  try {
    const { data } = await sb
      .from("players")
      .select("friend_code")
      .eq("id", playerId)
      .maybeSingle();
    const existing = (data?.friend_code as string | null) ?? null;
    if (existing) return existing;

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode();
      const { error } = await sb
        .from("players")
        .update({ friend_code: code })
        .eq("id", playerId);
      if (!error) return code;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ask to be friends with whoever holds this code.
 *
 * Returns a sentence for the player, or null when the request was sent. The
 * failures are deliberately all the same shape — a code that belongs to
 * nobody and a code you typed wrong must not be told apart, or the field
 * becomes a way to test whether a code exists.
 */
export async function askByCode(
  sb: SupabaseClient,
  playerId: string,
  raw: string,
): Promise<string | null> {
  const code = raw.trim().toUpperCase();
  if (code.length !== CODE_LENGTH) return "friend.codeUnknown";
  try {
    const { data } = await sb
      .from("players")
      .select("id")
      .eq("friend_code", code)
      .maybeSingle();
    const other = (data?.id as string | null) ?? null;
    if (!other) return "friend.codeUnknown";
    if (other === playerId) return "friend.self";
    return await askFriend(sb, playerId, other, { viaCode: true });
  } catch {
    return "friend.codeUnknown";
  }
}
