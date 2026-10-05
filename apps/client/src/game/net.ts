import {
  encode,
  type BoardView,
  type ClientMessage,
  type NetBoard,
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

/** What to ask the lobby for once the socket opens. */
export type Intent =
  | { kind: "quick" }
  | { kind: "host" }
  | { kind: "join"; code: string };

export interface NetHandlers {
  onWaiting?: () => void;
  /** A private room was opened — share this code. */
  onRoom?: (code: string) => void;
  onRoomError?: (reason: RoomError) => void;
  onStart?: (side: Side) => void;
  onPhase?: (phase: string, timeLeft: number) => void;
  onOpp?: (view: BoardView) => void;
  onResult?: (r: { seed: number; boardA: NetBoard; boardB: NetBoard; winner: Side | null }) => void;
  onOppLeft?: () => void;
  /** The opponent played an action card at you. */
  onHexed?: (id: string) => void;
  /** The socket closed. `connected` is false when it never opened at all. */
  onClose?: (connected: boolean) => void;
}

export class Net {
  private ws: WebSocket | null = null;
  private handlers: NetHandlers = {};
  /** True once the socket actually opened — tells a dead server from a drop. */
  private connected = false;
  private intent: Intent = { kind: "quick" };

  /**
   * Open the socket. `intent` decides what to ask for once it is up: join the
   * open queue, open a private room, or join someone else's by code.
   */
  connect(handlers: NetHandlers, intent: Intent = { kind: "quick" }): void {
    this.handlers = handlers;
    this.intent = intent;
    const ws = new WebSocket(SERVER_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      const i = this.intent;
      this.sendMsg(
        i.kind === "host" ? { t: "host" } : i.kind === "join" ? { t: "join", code: i.code } : { t: "hello" },
      );
    };
    ws.onclose = () => this.handlers.onClose?.(this.connected);
    ws.onerror = () => this.handlers.onClose?.(this.connected);
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
          this.handlers.onHexed?.(msg.id);
          break;
        case "roomError":
          this.handlers.onRoomError?.(msg.reason);
          break;
        case "start":
          this.handlers.onStart?.(msg.side);
          break;
        case "phase":
          this.handlers.onPhase?.(msg.phase, msg.timeLeft);
          break;
        case "opp":
          this.handlers.onOpp?.(msg.view);
          break;
        case "result":
          this.handlers.onResult?.(msg);
          break;
        case "oppLeft":
          this.handlers.onOppLeft?.();
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
  /** Play an action card at the opponent. */
  hex(id: string): void {
    this.sendMsg({ t: "hex", id });
  }
  lock(board: NetBoard): void {
    this.sendMsg({ t: "lock", board });
  }
  close(): void {
    this.handlers = {};
    this.ws?.close();
    this.ws = null;
  }
}
