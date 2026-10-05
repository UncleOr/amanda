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
  /** Join the open queue and play whoever turns up next. */
  | { t: "hello" }
  /** Open a private room and wait for a specific person to join it. */
  | { t: "host" }
  /** Join a private room by its code. */
  | { t: "join"; code: string }
  /** Live board (for the opponent's fog-of-war view). */
  | { t: "board"; view: BoardView }
  /** Final locked board, WITH action-card buffs, used for the battle. */
  | { t: "lock"; board: NetBoard }
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
  | { t: "start"; side: Side }
  | { t: "phase"; phase: string; timeLeft: number }
  /** Fogged view of the opponent's board for the current phase. */
  | { t: "opp"; view: BoardView }
  /** Authoritative battle inputs — both clients replay this deterministically. */
  | { t: "result"; seed: number; boardA: NetBoard; boardB: NetBoard; winner: Side | null }
  | { t: "oppLeft" }
  /** The opponent played an action card at you. */
  | { t: "hexed"; id: string };

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}
