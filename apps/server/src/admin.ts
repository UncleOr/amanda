/**
 * The admin API.
 *
 * Or asked for "an admin interface where I can edit things normally instead of
 * in a file", and for the user controls a tester actually needs: delete a
 * player, reset their password, and — the useful one — put a player back to
 * their first minute so a change to the opening can be tried again without
 * making a new account.
 *
 * ALL OF IT LIVES HERE, ON THE SERVER, because all of it needs the service
 * key, and the service key bypasses row-level security entirely. It is on
 * Railway and nowhere else: not in the repo, not in the client, not in a
 * build. The browser gets endpoints, never the key.
 *
 * Every request proves who it is with the caller's own access token, and the
 * `admins` table decides whether that person may do any of this. There is no
 * admin flag on a row a player can reach — we have already been bitten once by
 * assuming row-level security protects a column (db/README.md), and an
 * "is_admin" column on the players table would be exactly that mistake again.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The cards a brand new player starts with, as the database grants them. */
const STARTER = [
  "dragons_01_flame_dragon",
  "giants_01_stone_colossus",
  "insects_01_ant_soldier",
  "plants_01_thorn_sprout",
  "slimes_01_basic_slime",
  "furries_01_chuppy",
];

export interface AdminDeps {
  db: () => SupabaseClient | null;
  send: (res: ServerResponse, code: number, body: unknown) => void;
  readBody: (req: IncomingMessage) => Promise<unknown>;
  /** The caller's user id, from their own token. */
  userFrom: (req: IncomingMessage) => Promise<string | null>;
}

/** True when this user is in the admins table. Nothing else counts. */
async function isAdmin(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await sb.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

/**
 * Put a player back to their first minute.
 *
 * Or's words: "resets the user to the initial state as if they just started
 * playing — it will help us with tests." So it clears the album, the counters
 * and the tutorial flag, then grants the starter cards again. It does NOT
 * touch the account itself: same login, same id, same linked Google — because
 * the point is to replay the opening, not to lose the way back in.
 */
async function resetPlayer(sb: SupabaseClient, playerId: string): Promise<string | null> {
  const wipe = await sb.from("player_cards").delete().eq("player_id", playerId);
  if (wipe.error) return wipe.error.message;

  const reset = await sb
    .from("players")
    .update({ trophies: 0, diamonds: 0, tutorial_done: false })
    .eq("id", playerId);
  if (reset.error) return reset.error.message;

  const grant = await sb
    .from("player_cards")
    .insert(STARTER.map((cardId) => ({ player_id: playerId, card_id: cardId, copies: 1, level: 1 })));
  if (grant.error) return grant.error.message;

  // Chests are a record of matches that no longer happened.
  await sb.from("chests").delete().eq("player_id", playerId);
  return null;
}

/** Returns true when it handled the request. */
export async function handleAdmin(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AdminDeps,
): Promise<boolean> {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (!path.startsWith("/api/admin/")) return false;
  if (req.method === "OPTIONS") {
    deps.send(res, 204, {});
    return true;
  }

  const sb = deps.db();
  if (!sb) {
    deps.send(res, 503, { error: "no database" });
    return true;
  }
  const userId = await deps.userFrom(req);
  if (!userId) {
    deps.send(res, 401, { error: "who are you" });
    return true;
  }
  if (!(await isAdmin(sb, userId))) {
    // Same answer whether the table is empty or you are simply not in it.
    deps.send(res, 403, { error: "not an admin" });
    return true;
  }

  const body = (await deps.readBody(req)) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");

  switch (path) {
    /** Am I an admin? Asked by the client before it shows the panel at all. */
    case "/api/admin/whoami":
      deps.send(res, 200, { ok: true, userId });
      return true;

    case "/api/admin/users": {
      // Two reads joined by hand: the login lives in auth, the game's own
      // record lives in players, and the panel needs both on one line.
      const { data: list, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      const { data: players } = await sb
        .from("players")
        .select("id, nickname, trophies, diamonds, tutorial_done, birth_date");
      const byId = new Map((players ?? []).map((p) => [p.id, p]));
      const { data: cards } = await sb.from("player_cards").select("player_id");
      const cardCount = new Map<string, number>();
      for (const row of cards ?? [])
        cardCount.set(row.player_id, (cardCount.get(row.player_id) ?? 0) + 1);

      deps.send(res, 200, {
        users: list.users.map((u) => {
          const p = byId.get(u.id);
          return {
            id: u.id,
            email: u.email ?? null,
            anonymous: !u.email && u.identities?.length === 0,
            providers: (u.identities ?? []).map((i) => i.provider),
            createdAt: u.created_at,
            lastSeen: u.last_sign_in_at ?? null,
            nickname: p?.nickname ?? null,
            trophies: p?.trophies ?? 0,
            diamonds: p?.diamonds ?? 0,
            tutorialDone: p?.tutorial_done ?? false,
            cards: cardCount.get(u.id) ?? 0,
            isAdmin: u.id === userId,
          };
        }),
      });
      return true;
    }

    case "/api/admin/user/reset": {
      const id = str("userId");
      if (!id) {
        deps.send(res, 400, { error: "which user" });
        return true;
      }
      const err = await resetPlayer(sb, id);
      deps.send(res, err ? 500 : 200, err ? { error: err } : { ok: true });
      return true;
    }

    case "/api/admin/user/password": {
      // Two ways, and the safe one is the default: send them a reset link.
      // Setting a password here would mean an admin typing someone else's
      // password into a form, which is the thing we are trying not to do.
      const email = str("email");
      if (!email) {
        deps.send(res, 400, { error: "that account has no email to send to" });
        return true;
      }
      const { error } = await sb.auth.admin.generateLink({ type: "recovery", email });
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true, sent: email });
      return true;
    }

    case "/api/admin/user/delete": {
      const id = str("userId");
      if (!id) {
        deps.send(res, 400, { error: "which user" });
        return true;
      }
      if (id === userId) {
        deps.send(res, 400, { error: "that is you" });
        return true;
      }
      const { error } = await sb.auth.admin.deleteUser(id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
      return true;
    }

    /** Save edited copy. One id may carry several lines; see copy_strings. */
    case "/api/admin/copy": {
      const rows = Array.isArray(body.rows) ? body.rows : null;
      if (!rows) {
        deps.send(res, 400, { error: "nothing to save" });
        return true;
      }
      const clean = rows
        .map((r) => r as { id?: unknown; variant?: unknown; text?: unknown })
        .filter((r) => typeof r.id === "string" && typeof r.text === "string")
        .map((r) => ({
          id: r.id as string,
          variant: typeof r.variant === "number" ? r.variant : 0,
          text: (r.text as string).trim(),
          updated_at: new Date().toISOString(),
        }));

      // An empty string means "drop this variant", not "show nothing".
      const gone = clean.filter((r) => r.text === "");
      const kept = clean.filter((r) => r.text !== "");
      for (const r of gone)
        await sb.from("copy_strings").delete().eq("id", r.id).eq("variant", r.variant);
      if (kept.length) {
        const { error } = await sb.from("copy_strings").upsert(kept, { onConflict: "id,variant" });
        if (error) {
          deps.send(res, 500, { error: error.message });
          return true;
        }
      }
      deps.send(res, 200, { ok: true, saved: kept.length, removed: gone.length });
      return true;
    }

    default:
      deps.send(res, 404, { error: "no such admin endpoint" });
      return true;
  }
}

/**
 * The public half: every override the game should use, for anyone.
 *
 * Needs no token and no admin — these are the words on the screen. Kept out of
 * the authorised block above on purpose, so a signed-out child still gets
 * whatever Or last wrote.
 */
export async function handleCopy(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AdminDeps,
): Promise<boolean> {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (path !== "/api/copy") return false;
  if (req.method === "OPTIONS") {
    deps.send(res, 204, {});
    return true;
  }
  const sb = deps.db();
  if (!sb) {
    // No database is not an error here: the game ships with every string in
    // it already and simply uses those.
    deps.send(res, 200, { copy: {} });
    return true;
  }
  const { data, error } = await sb.from("copy_strings").select("id, variant, text");
  if (error) {
    deps.send(res, 200, { copy: {} });
    return true;
  }
  const copy: Record<string, string[]> = {};
  for (const row of (data ?? []).sort((a, b) => a.variant - b.variant)) {
    (copy[row.id] ??= []).push(row.text);
  }
  deps.send(res, 200, { copy });
  return true;
}
