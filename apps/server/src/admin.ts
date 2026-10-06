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
import { CardSchema } from "@amanda/shared";
import { cardState, refreshCards } from "./cards.js";
import { listReports } from "./reports.js";

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
  try {
    return await adminRoutes(req, res, deps, sb, path);
  } catch (err) {
    // Answer, rather than rejecting into the caller. See the note in index.ts
    // about what a rejection here used to cost.
    deps.send(res, 500, { error: (err as Error).message });
    return true;
  }
}

async function adminRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AdminDeps,
  sb: SupabaseClient,
  path: string,
): Promise<boolean> {
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
        .select("id, nickname, trophies, diamonds, tutorial_done, birth_date, suspended_until");
      const { data: adminRows } = await sb.from("admins").select("user_id");
      const adminIds = new Set((adminRows ?? []).map((r) => r.user_id));
      const byId = new Map((players ?? []).map((p) => [p.id, p]));
      const { data: cards } = await sb.from("player_cards").select("player_id");
      const cardCount = new Map<string, number>();
      for (const row of cards ?? [])
        cardCount.set(row.player_id, (cardCount.get(row.player_id) ?? 0) + 1);

      /*
       * Or: "in the user interface, anonymous users should not be kept."
       *
       * Every visitor gets an anonymous account from their first second, so
       * the list fills up with people who opened the game once and never came
       * back — and the ones who actually play are buried. Only accounts with
       * a real identity are listed.
       *
       * They are NOT deleted. An anonymous account is a child's album, and it
       * becomes a named one the moment they sign in; throwing it away would
       * throw away everything they collected before they got round to that.
       * This is about what the list shows, not about what exists.
       */
      const real = list.users.filter((u) => !!u.email || (u.identities?.length ?? 0) > 0);

      deps.send(res, 200, {
        hiddenAnonymous: list.users.length - real.length,
        users: real.map((u) => {
          const p = byId.get(u.id);
          return {
            id: u.id,
            email: u.email ?? null,
            anonymous: false,
            providers: (u.identities ?? []).map((i) => i.provider),
            createdAt: u.created_at,
            lastSeen: u.last_sign_in_at ?? null,
            nickname: p?.nickname ?? null,
            trophies: p?.trophies ?? 0,
            diamonds: p?.diamonds ?? 0,
            tutorialDone: p?.tutorial_done ?? false,
            cards: cardCount.get(u.id) ?? 0,
            isYou: u.id === userId,
            isAdmin: adminIds.has(u.id),
            suspendedUntil: p?.suspended_until ?? null,
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

    /*
     * Hand a player trophies or diamonds, for testing.
     *
     * Or: "give me options in the admin to bump users' diamonds and arenas,
     * say for test purposes." Arenas ARE trophies — the ladder is a trophy
     * range (packages/shared/src/arenas.ts) — so setting trophies is how you
     * put somebody in the petrol station, and there is nothing else to set.
     *
     * Absolute values, not deltas. "Put this account in the alley" is a thing
     * you want to be able to do twice and get the same answer; "+900" is not.
     */
    /** The inbox. */
    case "/api/admin/reports": {
      const want = str("status");
      const status = want === "done" || want === "all" ? want : "open";
      deps.send(res, 200, { reports: await listReports(sb, status) });
      return true;
    }

    /** Mark one dealt with. Suspending is a separate, deliberate second act. */
    case "/api/admin/report/handle": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "which report" });
        return true;
      }
      const { error } = await sb
        .from("reports")
        .update({
          status: "done",
          handled_by: userId,
          handled_at: new Date().toISOString(),
          handled_note: str("note") || null,
        })
        .eq("id", id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
      return true;
    }

    case "/api/admin/user/grant": {
      const id = str("userId");
      if (!id) {
        deps.send(res, 400, { error: "which user" });
        return true;
      }
      const patch: Record<string, number> = {};
      if (typeof body.trophies === "number") patch.trophies = Math.max(0, Math.round(body.trophies));
      if (typeof body.diamonds === "number") patch.diamonds = Math.max(0, Math.round(body.diamonds));
      if (!Object.keys(patch).length) {
        deps.send(res, 400, { error: "nothing to set" });
        return true;
      }
      // best_trophies only ever goes up, the same as it does in a real match.
      if (patch.trophies !== undefined) {
        const { data } = await sb.from("players").select("best_trophies").eq("id", id).maybeSingle();
        patch.best_trophies = Math.max(data?.best_trophies ?? 0, patch.trophies);
      }
      const { error } = await sb.from("players").update(patch).eq("id", id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true, ...patch });
      return true;
    }

    /*
     * Suspend a player, for a while or for good.
     *
     * TWO LOCKS, because they stop different things. Supabase's own ban stops
     * them getting a new token — the right lock on the front door, and no use
     * at all against a session already open in a browser, because tokens live
     * an hour. The column on `players` is what the match server checks before
     * it will queue anybody, so a suspension bites on the next match instead
     * of within the hour.
     *
     * `hours: 0` lifts it. No hours at all means indefinitely, written as a
     * date far enough away that there is one shape to read everywhere.
     */
    case "/api/admin/user/suspend": {
      const id = str("userId");
      if (!id) {
        deps.send(res, 400, { error: "which user" });
        return true;
      }
      if (id === userId) {
        deps.send(res, 400, { error: "that is you" });
        return true;
      }
      const hours = typeof body.hours === "number" ? body.hours : null;
      const lift = hours === 0;
      const until = lift
        ? null
        : new Date(Date.now() + (hours ?? 24 * 365 * 50) * 3600_000).toISOString();

      const { error } = await sb
        .from("players")
        .update({ suspended_until: until, suspended_reason: lift ? null : str("reason") || null })
        .eq("id", id);
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      // The front door. "none" is Supabase's way of lifting a ban.
      await sb.auth.admin.updateUserById(id, {
        ban_duration: lift ? "none" : `${hours ?? 24 * 365 * 50}h`,
      });
      deps.send(res, 200, { ok: true, suspendedUntil: until });
      return true;
    }

    /*
     * Make somebody an admin, or stop them being one.
     *
     * Or: "at this stage I will not make Hod an admin, it is frightening." So
     * it asks for a real confirmation in the UI, and an admin can never remove
     * themselves — locking yourself out of the only panel that can let you
     * back in is a mistake with no undo.
     */
    case "/api/admin/user/admin": {
      const id = str("userId");
      const make = body.make !== false;
      if (!id) {
        deps.send(res, 400, { error: "which user" });
        return true;
      }
      if (id === userId && !make) {
        deps.send(res, 400, { error: "אי אפשר להוריד את עצמך" });
        return true;
      }
      const { error } = make
        ? await sb.from("admins").upsert({ user_id: id }, { onConflict: "user_id" })
        : await sb.from("admins").delete().eq("user_id", id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true, admin: make });
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

    /*
     * ── cards ──
     *
     * The editor sends a whole card, in exactly the shape the engine reads, so
     * there is no translation layer to get wrong. It is validated HERE as well
     * as in the browser, because the browser is not a place to check anything:
     * a card that does not parse would be accepted and then behave as a blank
     * in a battle somebody is playing.
     */
    case "/api/admin/cards": {
      const rows = Array.isArray(body.rows) ? body.rows : null;
      if (!rows) {
        deps.send(res, 400, { error: "nothing to save" });
        return true;
      }
      const saved: string[] = [];
      for (const raw of rows) {
        const r = raw as { id?: unknown; seriesId?: unknown; active?: unknown; data?: unknown };
        if (typeof r.id !== "string" || typeof r.seriesId !== "string") continue;
        const active = r.active !== false;
        // A hidden card needs no valid body — it is not going to be played.
        if (active) {
          const parsed = CardSchema.safeParse(r.data);
          if (!parsed.success) {
            deps.send(res, 400, {
              error: `${r.id}: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`,
            });
            return true;
          }
        }
        const { error } = await sb.from("card_overrides").upsert(
          {
            id: r.id,
            series_id: r.seriesId,
            active,
            data: r.data ?? {},
            updated_at: new Date().toISOString(),
            updated_by: userId,
          },
          { onConflict: "id" },
        );
        if (error) {
          deps.send(res, 500, { error: error.message });
          return true;
        }
        saved.push(r.id);
      }
      // This process fights with these cards, so it reloads immediately.
      await refreshCards();
      deps.send(res, 200, { ok: true, saved, cards: cardState });
      return true;
    }

    /** Forget an override entirely, which puts a shipped card back as it was. */
    case "/api/admin/cards/revert": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "which card" });
        return true;
      }
      const { error } = await sb.from("card_overrides").delete().eq("id", id);
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      await refreshCards();
      deps.send(res, 200, { ok: true, cards: cardState });
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
  /*
   * Any failure answers with "no overrides" rather than throwing. These are
   * the words on the screen: the game already has all of them, so the worst
   * case of a broken query is that Or's latest edit is not shown yet.
   */
  try {
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
  } catch {
    deps.send(res, 200, { copy: {} });
  }
  return true;
}
