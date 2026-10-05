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
import "./content.js"; // eager-load the card catalog at boot

const PORT = Number(process.env.PORT ?? 2567);

/** A private room is abandoned if nobody joins it within this long. */
const ROOM_TTL_MS = 15 * 60 * 1000;

// A tiny HTTP server for health checks (hosts like Render probe GET /).
const http = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("Amanda multiplayer server — OK");
});

const wss = new WebSocketServer({ server: http });

/** The player in the open queue, waiting for whoever turns up next. */
let waiting: WebSocket | null = null;
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

function beginMatch(a: WebSocket, b: WebSocket, how: string): void {
  const m = new Match(a, b);
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

function handleLobby(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.t) {
    case "hello": {
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

    case "host": {
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
    if (waiting === ws) waiting = null;
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
});
