/**
 * The soundtrack.
 *
 * ═══ TWO WHOLE SONGS, ONE AT A TIME ═══
 *
 * It used to be a single score.mp3: eleven stretches cut out of four songs,
 * levelled, crossfaded together, and with the tail folded over the head so
 * the loop would not be heard. That was what Or asked for — "assemble a
 * soundtrack out of everything I gave you" — and it was wrong, which only
 * became obvious under the trailer: *"after 10 seconds the melody suddenly
 * changes."*
 *
 * It did. The file changed song underneath you, and the first five seconds
 * of it were the END of one song mixed over the BEGINNING of another, which
 * is what a loop fold is.
 *
 * Or: *"then let there not be one. Take a single track and use it in the
 * game. It can vary — start one of the two each time. And if one ends you
 * can start the other."*
 *
 * So: two complete songs, built by scripts/make-music.sh, matched in level
 * and otherwise untouched. One is picked at random when the music starts and
 * the other follows it. Nothing restarts on a phase change — music that
 * resets every time you change screen is what made the old six-clip version
 * feel like six clips.
 *
 * Volume sits under the SFX so the game sounds still read clearly. Must be
 * started from a user gesture — pre-gesture play() is blocked and ignored.
 */
export type MusicName = "menu" | "build" | "panic" | "battle" | "win" | "lose";

const BASE = import.meta.env.BASE_URL;

/**
 * The two songs, in no particular order — which is the point.
 *
 * Hod hears the first few seconds of this every single time he opens the
 * game. Two openings is not variety, but it is twice as much as one, and it
 * costs nothing.
 */
const TRACKS = [`${BASE}music/track1.mp3`, `${BASE}music/track2.mp3`] as const;

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
  /** Which of the two is playing. Chosen once per session, then alternates. */
  private track = Math.floor(Math.random() * TRACKS.length);

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
   * Build the element for whichever track is up, and hand over to the other
   * one when it ends.
   *
   * The successor starts at full volume rather than ramping in: the previous
   * track has genuinely finished, so there is nothing to fade against and a
   * ramp would just sound like the music arriving late.
   */
  private open(volume: number): Ramping {
    const el = new Audio(TRACKS[this.track]) as Ramping;
    el.volume = volume;
    el.addEventListener("ended", () => {
      // Only if this is still the element in play — a restart or a stop
      // replaces it, and the old one firing `ended` must not start anything.
      if (this.el !== el || !this.enabled) return;
      this.track = (this.track + 1) % TRACKS.length;
      const next = this.open(this.muted ? 0 : this.baseVolume);
      this.el = next;
      void next.play().catch(() => {});
    });
    return el;
  }

  /**
   * Keep the music playing. The phase name is noted and otherwise ignored:
   * the whole point is that changing screen does not change the music.
   */
  play(name: MusicName, opts: { restart?: boolean } = {}): void {
    this.current = name;
    if (!this.enabled) return;

    // Already going — leave it alone. This is the line that makes it one
    // continuous soundtrack rather than a clip per screen.
    if (this.el && !this.el.paused && !opts.restart) return;

    if (this.el && !opts.restart) {
      // Playing but paused: a play() before the first user gesture was
      // blocked. Pick it up where it stopped rather than starting over.
      void this.el.play().catch(() => {});
      return;
    }

    const prev = opts.restart ? this.el : null;
    const next = this.open(0);
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
