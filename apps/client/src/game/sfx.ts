/**
 * Tiny self-contained sound engine. All sounds are synthesised with the Web
 * Audio API (oscillators + a noise buffer), so there are zero asset files to
 * ship and nothing to load. Must be unlocked from a user gesture (browser
 * autoplay policy) — call sfx.unlock() from the first click.
 */
type SoundName =
  | "click"
  | "draw"
  | "place"
  | "discard"
  | "beep"
  | "tick"
  | "tickUrgent"
  | "timeUp"
  | "go"
  | "crumbs"
  | "explode"
  | "win"
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
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 260, { type: "sine", gain: 0.14, delayMs: i * 130 })),
};

export const sfx = {
  unlock(): void {
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
  },
  play(name: SoundName): void {
    if (muted) return;
    const c = ac();
    if (c && c.state === "suspended") void c.resume();
    try {
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
