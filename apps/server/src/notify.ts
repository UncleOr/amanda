/**
 * Telling a player something.
 *
 * Or: "and for the app we will also need notifications — to tell a player
 * about gifts, offers and so on."
 *
 * ═══ IN-APP FIRST, PUSH LATER, AND WHY THAT ORDER ═══
 *
 * A push notification needs the app shell that does not exist yet (TWA on
 * Android, Capacitor on iOS — see docs/TASKS.md), a permission prompt, and a
 * service worker subscription. None of that changes what is being said or who
 * it is said to; it is a second DELIVERY of the same row. So the row comes
 * first, the game shows an inbox, and push becomes "also send this one over
 * the wire" rather than a feature rebuilt from scratch.
 *
 * It also matters for the age rating. Under Google's Families Policy,
 * notifications to children are restricted and need consent — and that is a
 * question on the IARC questionnaire. Having the inbox working and the push
 * not yet sent is the right order to be in when filling that form.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationKind = "gift" | "offer" | "chest" | "friend" | "news";

export interface Notice {
  id: string;
  kind: NotificationKind;
  title: { he: string; en?: string };
  body: { he: string; en?: string } | null;
  action: string | null;
  read_at: string | null;
  created_at: string;
}

/** Say something to one player. Never throws: a notice is not worth a 500. */
export async function notify(
  sb: SupabaseClient,
  playerId: string,
  kind: NotificationKind,
  title: { he: string; en?: string },
  body?: { he: string; en?: string },
  action?: string,
): Promise<void> {
  try {
    await sb.from("notifications").insert({
      player_id: playerId,
      kind,
      title,
      body: body ?? null,
      action: action ?? null,
    });
  } catch {
    /* the gift still arrived; the note about it is not worth failing over */
  }
}

/** The last few, newest first, with how many are unread. */
export async function inbox(
  sb: SupabaseClient,
  playerId: string,
): Promise<{ notices: Notice[]; unread: number }> {
  const { data } = await sb
    .from("notifications")
    .select("id, kind, title, body, action, read_at, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(30);
  const notices = (data ?? []) as Notice[];
  return { notices, unread: notices.filter((n) => !n.read_at).length };
}

/**
 * Mark them read.
 *
 * All of them at once, because an inbox in a children's game is a list you
 * open — not a thing to manage item by item. The badge going away when you
 * look is the entire interaction.
 */
export async function markRead(sb: SupabaseClient, playerId: string): Promise<void> {
  await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .is("read_at", null);
}
