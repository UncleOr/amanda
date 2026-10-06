/**
 * The soundtrack.
 *
 * ═══ ONE SCORE, NOT SIX CLIPS ═══
 *
 * Or: "assemble a soundtrack out of everything I gave you, with as much
 * instrumental as possible, no words at all — that will be the game's
 * continuous soundtrack."
 *
 * So it is one track that starts when the music is switched on and keeps
 * playing, across the menu, the build, the battle and the result. It does NOT
 * restart or crossfade on a phase change: music that resets every time you
 * change screen is what made the old six-clip version feel like six clips.
 *
 * `music/score.mp3` is built from the four tracks in `soundtracks/` by
 * scripts recorded in the commit: the stretches where nobody is singing are
 * cut out, levelled to the same loudness, crossfaded together, and the tail is
 * folded onto the head so it loops with no gap. The timestamps that went in
 * are in docs/SOUNDTRACK.md, so any of them can be dropped by ear.
 *
 * Volume sits under the SFX so the game sounds still read clearly. Must be
 * started from a user gesture — pre-gesture play() is blocked and ignored.
 */
export type MusicName = "menu" | "build" | "panic" | "battle" | "win" | "lose";

const BASE = import.meta.env.BASE_URL;
/**
 * Every name points at the same score.
 *
 * The callers still say which phase they are in, because one day a phase may
 * want to duck the music or lift it — and because deleting those calls would
 * throw away the only place that knows. Today they all mean "keep playing".
 */
const SCORE = `${BASE}music/score.mp3`;

interface Ramping extends HTMLAudioElement {
  __ramp?: number;
}

function ramp(el: Ramping, target: number, ms: number, onDone?: () => void): void {
  if (el.__ramp) window.clearInterval(el.__ramp);
  const start = el.volume;
  const steps = Math.max(1, Math.round(ms / 30));
  let i = 0;
  el.__ramp = window.setInterval(() => {
    i++;
    el.volume = Math.min(1, Math.max(0, start + (target - start) * (i / steps)));
    if (i >= steps) {
      window.clearInterval(el.__ramp);
      el.__ramp = undefined;
      onDone?.();
    }
  }, 30);
}

/**
 * Music is OFF until someone asks for it. Playtesting the same twenty seconds
 * of board-building over and over with a soundtrack underneath is maddening, so
 * the game stays quiet by default and remembers the choice per browser.
 */
const ENABLED_KEY = "amanda.music";

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "on";
  } catch {
    return false; // private mode / blocked storage — stay quiet
  }
}

class Music {
  private el: Ramping | null = null;
  private current: MusicName | null = null;
  private muted = false;
  private enabled = loadEnabled();
  private baseVolume = 0.35;

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Turn the soundtrack on or off. Returns the new state. */
  toggleEnabled(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(ENABLED_KEY, this.enabled ? "on" : "off");
    } catch {
      /* not being able to remember it is not worth failing over */
    }
    if (!this.enabled) this.stop();
    else if (this.current) this.play(this.current, { restart: true });
    return this.enabled;
  }

  /**
   * Keep the score playing. The phase name is noted and otherwise ignored:
   * the whole point is that changing screen does not change the music.
   */
  play(name: MusicName, opts: { restart?: boolean } = {}): void {
    this.current = name;
    if (!this.enabled) return;

    // Already going — leave it alone. This is the line that makes it one
    // continuous score rather than a clip per screen.
    if (this.el && !this.el.paused && !opts.restart) return;

    if (this.el && !opts.restart) {
      // Playing but paused: a play() before the first user gesture was
      // blocked. Pick it up where it stopped rather than starting over.
      void this.el.play().catch(() => {});
      return;
    }

    const prev = opts.restart ? this.el : null;
    const next = new Audio(SCORE) as Ramping;
    next.loop = true;
    next.volume = 0;
    next.play().catch(() => {
      /* autoplay blocked until the first user gesture — ignored */
    });
    this.el = next;
    ramp(next, this.muted ? 0 : this.baseVolume, 1200);
    if (prev) ramp(prev, 0, 800, () => prev.pause());
  }

  stop(): void {
    const prev = this.el;
    this.el = null;
    // `current` is deliberately kept: it is the phase, not the track, and
    // switching the music back on should pick up from wherever the player is.
    if (prev) ramp(prev, 0, 500, () => prev.pause());
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.el) ramp(this.el, muted ? 0 : this.baseVolume, 250);
  }
}

export const music = new Music();
