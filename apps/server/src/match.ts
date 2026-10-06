import type { WebSocket } from "ws";
import {
  PHASES,
  TAUNT_LIMITS,
  encode,
  tauntById,
  type BoardView,
  type NetBoard,
  type ServerMessage,
  type Side,
} from "@amanda/shared";
import { runBattle } from "@amanda/engine";
import { CATALOG, SYNERGIES } from "./content.js";
import { recordMatch } from "./progress.js";
import { COOP_LANES, amandaBoard, amandaView, joinBoards } from "./amanda.js";

const COUNTDOWN = 3;
/** The lane offset of the second player's half of the shared co-op side. */
const LANE_B = 4;
const PANIC_LOCK_WINDOW = 8; // seconds after Panic to gather both locked boards

interface PlayerConn {
  ws: WebSocket;
  side: Side;
  view: BoardView;
  board: NetBoard | null;
  /** The account this socket belongs to, or null for a guest. */
  playerId: string | null;
  /** When this player last said something, and how much they have said. */
  lastSaid: number;
  saidCount: number;
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

  /** Amanda mode: both players share side A and fight her instead of each other. */
  private readonly coop: boolean;
  /**
   * Her board, built ONCE at the start of the match rather than at the end.
   *
   * It used to be generated inside computeResult, which meant nothing shown
   * before the battle could possibly have been her: the panel labelled
   * "Amanda" was showing the other player's cards. Building her up front gives
   * the panic phase something true to reveal — and makes the reveal and the
   * battle the same board, which is the only version of that worth having.
   */
  private readonly amanda: NetBoard | null;

  constructor(
    wsA: WebSocket,
    wsB: WebSocket,
    idA: string | null,
    idB: string | null,
    coop = false,
  ) {
    this.coop = coop;
    this.amanda = coop ? amandaBoard() : null;
    this.a = { ws: wsA, side: "A", view: emptyView(), board: null, playerId: idA, lastSaid: 0, saidCount: 0 };
    this.b = { ws: wsB, side: "B", view: emptyView(), board: null, playerId: idB, lastSaid: 0, saidCount: 0 };
    // In Amanda mode both are side A; `lane` tells each which half is theirs.
    this.send(this.a, { t: "start", side: "A", coop, ...(coop ? { lane: 0 } : {}) });
    this.send(this.b, { t: "start", side: coop ? "A" : "B", coop, ...(coop ? { lane: LANE_B } : {}) });
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

  /**
   * Tell one player what they may see of everyone else.
   *
   * Ordinarily that is one thing — the opponent, through the fog of the
   * current phase. In Amanda mode it is two different things, and conflating
   * them was the bug: the enemy is HER (fogged, because she is the surprise),
   * and the other player is an ALLY (not fogged, because the entire mode is
   * two people arranging one side together, and they cannot do that blind).
   */
  private showOthers(p: PlayerConn): void {
    if (this.coop && this.amanda) {
      this.send(p, { t: "opp", view: fog(amandaView(this.amanda), this.phase) });
      this.send(p, { t: "mate", view: this.other(p).view, lane: p === this.a ? LANE_B : 0 });
      return;
    }
    this.send(p, { t: "opp", view: fog(this.other(p).view, this.phase) });
  }

  private setPhase(phase: string, seconds: number): void {
    this.phase = phase;
    this.both({ t: "phase", phase, timeLeft: seconds });
    // Re-send each view with the new (looser) fog.
    this.showOthers(this.a);
    this.showOthers(this.b);
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
      this.showOthers(this.other(p));
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
    } else if (msg.t === "say" && typeof msg.id === "string") {
      /*
       * One of the ready-made lines, passed to the other player.
       *
       * Checked here and not in the picker, because a picker that greys
       * itself out stops an honest player and nobody else. An unknown id is
       * dropped in silence: the only ids that exist are the ones in
       * taunts.ts, so anything else is somebody poking at the socket.
       */
      if (!tauntById(msg.id)) return;
      const now = Date.now();
      if (now - p.lastSaid < TAUNT_LIMITS.gapSeconds * 1000) return;
      if (p.saidCount >= TAUNT_LIMITS.perMatch) return;
      p.lastSaid = now;
      p.saidCount++;
      this.send(this.other(p), { t: "said", id: msg.id });
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
    // Amanda mode: the two players become ONE side, and she is the other.
    const boardA = this.coop
      ? joinBoards(this.a.board, this.b.board)
      : (this.a.board ?? fallback("A"));
    const boardB = this.coop ? (this.amanda ?? amandaBoard()) : (this.b.board ?? fallback("B"));
    let winner: Side | null = null;
    try {
      const result = runBattle({
        seed: this.seed,
        catalog: CATALOG,
        synergies: SYNERGIES,
        a: boardA,
        b: boardB,
        ...(this.coop ? { lanes: COOP_LANES } : {}),
      });
      winner = result.winner;
    } catch (err) {
      console.error("[match] battle error", err);
    }
    this.both({
      t: "result",
      seed: this.seed,
      boardA,
      boardB,
      winner,
      ...(this.coop ? { lanes: COOP_LANES, coop: true } : {}),
    });
    // Trophies and the winner's chest. Deliberately not awaited: the players
    // have their result, and a slow database must not hold up the match.
    // In Amanda mode nobody beat anybody: both players share the result, so
    // they are recorded as two matches against her rather than one against
    // each other — otherwise one of them would be credited with a loss.
    if (this.coop) {
      const beatHer = winner === "A";
      void recordMatch({ a: this.a.playerId, b: null, winner: beatHer ? "A" : "B" });
      void recordMatch({ a: this.b.playerId, b: null, winner: beatHer ? "A" : "B" });
    } else {
      void recordMatch({ a: this.a.playerId, b: this.b.playerId, winner });
    }
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
