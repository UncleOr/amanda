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
