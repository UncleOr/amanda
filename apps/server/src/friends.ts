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
import { isRegistered, recentOpponents } from "./reports.js";

/** How many requests one person may have waiting for an answer. */
const MAX_PENDING_OUT = 20;

export interface FriendRow {
  id: string;
  nickname: string | null;
  /** "friend" · "asked" (you asked them) · "asking" (they asked you). */
  state: "friend" | "asked" | "asking";
  online: boolean;
}

/** Names for a set of ids, in one round trip. */
async function namesOf(sb: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const { data } = await sb.from("players").select("id, nickname").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id as string, (p.nickname as string | null) ?? null]));
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
  const names = await namesOf(sb, ids);
  return ids
    .map((id) => ({
      id,
      nickname: names.get(id) ?? null,
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
): Promise<string | null> {
  if (playerId === otherId) return "זה אתה.";
  if (!(await isRegistered(sb, playerId)))
    return "צריך חשבון כדי להוסיף חברים. אפשר להתחבר באזור האישי.";
  if (!(await isRegistered(sb, otherId))) return "לשחקן הזה אין חשבון.";

  // The rule that matters: you have actually played them.
  const played = await recentOpponents(sb, playerId, 15);
  if (!played.some((o) => o.id === otherId)) return "אפשר להוסיף רק מישהו ששיחקת מולו.";

  const { data: existing } = await sb
    .from("friends")
    .select("player_id, status")
    .or(`and(player_id.eq.${playerId},friend_id.eq.${otherId}),and(player_id.eq.${otherId},friend_id.eq.${playerId})`);

  for (const r of existing ?? []) {
    if (r.status === "accepted") return "אתם כבר חברים.";
    // They asked you first — asking back is accepting.
    if (r.player_id === otherId) return await acceptFriend(sb, playerId, otherId);
    return "כבר ביקשת. מחכים שיאשרו.";
  }

  const { count } = await sb
    .from("friends")
    .select("*", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("status", "pending");
  if ((count ?? 0) >= MAX_PENDING_OUT) return "יש לך יותר מדי בקשות שמחכות לתשובה.";

  const { error } = await sb
    .from("friends")
    .insert({ player_id: playerId, friend_id: otherId, status: "pending" });
  return error ? "לא הצלחתי. נסה שוב." : null;
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
  if (!ask) return "אין בקשה כזאת.";

  const { error } = await sb
    .from("friends")
    .upsert(
      [
        { player_id: otherId, friend_id: playerId, status: "accepted" },
        { player_id: playerId, friend_id: otherId, status: "accepted" },
      ],
      { onConflict: "player_id,friend_id" },
    );
  return error ? "לא הצלחתי. נסה שוב." : null;
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
  return error ? "לא הצלחתי. נסה שוב." : null;
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
