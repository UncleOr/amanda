import {
  encode,
  type BoardView,
  type ClientMessage,
  type NetBoard,
  type PlayerCard,
  type RoomError,
  type ServerMessage,
  type Side,
} from "@amanda/shared";

/**
 * WebSocket URL of the authoritative server. In dev it defaults to the local
 * server; for the deployed site set VITE_SERVER_URL (e.g. wss://amanda-server…)
 * at build time. Empty string → online play is unavailable (offline build).
 */
export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? "ws://localhost:2567" : "");

export const ONLINE_AVAILABLE = SERVER_URL !== "";

/**
 * How many times to try opening the socket before giving up, and how long to
 * wait between tries (multiplied by the attempt, so 0.8s then 1.6s).
 *
 * Three is chosen against the thing it exists for: a Railway service waking
 * from sleep takes a few seconds, and three tries spread over about two and a
 * half seconds covers it without leaving a child staring at a dead screen if
 * the server really is down.
 */
const CONNECT_ATTEMPTS = 3;
const RETRY_MS = 800;

/** What to ask the lobby for once the socket opens. */
export type Intent =
  | { kind: "quick" }
  /** Queue for Amanda mode — it pairs you with someone to face her with. */
  | { kind: "amanda" }
  | { kind: "host" }
  | { kind: "join"; code: string }
  /**
   * Call a friend in. The SERVER opens the room as part of handling this,
   * after checking they really are your friend — so this is not "host and
   * then tell them", which would open two rooms and leave one of them empty.
   */
  | { kind: "invite"; to: string };

export interface NetHandlers {
  onWaiting?: () => void;
  /** A private room was opened — share this code. */
  onRoom?: (code: string) => void;
  onRoomError?: (reason: RoomError) => void;
  onStart?: (side: Side, coop: boolean, lane: number) => void;
  onPhase?: (phase: string, timeLeft: number) => void;
  onOpp?: (view: BoardView) => void;
  /** Amanda mode: your partner's half, unfogged, and which half it is. */
  onMate?: (view: BoardView, lane: number) => void;
  onResult?: (r: {
    seed: number;
    boardA: NetBoard;
    boardB: NetBoard;
    winner: Side | null;
    lanes?: number;
    coop?: boolean;
  }) => void;
  onOppLeft?: () => void;
  /** The server will not start a match: this account is suspended until then. */
  onSuspended?: (until: string) => void;
  /** The opponent played an action card at you. */
  onHexed?: (id: string, cell?: string) => void;
  /** The opponent is (or is no longer) ready to fight. */
  onOppReady?: (ready: boolean) => void;
  /** The other player said one of the ready-made lines. */
  onSaid?: (id: string) => void;
  /** Who the other player is — name, face, trophies, catchphrase. */
  onOpponent?: (who: PlayerCard) => void;
  /** The other player would like to play you again. */
  onRematchWanted?: () => void;
  /** A friend has opened a room and wants you in it. */
  onInvited?: (from: { id: string; nickname: string | null; code: string }) => void;
  /** The socket closed. `connected` is false when it never opened at all. */
  onClose?: (connected: boolean) => void;
}

export class Net {
  private ws: WebSocket | null = null;
  private handlers: NetHandlers = {};
  /** True once the socket actually opened — tells a dead server from a drop. */
  private connected = false;
  private intent: Intent = { kind: "quick" };
  private playerId: string | null = null;
  /** How many times we have tried to open this socket. */
  private attempts = 0;
  private retryTimer: number | null = null;
  private closedOnPurpose = false;

  /**
   * Open the socket. `intent` decides what to ask for once it is up: join the
   * open queue, open a private room, or join someone else's by code.
   */
  connect(handlers: NetHandlers, intent: Intent = { kind: "quick" }, playerId?: string | null): void {
    this.handlers = handlers;
    this.intent = intent;
    this.playerId = playerId ?? null;
    this.attempts = 0;
    this.closedOnPurpose = false;
    this.open();
  }

  /**
   * Open the socket, and try again a couple of times if it never opens.
   *
   * ═══ WHY RETRY AT ALL ═══
   *
   * A server that has been asleep answers the first request with a 502 while
   * it wakes up. On Railway that is the whole point of Serverless mode — the
   * service costs nothing while nobody is playing — but without this, the
   * first child to press play would simply be told the server cannot be
   * reached, which is a broken game rather than a cheap one.
   *
   * It is worth having even with the server always awake: a phone coming off
   * a lift, a wifi handover, a moment of nothing. The old behaviour turned
   * every one of those into "we could not reach the server".
   *
   * Only a socket that NEVER OPENED is retried. Once it has opened, a close
   * means the match ended or the connection dropped, and silently reconnecting
   * would drop the player into a queue they did not ask to rejoin.
   */
  private open(): void {
    this.attempts++;
    const ws = new WebSocket(SERVER_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      // Say who we are before asking for a match, so the server knows who to
      // credit. A guest simply skips this and earns nothing.
      if (this.playerId) this.sendMsg({ t: "me", playerId: this.playerId });
      const i = this.intent;
      this.sendMsg(
        i.kind === "host"
          ? { t: "host" }
          : i.kind === "join"
            ? { t: "join", code: i.code }
            : i.kind === "invite"
              ? { t: "invite", to: i.to }
              : i.kind === "amanda"
                ? { t: "helloAmanda" }
                : { t: "hello" },
      );
    };
    /*
     * A socket that fails to open fires BOTH `onerror` and `onclose`, so
     * without this the caller is told twice — and on the last attempt it was
     * told twice that the server could not be reached. Once per socket.
     */
    let reported = false;
    const gone = () => {
      if (this.closedOnPurpose || reported) return;
      reported = true;
      // It opened once: this is a drop or the end of a match, not a server
      // that is asleep. Hand it to the caller as it always was.
      if (this.connected || this.attempts >= CONNECT_ATTEMPTS) {
        this.handlers.onClose?.(this.connected);
        return;
      }
      // Never opened, and there are tries left — wake it up.
      this.retryTimer = window.setTimeout(() => this.open(), RETRY_MS * this.attempts);
    };
    ws.onclose = gone;
    ws.onerror = gone;
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (msg.t) {
        case "waiting":
          this.handlers.onWaiting?.();
          break;
        case "room":
          this.handlers.onRoom?.(msg.code);
          break;
        case "hexed":
          this.handlers.onHexed?.(msg.id, msg.cell);
          break;
        case "said":
          this.handlers.onSaid?.(msg.id);
          break;
        case "opponent":
          this.handlers.onOpponent?.(msg.who);
          break;
        case "rematchWanted":
          this.handlers.onRematchWanted?.();
          break;
        case "invited":
          this.handlers.onInvited?.({ id: msg.from, nickname: msg.nickname, code: msg.code });
          break;
        case "oppReady":
          this.handlers.onOppReady?.(msg.ready);
          break;
        case "roomError":
          this.handlers.onRoomError?.(msg.reason);
          break;
        case "start":
          this.handlers.onStart?.(msg.side, msg.coop ?? false, msg.lane ?? 0);
          break;
        case "phase":
          this.handlers.onPhase?.(msg.phase, msg.timeLeft);
          break;
        case "opp":
          this.handlers.onOpp?.(msg.view);
          break;
        case "mate":
          this.handlers.onMate?.(msg.view, msg.lane);
          break;
        case "result":
          this.handlers.onResult?.(msg);
          break;
        case "oppLeft":
          this.handlers.onOppLeft?.();
          break;
        case "suspended":
          this.handlers.onSuspended?.(msg.until);
          break;
      }
    };
  }

  private sendMsg(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(encode(msg));
  }

  sendBoard(view: BoardView): void {
    this.sendMsg({ t: "board", view });
  }
  /** Play an action card at the opponent, optionally at one of their cells. */
  hex(id: string, cell?: string): void {
    this.sendMsg({ t: "hex", id, ...(cell ? { cell } : {}) });
  }
  /** Say one of the ready-made lines (see taunts.ts). Id only. */
  say(id: string): void {
    this.sendMsg({ t: "say", id });
  }
  /** Ask the person you just played for another match. */
  rematch(): void {
    this.sendMsg({ t: "rematch" });
  }
  unready(): void {
    this.sendMsg({ t: "unready" });
  }
  lock(board: NetBoard): void {
    this.sendMsg({ t: "lock", board });
  }
  close(): void {
    this.closedOnPurpose = true;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.handlers = {};
    this.ws?.close();
    this.ws = null;
  }
}
