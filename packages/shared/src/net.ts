/**
 * Wire protocol shared by the client and the authoritative multiplayer server.
 * Kept dependency-free (no engine import) so `@amanda/shared` stays a leaf:
 * the placement shapes below are structurally compatible with the engine's
 * BoardInput / Placement, so boards pass straight through to runBattle.
 */

export type Side = "A" | "B";

export interface NetBuff {
  powerAdd?: number;
  powerMult?: number;
  hpMult?: number;
}

export interface NetPlacement {
  cardId: string;
  x: number;
  y: number;
  king?: boolean;
  below?: string;
  buff?: NetBuff;
}

export interface NetBoard {
  owner: Side;
  placements: NetPlacement[];
}

/** A fog-limited view of a board (cellKey → cardId, plus the King if revealed). */
export interface BoardView {
  placements: Record<string, string>;
  king: string | null;
}

/**
 * Room codes are read aloud and typed in by hand, so the alphabet leaves out
 * every character that can be mistaken for another: no O/0, no I/1/L.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

/** Why joining a room failed. */
export type RoomError = "notFound" | "full" | "self";

// ── client → server ────────────────────────────────────────────────
export type ClientMessage =
  /**
   * Which account is playing, sent once on connect. Optional on purpose: a
   * player with no account still gets a match, they just earn nothing from it.
   */
  | { t: "me"; playerId: string }
  /** Join the open queue and play whoever turns up next. */
  | { t: "hello" }
  /**
   * Queue for Amanda mode: the two of you share one side against her.
   * It needs two people by design — one board cannot beat her.
   */
  | { t: "helloAmanda" }
  /** Open a private room and wait for a specific person to join it. */
  | { t: "host" }
  /** Join a private room by its code. */
  | { t: "join"; code: string }
  /** Live board (for the opponent's fog-of-war view). */
  | { t: "board"; view: BoardView }
  /**
   * "I am ready", carrying the board as it stands. Being ready does NOT stop
   * you building: keep placing and this is simply sent again. The battle
   * starts the moment BOTH players are ready.
   */
  | { t: "lock"; board: NetBoard }
  /** Changed my mind — I am not ready after all. */
  | { t: "unready" }
  /**
   * An action card played AT the opponent. The server only passes it along —
   * what it does is the receiving client's business, so a new card of this kind
   * needs no server change.
   */
  | { t: "hex"; id: string };

// ── server → client ────────────────────────────────────────────────
export type ServerMessage =
  | { t: "waiting" }
  /** A private room was opened; share this code to be joined. */
  | { t: "room"; code: string }
  | { t: "roomError"; reason: RoomError }
  /**
   * `coop` means Amanda mode: both players build on side A, each in their own
   * half of an eight-lane board, and `lane` says which half is yours.
   */
  | { t: "start"; side: Side; coop?: boolean; lane?: number }
  | { t: "phase"; phase: string; timeLeft: number }
  /** Fogged view of the opponent's board for the current phase. */
  | { t: "opp"; view: BoardView }
  /** Authoritative battle inputs — both clients replay this deterministically. */
  /**
   * `lanes` is not optional detail: the client replays this battle itself, and
   * a replay run in four lanes against boards built for eight would diverge
   * from the server's answer rather than merely look wrong.
   */
  | {
      t: "result";
      seed: number;
      boardA: NetBoard;
      boardB: NetBoard;
      winner: Side | null;
      lanes?: number;
      coop?: boolean;
    }
  | { t: "oppLeft" }
  /** Whether the opponent has declared themselves ready. */
  | { t: "oppReady"; ready: boolean }
  /** The opponent played an action card at you. */
  | { t: "hexed"; id: string };

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}
