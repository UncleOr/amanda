import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Every piece of match state is either reset between matches, or deliberately
 * not — and there is no third option.
 *
 * ═══ WHY THIS IS A SOURCE CHECK AND NOT A BEHAVIOUR TEST ═══
 *
 * `useMatch` holds forty-two pieces of state, and `clearMatch` resets them by
 * naming each setter in turn. That shape has exactly one failure mode: add a
 * `useState` and forget to add a line. It has already happened twice — once
 * `mySide` survived into a single-player game and inverted the win check, and
 * once an arriving account re-dealt the tutorial deck.
 *
 * Testing it by running the hook would need a React renderer and a DOM, and
 * would still only prove that the states the test knew to look at were reset.
 * Reading the source proves it about ALL of them, including the one somebody
 * adds next week — which is the whole point.
 *
 * So: every `set…` from a `useState` in that file must be called inside
 * `clearRound` or `clearMatch`, or be listed below with a reason. Adding a
 * state and not thinking about it is what this makes impossible; deciding
 * that it should outlive a match is still completely allowed, it just has to
 * be written down.
 */
const SOURCE = readFileSync(
  fileURLToPath(new URL("./useMatch.ts", import.meta.url)),
  "utf8",
);

/**
 * State that is NOT reset between matches, and why.
 *
 * Each of these is a deliberate decision. If one of them starts looking
 * wrong, this is the list to argue with.
 */
const OUTLIVES_A_MATCH: Record<string, string> = {
  setAccount: "who you are. A match ending does not sign you out.",
  setSuspendedUntil: "a suspension is not served by starting a new match.",
  setHearing:
    "whether you want to see other players' messages. A per-browser choice, remembered on purpose.",
  setPhase:
    "the screen you are on. Every caller of clearMatch sets it immediately afterwards, to the screen it is going to — resetting it here would flash the wrong one.",
  setInvitation:
    "a friend calling you in. It arrives while you are between matches, which is exactly when clearMatch runs.",
};

/** The body of a top-level `const NAME = useCallback(() => { … }, [...])`. */
function bodyOf(name: string): string {
  const start = SOURCE.indexOf(`const ${name} = useCallback(`);
  if (start < 0) throw new Error(`${name} not found in useMatch.ts`);
  // Walk braces from the first one after the arrow.
  const open = SOURCE.indexOf("{", SOURCE.indexOf("=>", start));
  let depth = 0;
  for (let i = open; i < SOURCE.length; i++) {
    if (SOURCE[i] === "{") depth++;
    else if (SOURCE[i] === "}" && --depth === 0) return SOURCE.slice(open, i + 1);
  }
  throw new Error(`${name} never closes`);
}

/** Every `const [x, setX] = useState…` in the file. */
function stateSetters(): string[] {
  const found = new Set<string>();
  for (const m of SOURCE.matchAll(/const\s*\[\s*\w+\s*,\s*(set\w+)\s*\]\s*=\s*useState/g))
    found.add(m[1]!);
  return [...found].sort();
}

describe("state that survives a match", () => {
  const setters = stateSetters();
  const resetters = bodyOf("clearRound") + bodyOf("clearMatch");

  it("finds the states — if this is zero the test is lying to us", () => {
    // A regex that silently stops matching would make every assertion below
    // pass by finding nothing to check.
    expect(setters.length).toBeGreaterThan(30);
  });

  it.each(stateSetters())("%s is reset between matches, or says why not", (setter) => {
    const reset = new RegExp(`\\b${setter}\\s*\\(`).test(resetters);
    const excused = setter in OUTLIVES_A_MATCH;
    expect(
      reset || excused,
      `${setter} is neither reset in clearRound/clearMatch nor listed in OUTLIVES_A_MATCH.\n` +
        `Either add it to one of those two functions, or add it to the list with the reason ` +
        `it should survive a match. Both are fine; forgetting is not.`,
    ).toBe(true);
  });

  it("nothing is on the excuse list that is actually being reset", () => {
    // A stale excuse is a comment that has stopped being true.
    for (const setter of Object.keys(OUTLIVES_A_MATCH)) {
      const alsoReset = new RegExp(`\\b${setter}\\s*\\(`).test(resetters);
      expect(
        alsoReset,
        `${setter} is listed as surviving a match, but clearRound/clearMatch resets it. ` +
          `Remove it from OUTLIVES_A_MATCH.`,
      ).toBe(false);
    }
  });

  it("every name on the excuse list is really a state setter", () => {
    for (const setter of Object.keys(OUTLIVES_A_MATCH))
      expect(setters, `${setter} is excused but no longer exists`).toContain(setter);
  });
});
