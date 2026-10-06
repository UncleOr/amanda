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
import { arrived, deliver, left as presenceLeft } from "./presence.js";
import { areFriends } from "./friends.js";
import { PROGRESS_ENABLED } from "./progress.js";
import { handleApi } from "./api.js";
import { refreshCards } from "./cards.js";
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

const wss = new WebSocketServer({ server: http });

/**
 * Which account each socket belongs to, when it told us. A player without one
 * plays perfectly normally and simply earns nothing.
 */
const playerIdOf = new WeakMap<WebSocket, string>();

/** The player in the open queue, waiting for whoever turns up next. */
let waiting: WebSocket | null = null;
/** The player waiting for a partner to face Amanda with. A separate queue:
 *  pairing someone who asked for her with someone who asked for a duel would
 *  give both of them the wrong game. */
let waitingCoop: WebSocket | null = null;
const matchOf = new WeakMap<WebSocket, Match>();

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
  console.log(`[server] match started (${how})`);
}

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
const suspendedUntil = new WeakMap<WebSocket, number>();

async function checkSuspended(ws: WebSocket, playerId: string): Promise<void> {
  const sb = db();
  if (!sb) return;
  try {
    const { data } = await sb
      .from("players")
      .select("suspended_until")
      .eq("id", playerId)
      .maybeSingle();
    const until = data?.suspended_until ? Date.parse(data.suspended_until) : 0;
    if (until > Date.now()) suspendedUntil.set(ws, until);
  } catch {
    /* a database that cannot be reached must not stop anybody playing */
  }
}

/** True when this socket may not start a match, and told so. */
function refuseIfSuspended(ws: WebSocket): boolean {
  const until = suspendedUntil.get(ws) ?? 0;
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
        void checkSuspended(ws, msg.playerId);
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
      // Open queue: pair with whoever is already waiting.
      if (isOpen(waiting) && waiting !== ws) {
        const opponent = waiting;
        waiting = null;
        beginMatch(opponent, ws, "quick match");
      } else {
        waiting = ws;
        send(ws, { t: "waiting" });
        console.log("[server] player waiting");
      }
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
    if (waiting === ws) waiting = null;
    if (waitingCoop === ws) waitingCoop = null;
    closeRoomOf(ws);
    const match = matchOf.get(ws);
    if (match) {
      match.leave(ws);
      matchOf.delete(ws);
    }
  });

  ws.on("error", () => {
    /* ignore socket errors; close handler cleans up */
  });
});

http.listen(PORT, () => {
  console.log(`[server] Amanda multiplayer listening on :${PORT}`);
  console.log(
    PROGRESS_ENABLED
      ? "[server] progress is being recorded"
      : "[server] no SUPABASE_SERVICE_KEY — matches are played but nothing is saved",
  );
});
