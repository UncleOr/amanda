import type { WebSocket } from "ws";
import { PHASES, encode, type BoardView, type NetBoard, type ServerMessage, type Side } from "@amanda/shared";
import { runBattle } from "@amanda/engine";
import { CATALOG, SYNERGIES } from "./content.js";

const COUNTDOWN = 3;
const PANIC_LOCK_WINDOW = 8; // seconds after Panic to gather both locked boards

interface PlayerConn {
  ws: WebSocket;
  side: Side;
  view: BoardView;
  board: NetBoard | null;
}

const emptyView = (): BoardView => ({ placements: {}, king: null });

/** Fog-of-war filter: how much of a board the opponent may see in a phase. */
function fog(view: BoardView, phase: string): BoardView {
  if (phase === "build") {
    const placements: Record<string, string> = {};
    for (const [k, v] of Object.entries(view.placements))
      if (Number(k.split("-")[0]) === 3) placements[k] = v;
    return { placements, king: null };
  }
  if (phase === "panic" || phase === "locking") {
    const placements: Record<string, string> = {};
    for (const [k, v] of Object.entries(view.placements))
      if (Number(k.split("-")[0]) >= 1) placements[k] = v;
    return { placements, king: view.king };
  }
  return view;
}

/** A single 1v1 match between two connected clients. */
export class Match {
  private a: PlayerConn;
  private b: PlayerConn;
  private phase = "countdown";
  private seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private resultSent = false;
  private over = false;

  constructor(wsA: WebSocket, wsB: WebSocket) {
    this.a = { ws: wsA, side: "A", view: emptyView(), board: null };
    this.b = { ws: wsB, side: "B", view: emptyView(), board: null };
    this.send(this.a, { t: "start", side: "A" });
    this.send(this.b, { t: "start", side: "B" });
    this.runTimeline();
  }

  private send(p: PlayerConn, msg: ServerMessage): void {
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(encode(msg));
  }
  private both(msg: ServerMessage): void {
    this.send(this.a, msg);
    this.send(this.b, msg);
  }
  private other(p: PlayerConn): PlayerConn {
    return p === this.a ? this.b : this.a;
  }
  private after(seconds: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, seconds * 1000));
  }

  private setPhase(phase: string, seconds: number): void {
    this.phase = phase;
    this.both({ t: "phase", phase, timeLeft: seconds });
    // Re-send each opponent view with the new (looser) fog.
    this.send(this.a, { t: "opp", view: fog(this.b.view, phase) });
    this.send(this.b, { t: "opp", view: fog(this.a.view, phase) });
  }

  private runTimeline(): void {
    this.setPhase("countdown", COUNTDOWN);
    this.after(COUNTDOWN, () => {
      this.setPhase("build", PHASES.build.seconds);
      this.after(PHASES.build.seconds, () => {
        this.setPhase("panic", PHASES.panic.seconds);
        this.after(PHASES.panic.seconds, () => {
          this.setPhase("locking", 0);
          // Give clients a short window to submit their final boards.
          this.after(PANIC_LOCK_WINDOW, () => this.computeResult());
        });
      });
    });
  }

  /** Handle a message from one of the two clients. */
  handle(ws: WebSocket, raw: string): void {
    const p = ws === this.a.ws ? this.a : this.b;
    let msg: { t: string; view?: BoardView; board?: NetBoard; id?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === "board" && msg.view) {
      p.view = msg.view;
      this.send(this.other(p), { t: "opp", view: fog(p.view, this.phase) });
    } else if (msg.t === "hex" && typeof msg.id === "string") {
      // Only the build phases can be interfered with; once boards are locked
      // there is nothing left to disturb.
      if (this.phase === "build" || this.phase === "panic")
        this.send(this.other(p), { t: "hexed", id: msg.id });
    } else if (msg.t === "lock" && msg.board) {
      // Ready, with the board as it stands. A player who is ready may keep
      // building and send this again; the last one received is the one used.
      const wasReady = p.board !== null;
      p.board = { ...msg.board, owner: p.side }; // trust the placements, fix the side
      if (!wasReady) this.send(this.other(p), { t: "oppReady", ready: true });
      // Both ready — start now and skip whatever is left of the clock.
      if (this.a.board && this.b.board) this.computeResult();
    } else if (msg.t === "unready") {
      if (p.board !== null) {
        p.board = null;
        this.send(this.other(p), { t: "oppReady", ready: false });
      }
    }
  }

  private computeResult(): void {
    if (this.resultSent || this.over) return;
    this.resultSent = true;
    const fallback = (side: Side): NetBoard => ({ owner: side, placements: [] });
    const boardA = this.a.board ?? fallback("A");
    const boardB = this.b.board ?? fallback("B");
    let winner: Side | null = null;
    try {
      const result = runBattle({
        seed: this.seed,
        catalog: CATALOG,
        synergies: SYNERGIES,
        a: boardA,
        b: boardB,
      });
      winner = result.winner;
    } catch (err) {
      console.error("[match] battle error", err);
    }
    this.both({ t: "result", seed: this.seed, boardA, boardB, winner });
  }

  /** A client disconnected — tell the other and shut the match down. */
  leave(ws: WebSocket): void {
    if (this.over) return;
    this.over = true;
    for (const t of this.timers) clearTimeout(t);
    const remaining = ws === this.a.ws ? this.b : this.a;
    this.send(remaining, { t: "oppLeft" });
  }
}
