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

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = (req.url ?? "").split("?")[0];
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
  await levelUp(req, res);
  return true;
}
