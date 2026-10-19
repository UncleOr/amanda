/**
 * **The green dot that stayed after the prize was taken.**
 *
 * Or: *"when you take a challenge the green dot is still there, and it takes
 * a while to go away."*
 *
 * The dot on the home screen counts the REMEMBERED answer — the last thing
 * the server said — and that only ever changed when the server was asked
 * again. So taking a prize gave you: a prize, a token flying up to the bar,
 * a panel closing, and a dot still sitting there saying there is something
 * to take, until a fetch happened to come back.
 *
 * The claim is known the moment the server says yes, and this pins the two
 * halves of acting on it: the remembered list changes, and whoever is
 * showing it is told.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { markClaimed, watchChallenges, type Standing } from "./meta";

const META = readFileSync(fileURLToPath(new URL("./meta.ts", import.meta.url)), "utf8");
const BUTTON = readFileSync(
  fileURLToPath(new URL("../components/Challenges.tsx", import.meta.url)),
  "utf8",
);

const standing = (id: string, claimed = false): Standing =>
  ({ id, period: "daily", done: true, claimed }) as Standing;

describe("marking one taken", () => {
  it("claims the one that was taken and nothing else", () => {
    const after = markClaimed([standing("a"), standing("b")], "a");
    expect(after.find((c) => c.id === "a")?.claimed).toBe(true);
    expect(after.find((c) => c.id === "b")?.claimed).toBe(false);
  });

  /* A new list, because the dot is counted in React and React compares. */
  it("does not edit the list it was given", () => {
    const before = [standing("a")];
    const after = markClaimed(before, "a");
    expect(before[0]!.claimed, "the original must be untouched").toBe(false);
    expect(after).not.toBe(before);
  });

  it("leaves an unknown id alone", () => {
    expect(markClaimed([standing("a")], "nope")[0]!.claimed).toBe(false);
  });
});

describe("telling whoever is showing it", () => {
  it("hands back a way off, and taking it stops the calls", () => {
    let heard = 0;
    const off = watchChallenges(() => heard++);
    expect(typeof off).toBe("function");
    expect(off()).toBeUndefined();
  });

  /*
   * The two ends of the wire. There is no DOM here to press a button in, so
   * these read the source: the claim has to write the answer down, and the
   * button has to be listening.
   */
  it("writes the claim down the moment the server says yes", () => {
    const claim = META.slice(META.indexOf("export async function claimChallenge"));
    const ok = claim.slice(claim.indexOf("if (res.ok)"), claim.indexOf("return (\n"));
    expect(ok).toContain("remember(markClaimed(");
  });

  it("is heard by the dot on the home screen", () => {
    const btn = BUTTON.slice(BUTTON.indexOf("export function ChallengeButton"));
    expect(btn).toContain("watchChallenges(");
    expect(btn, "and it recounts when it hears").toMatch(/watchChallenges\(\(live\) => setReady/);
  });
});
