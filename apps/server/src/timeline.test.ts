/**
 * **The match that ended and then carried on.**
 *
 * Or, playing a friend: *"when I played the x-ray the clock got stuck and
 * the battle never started."* Asked whose screen it happened on: *"stuck for
 * both of us."*
 *
 * Both of them, with neither disconnected, is a very short list of possible
 * causes — the server is the only thing they share. It had two ways to stop
 * talking in the middle, and this file holds them both down.
 *
 * These drive a real Match through fake timers rather than reading the
 * source, because what failed was not a rule anybody wrote down. It was the
 * SHAPE of the timeline: what is still scheduled after the thing it was
 * leading up to has already happened.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PHASES } from "@amanda/shared";
import { Match } from "./match.js";

/** Just enough WebSocket for a Match: a state, and somewhere to put frames. */
function sock() {
  const sent: Array<Record<string, unknown>> = [];
  return {
    OPEN: 1,
    readyState: 1,
    send: (s: string) => sent.push(JSON.parse(s) as Record<string, unknown>),
    sent,
  };
}
type Sock = ReturnType<typeof sock>;
const kinds = (s: Sock) => s.sent.map((m) => String(m.t));
const board = (owner: string) => ({ owner, placements: [] });
/** Long enough for every phase and the locking window, with room to spare. */
const WHOLE_MATCH = (3 + PHASES.build.seconds + PHASES.panic.seconds + 8 + 5) * 1000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the timeline runs itself", () => {
  it("reaches a result with nobody touching anything", () => {
    const a = sock(), b = sock();
    new Match(a as never, b as never, null, null);
    vi.advanceTimersByTime(WHOLE_MATCH);
    expect(kinds(a)).toContain("result");
    expect(kinds(b)).toContain("result");
  });

  /*
   * ═══ THE ONE THAT COST A MATCH ═══
   *
   * Both ready early is the ordinary case, not an edge: it is what the
   * button is for. The battle is computed and sent on the spot — and the
   * clock that had been running since the match began used to carry on,
   * firing "panic" half a minute later into a screen that was watching the
   * fight, and then "locking", which drops the client into a pre-battle
   * countdown that only a result message ends. The result had been sent
   * already and is never sent twice.
   */
  it("says nothing at all after the result", () => {
    const a = sock(), b = sock();
    const m = new Match(a as never, b as never, null, null);
    vi.advanceTimersByTime(4000); // into the build phase
    m.handle(a as never, JSON.stringify({ t: "lock", board: board("A") }));
    m.handle(b as never, JSON.stringify({ t: "lock", board: board("B") }));
    expect(kinds(a), "both ready means the battle happens now").toContain("result");
    const after = a.sent.length;
    vi.advanceTimersByTime(WHOLE_MATCH);
    expect(
      a.sent.slice(after),
      "a phase message after the result pulls the player out of the battle",
    ).toEqual([]);
  });

  /*
   * A stored view is read again at every phase change, so one bad one is not
   * a bad frame — it is a match that stops where it stood. JSON.stringify
   * DROPS an undefined field, so "a view with no placements" is a thing a
   * client can send by accident rather than only by malice.
   */
  it("survives a board with no placements and still finishes", () => {
    const a = sock(), b = sock();
    const m = new Match(a as never, b as never, null, null);
    vi.advanceTimersByTime(4000);
    expect(() =>
      m.handle(a as never, JSON.stringify({ t: "board", view: { king: "k" } })),
    ).not.toThrow();
    vi.advanceTimersByTime(WHOLE_MATCH);
    expect(kinds(b)).toContain("result");
  });

  it("keeps the last good board when a bad one arrives", () => {
    const a = sock(), b = sock();
    const m = new Match(a as never, b as never, null, null);
    vi.advanceTimersByTime(4000);
    m.handle(a as never, JSON.stringify({ t: "board", view: { placements: { "3-1": "x" }, king: null } }));
    m.handle(a as never, JSON.stringify({ t: "board", view: { placements: null, king: null } }));
    const last = [...b.sent].reverse().find((msg) => msg.t === "opp") as
      | { view: { placements: Record<string, string> } }
      | undefined;
    expect(last?.view.placements).toEqual({ "3-1": "x" });
  });

  /*
   * The phases are scheduled against one wall clock instead of each one
   * scheduling the next from inside its own callback. A chain has the
   * property that any step which fails takes everything after it with it;
   * this asserts the shape, because the cost of losing it is a match that
   * stops in silence.
   */
  it("still starts the battle when a phase change throws", () => {
    const a = sock(), b = sock();
    const m = new Match(a as never, b as never, null, null);
    let boom = true;
    const good = a.send;
    (a as { send: (s: string) => void }).send = (s: string) => {
      if (boom && s.includes('"build"')) {
        boom = false;
        throw new Error("a phase change blew up");
      }
      good(s);
    };
    expect(() => vi.advanceTimersByTime(WHOLE_MATCH)).toThrow();
    vi.advanceTimersByTime(WHOLE_MATCH);
    expect(kinds(b), "the other player's match must not end with it").toContain("result");
  });
});
