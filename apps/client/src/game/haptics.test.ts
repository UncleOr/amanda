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

/** The two that are furniture: a button, and the studio mark. */
const LIGHT: Buzz[] = ["tap", "logo"];

describe("the vocabulary, as feelings", () => {
  const names = Object.keys(PATTERNS) as Buzz[];

  it("covers everything Or asked for", () => {
    /*
     * It grew twice. Seven at first, then the build phase — *"and it needs
     * to be at the start of the battle and at the start of the build phase
     * too"* — and then the whole scale was rebuilt: *"the vibrations are
     * really short and not noticeable... the small ones there are now can
     * be on the Asulins logo appearing and on button presses. But during
     * the game itself there needs to be a more significant vibration. Also
     * when you take a card, when the panic starts, when our soldiers die.
     * Also at the end of a match. And of course when you press a chest and
     * when diamonds are taken."*
     */
    expect(names.sort()).toEqual(
      [
        "action", "aim", "battle", "build", "chest", "defeat", "fallen",
        "gems", "go", "kill", "lift", "lock", "logo", "panic", "tap",
        "victory",
      ].sort(),
    );
  });

  it("keeps the light ones light and makes everything else felt", () => {
    const total = (p: number | readonly number[]) =>
      typeof p === "number" ? p : p.reduce((a, b) => a + b, 0);
    /*
     * ⚠ THE WHOLE POINT OF THE REBUILD. Twelve milliseconds is at the floor
     * of what a phone's motor can spin up for, which is why Or could not
     * feel any of it. The furniture stays there; everything that happens
     * IN a match is at least thirty-five, and the events that matter are
     * past a hundred.
     */
    for (const n of LIGHT) expect(total(PATTERNS[n]), n).toBeLessThanOrEqual(110);
    for (const n of names.filter((x) => !LIGHT.includes(x)))
      expect(total(PATTERNS[n]), n).toBeGreaterThanOrEqual(35);
    // And the four that are moments rather than confirmations.
    for (const n of ["battle", "victory", "defeat", "panic"] as Buzz[])
      expect(total(PATTERNS[n]), n).toBeGreaterThanOrEqual(260);
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
      // And nothing here is longer than a moment. The longest are the
      // curtain going up and the match being won, and both happen once.
      const total = parts.reduce((a, b) => a + b, 0);
      expect(total, `${n} runs for ${total}ms`).toBeLessThanOrEqual(800);
    }
  });

  it("makes a death of your own heavier than a kill", () => {
    // Told apart through a pocket, which means by LENGTH: the two can arrive
    // a quarter of a second apart and the player is watching the board, not
    // the phone.
    expect(PATTERNS.fallen).toBeGreaterThan((PATTERNS.kill as number) * 2);
  });

  it("makes a button press the lightest thing in the set", () => {
    const first = (p: number | readonly number[]) => (typeof p === "number" ? p : p[0]!);
    for (const n of (["lift", "action", "aim", "panic", "battle", "build", "fallen"] as Buzz[]))
      expect(first(PATTERNS.tap), n).toBeLessThan(first(PATTERNS[n]));
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
      vi.advanceTimersByTime(400);
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
      haptics.buzz("tap");
      expect(m.calls).toHaveLength(5);
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

  it("answers EVERY click, through one listener", () => {
    /*
     * Or: *"there needs to be vibration on every click... in general, more
     * haptic gestures for everything."* There are two hundred controls in
     * this game across a dozen files; the ones that would be missed are
     * exactly the ones nobody would remember to go back to.
     */
    const main = read("../main.tsx");
    expect(main).toContain('haptics.buzz("tap")');
    expect(main).toMatch(/addEventListener\(\s*"pointerdown"/);
    // Capture, so a handler that stops the event cannot take the answer
    // with it; passive, so this is never what delays a tap.
    expect(main).toContain("{ capture: true, passive: true }");
    // And a control that also calls `pressed` must not fire twice.
    const src = read("./haptics.ts");
    expect(src).toMatch(/tap: 90,/);
  });

  it("starts a match and locks the boards", () => {
    // Or: *"and when you press start game... and at the start of the panic.
    // And at the end of the panic."*
    const app = read("../App.tsx");
    expect(app).toContain('m.phase === "countdown") haptics.buzz("go")');
    expect(app).toContain('m.phase === "prebattle") haptics.buzz("lock")');
  });

  it("answers a button press, wherever that button is", () => {
    /*
     * Or: *"the small ones can be on button presses — going into the shop,
     * into the tunnel, into a game."* Every button in this game already
     * goes through one function, so that is where it lives: a press is a
     * TAP unless the press says otherwise.
     */
    const press = read("./press.ts");
    expect(press).toContain('haptics.buzz(opts.buzz ?? "tap")');
    expect(press).toContain("opts.buzz !== false");
    // And the presses that are events in their own right say so.
    expect(read("../components/Payout.tsx")).toContain('buzz: "chest"');
    expect(read("../components/ChestReveal.tsx")).toContain('haptics.buzz("chest")');
    expect(read("../components/Tunnel.tsx")).toContain('buzz: "gems"');
    expect(read("../components/Challenges.tsx")).toContain('buzz: "gems"');
  });

  it("and the studio mark says hello in the hand", () => {
    expect(read("../components/Ident.tsx")).toContain('haptics.buzz("logo")');
  });

  it("tells a won match from a lost one", () => {
    // Or: *"also at the end of a match."* Losing and winning are not the
    // same news, and the phone can say which before the screen has drawn.
    expect(read("../App.tsx")).toContain(
      'haptics.buzz(m.iWon ? "victory" : "defeat")',
    );
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

  it("and the fourteen chips every press throws do the same three things", () => {
    /*
     * ⚠ THE SECOND TIME HE REPORTED IT: *"the pixel is still there."* The
     * first search went to reward.ts, which throws the diamonds. This is
     * the thing that throws fourteen four-pixel rectangles out of EVERY
     * press in the game — including the press that starts the diamonds.
     *
     * Measured in the browser with the old recipe: at 300ms the chip is at
     * opacity 0.53 and flying, at 650ms it is at 0.01 — and at 850ms it is
     * back at OPACITY 1, sitting at the button, because with no `fill` an
     * animation's last frame is dropped the moment it ends. It stays lit
     * until a timer removes it up to 400ms later, and on a frame where the
     * main thread is busy — opening a chest, changing screen — that timer
     * is late and the chip stays on the screen.
     */
    const press = readFileSync(
      fileURLToPath(new URL("./press.ts", import.meta.url)),
      "utf8",
    );
    expect(press).toContain('fill: "forwards"');
    expect(press).toContain("for (const a of chip.getAnimations()) a.cancel()");
    // The declaration, not the word: the file explains in a comment why it
    // is not there.
    expect(press).not.toMatch(/will-change:/);
    // Removed when it finishes, with the timer left as the floor under it.
    expect(press).toContain("run.finished.then(gone, gone)");
    expect(press).toContain("window.setTimeout(gone, LIFE + 400)");
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
