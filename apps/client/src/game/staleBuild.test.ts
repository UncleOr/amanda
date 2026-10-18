/**
 * **Telling "the build moved" apart from "our code threw".**
 *
 * Or, at the end of a tutorial stage: *"it said it could not show me the
 * battle."* Underneath, the reason:
 *
 *     Failed to fetch dynamically imported module:
 *     .../assets/WebGLRenderer-CF5Wwt7Y.js
 *
 * A deploy renames every file and deletes the old names, so a page loaded
 * before it asks for a file that is gone the moment it needs anything it has
 * not already fetched. Only a reload fixes that, and it has to wait for the
 * home screen — reloading mid-match costs the match.
 *
 * So the page is FLAGGED here and repaired later. Which makes this one
 * sentence the whole thing: is this failure the build moving, or is it a
 * bug of ours? Flag the second and the game reloads itself on an honest
 * crash, which looks exactly like the game being broken.
 *
 * The browsers do not agree on the wording and none of them promise it, so
 * the three real ones are pinned here rather than trusted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

async function fresh() {
  vi.resetModules();
  return await import("./staleBuild");
}

beforeEach(() => vi.resetModules());

describe("a page whose build has moved", () => {
  it("starts out fine", async () => {
    const { isStale } = await fresh();
    expect(isStale()).toBe(false);
  });

  it("stays flagged once it has been", async () => {
    const { markStale, isStale } = await fresh();
    markStale();
    expect(isStale()).toBe(true);
    // There is no way back: the file names this page holds are gone for good.
    markStale();
    expect(isStale()).toBe(true);
  });
});

describe("recognising it", () => {
  /*
   * The three wordings that exist. Chrome and the Android WebView — which is
   * what Or plays on, and where this was found — say the first one.
   */
  it.each([
    "TypeError: Failed to fetch dynamically imported module: https://playamanda.com/play/assets/WebGLRenderer-CF5Wwt7Y.js",
    "TypeError: Importing a module script failed.",
    "Error: error loading dynamically imported module",
  ])("knows %s", async (message) => {
    const { looksLikeAMovedBuild } = await fresh();
    expect(looksLikeAMovedBuild(new Error(message))).toBe(true);
  });

  /*
   * THE HALF THAT MATTERS MORE. A page that reloads itself whenever
   * something throws is a game that restarts at random, and a child cannot
   * tell that from it being broken.
   */
  it.each([
    "TypeError: Cannot read properties of undefined (reading 'king')",
    "WebGL context lost",
    "Unknown cardId in placement: hitter",
    "NetworkError when attempting to fetch resource.",
  ])("does not mistake %s for it", async (message) => {
    const { looksLikeAMovedBuild } = await fresh();
    expect(looksLikeAMovedBuild(new Error(message))).toBe(false);
  });

  it("survives being handed something that is not an error", async () => {
    const { looksLikeAMovedBuild } = await fresh();
    for (const junk of [null, undefined, 42, { nope: true }, "plain string"]) {
      expect(() => looksLikeAMovedBuild(junk)).not.toThrow();
      expect(looksLikeAMovedBuild(junk)).toBe(false);
    }
  });
});
