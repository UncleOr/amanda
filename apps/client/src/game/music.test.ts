/**
 * The soundtrack picks one of two songs and hands over to the other.
 *
 * ═══ WHY THIS IS A TEST AND NOT A CLICK ═══
 *
 * Starting the music in a browser proves the first half: a track loads and
 * plays. The second half — what happens when a song ENDS — takes two minutes
 * and forty-five seconds to reach, and the element doing it is created with
 * `new Audio()` and never attached to the document, so there is nothing to
 * reach in from a console and seek.
 *
 * So the handover is tested here, where `ended` is a method call.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class FakeAudio {
  static made: FakeAudio[] = [];
  volume = 0;
  paused = true;
  private handlers: Record<string, Array<() => void>> = {};

  constructor(public src: string) {
    FakeAudio.made.push(this);
  }
  addEventListener(name: string, fn: () => void): void {
    (this.handlers[name] ??= []).push(fn);
  }
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  /** What the browser does when the song runs out. */
  finish(): void {
    for (const fn of this.handlers.ended ?? []) fn();
  }
}

const store = new Map<string, string>();

/**
 * A fresh module with the dice loaded.
 *
 * The track is chosen in a class field, which runs when the module is first
 * imported — so the only way to choose it is to reset the module registry and
 * import again.
 */
async function freshMusic(random: number) {
  vi.resetModules();
  FakeAudio.made = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.Audio = FakeAudio;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  // The ramps are not under test and a real interval would outlive the run.
  g.window = { setInterval: () => 0, clearInterval: () => {} };
  vi.spyOn(Math, "random").mockReturnValue(random);
  return (await import("./music")).music;
}

const name = (a: FakeAudio) => a.src.split("/").pop();

beforeEach(() => store.set("amanda.music", "on"));
afterEach(() => vi.restoreAllMocks());

describe("the soundtrack", () => {
  it("starts on either song, depending on the roll", async () => {
    const low = await freshMusic(0.0);
    low.play("menu");
    expect(name(FakeAudio.made[0]!)).toBe("track1.mp3");

    const high = await freshMusic(0.99);
    high.play("menu");
    expect(name(FakeAudio.made[0]!)).toBe("track2.mp3");
  });

  it("plays the other one when the first ends", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const first = FakeAudio.made[0]!;
    expect(name(first)).toBe("track1.mp3");

    first.finish();
    expect(FakeAudio.made).toHaveLength(2);
    expect(name(FakeAudio.made[1]!)).toBe("track2.mp3");

    // And back again, so a long session never runs out of music.
    FakeAudio.made[1]!.finish();
    expect(name(FakeAudio.made[2]!)).toBe("track1.mp3");
  });

  it("ignores an element that is no longer the one playing", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const first = FakeAudio.made[0]!;

    m.stop();
    first.finish();

    // Stopping is what happens when the player turns the music off. A song
    // reaching its end afterwards must not quietly start the next one.
    expect(FakeAudio.made).toHaveLength(1);
  });
});

/**
 * ═══ THE GAME BEING PUT DOWN ═══
 *
 * Or: *"the music doesn't stop when I minimise the game."*
 *
 * A phone leaves a page's audio running when it goes to the background, on
 * purpose — that is how a music app works — and a game is the one thing
 * nobody minimises in order to carry on listening to.
 *
 * The behaviour has three edges and all three are a bug if they are wrong:
 * it must actually stop; it must come back where it left off rather than at
 * the top of the song; and it must not start playing for somebody who never
 * had it on. The second one is the reason `suspend` exists at all instead of
 * a call to `stop()`, which drops the element and so restarts the track.
 *
 * game/away.ts is what calls these, from `visibilitychange` and from
 * Capacitor's `appStateChange`. That wiring needs a DOM and this file does
 * not have one; what is testable here is the part that decides.
 */
describe("the app going away", () => {
  it("pauses what is playing", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const el = FakeAudio.made[0]!;
    expect(el.paused).toBe(false);

    m.suspend();
    expect(el.paused).toBe(true);
  });

  it("comes back on the same element, not a new one", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const el = FakeAudio.made[0]!;

    m.suspend();
    m.resume();

    expect(el.paused).toBe(false);
    // The whole point: a new Audio would be the song from the beginning,
    // every time the phone is picked up.
    expect(FakeAudio.made).toHaveLength(1);
  });

  /*
   * The music is off by default and most sessions never turn it on. Leaving
   * and coming back must not be the thing that starts it.
   */
  it("starts nothing for somebody who had no music", async () => {
    store.set("amanda.music", "off");
    const m = await freshMusic(0.0);
    m.play("menu");
    expect(FakeAudio.made).toHaveLength(0);

    m.suspend();
    m.resume();
    expect(FakeAudio.made).toHaveLength(0);
    store.set("amanda.music", "on");
  });

  /*
   * `resume` only restarts what `suspend` paused. A player who turned the
   * music off while the app was in the background comes back to silence,
   * which is what they asked for.
   */
  it("does not undo the music being switched off while away", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const el = FakeAudio.made[0]!;

    m.suspend();
    m.toggleEnabled(); // off
    m.resume();

    expect(el.paused).toBe(true);
  });

  /*
   * ═══ AND IT ONLY RESTARTS WHAT IT STOPPED ITSELF ═══
   *
   * This is the `held` flag, and it is the one edge the other cases cannot
   * reach — they all end with no element at all, which `resume` refuses on
   * anyway. Here there IS an element and it is paused, and the question is
   * who paused it.
   *
   * A browser pauses audio for reasons of its own: an incoming call, another
   * app taking the audio focus, autoplay refused before the first gesture.
   * Coming back to the front must not override any of those — the last one
   * especially, since starting a track the browser declined to start is the
   * thing the whole module is careful about.
   */
  it("leaves alone a track the browser paused, not us", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const el = FakeAudio.made[0]!;

    el.pause(); // not us
    m.resume();

    expect(el.paused).toBe(true);
  });

  /*
   * Android and the WebView can both report the same departure, and
   * `away.ts` listens to both on purpose — so these arrive in pairs and
   * sometimes out of order.
   */
  it("survives being told twice, either way round", async () => {
    const m = await freshMusic(0.0);
    m.play("menu");
    const el = FakeAudio.made[0]!;

    m.suspend();
    m.suspend();
    m.resume();
    m.resume();
    expect(el.paused).toBe(false);
    expect(FakeAudio.made).toHaveLength(1);

    // And a resume that was never preceded by a suspend does nothing.
    m.stop();
    m.resume();
    expect(FakeAudio.made).toHaveLength(1);
  });
});
