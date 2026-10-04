import {
  encode,
  type BoardView,
  type ClientMessage,
  type NetBoard,
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

export interface NetHandlers {
  onWaiting?: () => void;
  onStart?: (side: Side) => void;
  onPhase?: (phase: string, timeLeft: number) => void;
  onOpp?: (view: BoardView) => void;
  onResult?: (r: { seed: number; boardA: NetBoard; boardB: NetBoard; winner: Side | null }) => void;
  onOppLeft?: () => void;
  /** The socket closed. `connected` is false when it never opened at all. */
  onClose?: (connected: boolean) => void;
}

export class Net {
  private ws: WebSocket | null = null;
  private handlers: NetHandlers = {};
  /** True once the socket actually opened — tells a dead server from a drop. */
  private connected = false;

  connect(handlers: NetHandlers): void {
    this.handlers = handlers;
    const ws = new WebSocket(SERVER_URL);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.sendMsg({ t: "hello" });
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
  lock(board: NetBoard): void {
    this.sendMsg({ t: "lock", board });
  }
  close(): void {
    this.handlers = {};
    this.ws?.close();
    this.ws = null;
  }
}
