/**
 * Who is connected right now, and how to reach them.
 *
 * This is the only thing in the game that is deliberately NOT in the
 * database. "Online" is true for as long as a socket is open and false the
 * instant it is not; a column would be a copy of that fact which is wrong
 * every time a process restarts or a phone goes through a tunnel, and the
 * stale value is the one people would act on.
 *
 * Kept in its own module because both ends need it and they must not import
 * each other: the lobby (index.ts) writes it, the API (friends) reads it.
 *
 * A player may be here more than once — two tabs, a phone and a laptop — so
 * this holds a SET of sockets per player rather than one. Counting was not
 * enough: closing one tab would have marked them away while the other was
 * still playing.
 */
import type { WebSocket } from "ws";

const sockets = new Map<string, Set<WebSocket>>();

export function arrived(playerId: string, ws: WebSocket): void {
  let set = sockets.get(playerId);
  if (!set) sockets.set(playerId, (set = new Set()));
  set.add(ws);
}

export function left(ws: WebSocket, playerId: string | undefined): void {
  if (!playerId) return;
  const set = sockets.get(playerId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(playerId);
}

export function isOnline(playerId: string): boolean {
  return (sockets.get(playerId)?.size ?? 0) > 0;
}

/**
 * Deliver something to every socket a player has open. Returns how many got
 * it, so an invite to somebody who has just closed the tab can say so rather
 * than appearing to have been sent.
 */
export function deliver(playerId: string, payload: string): number {
  const set = sockets.get(playerId);
  if (!set) return 0;
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
      sent++;
    }
  }
  return sent;
}
