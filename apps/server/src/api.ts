/**
 * The small HTTP API beside the match server.
 *
 * Levelling a card lives here rather than in a Postgres function for the same
 * reason chest contents do: the cost depends on a card's RARITY, and the
 * database deliberately does not know what a card is (db/README.md). This
 * process has the catalog and the service key, so it is the one place that can
 * both price the upgrade and apply it.
 *
 * Every request proves who it is with the player's own access token. The
 * player id is read from that token and never taken from the body — otherwise
 * anyone could level anyone's cards, or their own for free.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { LEVELS, levelCost } from "@amanda/shared";
import { CATALOG } from "./content.js";
import { handleAdmin, handleCopy } from "./admin.js";

const URL = process.env.SUPABASE_URL ?? "https://iiviygfltyrsonioyqxm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

let admin: SupabaseClient | null = null;
export function db(): SupabaseClient | null {
  if (!SERVICE_KEY) return null;
  if (!admin)
    admin = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      /*
       * A WebSocket, handed over explicitly.
       *
       * supabase-js builds a realtime client whether or not anything
       * subscribes, and it wants a global WebSocket for it. Node only has one
       * from 22, and the Railway container is older — so with the key finally
       * set, EVERY query failed with "Node.js detected but native WebSocket
       * not found" and the first thing that worked was a diagnostic that
       * asked the database what was wrong.
       *
       * This server never subscribes to anything. It is passed the `ws`
       * implementation it already depends on purely so the realtime client
       * can exist quietly and never be used.
       */
      realtime: { transport: WebSocket as unknown as never },
    });
  return admin;
}

export function send(res: ServerResponse, code: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    // The game is served from a different origin to this server.
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  });
  res.end(text);
}

export function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      // Nothing here needs a large body; refuse to buffer one.
      // Big enough for a screenful of edited copy, small enough that nobody
      // can make us buffer anything interesting.
      if (raw.length > 262144) raw = raw.slice(0, 262144);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

/** Who is calling, according to their own token — not according to the body. */
export async function playerFrom(req: IncomingMessage): Promise<string | null> {
  const sb = db();
  const auth = req.headers.authorization;
  if (!sb || !auth?.startsWith("Bearer ")) return null;
  const { data, error } = await sb.auth.getUser(auth.slice(7));
  if (error) return null;
  return data.user?.id ?? null;
}

/**
 * Spend copies to raise one card a level.
 *
 * Reads the card's current state from the database rather than trusting
 * anything sent in, so the price is charged against what the player actually
 * holds at this moment.
 */
async function levelUp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 503, { error: "no database" });
  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });

  const body = (await readBody(req)) as { cardId?: unknown };
  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  const card = CATALOG.get(cardId);
  if (!card) return send(res, 400, { error: "no such card" });

  const { data: owned } = await sb
    .from("player_cards")
    .select("copies, level")
    .eq("player_id", playerId)
    .eq("card_id", cardId)
    .maybeSingle();
  if (!owned) return send(res, 400, { error: "you do not have that card" });
  if (owned.level >= LEVELS.max) return send(res, 400, { error: "already at the top" });

  const cost = levelCost(card.rarity, owned.level);
  if (owned.copies < cost) return send(res, 400, { error: "not enough copies", cost });

  const { error } = await sb
    .from("player_cards")
    .update({ copies: owned.copies - cost, level: owned.level + 1 })
    .eq("player_id", playerId)
    .eq("card_id", cardId);
  if (error) return send(res, 500, { error: error.message });

  send(res, 200, { ok: true, level: owned.level + 1, copies: owned.copies - cost, spent: cost });
}

/** Returns true when it handled the request. */
const adminDeps = { db, send, readBody, userFrom: playerFrom };

/**
 * Is this process actually able to write to the database?
 *
 * Worth an endpoint, because the answer was NO for an unknown length of time
 * and nothing said so. Nineteen accounts existed with zero trophies and zero
 * chests between them: the service key was never reaching the process, every
 * save silently did nothing, and the game carried on looking fine because it
 * is built to survive exactly that.
 *
 * NAMES AND BOOLEANS ONLY. The key itself never appears here, in a log, or in
 * any response — it bypasses row-level security completely, and anything that
 * can print it is a way to leak it.
 */
/**
 * Scrub anything token-shaped out of a message before it leaves the process.
 *
 * Supabase puts the key it rejected into its own error text, so an error
 * message is a way to leak the key. Any long run of key characters goes.
 */
function scrub(text: string): string {
  return text.replace(/[A-Za-z0-9_\-.]{30,}/g, "<redacted>");
}

async function health(res: ServerResponse): Promise<void> {
  const names = Object.keys(process.env).filter(
    (k) => k.includes("SUPABASE") || k.includes("SERVICE"),
  );
  const key = process.env.SUPABASE_SERVICE_KEY ?? "";
  /*
   * Actually try it, rather than reporting that a variable exists.
   *
   * "A key is present" and "the key works" turned out to be very different
   * things: with the key set, every database request threw and the answer to
   * why was only in a log nobody here can read.
   */
  let dbError: string | null = null;
  let rows: number | null = null;
  try {
    const sb = db();
    if (!sb) dbError = "no client";
    else {
      const { error, count } = await sb
        .from("copy_strings")
        .select("id", { count: "exact", head: true });
      if (error) dbError = scrub(error.message);
      else rows = count ?? 0;
    }
  } catch (err) {
    dbError = scrub((err as Error).message);
  }
  send(res, 200, {
    ok: true,
    /** True when a key is present AND looks like one, rather than a stray word. */
    canSave: key.length > 40,
    keyPresent: key.length > 0,
    keyLength: key.length,
    /** Shape only — enough to tell a JWT from a publishable key from junk. */
    keyStartsWith: key.slice(0, 3),
    keyHasWhitespace: /\s/.test(key),
    /** Did a real query work, and if not, why. */
    dbError,
    copyRows: rows,
    /** Which Supabase-ish variables this process can see, by name only. */
    sees: names,
    url: URL,
  });
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = (req.url ?? "").split("?")[0];
  if (path === "/api/health") {
    await health(res);
    return true;
  }
  // The words on the screen, for anyone, signed in or not.
  if (await handleCopy(req, res, adminDeps)) return true;
  // Everything behind the admin panel. It checks the admins table itself.
  if (await handleAdmin(req, res, adminDeps)) return true;
  if (path !== "/api/level-up") return false;
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return true;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "post only" });
    return true;
  }
  try {
    await levelUp(req, res);
  } catch (err) {
    // See the note in index.ts: answering beats rejecting, because a rejection
    // here used to end every match the server was running.
    send(res, 500, { error: (err as Error).message });
  }
  return true;
}
