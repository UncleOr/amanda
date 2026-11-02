/**
 * **The match fetches its pictures before it needs them.**
 *
 * Or: *"maybe we should do a kind of 'loading resources' at the start of a
 * match so it runs more smoothly"*, and, about the screen after it: *"when
 * you press 'a chest is waiting for you' at the end of a match it takes a
 * while to respond."*
 *
 * Two halves of one thing — a moment where the game is waiting on the
 * network with the player watching — and both are fixed by moving the wait
 * somewhere nobody is looking.
 *
 * ⚠ THESE ARE SOURCE TESTS, AND THEY HAVE TO BE. There is no browser here:
 * `warm` makes an `Image`, which does not exist in node, so the module
 * deliberately does nothing at all when there is no window. What IS checked
 * here is the shape of the thing — and the shape is where both of the bugs
 * below lived.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { warmedCount } from "./preload";

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const PRELOAD = read("./preload.ts");
const APP = read("../App.tsx");

describe("warming the cache", () => {
  it("does nothing at all without a window, rather than throwing", () => {
    // Imported by App.tsx, which is read as text by half a dozen tests.
    expect(warmedCount()).toBe(0);
  });

  it("calls requestIdleCallback ON the window", () => {
    /*
     * ⚠ THE SILENT FAILURE THIS FILE WAS BORN WITH.
     *
     * `const idle = window.requestIdleCallback; idle(fn)` does not throw in
     * Chrome — it quietly does nothing, for ever. Measured: the whole
     * catalogue was queued on every build phase and not one image was
     * fetched; the count of things asked for sat at 19 through four seconds
     * of an idle browser. After calling it on `window`, the same nine
     * seconds of build phase fetched 75 card pictures and five scenes.
     */
    expect(PRELOAD).toContain("window.requestIdleCallback(later, { timeout: 3000 })");
    expect(PRELOAD).not.toMatch(/\bidle\(later\)/);
  });

  it("never asks for the same picture twice", () => {
    expect(PRELOAD).toContain("const asked = new Set<string>()");
    expect(PRELOAD).toContain("if (!url || asked.has(url)) continue");
  });

  it("leaves the connections the game itself needs", () => {
    // A browser gives a host six. The point of this is to use the quiet,
    // not to compete with the match for it.
    expect(PRELOAD).toMatch(/const AT_ONCE = [1-4];/);
    expect(PRELOAD).toContain('img.decoding = "async"');
  });

  it("is run by the build phase, in two waves", () => {
    const where = APP.slice(APP.indexOf('if (m.phase !== "build") return;'));
    const block = where.slice(0, where.indexOf("}, ["));
    // What this match will certainly show, now...
    expect(block).toContain("warm([");
    expect(block).toContain("arena/");
    expect(block).toContain("scenes/chest_gold.png");
    // ...and the rest of the catalogue when the browser is quiet.
    expect(block).toContain("warmSoon([...CATALOG.keys()]");
  });
});

describe("the chest at the end of a match", () => {
  it("is fetched while the result is still being read", () => {
    /*
     * Or: *"when you press 'a chest is waiting for you' at the end of a
     * match it takes a while to respond."* It did: two round trips stood in
     * front of the animation — ask which chests are waiting, then ask the
     * server to open one — and only then was anything drawn.
     */
    expect(APP).toContain("const [waitingChest, setWaitingChest] = useState<Chest | null>(null)");
    expect(APP).toMatch(/if \(m\.phase !== "result" \|\| !m\.award\?\.chests\?\.length\) return;/);
  });

  it("opens on the press, with what is already held", () => {
    // The shelf on the home screen has worked this way since Or said the
    // same thing about it: the reveal opens on the tap and the server's
    // answer lands during the chest's own 480ms of rattling.
    const fn = APP.slice(APP.indexOf("const openNewestChest"));
    const body = fn.slice(0, fn.indexOf("}, [waitingChest]"));
    expect(body).toContain("setChest(held)");
    expect(body.indexOf("setChest(held)")).toBeLessThan(body.indexOf("openChest(held.id)"));
    // And it still works for a chest the list never caught up with.
    expect(body).toContain("const waiting = await unopenedChests()");
  });

  it("answers under the thumb before it answers from the server", () => {
    const payout = read("../components/Payout.tsx");
    expect(payout).toContain("pressed(e.currentTarget");
  });
});
