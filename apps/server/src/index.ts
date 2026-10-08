import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  encode,
  type ClientMessage,
  type RoomError,
} from "@amanda/shared";
import { Match } from "./match.js";
import { arrived, deliver, left as presenceLeft, presenceCounts } from "./presence.js";
import { areFriends } from "./friends.js";
import { PROGRESS_ENABLED } from "./progress.js";
import { handleApi } from "./api.js";
import { cardOf, forget, loadProfile, profileOf } from "./profiles.js";
import { refreshCards } from "./cards.js";
import { refreshLive } from "./live.js";
import { reportLiveWith } from "./liveops.js";
import { startScheduler } from "./schedule.js";
import { findPair, type Waiting } from "./matchmaking.js";
import { db } from "./supabase.js";
import "./content.js"; // eager-load the card catalog at boot

const PORT = Number(process.env.PORT ?? 2567);

/** A private room is abandoned if nobody joins it within this long. */
const ROOM_TTL_MS = 15 * 60 * 1000;

// A tiny HTTP server for health checks (hosts like Render probe GET /).
const http = createServer((req, res) => {
  // The small API (levelling, copy, admin) shares this server; anything it
  // does not claim falls through to the health check a host probes.
  void handleApi(req, res)
    .then((handled) => {
      if (handled) return;
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("Amanda multiplayer server — OK");
    })
    .catch((err) => {
      /*
       * A failing HTTP request must not take the match server with it.
       *
       * It did. The moment the service key arrived and the admin endpoints
       * could really reach the database, one rejected query became an
       * unhandled rejection — which Node turns into process.exit — and the
       * server crash-looped. Every battle in progress died with it, for a
       * request nobody was even playing.
       */
      console.error("[api] request failed:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "server error" }));
      } else {
        res.end();
      }
    });
});

/*
 * The last line of defence, for the same reason.
 *
 * Node kills the process on an unhandled rejection by default. For a server
 * that holds every live match in memory, that trade is exactly backwards: one
 * stray promise anywhere is worth less than the games already being played.
 */
process.on("unhandledRejection", (err) => {
  console.error("[fatal-ish] unhandled rejection, staying up:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[fatal-ish] uncaught exception, staying up:", err);
});

/*
 * Whatever Or has changed about the cards, before anybody can start a match.
 * Fire and forget: a failure here leaves the catalogue the files describe,
 * which is a game, and waiting on it would mean a database outage stops play.
 */
void refreshCards();
/*
 * And whatever he has changed about the phrases, the series and the numbers.
 * Same arrangement and the same reasoning — see live.ts.
 */
void refreshLive();

/*
 * Hand the admin panel a window onto this process.
 *
 * Everything it reads is a plain variable a few lines below — the queue, the
 * rooms, the matches. None of it was visible anywhere, which meant the first
 * sign of broken matchmaking would have been a child saying "it is stuck".
 * See liveops.ts for why it is a registered reader rather than an import.
 */
reportLiveWith(() => ({
  ...presenceCounts(),
  queue: queue.length,
  rooms: rooms.size,
  // One Match object is one match, however many sockets are attached to it.
  matches: new Set(liveMatches).size,
}));

const wss = new WebSocketServer({ server: http });

/**
 * Which account each socket belongs to, when it told us. A player without one
 * plays perfectly normally and simply earns nothing.
 */
const playerIdOf = new WeakMap<WebSocket, string>();

/**
 * Everybody waiting for a quick match.
 *
 * A LIST, where it used to be one socket. The old shape could only answer
 * "who was here first", which is why matching ignored everything else — see
 * matchmaking.ts for the two numbers it looks at now and for why only one of
 * them relaxes with waiting.
 */
const queue: Array<Waiting<WebSocket>> = [];
/** The player waiting for a partner to face Amanda with. A separate queue:
 *  pairing someone who asked for her with someone who asked for a duel would
 *  give both of them the wrong game. */
let waitingCoop: WebSocket | null = null;
const matchOf = new WeakMap<WebSocket, Match>();
/*
 * The same matches, countable.
 *
 * `matchOf` is a WeakMap keyed by socket, which is right for "which match is
 * this socket in" and useless for "how many matches are running" — a WeakMap
 * cannot be enumerated, by design. The admin panel needs the second question
 * answered, so the matches are also held here and removed when both sockets
 * have gone. See liveops.ts.
 */
const liveMatches = new Set<Match>();

/** Open private rooms, by code. */
interface Room {
  host: WebSocket;
  openedAt: number;
}
const rooms = new Map<string, Room>();
/** Reverse lookup so a host's room can be torn down when they disconnect. */
const roomOf = new WeakMap<WebSocket, string>();

function send(ws: WebSocket, msg: Parameters<typeof encode>[0]): void {
  if (ws.readyState === ws.OPEN) ws.send(encode(msg));
}

function isOpen(ws: WebSocket | null): ws is WebSocket {
  return ws !== null && ws.readyState === ws.OPEN;
}

/** A short code that is unambiguous when read aloud and unused right now. */
function newRoomCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++)
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  // Astronomically unlikely; fall back to something certainly unique.
  return `${Date.now().toString(36).toUpperCase().slice(-ROOM_CODE_LENGTH)}`;
}

function beginMatch(a: WebSocket, b: WebSocket, how: string, coop = false): void {
  const m = new Match(
    a,
    b,
    playerIdOf.get(a) ?? null,
    playerIdOf.get(b) ?? null,
    coop,
    // Both asked to play again: the same two people, down the same two
    // sockets, in the same mode. `matchOf` is simply pointed at the new one.
    () => {
      if (!isOpen(a) || !isOpen(b)) return;
      beginMatch(a, b, "rematch", coop);
    },
  );
  matchOf.set(a, m);
  matchOf.set(b, m);
  liveMatches.add(m);
  console.log(`[server] match started (${how})`);
}

/** Read this player's record, so the queue knows who they are. */
async function rate(entry: Waiting<WebSocket>): Promise<void> {
  const playerId = playerIdOf.get(entry.who);
  const sb = db();
  if (!playerId || !sb) return; // a guest, or no database: matched with anybody
  try {
    const { data } = await sb
      .from("players")
      .select("trophies, album_power")
      .eq("id", playerId)
      .maybeSingle();
    if (!data) return;
    entry.trophies = (data.trophies as number) ?? 0;
    entry.albumPower = (data.album_power as number) ?? 0;
  } catch {
    /* unrated is the safe answer: they get matched rather than stuck */
  }
}

function leaveQueue(ws: WebSocket): void {
  const i = queue.findIndex((q) => q.who === ws);
  if (i >= 0) queue.splice(i, 1);
}

/**
 * Pair whoever can be paired, now.
 *
 * Called when somebody joins, when their record arrives, and once a second —
 * the last one because the trophy window widens with waiting, so two people
 * who could not be paired a moment ago can be paired later without either of
 * them doing anything.
 */
function tryToPair(): void {
  for (let i = queue.length - 1; i >= 0; i--) if (!isOpen(queue[i]!.who)) queue.splice(i, 1);
  for (;;) {
    const pair = findPair(queue, Date.now());
    if (!pair) return;
    const [a, b] = pair;
    leaveQueue(a.who);
    leaveQueue(b.who);
    const gap =
      a.trophies !== null && b.trophies !== null ? Math.abs(a.trophies - b.trophies) : null;
    beginMatch(
      a.who,
      b.who,
      `quick match${gap === null ? ", unrated" : `, ${gap} trophies apart`}`,
    );
  }
}

// The window widens while somebody waits, so the queue is looked at again
// even when nothing has happened.
setInterval(tryToPair, 1000).unref?.();

function closeRoomOf(ws: WebSocket): void {
  const code = roomOf.get(ws);
  if (code === undefined) return;
  roomOf.delete(ws);
  if (rooms.get(code)?.host === ws) rooms.delete(code);
}

/** Drop rooms nobody ever joined, so codes stay short and memory stays flat. */
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms)
    if (now - room.openedAt > ROOM_TTL_MS || !isOpen(room.host)) {
      rooms.delete(code);
      roomOf.delete(room.host);
    }
}, 60_000).unref();

/**
 * Players a suspension applies to, and when it runs out.
 *
 * Checked when somebody says who they are rather than on every message: one
 * read per connection instead of one per keystroke, and a suspension handed
 * out mid-match does not yank somebody out of a game already in progress — it
 * stops the next one. That is the right moment for it.
 */
/**
 * True when this socket may not start a match, and told so.
 *
 * The date comes from the profile read on sign-on (profiles.ts), which used
 * to be a query of its own for this one column. Three different things wanted
 * that row — this, the versus screen and the emoji picker — so there is now
 * one read and they share it.
 */
function refuseIfSuspended(ws: WebSocket): boolean {
  const until = profileOf(ws).suspendedUntil;
  if (until <= Date.now()) return false;
  send(ws, { t: "suspended", until: new Date(until).toISOString() });
  return true;
}

function handleLobby(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.t) {
    case "me": {
      if (typeof msg.playerId === "string" && msg.playerId) {
        playerIdOf.set(ws, msg.playerId);
        // From here on this socket counts as that player being online, which
        // is what their friends' lists are reading (see presence.ts).
        arrived(msg.playerId, ws);
        void loadProfile(ws, msg.playerId);
      }
      return;
    }

    case "invite": {
      /*
       * "Come and play" — to a friend, and only to a friend.
       *
       * The friendship is checked against the database rather than trusted
       * from the message: otherwise this is a way to make any child's screen
       * light up with an invitation from a stranger.
       *
       * It reuses the private-room machinery exactly as it stands. The
       * inviter opens a room, the friend is handed its code, and accepting is
       * an ordinary join — so there is no second way into a match to keep
       * working.
       */
      if (refuseIfSuspended(ws)) return;
      const me = playerIdOf.get(ws);
      const to = typeof msg.to === "string" ? msg.to : "";
      if (!me || !to || me === to) return;
      void (async () => {
        const sb = db();
        if (!sb || !(await areFriends(sb, me, to))) return;
        // Open the room first, so the code in the invitation is real.
        closeRoomOf(ws);
        const code = newRoomCode();
        rooms.set(code, { host: ws, openedAt: Date.now() });
        roomOf.set(ws, code);
        send(ws, { t: "room", code });
        const { data } = await sb.from("players").select("nickname").eq("id", me).maybeSingle();
        const sent = deliver(
          to,
          encode({ t: "invited", from: me, nickname: data?.nickname ?? null, code }),
        );
        if (sent === 0) {
          // They went offline between the list being drawn and this arriving.
          closeRoomOf(ws);
          send(ws, { t: "roomError", reason: "notFound" });
        }
      })();
      return;
    }

    case "hello": {
      if (refuseIfSuspended(ws)) return;
      if (queue.some((q) => q.who === ws)) return; // already in line
      /*
       * Join the queue with no numbers, and fill them in when the database
       * answers. Waiting for the read first would leave somebody staring at
       * a blank screen because of a slow query — and a player whose record
       * has not arrived yet is simply treated as a guest for a moment, which
       * is the right failure.
       */
      const entry: Waiting<WebSocket> = {
        who: ws,
        trophies: null,
        albumPower: null,
        since: Date.now(),
      };
      queue.push(entry);
      send(ws, { t: "waiting" });
      void rate(entry).then(() => tryToPair());
      tryToPair();
      return;
    }

    case "helloAmanda": {
      if (refuseIfSuspended(ws)) return;
      if (isOpen(waitingCoop) && waitingCoop !== ws) {
        const partner = waitingCoop;
        waitingCoop = null;
        beginMatch(partner, ws, "Amanda mode", true);
      } else {
        waitingCoop = ws;
        send(ws, { t: "waiting" });
        console.log("[server] player waiting for Amanda mode");
      }
      return;
    }

    case "host": {
      if (refuseIfSuspended(ws)) return;
      // One room per connection — opening a second replaces the first.
      closeRoomOf(ws);
      const code = newRoomCode();
      rooms.set(code, { host: ws, openedAt: Date.now() });
      roomOf.set(ws, code);
      send(ws, { t: "room", code });
      console.log(`[server] room ${code} opened`);
      return;
    }

    case "join": {
      if (refuseIfSuspended(ws)) return;
      const code = String(msg.code ?? "").toUpperCase().trim();
      const room = rooms.get(code);
      const fail = (reason: RoomError) => send(ws, { t: "roomError", reason });
      if (!room) return fail("notFound");
      if (room.host === ws) return fail("self");
      if (!isOpen(room.host)) {
        rooms.delete(code);
        return fail("notFound");
      }
      rooms.delete(code);
      roomOf.delete(room.host);
      // Whoever opened the room is side A, the same way the open queue works.
      beginMatch(room.host, ws, `room ${code}`);
      return;
    }

    default:
      return;
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const raw = data.toString();
    const match = matchOf.get(ws);
    if (match) {
      match.handle(ws, raw);
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    handleLobby(ws, msg);
  });

  ws.on("close", () => {
    presenceLeft(ws, playerIdOf.get(ws));
    forget(ws);
    leaveQueue(ws);
    if (waitingCoop === ws) waitingCoop = null;
    closeRoomOf(ws);
    const match = matchOf.get(ws);
    if (match) {
      match.leave(ws);
      matchOf.delete(ws);
      // Forgotten once NEITHER socket is still in it — a match with one
      // player still connected is a match somebody is still looking at.
      if (!match.anyoneLeft()) liveMatches.delete(match);
    }
  });

  ws.on("error", () => {
    /* ignore socket errors; close handler cleans up */
  });
});

http.listen(PORT, () => {
  console.log(`[server] Amanda multiplayer listening on :${PORT}`);
  // Gifts that were set for a date go out on their own — see schedule.ts for
  // why this is a loop that asks the database rather than a timer per gift.
  startScheduler(db);
  console.log(
    PROGRESS_ENABLED
      ? "[server] progress is being recorded"
      : "[server] no SUPABASE_SERVICE_KEY — matches are played but nothing is saved",
  );
});
