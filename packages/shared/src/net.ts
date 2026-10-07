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
  | { t: "hex"; id: string }
  /**
   * Say one of the ready-made lines to the other player (see taunts.ts).
   * Only the id travels: the words live in the catalogue on both sides, so
   * nothing a client sends can become text on somebody else's screen.
   */
  | { t: "say"; id: string }
  /**
   * "Again?" — offered once a match is over, to the person you just played.
   *
   * The second round runs down the SAME sockets. Sending both players back to
   * the queue instead would be a different feature with the same button: they
   * would each be paired with whoever happened to be waiting.
   */
  | { t: "rematch" }
  /** Ask a friend to come and play. Checked against the friends table. */
  | { t: "invite"; to: string };

/**
 * Who you are about to fight: everything the versus screen shows.
 *
 * Or: *"at the start of a match against a friend (and against the bot too)
 * there should be a second where you see who you are fighting — how many
 * trophies they have, their nickname and their picture."*
 *
 * Sent by the server, which is the only side that knows any of it. Deliberately
 * a small flat record rather than a reference to a player row: the client must
 * never be in a position to look up a stranger, and this is exactly what is
 * public about an opponent and nothing else — no id, no age, no email.
 *
 * The CATCHPHRASE is an id, not a sentence, for the same reason a taunt is:
 * the words live in the catalogue on both sides, so nothing a client sends can
 * become text on somebody else's screen.
 */
export interface PlayerCard {
  nickname: string | null;
  avatar: string | null;
  trophies: number;
  /** An id from catchphrases.ts, or null for "chose not to say anything". */
  catchphrase: string | null;
  /** Which way to word a line said TO them. Null means "did not say". */
  gender: "boy" | "girl" | null;
}

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
  /**
   * Amanda mode only: your partner's half, with NO fog.
   *
   * It is a separate message from `opp` because a partner is not an opponent
   * and the two were being confused — the panel labelled "Amanda" was showing
   * the other player's cards, fogged, while Amanda herself was not built until
   * the battle. Your ally is yours to see; she is the one behind the fog.
   *
   * `lane` is the row offset of the half it belongs to, so the client can draw
   * the two halves in the order the engine will actually fight them in.
   */
  | { t: "mate"; view: BoardView; lane: number }
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
  /**
   * Who the other player is — name, face, trophies, catchphrase.
   *
   * Sent once, right after `start`, and separate from it because it arrives
   * from a database and `start` must not wait on one. A match whose profile
   * never turns up is a match with a plain "היריב" on the versus screen, which
   * is a worse screen and a perfectly good game.
   */
  | { t: "opponent"; who: PlayerCard }
  | { t: "oppLeft" }
  /**
   * You are suspended and no match will start. Carries the date it lifts, so
   * the game can say when rather than just refusing — being told you are
   * suspended and until when is the difference between a punishment and a
   * game that is mysteriously broken.
   */
  | { t: "suspended"; until: string }
  /** Whether the opponent has declared themselves ready. */
  | { t: "oppReady"; ready: boolean }
  /** The opponent played an action card at you. */
  | { t: "hexed"; id: string }
  /** The other player said one of the ready-made lines. Id only — see "say". */
  | { t: "said"; id: string }
  /** The other player would like to play you again. */
  | { t: "rematchWanted" }
  /** A friend has opened a room and would like you in it. */
  | { t: "invited"; from: string; nickname: string | null; code: string };

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}
