/**
 * **The game in your hand.**
 *
 * Or: *"I want to add vibration: when you pick a card up, when you play an
 * action card (and also when you have chosen a position for an action card —
 * which card to strengthen, say, or which enemy card to destroy), when the
 * panic phase starts, when the battle starts, and every time a monster dies
 * or an enemy monster dies. Obviously each of them needs a slightly different
 * vibration."*
 *
 * Two kinds of thing can go wrong here and neither is visible in a diff:
 *
 *   THE PATTERNS STOP BEING TELLABLE APART. A phone has one motor and no
 *   volume, so rhythm is the only thing that distinguishes a kill from a
 *   card being picked up. Two events that feel identical are worse than one
 *   of them not firing — a game that buzzes at everything is a game that
 *   means nothing by it.
 *
 *   A BATTLE BECOMES A DRONE. The motor is a queue of one and twenty cards
 *   die in a second. Without a floor the phone buzzes continuously for the
 *   whole battle, which is the kind of thing nobody notices until it is in
 *   a child's hands.
 *
 * And one that is invisible in the browser too: the shipped Android app is a
 * WebView, and a WebView whose app has not declared VIBRATE does not throw,
 * warn or return false. It silently does nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { haptics, PATTERNS, type Buzz } from "./haptics";

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

/** Fit a fake motor and report everything it was asked to do. */
function motor(): { calls: unknown[]; off: () => void } {
  const calls: unknown[] = [];
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  const had = Object.prototype.hasOwnProperty.call(nav, "vibrate");
  const was = nav.vibrate;
  Object.defineProperty(nav, "vibrate", {
    value: (p: unknown) => {
      calls.push(p);
      return true;
    },
    configurable: true,
    writable: true,
  });
  return {
    calls,
    off: () => {
      if (had) nav.vibrate = was;
      else delete nav.vibrate;
    },
  };
}

/**
 * A clock that only ever goes forward, and never twice from the same place.
 *
 * The floors below remember when they last let something through, in a
 * module that outlives one test. Two tests that both start at "now" run the
 * second one in the first one's past, and a floor cannot tell that from a
 * death a moment ago.
 */
let clock = 1_700_000_000_000;
function fakeClock(): void {
  clock += 60_000;
  vi.useFakeTimers({ now: clock });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the seven, as feelings", () => {
  const names = Object.keys(PATTERNS) as Buzz[];

  it("covers everything Or asked for", () => {
    expect(names.sort()).toEqual(
      ["action", "aim", "battle", "fallen", "kill", "lift", "panic"].sort(),
    );
  });

  it("gives no two of them the same rhythm", () => {
    const shapes = names.map((n) => JSON.stringify(PATTERNS[n]));
    expect(new Set(shapes).size, shapes.join(" | ")).toBe(names.length);
  });

  it("asks for nothing a motor cannot do", () => {
    for (const n of names) {
      const p = PATTERNS[n];
      const parts = typeof p === "number" ? [p] : [...p];
      // Under about ten milliseconds a phone's motor does not finish
      // spinning up, so the pulse is felt as nothing at all.
      for (const ms of parts) expect(ms, `${n} has a ${ms}ms step`).toBeGreaterThanOrEqual(10);
      // And nothing here is longer than a moment. The battle is the longest
      // and it happens once a match.
      const total = parts.reduce((a, b) => a + b, 0);
      expect(total, `${n} runs for ${total}ms`).toBeLessThanOrEqual(400);
    }
  });

  it("makes a death of your own heavier than a kill", () => {
    // Told apart through a pocket, which means by LENGTH: the two can arrive
    // a quarter of a second apart and the player is watching the board, not
    // the phone.
    expect(PATTERNS.fallen).toBeGreaterThan((PATTERNS.kill as number) * 2);
  });

  it("makes picking a card up the lightest thing in the set", () => {
    const first = (p: number | readonly number[]) => (typeof p === "number" ? p : p[0]!);
    for (const n of (["action", "aim", "panic", "battle", "fallen"] as Buzz[]))
      expect(first(PATTERNS.lift), n).toBeLessThan(first(PATTERNS[n]));
  });
});

describe("a battle does not become one long buzz", () => {
  it("lets one death through at a time", () => {
    fakeClock();
    const m = motor();
    try {
      for (let i = 0; i < 20; i++) haptics.buzz("kill");
      expect(m.calls, "twenty cards died in one frame").toHaveLength(1);
      vi.advanceTimersByTime(250);
      haptics.buzz("kill");
      expect(m.calls).toHaveLength(2);
    } finally {
      m.off();
    }
  });

  it("and counts both sides' dead on one clock", () => {
    /*
     * ⚠ ONE FLOOR FOR BOTH. A row of yours trading with a row of theirs ends
     * with both sides falling together — and alternating two patterns
     * through that would feel like neither of them.
     */
    fakeClock();
    const m = motor();
    try {
      haptics.buzz("kill");
      haptics.buzz("fallen");
      expect(m.calls).toHaveLength(1);
    } finally {
      m.off();
    }
  });

  it("but never holds up the things you did on purpose", () => {
    // A build phase is a card every second or so, and every one of them is
    // a gesture the player made. None of these may ever be swallowed.
    fakeClock();
    const m = motor();
    try {
      haptics.buzz("lift");
      haptics.buzz("lift");
      haptics.buzz("action");
      haptics.buzz("aim");
      expect(m.calls).toHaveLength(4);
    } finally {
      m.off();
    }
  });
});

describe("when it must do nothing at all", () => {
  it("survives a browser with no motor", () => {
    // Every desktop, and every iPhone: Safari has never shipped
    // navigator.vibrate. The call has to be free and silent, not a crash in
    // the middle of a battle.
    const nav = globalThis.navigator as unknown as Record<string, unknown>;
    const was = nav.vibrate;
    delete nav.vibrate;
    expect(() => haptics.buzz("battle")).not.toThrow();
    if (was) nav.vibrate = was;
  });

  it("survives a motor that refuses", () => {
    const nav = globalThis.navigator as unknown as Record<string, unknown>;
    const was = nav.vibrate;
    Object.defineProperty(nav, "vibrate", {
      value: () => {
        throw new Error("blocked by policy");
      },
      configurable: true,
      writable: true,
    });
    expect(() => haptics.buzz("kill")).not.toThrow();
    if (was) nav.vibrate = was;
    else delete nav.vibrate;
  });

  it("stays quiet when it has been turned off", () => {
    const m = motor();
    try {
      expect(haptics.isEnabled()).toBe(true); // on unless asked otherwise
      haptics.toggleEnabled();
      m.calls.length = 0;
      haptics.buzz("battle");
      haptics.buzz("kill");
      expect(m.calls).toHaveLength(0);
      haptics.toggleEnabled();
      expect(haptics.isEnabled()).toBe(true);
    } finally {
      // Back on, whatever happened above: this module outlives the test.
      if (!haptics.isEnabled()) haptics.toggleEnabled();
      m.off();
    }
  });
});

describe("where the game asks for it", () => {
  /*
   * Six moments, five files. Read out of the source because there is no
   * browser here to carry a card across one — and because the thing that
   * actually goes wrong is a call being dropped in a refactor, which is
   * exactly what a string match catches.
   */
  it("when a card leaves the table", () => {
    const drag = read("./useDrag.ts");
    expect(drag).toContain('haptics.buzz("lift")');
    // Beside the sound, which is the frame at which a press became a carry
    // rather than a tap that opens the card.
    expect(drag.indexOf('haptics.buzz("lift")') - drag.indexOf("sfx.drag(dragMix")).toBeLessThan(
      400,
    );
  });

  it("when an action card is played, and again when it is aimed", () => {
    const match = read("./useMatch.ts");
    expect(match).toContain('haptics.buzz("action")');
    expect(match).toContain('haptics.buzz("aim")');
    // The aim fires where the card is SPENT — one place, whatever the card
    // does, which is why all four of Or's examples are covered by it.
    const spend = match.indexOf("const applyTargetTo");
    expect(match.indexOf('haptics.buzz("aim")')).toBeGreaterThan(spend);
  });

  it("when the panic starts and when the battle does", () => {
    const app = read("../App.tsx");
    expect(app).toContain('m.phase === "panic") haptics.buzz("panic")');
    expect(app).toContain('m.phase === "battle") haptics.buzz("battle")');
  });

  it("and every time a monster falls, on whichever side", () => {
    const arena = read("../components/Arena.tsx");
    expect(arena).toContain('haptics.buzz(mine ? "fallen" : "kill")');
    // `flip` is the only thing in that file that knows whose cards are
    // whose: it is set when the local player is side B.
    expect(arena).toContain('const mine = (g.owner === "A") !== flip');
  });

  it("and can be turned off by the adult in the room", () => {
    const settings = read("../components/Settings.tsx");
    expect(settings).toContain("haptics.toggleEnabled()");
    expect(settings).toContain("haptics.isEnabled()");
  });
});

describe("the one line that makes it work on a real phone", () => {
  it("asks Android for permission to vibrate", () => {
    /*
     * ⚠ SILENT WITHOUT IT. The shipped app is a Capacitor WebView, not the
     * Chrome tab the TWA used to be, so the permission has to be ours now.
     * A WebView whose app has not declared VIBRATE returns true from
     * navigator.vibrate and does nothing — no error, no warning, nothing in
     * a log. The only way to notice is to hold the phone.
     */
    const build = readFileSync(
      fileURLToPath(new URL("../../../../scripts/android-capacitor.cjs", import.meta.url)),
      "utf8",
    );
    expect(build).toContain('android:name="android.permission.VIBRATE"');
    // And that it is actually written into the manifest, rather than being a
    // string nothing uses.
    expect(build).toMatch(/s\.replace\("    <application",\s*cfg\.vibratePermission/);
  });
});
