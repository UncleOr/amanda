import { db } from "./account";

/**
 * The three things only the browser knows, told to the server.
 *
 * Or asked for statistics including *"app usage… user behaviour (abandoning
 * mid-game for instance)… how many playground games"*. None of those reach
 * the server on their own: opening the game is not a request it can see as a
 * visit, leaving a match half way through is the ABSENCE of the message that
 * would have ended it, and the playground is played entirely in the browser
 * and has no result to report.
 *
 * Everything else that gets counted — a purchase, a chest, what a match paid
 * — is written by the server from what it did itself, and deliberately is not
 * reportable from here. See FROM_BROWSER in the server's api.ts.
 *
 * ═══ IT NEVER GETS IN THE WAY ═══
 *
 * Fire and forget, with every failure swallowed. A counter is worth a
 * counter; nothing a child is doing may be slowed down, blocked or broken
 * because the thing counting it could not reach the server.
 */
const SERVER_HTTP = (
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : "")
)
  .replace(/^ws:/, "http:")
  .replace(/^wss:/, "https:");

export type ClientEvent = "open" | "quit" | "playground";

export function track(kind: ClientEvent, data: Record<string, unknown> = {}): void {
  if (!SERVER_HTTP) return;
  void (async () => {
    try {
      const sb = db();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      await fetch(`${SERVER_HTTP}/api/track`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // A guest has no token and still counts: somebody who opens the
          // game without an account is a real person having a real session.
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ kind, data }),
        /*
         * `keepalive` is the whole reason a "quit" is ever recorded.
         *
         * Leaving a match often means leaving the PAGE — a closed tab, a
         * phone switching apps — and an ordinary fetch started on the way out
         * is cancelled with the document. keepalive hands the request to the
         * browser to finish on its own afterwards, which is exactly the case
         * this event exists to count.
         */
        keepalive: true,
      });
    } catch {
      // Counting is not worth a single visible failure.
    }
  })();
}
