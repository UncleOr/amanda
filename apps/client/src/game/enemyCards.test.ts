/**
 * **The two halves of "the enemy cards do not work".**
 *
 * Or, playing a friend: *"none of the action cards that touch the enemy
 * work. I cannot erase, freeze the clock, or see the opponent with the
 * x-ray. And when I played the x-ray the clock got stuck and the battle
 * never started"* — *"stuck for both of us."*
 *
 * The x-ray was a card that could never have worked online and is answered
 * by the server now (xray.test.ts, on the server side). These two are the
 * rest of it, and both are about the player who SPENDS the card seeing
 * nothing happen.
 *
 * There is no DOM here, so these read the source. Both are ORDER rules — a
 * line that has to come before another line — which is exactly the kind of
 * thing that gets quietly undone by the next person tidying a function.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");

describe("the eraser, aimed at a person", () => {
  const fn = SRC.slice(SRC.indexOf("const eraseEnemyAt"), SRC.indexOf("const activateAction"));

  /*
   * Everything this function did was an edit to the COMPUTER's plan, and
   * against a person there is no plan: it is null, the function returned,
   * and the screen of the player who spent the card did not change at all.
   * The card landed — the other client carried it out — but a card that
   * does nothing when you play it is a card that does not work.
   */
  it("changes what the player sees before it looks for a plan", () => {
    const paint = fn.indexOf("setNetOpp(");
    const plan = fn.indexOf("if (!plan) return;");
    expect(paint, "the enemy board must be repainted here").toBeGreaterThan(-1);
    expect(plan).toBeGreaterThan(-1);
    expect(paint, "online there is no plan, so anything after that line is dead").toBeLessThan(
      plan,
    );
  });

  it("still tells the other client, which is the one holding that board", () => {
    const apply = SRC.slice(SRC.indexOf("const applyTargetTo"), SRC.indexOf("const applyTargetCell"));
    const erase = apply.slice(apply.indexOf('effect === "eraseEnemyCard"'));
    expect(erase).toContain("netRef.current?.hex(id, key)");
  });
});

describe("a phase message from a match that is over", () => {
  const onPhase = SRC.slice(SRC.indexOf("onPhase: (p, timeLeft)"), SRC.indexOf("onOpp:"));

  /*
   * ═══ THE STUCK CLOCK ═══
   *
   * Both players press ready, the server computes the battle on the spot —
   * and the clock it started when the match began used to keep running.
   * Half a minute later "panic" arrived, this handler obeyed it, and the
   * fight they were watching vanished. Then "locking" arrived and put them
   * into the pre-battle countdown, which online is only ever ended by a
   * result message — and that had been sent already.
   *
   * The server no longer talks after the result (computeResult in
   * match.ts). This is the other half: a client must not act on a message
   * from a round it has already fought.
   */
  it("is ignored once the battle has been fought", () => {
    expect(onPhase).toMatch(/phaseRef\.current === "battle"/);
    expect(onPhase).toMatch(/phaseRef\.current === "result"/);
    const guard = onPhase.indexOf('p !== "countdown"');
    const locking = onPhase.indexOf('if (p === "locking")');
    expect(guard, "the guard has to come before anything acts on the phase").toBeGreaterThan(-1);
    expect(guard).toBeLessThan(locking);
  });

  /*
   * Except a new countdown, which is not the past: it is the server
   * starting the rematch both players asked for, down the same socket.
   */
  it("still lets a rematch through", () => {
    expect(onPhase).toContain('if (p === "countdown" && phaseRef.current === "result")');
    expect(onPhase).toContain("clearRound()");
  });
});
