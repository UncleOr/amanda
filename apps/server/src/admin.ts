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
import {
  CardSchema,
  givesSomething,
  type GrantFilters,
  type GrantGives,
} from "@amanda/shared";
import { cardState, refreshCards } from "./cards.js";
import { liveState, refreshLive } from "./live.js";
import { aboutPlayer, overview } from "./stats.js";
import { TUNABLES } from "@amanda/shared";
import { listReports } from "./reports.js";
import { audienceOf, deliver, runGrant } from "./shop.js";
import { notify } from "./notify.js";

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
        .select("id, nickname, trophies, diamonds, tutorial_done, birth_date, suspended_until, gender");
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
            gender: (p?.gender as "boy" | "girl" | null) ?? null,
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
      const patch: Record<string, number | string | null> = {};
      if (typeof body.trophies === "number") patch.trophies = Math.max(0, Math.round(body.trophies));
      if (typeof body.diamonds === "number") patch.diamonds = Math.max(0, Math.round(body.diamonds));
      // Null is a real answer — "did not say" — so `gender` being present at
      // all is what decides whether it is written, not whether it is truthy.
      if ("gender" in body)
        patch.gender = body.gender === "boy" || body.gender === "girl" ? body.gender : null;
      if (!Object.keys(patch).length) {
        deps.send(res, 400, { error: "nothing to set" });
        return true;
      }
      // best_trophies only ever goes up, the same as it does in a real match.
      if (typeof patch.trophies === "number") {
        const { data } = await sb.from("players").select("best_trophies").eq("id", id).maybeSingle();
        patch.best_trophies = Math.max(data?.best_trophies ?? 0, patch.trophies);
      }
      const { error } = await sb.from("players").update(patch).eq("id", id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true, ...patch });
      return true;
    }

    /*
     * Give one person specific cards.
     *
     * Or: "it should also be possible to assign specific cards to a user from
     * the admin panel." Goes through the same `deliver` as a purchase and a
     * mass gift, so there is one answer to "what can a player receive" rather
     * than three that drift (see shop.ts).
     */
    case "/api/admin/user/cards": {
      const id = str("userId");
      const cards = Array.isArray(body.cards) ? body.cards : [];
      if (!id || !cards.length) {
        deps.send(res, 400, { error: "למי, ומה" });
        return true;
      }
      const gives = {
        cards: cards
          .filter((c): c is { cardId: string; copies?: number } =>
            !!c && typeof (c as { cardId?: unknown }).cardId === "string",
          )
          .map((c) => ({ cardId: c.cardId, copies: Math.max(1, Math.round(c.copies ?? 1)) })),
      };
      if (!gives.cards.length) {
        deps.send(res, 400, { error: "אין קלפים" });
        return true;
      }
      await deliver(sb, id, gives, "grant");
      await notify(
        sb,
        id,
        "gift",
        { he: "קיבלת קלפים", en: "You received cards" },
        { he: gives.cards.map((c) => c.cardId).join(", ") },
        "album",
      );
      deps.send(res, 200, { ok: true, cards: gives.cards.length });
      return true;
    }

    /* ── gifts to many: the list, the preview, saving, and sending ── */

    case "/api/admin/grants": {
      const { data, error } = await sb
        .from("grants")
        .select("id, name, gives, filters, scheduled_at, executed_at, recipients, active, note, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { grants: data ?? [] });
      return true;
    }

    /*
     * How many people would this reach?
     *
     * Deliberately the SAME function the sending uses (audienceOf), so the
     * number Or is shown and the number that receives it cannot differ. A
     * preview computed by its own query is a preview that will one day be
     * wrong about the one thing it exists to be right about.
     */
    case "/api/admin/grants/preview": {
      const ids = await audienceOf(sb, (body.filters ?? {}) as GrantFilters);
      deps.send(res, 200, { count: ids.length });
      return true;
    }

    case "/api/admin/grants/save": {
      const name = str("name").trim();
      if (!name) {
        deps.send(res, 400, { error: "צריך שם" });
        return true;
      }
      const gives = (body.gives ?? {}) as GrantGives;
      if (!givesSomething(gives)) {
        deps.send(res, 400, { error: "המתנה ריקה" });
        return true;
      }
      const row = {
        name,
        gives,
        filters: (body.filters ?? {}) as GrantFilters,
        scheduled_at: typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null,
        note: str("note") || null,
        active: body.active !== false,
      };
      const id = str("id");
      const { data, error } = id
        ? await sb.from("grants").update(row).eq("id", id).select("id").maybeSingle()
        : await sb.from("grants").insert(row).select("id").maybeSingle();
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true, id: data?.id });
      return true;
    }

    /*
     * Send it now.
     *
     * Safe to press twice: delivery writes a receipt per person and reads the
     * receipts first, so the second press reports everybody as already having
     * it and hands out nothing (see shop.ts).
     */
    case "/api/admin/grants/send": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "איזו מתנה" });
        return true;
      }
      const report = await runGrant(sb, id, (playerId, gname) =>
        notify(
          sb,
          playerId,
          "gift",
          { he: "יש לך מתנה", en: "You have a gift" },
          { he: gname },
          "album",
        ),
      );
      deps.send(res, report.error ? 400 : 200, report);
      return true;
    }

    case "/api/admin/grants/delete": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "איזו מתנה" });
        return true;
      }
      const { error } = await sb.from("grants").delete().eq("id", id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
      return true;
    }

    /* ── the shop ── */

    case "/api/admin/shop": {
      const { data, error } = await sb
        .from("shop_items")
        .select("*")
        .order("sort")
        .order("id");
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { items: data ?? [] });
      return true;
    }

    case "/api/admin/shop/save": {
      const id = str("id").trim();
      if (!id) {
        deps.send(res, 400, { error: "צריך מזהה" });
        return true;
      }
      const row = {
        id,
        kind: str("kind") || "avatar",
        name: body.name ?? { he: id },
        blurb: body.blurb ?? null,
        grants: body.grants ?? {},
        price_diamonds: Math.max(0, Math.round(Number(body.priceDiamonds) || 0)),
        art: str("art") || null,
        active: body.active !== false,
        sort: Math.round(Number(body.sort) || 0),
        available_from: typeof body.availableFrom === "string" && body.availableFrom ? body.availableFrom : null,
        available_until: typeof body.availableUntil === "string" && body.availableUntil ? body.availableUntil : null,
        /*
         * The sale. Both halves or neither: a discount with no end date is
         * not a sale, it is a price, and shop.ts refuses to honour one — so
         * saving a number with no date would quietly do nothing.
         */
        sale_price_diamonds:
          body.salePrice === null || body.salePrice === undefined || body.salePrice === ""
            ? null
            : Math.max(0, Math.round(Number(body.salePrice) || 0)),
        sale_until:
          typeof body.saleUntil === "string" && body.saleUntil ? body.saleUntil : null,
      };
      const { error } = await sb.from("shop_items").upsert(row, { onConflict: "id" });
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
      return true;
    }

    case "/api/admin/shop/delete": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "איזה פריט" });
        return true;
      }
      const { error } = await sb.from("shop_items").delete().eq("id", id);
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { ok: true });
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

    /* ── statistics ──────────────────────────────────────────────── */

    /** Everything about everybody, for the overview screen. */
    case "/api/admin/stats": {
      deps.send(res, 200, await overview(sb));
      return true;
    }

    /** The same questions about one person, from the users tab. */
    case "/api/admin/stats/player": {
      const id = str("userId");
      if (!id) {
        deps.send(res, 400, { error: "איזה משתמש" });
        return true;
      }
      deps.send(res, 200, await aboutPlayer(sb, id));
      return true;
    }

    /* ── the phrases, the series and the numbers ───────────────────
     *
     * Or: *"in the admin interface I need to be able to manage everything:
     * items in the shop including prices, and to add new ones and delete and
     * temporarily take down from the shop, cards, series, sales, phrases,
     * including assigning and giving things to users."*
     *
     * All three follow the card endpoints above exactly: the row is the
     * whole object, saving reloads THIS process (it fights with these
     * values), and deleting a row puts the shipped version back rather than
     * removing anything.
     */

    case "/api/admin/phrases": {
      const { data, error } = await sb
        .from("phrase_overrides")
        .select("id, active, data, updated_at")
        .order("id");
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { rows: data ?? [] });
      return true;
    }

    case "/api/admin/phrases/save": {
      const data = body.data as Record<string, unknown> | undefined;
      const id = typeof data?.id === "string" ? data.id.trim() : "";
      if (!id) {
        deps.send(res, 400, { error: "צריך מזהה למשפט" });
        return true;
      }
      if (typeof data?.he !== "string" || !data.he.trim()) {
        deps.send(res, 400, { error: "צריך משפט" });
        return true;
      }
      const { error } = await sb.from("phrase_overrides").upsert(
        {
          id,
          active: body.active !== false,
          data: { ...data, id },
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "id" },
      );
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      await refreshLive();
      deps.send(res, 200, { ok: true, live: liveState });
      return true;
    }

    /** Forget the override, which puts a shipped line back as it was. */
    case "/api/admin/phrases/revert": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "איזה משפט" });
        return true;
      }
      const { error } = await sb.from("phrase_overrides").delete().eq("id", id);
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      await refreshLive();
      deps.send(res, 200, { ok: true, live: liveState });
      return true;
    }

    case "/api/admin/series": {
      const { data, error } = await sb
        .from("series_overrides")
        .select("id, active, data, sort")
        .order("sort");
      deps.send(res, error ? 500 : 200, error ? { error: error.message } : { rows: data ?? [] });
      return true;
    }

    case "/api/admin/series/save": {
      const id = str("id").trim();
      if (!id) {
        deps.send(res, 400, { error: "איזו סדרה" });
        return true;
      }
      const { error } = await sb.from("series_overrides").upsert(
        {
          id,
          active: body.active !== false,
          data: (body.data as Record<string, unknown>) ?? {},
          sort: body.sort === null || body.sort === undefined ? null : Math.round(Number(body.sort)),
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "id" },
      );
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      await refreshLive();
      deps.send(res, 200, { ok: true, live: liveState });
      return true;
    }

    case "/api/admin/series/revert": {
      const id = str("id");
      if (!id) {
        deps.send(res, 400, { error: "איזו סדרה" });
        return true;
      }
      const { error } = await sb.from("series_overrides").delete().eq("id", id);
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      await refreshLive();
      deps.send(res, 200, { ok: true, live: liveState });
      return true;
    }

    /**
     * The dials, and what they are currently set to.
     *
     * The LIST comes from the code (TUNABLES), not from the table: the label,
     * the warning and the bounds belong beside the dial they describe, and a
     * copy of them in the database would be a second answer to "what is the
     * most this may be" that the server does not enforce.
     */
    case "/api/admin/tunables": {
      deps.send(res, 200, {
        dials: TUNABLES.map((t) => ({
          id: t.id,
          he: t.he,
          note: t.note,
          min: t.min,
          max: t.max,
          step: t.step,
          value: t.get(),
        })),
      });
      return true;
    }

    case "/api/admin/tunables/save": {
      const rows = Array.isArray(body.rows) ? body.rows : null;
      if (!rows) {
        deps.send(res, 400, { error: "nothing to save" });
        return true;
      }
      const known = new Map(TUNABLES.map((t) => [t.id, t]));
      const clean = rows
        .map((r) => r as { id?: unknown; value?: unknown })
        .filter((r) => typeof r.id === "string" && known.has(r.id) && Number.isFinite(Number(r.value)))
        .map((r) => {
          const dial = known.get(r.id as string)!;
          return {
            id: r.id as string,
            // Clamped HERE as well as on the way in, because the bounds are
            // the whole protection and a panel is a thing anybody can forge a
            // request to. See applyTunables for the other half of it.
            value: Math.min(dial.max, Math.max(dial.min, Number(r.value))),
            updated_at: new Date().toISOString(),
            updated_by: userId,
          };
        });
      if (!clean.length) {
        deps.send(res, 400, { error: "אין פה מספר שאני מכיר" });
        return true;
      }
      const { error } = await sb.from("tunables").upsert(clean, { onConflict: "id" });
      if (error) {
        deps.send(res, 500, { error: error.message });
        return true;
      }
      await refreshLive();
      deps.send(res, 200, { ok: true, saved: clean.length, live: liveState });
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
