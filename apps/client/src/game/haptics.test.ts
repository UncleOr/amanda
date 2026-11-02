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

describe("the eight, as feelings", () => {
  const names = Object.keys(PATTERNS) as Buzz[];

  it("covers everything Or asked for", () => {
    // The eighth arrived after the first seven: *"and it needs to be at the
    // start of the battle and at the start of the build phase too."*
    expect(names.sort()).toEqual(
      ["action", "aim", "battle", "build", "fallen", "kill", "lift", "panic"].sort(),
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
    for (const n of (["action", "aim", "panic", "battle", "build", "fallen"] as Buzz[]))
      expect(first(PATTERNS.lift), n).toBeLessThan(first(PATTERNS[n]));
  });

  it("answers the settings switch with something nobody can miss", () => {
    /*
     * ⚠ THE SWITCH IS THE ONLY TEST A PLAYER HAS. The three reasons a phone
     * stays still — no VIBRATE permission in the installed app, a handset on
     * silent, a page nobody has touched yet — are all invisible from inside
     * the game, so the one control that is ABOUT vibration has to answer
     * with a pattern that cannot be confused with silence. It used to answer
     * with the 12ms tick.
     */
    const src = read("./haptics.ts");
    const on = src.slice(src.indexOf("toggleEnabled()"));
    expect(on).toContain('else this.buzz("panic")');
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

  it("when the board opens, when the panic starts and when the battle does", () => {
    const app = read("../App.tsx");
    expect(app).toContain('m.phase === "build") haptics.buzz("build")');
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

describe("the prize that flies, and the pixel it left behind", () => {
  /*
   * Or: *"there is some annoying bug — when there are diamonds or other
   * things flying there is a 'burnt' pixel on the screen."*
   *
   * Not a leftover element: measured in the browser, the fourteen tokens a
   * forty-diamond prize throws are all gone a second later and the body is
   * back to the four children it started with. It is a leftover LAYER —
   * which three things conspired to leave behind, and all three are here.
   */
  const REWARD = readFileSync(
    fileURLToPath(new URL("./reward.ts", import.meta.url)),
    "utf8",
  );
  const FX = readFileSync(
    fileURLToPath(new URL("../styles/effects.css", import.meta.url)),
    "utf8",
  );

  it("ends the flight at nothing, not at a tenth of something", () => {
    const flight = REWARD.slice(REWARD.indexOf("A lift before the run"));
    expect(flight).toContain("opacity: 0,");
    expect(flight).not.toContain("opacity: 0.1");
  });

  it("cancels the animation before deleting the element it is holding", () => {
    // `fill: forwards` keeps the last frame painted on a node that is about
    // to be removed, which is the other half of the ghost.
    expect(REWARD).toContain("for (const a of node.getAnimations()) a.cancel()");
  });

  it("makes no permanent promise to the compositor", () => {
    // `will-change` on an element that lives for one second and is then
    // deleted is a layer asked for and never released.
    // The DECLARATION, not the word: the rule explains in a comment why it
    // is not there, and a plain string match reads that as the bug.
    const fly = FX.slice(FX.indexOf(".fly {"));
    expect(fly.slice(0, fly.indexOf("}"))).not.toMatch(/will-change\s*:/);
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
