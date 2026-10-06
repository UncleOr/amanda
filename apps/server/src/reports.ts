/**
 * Reporting a bug, or a player who was unpleasant.
 *
 * Or: "a report option that goes to a dedicated inbox in the admin panel,
 * including who reported and who was reported (let them pick from recent
 * opponents) — works only between registered users — and an option for the
 * admin to suspend them for a period or indefinitely."
 *
 * ═══ THE RULES LIVE HERE, NOT IN THE BROWSER ═══
 *
 * Three of them, and each exists because of a specific way this gets abused:
 *
 *   REGISTERED ONLY. An anonymous account is free and takes one second to
 *   make. Reporting from one is reporting from nowhere, and being reported BY
 *   one is being reported by nobody — so both ends must be real accounts.
 *
 *   YOU MUST HAVE PLAYED THEM. The opponent list comes from the matches
 *   table, and a report names a match. A child cannot report somebody they
 *   have never met, which is most of what a report button gets used for.
 *
 *   A LIMIT. Five open reports an hour. Not to protect the database — to stop
 *   one upset seven-year-old filling Or's inbox with the same complaint
 *   fourteen times.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** How many open reports one person may have in flight within the hour. */
const MAX_OPEN_PER_HOUR = 5;

export interface ReportInput {
  kind: "bug" | "player";
  reportedId?: string | null;
  aboutMatch?: string | null;
  message: string;
}

/**
 * Is this a real account, or one of the anonymous ones everybody gets on
 * their first visit?
 */
export async function isRegistered(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await sb.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return !!data.user.email || (data.user.identities?.length ?? 0) > 0;
}

/**
 * The people this player has actually faced, most recent first.
 *
 * Anonymous opponents are dropped: there is no point offering somebody to
 * report who cannot be suspended in any way that matters, because the account
 * is thrown away the moment they clear their browser.
 */
export async function recentOpponents(
  sb: SupabaseClient,
  playerId: string,
  limit = 10,
): Promise<Array<{ id: string; nickname: string | null; matchId: string; at: string }>> {
  const { data } = await sb
    .from("matches")
    .select("id, player_a, player_b, played_at")
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`)
    .order("played_at", { ascending: false })
    .limit(40);

  const seen = new Set<string>();
  const out: Array<{ id: string; nickname: string | null; matchId: string; at: string }> = [];
  for (const row of data ?? []) {
    const other = row.player_a === playerId ? row.player_b : row.player_a;
    if (!other || other === playerId || seen.has(other)) continue;
    seen.add(other);
    out.push({ id: other, nickname: null, matchId: row.id, at: row.played_at });
    if (out.length >= limit) break;
  }
  if (!out.length) return out;

  // Names, and drop anyone who is not a real account.
  const { data: players } = await sb
    .from("players")
    .select("id, nickname")
    .in("id", out.map((o) => o.id));
  const byId = new Map((players ?? []).map((p) => [p.id, p.nickname as string | null]));

  const kept: typeof out = [];
  for (const o of out) {
    if (!(await isRegistered(sb, o.id))) continue;
    kept.push({ ...o, nickname: byId.get(o.id) ?? null });
  }
  return kept;
}

/** File one. Returns an error message for the player, or null. */
export async function fileReport(
  sb: SupabaseClient,
  reporterId: string,
  input: ReportInput,
): Promise<string | null> {
  if (!(await isRegistered(sb, reporterId)))
    return "צריך חשבון כדי לדווח. אפשר להתחבר באזור האישי.";

  const message = input.message.trim().slice(0, 1000);
  if (input.kind === "bug" && message.length < 3) return "ספר לנו מה קרה.";

  if (input.kind === "player") {
    if (!input.reportedId) return "על מי מדווחים?";
    if (input.reportedId === reporterId) return "זה אתה.";
    if (!(await isRegistered(sb, input.reportedId)))
      return "אפשר לדווח רק על שחקנים רשומים.";
    /*
     * And they have to have actually played them. Without this the button is
     * a way to name anybody at all, which is the first thing it would be
     * used for.
     */
    const met = await recentOpponents(sb, reporterId, 50);
    if (!met.some((o) => o.id === input.reportedId))
      return "אפשר לדווח רק על מישהו ששיחקת מולו.";
  }

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", reporterId)
    .eq("status", "open")
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_OPEN_PER_HOUR) return "דיווחת הרבה. נבדוק, ונחזור אליך.";

  const { error } = await sb.from("reports").insert({
    kind: input.kind,
    reporter_id: reporterId,
    reported_id: input.kind === "player" ? input.reportedId : null,
    about_match: input.aboutMatch ?? null,
    message,
  });
  return error ? error.message : null;
}

/** The inbox, newest first, with both names resolved. */
export async function listReports(sb: SupabaseClient, status: "open" | "done" | "all") {
  let q = sb
    .from("reports")
    .select("id, kind, reporter_id, reported_id, message, created_at, status, handled_note")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const r of data ?? []) {
    ids.add(r.reporter_id);
    if (r.reported_id) ids.add(r.reported_id);
  }
  const { data: players } = ids.size
    ? await sb.from("players").select("id, nickname, suspended_until").in("id", [...ids])
    : { data: [] };
  const byId = new Map((players ?? []).map((p) => [p.id, p]));

  return (data ?? []).map((r) => ({
    ...r,
    reporterName: byId.get(r.reporter_id)?.nickname ?? null,
    reportedName: r.reported_id ? (byId.get(r.reported_id)?.nickname ?? null) : null,
    reportedSuspendedUntil: r.reported_id
      ? (byId.get(r.reported_id)?.suspended_until ?? null)
      : null,
  }));
}
