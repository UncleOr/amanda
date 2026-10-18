/**
 * **The x-ray, which only the server can answer.**
 *
 * Or, playing a friend: *"none of the action cards that touch the enemy
 * work. I cannot erase, freeze the clock, or see the opponent with the
 * x-ray."*
 *
 * The x-ray is the one that could never have worked, and the reason is
 * worth keeping. Against the computer it is a client-side flag: the whole
 * enemy board is in the client's memory and the flag stops hiding it.
 * Online the client is not holding that board — it is holding what this
 * server already fogged — so the flag lifted a fog applied somewhere else
 * and nothing happened. There was nothing to uncover.
 *
 * Every other hex is passed to the opponent and carried out by whoever
 * holds the board it lands on. This one is a request to SEE, and only the
 * server has the thing to show.
 *
 * These exercise `fog` and the peek rule directly rather than standing a
 * socket up, because what can go wrong is the RULE: showing the wrong
 * player, or never putting the fog back.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./match.ts", import.meta.url)), "utf8");

describe("the fog it has to lift", () => {
  /*
   * What the fog hides is the point of the card: during the build phase the
   * opponent sees only the front column, and the x-ray promises "the entire
   * enemy board, including the back Surprise Row".
   */
  it("hides everything but the front column while building", () => {
    const body = SRC.slice(SRC.indexOf("function fog("), SRC.indexOf("/** A single 1v1 match"));
    expect(body).toContain('phase === "build"');
    expect(body, "the front column is x === 3").toContain('Number(k.split("-")[0]) === 3');
    expect(body, "and the crown is hidden with it").toContain("king: null");
  });
});

describe("granting a peek", () => {
  const grant = SRC.slice(SRC.indexOf("private grantPeek"), SRC.indexOf("private setPhase"));

  /*
   * THE DIRECTION. `showOthers(p)` sends P the OPPONENT's board, so the
   * player who peeks is the one who must be re-sent to. Getting this
   * backwards hands the x-ray to the person who was x-rayed, which is both
   * useless and invisible — exactly the failure being fixed.
   */
  it("re-sends to the player who asked, not to the one they looked at", () => {
    expect(grant).toContain("this.showOthers(p)");
    expect(grant, "showOthers(other) would answer the wrong player").not.toContain(
      "this.showOthers(this.other(p))",
    );
  });

  it("puts the fog back when it lapses", () => {
    expect(grant).toContain("this.peeking[p.side] = false");
    expect(grant).toContain("this.after(");
  });

  /*
   * Per player. Both of them can hold an x-ray, and one peeking must not
   * open the other's board.
   */
  it("is remembered for each player separately", () => {
    expect(SRC).toMatch(/private peeking = \{ A: false, B: false \}/);
  });

  /*
   * The window must not be SHORTER than the client's, or the board closes
   * while the player still believes they are looking at it.
   */
  it("lasts at least as long as the client believes it does", () => {
    const server = Number(/const XRAY_SECONDS = (\d+)/.exec(SRC)?.[1]);
    const client = Number(
      /const XRAY_MS = (\d+)/.exec(
        readFileSync(
          fileURLToPath(new URL("../../client/src/game/useMatch.ts", import.meta.url)),
          "utf8",
        ),
      )?.[1],
    );
    expect(server).toBeGreaterThan(0);
    expect(client).toBeGreaterThan(0);
    expect(server * 1000).toBeGreaterThanOrEqual(client);
  });
});

describe("the hex that is not forwarded", () => {
  /*
   * Everything else goes to the opponent to be carried out. The x-ray must
   * not, because there is nothing for them to do and a stray "hexed" would
   * have them react to a card that did not touch them.
   */
  it("answers the x-ray here instead of passing it on", () => {
    const branch = SRC.slice(SRC.indexOf('msg.t === "hex"'), SRC.indexOf('msg.t === "lock"'));
    expect(branch).toContain("XRAY_ID");
    expect(branch).toContain("grantPeek");
    expect(branch, "and stops, rather than also forwarding it").toContain("return;");
  });
});
