/**
 * Background music manager. Plays one looping track at a time and crossfades
 * between them on phase changes. Tracks are short clips cut from the film
 * soundtrack (see apps/client/public/music). Volume sits under the SFX so the
 * game sounds still read clearly. Must be started from a user gesture (the
 * Start button) — pre-gesture play() is blocked by the browser and ignored.
 */
export type MusicName = "menu" | "build" | "panic" | "battle" | "win" | "lose";

const BASE = import.meta.env.BASE_URL;
const URLS: Record<MusicName, string> = {
  menu: `${BASE}music/menu.mp3`,
  build: `${BASE}music/build.mp3`,
  panic: `${BASE}music/panic.mp3`,
  battle: `${BASE}music/battle.mp3`,
  win: `${BASE}music/win.mp3`,
  lose: `${BASE}music/lose.mp3`,
};

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

  play(name: MusicName, opts: { loop?: boolean; restart?: boolean } = {}): void {
    const loop = opts.loop ?? true;
    if (!this.enabled) {
      // Remember what WOULD be playing, so switching music on starts the right
      // track for the phase the player is already in.
      this.current = name;
      return;
    }
    if (opts.restart) this.current = null;
    // Already playing this track → nothing to do (but retry if a prior attempt
    // was blocked before a user gesture and is still paused).
    if (this.current === name && this.el && !this.el.paused) return;

    const next = new Audio(URLS[name]) as Ramping;
    next.loop = loop;
    next.volume = 0;
    next.play().catch(() => {
      /* autoplay blocked until the first user gesture — ignored */
    });

    const prev = this.el;
    this.el = next;
    this.current = name;
    ramp(next, this.muted ? 0 : this.baseVolume, 800);
    if (prev) ramp(prev, 0, 800, () => prev.pause());
  }

  stop(): void {
    const prev = this.el;
    this.el = null;
    this.current = null;
    if (prev) ramp(prev, 0, 500, () => prev.pause());
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.el) ramp(this.el, muted ? 0 : this.baseVolume, 250);
  }
}

export const music = new Music();
