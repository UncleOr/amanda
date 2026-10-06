/**
 * The one Supabase client this process has.
 *
 * It used to be two: `api.ts` built one for the admin endpoints and
 * `progress.ts` built another for trophies and chests. When supabase-js turned
 * out to need a WebSocket that Railway's Node does not have, only one of them
 * was fixed — so the admin panel started working while every match still
 * silently saved nothing. The bug was invisible because both call sites are
 * fire-and-forget by design: a missing database must never stop a game.
 *
 * So there is one client, with one set of options, and anything that needs the
 * service key imports it from here.
 *
 * THE KEY IS SECRET. It bypasses row-level security completely. It lives in
 * the host's environment and must never reach the repo, the client, a log or
 * an error message.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

export const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://iiviygfltyrsonioyqxm.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

/** True when this process was given the key it needs to write anything. */
export const CAN_SAVE = Boolean(SUPABASE_URL && SERVICE_KEY);

let client: SupabaseClient | null = null;

export function db(): SupabaseClient | null {
  if (!CAN_SAVE) return null;
  if (!client)
    client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      /*
       * supabase-js builds a realtime client whether or not anything
       * subscribes, and it wants a global WebSocket for it. Node only has one
       * from version 22 and the container is older, so without this EVERY
       * query fails with "Node.js detected but native WebSocket not found".
       *
       * This server subscribes to nothing. It is handed the `ws` it already
       * depends on purely so the realtime client can exist and be ignored.
       */
      realtime: { transport: WebSocket as unknown as never },
    });
  return client;
}

/** How long the key is, for the health check. Never the key itself. */
export const keyLength = SERVICE_KEY.length;
export const keyStartsWith = SERVICE_KEY.slice(0, 3);
export const keyHasWhitespace = /\s/.test(SERVICE_KEY);
