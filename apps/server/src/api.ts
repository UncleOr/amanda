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
import { LEVELS, levelCost } from "@amanda/shared";
import { CATALOG } from "./content.js";
import { grantChest, saves } from "./progress.js";
import { fileReport, recentOpponents } from "./reports.js";
import { acceptFriend, addableOpponents, askFriend, listFriends, removeFriend } from "./friends.js";
import { isOnline } from "./presence.js";
import { buy, ownedItems, shopWindow } from "./shop.js";
import { inbox, markRead } from "./notify.js";
import { handleAdmin, handleCopy } from "./admin.js";
import { awardMatch, claim, factsFor, standings } from "./meta.js";
import { soloResult } from "./solo.js";

import { SUPABASE_URL as URL, db, keyHasWhitespace, keyLength, keyStartsWith } from "./supabase.js";
import { phraseOverrides, seriesOverrides, tunableValues, tutorialOverrides } from "./live.js";
import { MAX_EVENT_BYTES, track, type EventKind } from "./events.js";

/**
 * The only event kinds a browser may report.
 *
 * Everything else — a purchase, a chest, what a match paid — is written by
 * the server from what it did itself, so there is nothing here anyone could
 * claim that would be worth claiming.
 *
 * `crash` is here because a screen that has just fallen over is the one thing
 * only the browser can report, and the alternative — a message in a console
 * on a child's phone — is no report at all.
 *
 * `playground` is its own kind rather than a `match` with a mode, which it
 * nearly was. A browser allowed to report matches is a browser allowed to
 * report WON matches, and a leaderboard of made-up wins is the one statistic
 * on this screen that would be worth forging. The playground has no result
 * and no reward, so counting one costs nothing even if somebody lies about
 * it — and keeping it a separate word is what makes that true by
 * construction rather than by a check somebody has to remember.
 */
const FROM_BROWSER = ["open", "quit", "playground", "crash"] as const;

export { db };

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
/**
 * Open one of your own chests.
 *
 * What is inside was decided and written down when the match was won
 * (progress.ts) — this only breaks the seal and hands it over. That split is
 * the whole security of it: if the contents were rolled here, the player would
 * be asking for a prize at a moment they choose, and choosing is the one thing
 * they must not be able to do.
 *
 * Reads the chest by id AND by the caller's own player id, so asking for
 * somebody else's chest finds nothing rather than finding theirs. Idempotent:
 * a chest that is already open gives its contents back and grants nothing
 * twice, because a dropped connection must not cost a prize or double one.
 */
async function openChest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 503, { error: "no database" });
  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });

  const body = (await readBody(req)) as { chestId?: unknown };
  const chestId = typeof body.chestId === "string" ? body.chestId : "";
  if (!chestId) return send(res, 400, { error: "which chest" });

  const { data: chest } = await sb
    .from("chests")
    .select("id, kind, contents, opened_at")
    .eq("id", chestId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (!chest) return send(res, 404, { error: "no such chest" });

  const won = (chest.contents ?? {}) as {
    cards?: string[];
    diamonds?: number;
    items?: string[];
  };
  // `items` only when there are any, so a chest without one does not send an
  // empty array that the reveal would have to know to ignore.
  const contents = {
    cards: won.cards ?? [],
    diamonds: won.diamonds ?? 0,
    ...(won.items?.length ? { items: won.items } : {}),
  };

  if (chest.opened_at) {
    // Already open. Say what was in it and grant nothing.
    return send(res, 200, { ok: true, alreadyOpen: true, kind: chest.kind, ...contents });
  }

  // Mark it open FIRST and only on the row that is still closed. Two taps that
  // arrive together leave exactly one of them holding the prize.
  const { data: claimed } = await sb
    .from("chests")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", chestId)
    .eq("player_id", playerId)
    .is("opened_at", null)
    .select("id");
  if (!claimed?.length) {
    return send(res, 200, { ok: true, alreadyOpen: true, kind: chest.kind, ...contents });
  }

  // Which of them the album had never held. The celebration on the other end
  // needs an answer only this moment can give — see grantChest.
  const fresh = await grantChest(sb, playerId, contents);
  // What was in it, and how much of it was new — which is the difference
  // between "chests are exciting" and "chests are duplicates", and the one
  // number that says whether the collection is working.
  track(sb, playerId, "chest", {
    kind: chest.kind,
    cards: contents.cards.length,
    diamonds: contents.diamonds,
    fresh: fresh.length,
  });
  if (contents.diamonds > 0) {
    const { data: row } = await sb
      .from("players")
      .select("diamonds")
      .eq("id", playerId)
      .maybeSingle();
    await sb
      .from("players")
      .update({ diamonds: (row?.diamonds ?? 0) + contents.diamonds })
      .eq("id", playerId);
  }
  send(res, 200, { ok: true, kind: chest.kind, ...contents, fresh });
}

/**
 * Delete your own account, from inside the game.
 *
 * NOT a nice-to-have. Both stores have required this since 2022: if an app
 * lets you create an account, it must let you delete it from the app, and the
 * route to it must not be hidden. We had deletion in the admin panel only,
 * which is not the same thing and would have failed review.
 *
 * It deletes the auth user, and everything else follows: players, chests,
 * player_cards and matches all reference it with `on delete cascade`, so there
 * is no list of tables here to forget to update when a new one is added.
 *
 * No confirmation token and no grace period on purpose. A seven-year-old who
 * wants their account gone should not need an email to get it, and the UI asks
 * twice before it ever reaches here.
 */
async function deleteSelf(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 503, { error: "no database" });
  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });

  const { error } = await sb.auth.admin.deleteUser(playerId);
  if (error) return send(res, 500, { error: error.message });
  send(res, 200, { ok: true });
}

/** File a report, or ask who there is to report. */
async function handleReports(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 503, { error: "no database" });
  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });

  if (path === "/api/report/opponents") {
    return send(res, 200, { opponents: await recentOpponents(sb, playerId) });
  }

  const body = (await readBody(req)) as Record<string, unknown>;
  const kind = body.kind === "player" ? "player" : "bug";
  const error = await fileReport(sb, playerId, {
    kind,
    reportedId: typeof body.reportedId === "string" ? body.reportedId : null,
    aboutMatch: typeof body.aboutMatch === "string" ? body.aboutMatch : null,
    message: typeof body.message === "string" ? body.message : "",
  });
  send(res, error ? 400 : 200, error ? { error } : { ok: true });
}

/** Friends: the list, who there is to add, and the three things you can do. */
async function handleFriends(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 503, { error: "no database" });
  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });

  if (path === "/api/friends") {
    return send(res, 200, { friends: await listFriends(sb, playerId, isOnline) });
  }
  if (path === "/api/friends/addable") {
    return send(res, 200, { opponents: await addableOpponents(sb, playerId) });
  }

  const body = (await readBody(req)) as Record<string, unknown>;
  const other = typeof body.playerId === "string" ? body.playerId : "";
  if (!other) return send(res, 400, { error: "מי?" });

  const error =
    path === "/api/friends/ask"
      ? await askFriend(sb, playerId, other)
      : path === "/api/friends/accept"
        ? await acceptFriend(sb, playerId, other)
        : path === "/api/friends/remove"
          ? await removeFriend(sb, playerId, other)
          : "לא ידוע";
  send(res, error ? 400 : 200, error ? { error } : { ok: true });
}

/**
 * The shop, and what the player already owns.
 *
 * The window itself is public — it is a price list, and the game draws it
 * before anybody signs in. Only "what is mine" and "buy this" need to know
 * who you are.
 */
async function handleShop(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 200, { items: [], owned: [] });

  if (path === "/api/shop") {
    const items = await shopWindow(sb);
    const playerId = await playerFrom(req);
    const owned = playerId ? await ownedItems(sb, playerId) : [];
    return send(res, 200, { items, owned });
  }

  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });
  const body = (await readBody(req)) as Record<string, unknown>;
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  if (!itemId) return send(res, 400, { error: "מה?" });
  const error = await buy(sb, playerId, itemId);
  send(res, error ? 400 : 200, error ? { error } : { ok: true });
}

/** The player's own inbox. */
/**
 * Nachos and challenges: what is live, what a match was worth, and claiming.
 *
 * `/api/meta` is readable without an account — a guest sees today's three
 * challenges at zero, which is the whole point of showing them a locked thing
 * rather than hiding it.
 *
 * `/api/meta/solo` is the one that matters. It is handed the two boards and
 * the seed of a match the browser played against the bot, and it RE-RUNS that
 * battle here before paying anything out: see meta.ts for why the outcome is
 * never taken from the client.
 */
async function handleMeta(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const sb = db();
  const playerId = await playerFrom(req);

  if (path === "/api/meta") {
    if (!sb) return send(res, 200, { challenges: [] });
    return send(res, 200, { challenges: await standings(sb, playerId) });
  }

  if (!sb) return send(res, 200, { nachos: 0, chests: [], moved: [] });
  if (!playerId) return send(res, 401, { error: "who are you" });

  if (path === "/api/meta/solo") {
    const outcome = soloResult(await readBody(req));
    if ("error" in outcome) return send(res, 400, { error: outcome.error });
    const facts = factsFor(outcome.result, "A", outcome.mine);
    const award = await awardMatch(sb, playerId, facts, new Date(), outcome.level);
    // The score comes back from HERE even though the browser graded the same
    // battle itself: one authority, so a bug in either grader shows up as a
    // disagreement on the screen rather than as a quiet difference in pay.
    return send(res, 200, { ...award, score: facts.score, won: facts.won });
  }

  if (path === "/api/meta/claim") {
    const body = (await readBody(req)) as Record<string, unknown>;
    const id = typeof body.challengeId === "string" ? body.challengeId : "";
    if (!id) return send(res, 400, { error: "מה?" });
    const done = await claim(sb, playerId, id);
    return send(res, done.ok ? 200 : 400, done.ok ? { ok: true, gave: done.gave } : { error: done.why });
  }

  send(res, 404, { error: "no such thing" });
}

async function handleInbox(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  const sb = db();
  if (!sb) return send(res, 200, { notices: [], unread: 0 });
  const playerId = await playerFrom(req);
  if (!playerId) return send(res, 401, { error: "who are you" });
  if (path === "/api/inbox/read") {
    await markRead(sb, playerId);
    return send(res, 200, { ok: true });
  }
  send(res, 200, await inbox(sb, playerId));
}

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
    canSave: keyLength > 40,
    keyPresent: keyLength > 0,
    keyLength,
    /** Shape only — enough to tell a JWT from a publishable key from junk. */
    keyStartsWith,
    keyHasWhitespace,
    /** Did a real query work, and if not, why. */
    dbError,
    copyRows: rows,
    /* Whether finished matches are actually turning into trophies. */
    saves: { ...saves, lastError: saves.lastError ? scrub(saves.lastError) : null },
    /** Which Supabase-ish variables this process can see, by name only. */
    sees: names,
    url: URL,
  });
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  // Defaulted twice: `split` is typed as possibly returning undefined, and the
  // routes below call string methods on this.
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (path === "/api/health") {
    await health(res);
    return true;
  }
  // The cards, for anyone. Same shape and same reasoning as /api/copy.
  if (path === "/api/cards") {
    const sb = db();
    if (!sb) {
      send(res, 200, { cards: [] });
      return true;
    }
    try {
      const { data, error } = await sb
        .from("card_overrides")
        .select("id, series_id, active, data");
      send(res, 200, { cards: error ? [] : (data ?? []) });
    } catch {
      // The game ships with every card it has; an empty answer costs nothing.
      send(res, 200, { cards: [] });
    }
    return true;
  }
  /*
   * The phrases, the series and the numbers, for anyone.
   *
   * ONE request for all three rather than three, because the browser wants
   * all three at the same moment — boot — and three round trips on a phone is
   * three chances to be slow. Served from what this process already has in
   * memory (live.ts), so it costs no database call at all.
   *
   * Same promise as /api/cards and /api/copy: an empty answer is a correct
   * answer. The game ships with its own phrases, its own series and its own
   * numbers, and nothing here is awaited before a child can press play.
   */
  /*
   * ═══ WHAT ONLY THE BROWSER KNOWS ═══
   *
   * Three of the things Or asked to count never reach the server on their
   * own: opening the game, leaving a match half way through, and the
   * playground (which is played entirely in the browser and has no result to
   * report). So the browser says.
   *
   * ═══ AND WHY THAT IS NOT A HOLE ═══
   *
   * An endpoint that takes events from a client is an endpoint somebody can
   * post nonsense to. Four things keep it boring:
   *
   *   only three KINDS are accepted here. Everything that touches money,
   *     cards or trophies — buying, chests, match rewards — is written by the
   *     server from what it did itself and can never be claimed from outside.
   *   the player id comes from the TOKEN, never from the body, so nobody can
   *     write into somebody else's history.
   *   the data bag is capped and stored as-is, never read back as code.
   *   nothing here grants anything. The worst a forged request achieves is a
   *     wrong number on Or's statistics screen.
   */
  if (path === "/api/track") {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    const body = (await readBody(req)) as { kind?: unknown; data?: unknown };
    const kind = typeof body.kind === "string" ? body.kind : "";
    if (!FROM_BROWSER.includes(kind as (typeof FROM_BROWSER)[number])) {
      send(res, 400, { error: "not a thing" });
      return true;
    }
    const data = body.data && typeof body.data === "object" ? (body.data as object) : {};
    if (JSON.stringify(data).length > MAX_EVENT_BYTES) {
      send(res, 400, { error: "too much" });
      return true;
    }
    // A guest is a real person having a real session; `playerFrom` returning
    // nothing is a null player id and not a refusal.
    track(db(), await playerFrom(req), kind as EventKind, data as Record<string, unknown>);
    send(res, 200, { ok: true });
    return true;
  }

  if (path === "/api/live") {
    send(res, 200, {
      phrases: phraseOverrides(),
      series: seriesOverrides(),
      tunables: tunableValues(),
      tutorial: tutorialOverrides(),
    });
    return true;
  }
  // The words on the screen, for anyone, signed in or not.
  if (await handleCopy(req, res, adminDeps)) return true;
  // Everything behind the admin panel. It checks the admins table itself.
  if (await handleAdmin(req, res, adminDeps)) return true;
  if (path.startsWith("/api/shop") || path.startsWith("/api/inbox")) {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    try {
      if (path.startsWith("/api/inbox")) await handleInbox(req, res, path);
      else await handleShop(req, res, path);
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
    return true;
  }
  if (path.startsWith("/api/meta")) {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    try {
      await handleMeta(req, res, path);
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
    return true;
  }
  if (path.startsWith("/api/friends")) {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    try {
      await handleFriends(req, res, path);
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
    return true;
  }
  if (path.startsWith("/api/report")) {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    try {
      await handleReports(req, res, path);
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
    return true;
  }
  if (path === "/api/account/delete") {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    try {
      await deleteSelf(req, res);
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
    return true;
  }
  if (path === "/api/chest/open") {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return true;
    }
    try {
      await openChest(req, res);
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
    return true;
  }
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
