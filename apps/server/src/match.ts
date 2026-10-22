import type { WebSocket } from "ws";
import {
  PHASES,
  TAUNT_LIMITS,
  encode,
  groundFor,
  emojiFromSayId,
  ownedEmoji,
  tauntById,
  type BoardView,
  type NetBoard,
  type ServerMessage,
  type Side,
} from "@amanda/shared";
import { runBattle, type BattleResult, type Placement } from "@amanda/engine";
import { CATALOG, SYNERGIES } from "./content.js";
import { recordMatch } from "./progress.js";
import { awardMeta, factsFor } from "./meta.js";
import { cardOf, itemsOf, profileOf } from "./profiles.js";
import { COOP_LANES, amandaBoard, amandaView, joinBoards } from "./amanda.js";

const COUNTDOWN = 3;
/** The lane offset of the second player's half of the shared co-op side. */
const LANE_B = 4;
const PANIC_LOCK_WINDOW = 8; // seconds after Panic to gather both locked boards
/*
 * The x-ray, named here because the server has to recognise it.
 *
 * It is the one action a server has to understand rather than pass along:
 * every other card is applied by the client holding the board it lands on,
 * and this one is a request to SEE a board only the server has.
 *
 * The number matches data/action-cards.json. A shared constant would be
 * better and the server does not read that file today; the client sends the
 * id, so a rename breaks visibly rather than silently.
 */
const XRAY_ID = "xray";
/*
 * Six, not the five the card promises: XRAY_MS on the client is 6000, and
 * if this were shorter the fog would come back while the client still
 * believed it was looking — the board would close a second early for no
 * reason anyone could see. It must never be the shorter of the two.
 */
const XRAY_SECONDS = 6;

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

/**
 * ═══ THE LINE THAT COULD STOP A MATCH DEAD ═══
 *
 * Or: *"when I played the x-ray the clock got stuck and the battle never
 * started"* — and, asked whose screen: *"stuck for both of us."*
 *
 * Both, with the sockets still open, is a short list of possible causes, and
 * only one of them survived being looked at: a THROW inside the timers that
 * drive the phases. The chain used to be nested — each phase scheduled the
 * next one from inside its own callback — so an exception anywhere in a
 * phase change meant the next phase was never scheduled at all. The match
 * stops where it stood. Nobody is disconnected, so nobody is told anything;
 * the process catches the exception and stays up (see uncaughtException in
 * index.ts) precisely so that one bad match does not kill the others, which
 * also means nothing at all is visibly wrong.
 *
 * And `Object.entries(undefined)` throws. A view with no placements field —
 * and JSON.stringify DROPS an undefined field, so a client that had one for
 * a moment sends exactly that — got stored, and then killed the match at the
 * next phase change, several seconds later, with nothing to connect the two.
 *
 * Three locks on this door now, because the cost of it being open is the
 * whole match: views are checked on the way in, this is total, and the
 * timeline no longer depends on any of its own steps finishing.
 */
function cells(view: BoardView): Array<[string, string]> {
  const p = view?.placements;
  return p && typeof p === "object" ? Object.entries(p) : [];
}

/** Does this look like a board a player could have built? */
function isBoardView(v: unknown): v is BoardView {
  if (!v || typeof v !== "object") return false;
  const { placements, king } = v as BoardView;
  if (!placements || typeof placements !== "object" || Array.isArray(placements)) return false;
  return king === null || king === undefined || typeof king === "string";
}

/** Fog-of-war filter: how much of a board the opponent may see in a phase. */
function fog(view: BoardView, phase: string): BoardView {
  if (phase === "build") {
    const placements: Record<string, string> = {};
    for (const [k, v] of cells(view)) if (Number(k.split("-")[0]) === 3) placements[k] = v;
    return { placements, king: null };
  }
  if (phase === "panic" || phase === "locking") {
    const placements: Record<string, string> = {};
    for (const [k, v] of cells(view)) if (Number(k.split("-")[0]) >= 1) placements[k] = v;
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
  /**
   * ═══ WHOSE GROUND THE TWO OF THEM ARE MEETING ON ═══
   *
   * The family that fights 20% harder in this match (arenas.ts), decided
   * ONCE here rather than per player, because there is one battle and it
   * happens in one place.
   *
   * The LOWER of the two rungs. The matchmaker pairs on trophies, so the two
   * are nearly always in the same arena anyway; when they are not, the pair
   * meets on ground they have both reached rather than on ground one of them
   * has never seen. Read at the start of the match, so a trophy change while
   * they are building cannot move the floor out from under a board already
   * laid out on it.
   */
  private readonly ground: string;
  /** Who has asked to play again, once this match is over. */
  private rematch = new WeakSet<PlayerConn["ws"]>();
  /** Called when BOTH have asked — the lobby starts the next round. */
  private readonly onRematch: (() => void) | undefined;

  constructor(
    wsA: WebSocket,
    wsB: WebSocket,
    idA: string | null,
    idB: string | null,
    coop = false,
    onRematch?: () => void,
  ) {
    this.onRematch = onRematch;
    this.coop = coop;
    this.amanda = coop ? amandaBoard() : null;
    this.ground = groundFor(Math.min(profileOf(wsA).trophies ?? 0, profileOf(wsB).trophies ?? 0));
    this.a = { ws: wsA, side: "A", view: emptyView(), board: null, playerId: idA, lastSaid: 0, saidCount: 0 };
    this.b = { ws: wsB, side: "B", view: emptyView(), board: null, playerId: idB, lastSaid: 0, saidCount: 0 };
    // In Amanda mode both are side A; `lane` tells each which half is theirs.
    this.send(this.a, { t: "start", side: "A", coop, ...(coop ? { lane: 0 } : {}) });
    this.send(this.b, { t: "start", side: coop ? "A" : "B", coop, ...(coop ? { lane: LANE_B } : {}) });
    /*
     * Who each of them is about to fight.
     *
     * After `start` and never instead of it: this comes from a row read when
     * the socket signed on (profiles.ts), and a match must not wait on a
     * database. If it is not there, each of them gets a stranger's card —
     * which is a worse versus screen and a perfectly good match.
     *
     * In Amanda mode the other player is a PARTNER, not an opponent, and the
     * card is sent all the same: "who am I playing WITH" is the same question
     * and the screen says so.
     */
    this.send(this.a, { t: "opponent", who: cardOf(wsB) });
    this.send(this.b, { t: "opponent", who: cardOf(wsA) });
    this.runTimeline();
  }

  /**
   * May this player send this, right now?
   *
   * Two different answers in one question. A TAUNT is a sentence from the
   * closed list and everybody has all of them. An EMOJI is a picture, and
   * some of them are bought or won — which is the entire reason they are
   * drawn rather than unicode, so "do you own it" has to be asked somewhere.
   *
   * Asked HERE rather than in the picker, for the same reason the rate limit
   * is: a picker that hides what you do not own stops an honest player and
   * nobody else, and the one thing a crafted socket frame could otherwise do
   * is show everybody an emoji that was supposed to be worth buying.
   *
   * The item list was read when the socket signed on. If it never arrived,
   * the free emoji still work and the paid ones do not — the permissive
   * failure would be the one that gives away the thing being sold.
   */
  private maySay(p: PlayerConn, id: string): boolean {
    if (tauntById(id)) return true;
    const emoji = emojiFromSayId(id);
    if (!emoji) return false;
    return ownedEmoji(itemsOf(p.ws)).some((e) => e.id === emoji.id);
  }

  /**
   * Is anybody still connected to this match?
   *
   * Asked by the lobby so a finished match can stop being counted as running
   * (see liveMatches in index.ts). A method rather than the lobby reaching
   * into `a` and `b`, which are private for the good reason that everything
   * about who is in a match is this class's business.
   */
  anyoneLeft(): boolean {
    return this.a.ws.readyState === this.a.ws.OPEN || this.b.ws.readyState === this.b.ws.OPEN;
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
    /*
     * `p` is who is LOOKING, so `p` is who may be peeking. Unfogged means
     * the board as the other player has actually built it, back row and
     * all, which is what the card promises in words: "reveals the entire
     * enemy board (including the back Surprise Row) for 5 seconds".
     */
    const view = this.peeking[p.side] ? this.other(p).view : fog(this.other(p).view, this.phase);
    this.send(p, { t: "opp", view });
  }

  /**
   * ═══ THE X-RAY, WHICH ONLY THIS SIDE CAN GRANT ═══
   *
   * Or: *"none of the action cards that touch the enemy work. I cannot
   * erase, freeze the clock, or see the opponent with the x-ray. Against a
   * friend."*
   *
   * The x-ray was the one that could never have worked. Against the
   * computer it is a client-side flag: the whole enemy board is in memory
   * and the flag stops hiding it. Online the client is NOT holding that
   * board — it is holding what this server already fogged — so there was
   * nothing for a flag to uncover. It lifted a fog that had been applied
   * somewhere else.
   *
   * Only the server can answer it, because only the server has the board.
   * While a player is peeking, their copy of the opponent is sent unfogged;
   * when it lapses, the ordinary fog comes back.
   *
   * Set per player, not per match: both of them may hold one.
   */
  private peeking = { A: false, B: false };

  private grantPeek(p: PlayerConn, seconds: number): void {
    this.peeking[p.side] = true;
    this.showOthers(p);
    this.after(seconds, () => {
      this.peeking[p.side] = false;
      this.showOthers(p);
    });
  }

  private setPhase(phase: string, seconds: number): void {
    this.phase = phase;
    this.both({ t: "phase", phase, timeLeft: seconds });
    // Re-send each view with the new (looser) fog.
    this.showOthers(this.a);
    this.showOthers(this.b);
  }

  /**
   * The whole match, scheduled at once.
   *
   * It used to be a chain: build was scheduled from inside the countdown's
   * callback, panic from inside build's, and the result from inside panic's.
   * That reads well and has one terrible property — every step depends on the
   * one before it RUNNING TO THE END. A single exception, anywhere in a phase
   * change, and the next phase is never scheduled: the match stops, both
   * players sit in front of a clock that does not move, and nothing is
   * disconnected so nothing is said. See `cells` above for the line that did
   * it.
   *
   * Four timers against one wall clock instead. Each knows when it fires
   * without asking any of the others, so a step that fails costs that step
   * and nothing after it: the battle still starts.
   */
  private runTimeline(): void {
    const build = COUNTDOWN;
    const panic = build + PHASES.build.seconds;
    const locking = panic + PHASES.panic.seconds;
    this.setPhase("countdown", COUNTDOWN);
    this.after(build, () => this.setPhase("build", PHASES.build.seconds));
    this.after(panic, () => this.setPhase("panic", PHASES.panic.seconds));
    this.after(locking, () => this.setPhase("locking", 0));
    // And a short window after locking for the clients to send final boards.
    this.after(locking + PANIC_LOCK_WINDOW, () => this.computeResult());
  }

  /** Handle a message from one of the two clients. */
  handle(ws: WebSocket, raw: string): void {
    const p = ws === this.a.ws ? this.a : this.b;
    let msg: { t: string; view?: BoardView; board?: NetBoard; id?: string; cell?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.t === "board" && msg.view) {
      // Checked before it is kept: a stored view is read again at every phase
      // change, so a bad one is not a bad frame, it is a bad match.
      if (!isBoardView(msg.view)) return;
      p.view = msg.view;
      this.showOthers(this.other(p));
    } else if (msg.t === "hex" && typeof msg.id === "string") {
      // Only the build phases can be interfered with; once boards are locked
      // there is nothing left to disturb.
      if (this.phase === "build" || this.phase === "panic") {
        /*
         * The x-ray is the one card the TARGET cannot carry out, because it
         * does nothing to them: it asks to see. Everything else is forwarded
         * and applied by whoever is holding the board it lands on.
         */
        if (msg.id === XRAY_ID) {
          this.grantPeek(p, XRAY_SECONDS);
          return;
        }
        this.send(this.other(p), {
          t: "hexed",
          id: msg.id,
          // Passed through untouched: which cell was hit is the other
          // client's business, and it is the one holding that board.
          ...(typeof msg.cell === "string" ? { cell: msg.cell } : {}),
        });
      }
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
      if (!this.maySay(p, msg.id)) return;
      const now = Date.now();
      if (now - p.lastSaid < TAUNT_LIMITS.gapSeconds * 1000) return;
      if (p.saidCount >= TAUNT_LIMITS.perMatch) return;
      p.lastSaid = now;
      p.saidCount++;
      this.send(this.other(p), { t: "said", id: msg.id });
    } else if (msg.t === "rematch") {
      /*
       * Only once it is over, and only while both are still here.
       *
       * `resultSent` is the gate: "again?" during the build phase would be a
       * way to end somebody else's match early. `over` means one of them has
       * already gone, and there is nobody to play again with.
       */
      if (!this.resultSent || this.over) return;
      if (this.rematch.has(p.ws)) return;
      this.rematch.add(p.ws);
      this.send(this.other(p), { t: "rematchWanted" });
      if (this.rematch.has(this.a.ws) && this.rematch.has(this.b.ws)) {
        this.over = true;
        for (const t of this.timers) clearTimeout(t);
        this.onRematch?.();
      }
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
    /*
     * ═══ AND THE TIMELINE IS OVER ═══
     *
     * Or: *"when I played the x-ray the clock got stuck and the battle never
     * started"* — *"stuck for both of us."*
     *
     * Here is how a match ends and then carries on. Both players press ready,
     * both boards arrive, and the battle is computed and sent on the spot —
     * that is the whole point of the button. But the clock that was still
     * running underneath was never told, so thirty seconds later, with the
     * two of them watching the fight they had already started, the build
     * timer fired and sent "phase: panic". The client obeys a phase message:
     * the battle vanishes and they are back on a board. Then "phase:
     * locking" arrives, which puts them into the pre-battle countdown — and
     * online nothing comes out of that on its own, because the server's job
     * ended long ago. A clock that does not move and a battle that never
     * starts. Both of them, every time they were both ready early.
     *
     * The result is the end of the match. Nothing scheduled before it has
     * anything left to say.
     */
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    const fallback = (side: Side): NetBoard => ({ owner: side, placements: [] });
    // Amanda mode: the two players become ONE side, and she is the other.
    const boardA = this.coop
      ? joinBoards(this.a.board, this.b.board)
      : (this.a.board ?? fallback("A"));
    const boardB = this.coop ? (this.amanda ?? amandaBoard()) : (this.b.board ?? fallback("B"));
    let winner: Side | null = null;
    // Kept outside the try: the nacho and challenge award below needs the
    // battle itself, not just who won.
    let result: BattleResult | null = null;
    try {
      result = runBattle({
        seed: this.seed,
        catalog: CATALOG,
        synergies: SYNERGIES,
        ground: this.ground,
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
      ground: this.ground,
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
    /*
     * Nachos and challenge progress, for both of them.
     *
     * Separate from recordMatch because they are a different kind of thing:
     * trophies are the ladder and are decided by the result alone, while these
     * are decided by HOW the board did — which needs the battle itself, and
     * this is the only place that still has it. In co-op the two players share
     * one side, so they share the grade; their boards differ, so a challenge
     * about a card one of them played moves for that one only.
     */
    if (result) {
      const both: Array<[string | null, Placement[]]> = this.coop
        ? [
            [this.a.playerId, this.a.board?.placements ?? []],
            [this.b.playerId, this.b.board?.placements ?? []],
          ]
        : [
            [this.a.playerId, boardA.placements],
            [this.b.playerId, boardB.placements],
          ];
      both.forEach(([id, placements], i) => {
        if (!id) return;
        const side = this.coop ? "A" : i === 0 ? "A" : "B";
        /*
         * Who they were up against, so the payout can tell a friend from a
         * stranger. Or's one rule that pays for losing — *"a loss to a
         * friend, one nacho; at this stage I want to encourage games against
         * friends"* — needs this and nothing else.
         *
         * In co-op the other seat is a team-mate, not an opponent, and the
         * two of them are fighting Amanda. Passing a team-mate's id here
         * would pay the friend rate for a match neither of them played
         * against the other, so co-op hands over nothing and everybody is a
         * stranger.
         */
        const against = this.coop ? null : i === 0 ? this.b.playerId : this.a.playerId;
        void awardMeta(id, factsFor(result, side, placements), against);
      });
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
