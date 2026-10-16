/**
 * The game's sounds.
 *
 * Recorded clips first, synthesis second. Or's verdict on the synthesis-only
 * version: "they sound like a 386 making noise out of the CPU with no
 * speakers — it could have been cool if that was our thing, but it isn't."
 * The clips in `public/sfx` are generated (see `pnpm art:sounds`) and decoded
 * into memory once, so playing one costs nothing and never lags behind the tap
 * that caused it.
 *
 * THE OSCILLATORS ARE STILL HERE ON PURPOSE. They are what plays before the
 * clips have finished loading, if a clip is missing, and on a connection too
 * slow to have fetched them yet. A thin sound is a disappointment; silence
 * where you expected a sound reads as a broken game.
 *
 * Must be unlocked from a user gesture (browser autoplay policy) — call
 * sfx.unlock() from the first click.
 */
type SoundName =
  | "click"
  | "draw"
  | "place"
  | "discard"
  | "beep"
  /**
   * The match countdown: a clock, alternating two pitches.
   *
   * Or: *"the 3 2 1 at the start of a match sounds like gunshots. Change it
   * to a clock ticking."* It was playing `beep`, which measures as a 400ms
   * broadband hit with a 34ms attack and a tonality of 0.16 — a percussive
   * thud with no pitch in it, three in a row.
   *
   * `tick` was the obvious thing to point at instead and it is not a clock
   * either: 300ms long with its peak 212ms in, which is a swell. These are
   * 60ms, resonant at 2.2kHz and 1.6kHz, and gone. Two of them because the
   * alternation is most of what makes a sound read as a clock rather than
   * as a click. See scripts/make-clock.sh.
   */
  | "clock"
  | "clockLow"
  /**
   * Happy Birthday, three seconds of it.
   *
   * Public domain since 2016 in the US and 2017 in Europe — the Warner
   * copyright was found invalid and the settlement ended it. Synthesised
   * rather than sampled all the same, because a RECORDING of a public-domain
   * tune has its own copyright: see scripts/make-birthday-tune.mjs, which
   * generates it from a list of note names.
   */
  | "birthday"
  | "tick"
  | "tickUrgent"
  | "timeUp"
  | "go"
  | "crumbs"
  | "explode"
  | "win"
  /**
   * A card the album has never held.
   *
   * Its own sound, not `win`. Or: *"make a DIFFERENT victory sound for each
   * of them."* They were the same clip, which is how a game teaches a child
   * that nothing in particular just happened — two events that mean
   * different things and sound identical cancel each other out, and the
   * rarer of the two is the one that loses.
   */
  | "newcard"
  | "lose";

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  }
  return ctx;
}

function tone(
  freq: number,
  durMs: number,
  opts: { type?: OscillatorType; gain?: number; slideTo?: number; delayMs?: number } = {},
): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delayMs ?? 0) / 1000;
  const dur = durMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(durMs: number, gain = 0.3): void {
  const c = ac();
  if (!c) return;
  const frames = Math.floor((c.sampleRate * durMs) / 1000);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  src.connect(lp).connect(g).connect(c.destination);
  src.start();
}

const RECIPES: Record<SoundName, () => void> = {
  click: () => tone(240, 45, { type: "square", gain: 0.08 }),
  draw: () => tone(620, 70, { type: "sine", slideTo: 880, gain: 0.1 }),
  place: () => tone(360, 100, { type: "triangle", slideTo: 150, gain: 0.16 }),
  discard: () => tone(420, 110, { type: "sawtooth", slideTo: 120, gain: 0.1 }),
  beep: () => tone(880, 120, { type: "sine", gain: 0.14 }),
  // Short and resonant, and the fallbacks alternate like the clips do.
  clock: () => tone(2200, 45, { type: "triangle", gain: 0.1 }),
  clockLow: () => tone(1600, 45, { type: "triangle", gain: 0.1 }),
  /*
   * The same six notes, in oscillators, for a browser that could not fetch
   * the clip. G G A G C B — "happy birthday to you". The timings are the
   * same 150bpm; what is missing is the detuned fifth underneath it, which
   * a fallback does not need.
   */
  birthday: () =>
    [
      [392, 300, 0],
      [392, 100, 300],
      [440, 400, 400],
      [392, 400, 800],
      [523, 400, 1200],
      [494, 800, 1600],
    ].forEach(([f, ms, at]) =>
      tone(f!, ms!, { type: "triangle", gain: 0.12, delayMs: at }),
    ),
  // A clock, not an alarm: quiet and low while there is still time…
  tick: () => tone(520, 55, { type: "square", gain: 0.05 }),
  // …then higher and harder once seconds actually matter.
  tickUrgent: () => {
    tone(1040, 85, { type: "square", gain: 0.12 });
    tone(520, 85, { type: "triangle", gain: 0.06 });
  },
  // The buzzer: two falling notes under a short burst of noise.
  timeUp: () => {
    tone(700, 420, { type: "sawtooth", slideTo: 180, gain: 0.16 });
    tone(350, 420, { type: "square", slideTo: 90, gain: 0.08, delayMs: 30 });
    noise(260, 0.16);
  },
  go: () => {
    tone(440, 260, { type: "sine", slideTo: 900, gain: 0.18 });
    tone(660, 260, { type: "triangle", slideTo: 1200, gain: 0.08, delayMs: 40 });
  },
  crumbs: () => {
    for (let i = 0; i < 4; i++) tone(200 + i * 40, 60, { type: "square", gain: 0.05, delayMs: i * 70 });
  },
  explode: () => {
    noise(500, 0.4);
    tone(120, 400, { type: "sawtooth", slideTo: 40, gain: 0.2 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 220, { type: "triangle", gain: 0.14, delayMs: i * 110 })),
  // Higher, faster and with no bottom to it, so the fallback keeps the one
  // distinction that matters: a win has weight, a new card sparkles.
  newcard: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 160, { type: "sine", gain: 0.1, delayMs: i * 70 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 260, { type: "sine", gain: 0.14, delayMs: i * 130 })),
};

/* ───────────── the recorded clips ───────────── */

const BASE = import.meta.env.BASE_URL;
/** Decoded and ready. A name missing from here falls back to the oscillators. */
const buffers = new Map<SoundName, AudioBuffer>();
let loading = false;

/**
 * Fetch and decode every clip, once.
 *
 * Deliberately fire-and-forget: nothing waits for it, nothing reports it, and
 * every failure is swallowed per-sound rather than per-batch — one missing
 * file must not cost the other twelve. Called from unlock(), because decoding
 * needs an AudioContext and an AudioContext needs a gesture.
 */
function loadClips(): void {
  if (loading) return;
  loading = true;
  const c = ac();
  if (!c) return;
  for (const name of Object.keys(RECIPES) as SoundName[]) {
    void fetch(`${BASE}sfx/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => c.decodeAudioData(buf))
      .then((decoded) => buffers.set(name, decoded))
      .catch(() => {
        /* this one stays synthesised; see the note at the top */
      });
  }
}

function playClip(name: SoundName): boolean {
  const c = ac();
  const buf = c && buffers.get(name);
  if (!c || !buf) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
  return true;
}

export const sfx = {
  unlock(): void {
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
    loadClips();
  },
  play(name: SoundName): void {
    if (muted) return;
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
    try {
      if (playClip(name)) return;
      RECIPES[name]();
    } catch {
      /* audio is best-effort */
    }
  },
  toggleMute(): boolean {
    muted = !muted;
    return muted;
  },
  get muted(): boolean {
    return muted;
  },
};
