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
import { VOICE_CLIPS, type DragLayer } from "./cardSound";

export type SoundName =
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
  /**
   * ═══ THE BATTLE HAD NO SOUND AT ALL ═══
   *
   * Seventeen clips in this game and not one of them was a blow, a shot or
   * a death: a match played out in silence apart from the clock ticking and
   * one explosion at the end. Sound is half of what makes a hit feel like a
   * hit, and the half that was missing.
   *
   * All three are NOISE rather than tone, which is also the answer to Or's
   * verdict on the old synthesis — *"they sound like a 386 making noise out
   * of the CPU"* — because that was about melodies played on square waves.
   * A filtered noise burst is what an impact actually is, and it is the one
   * thing oscillators do convincingly.
   *
   * They are rate-limited at the call site (Arena.tsx): twenty cards
   * trading blows in one frame is twenty sounds, which is a wall rather
   * than a battle.
   */
  | "hit"
  | "shoot"
  | "die"
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

/*
 * Noise, which until now could only ever be one noise.
 *
 * Every percussive sound in this file went through a fixed lowpass at 900Hz
 * with a fixed fade-out, and that single line is why Or heard the same
 * object three times over: *"[the death] sounds like a thump"*, and of the
 * shot, *"if it is from a distance maybe it needs more wind."* There is no
 * wind below 900Hz. Air is the part that was being filtered out.
 *
 * So the filter is a parameter now, and it can SWEEP — a band of noise
 * moving down in pitch is the Doppler shift of something passing your ear,
 * and it is most of what the word "whoosh" means.
 *
 * ═══ WHY THE ENVELOPE IS STILL IN THE SAMPLE DATA ═══
 *
 * `hit` must not move. Or listened to it and approved it, and it is the
 * only sound here sharing this function with the two he rejected.
 *
 * The tidy version of this rewrite put the fade on the gain node, where
 * ramps belong, and it is a different sound: rendered offline five times
 * each, the old `hit` has a spectral centroid of 803–896Hz and the gain-node
 * one came out at 944. Of course it did — the fade used to happen BEFORE
 * the filter, so the biquad was fed a decaying signal; after the filter it
 * is fed full-scale noise throughout and settles differently. A fade and a
 * filter do not commute, which is not obvious until it is measured.
 *
 * So the shape stays baked into the samples, swell included, and the gain
 * node is a constant. Measured the same five ways, that version lands at
 * 826–888Hz — inside the original's own spread.
 */
function noise(
  durMs: number,
  gain = 0.3,
  opts: {
    /** Where the filter sits. The old fixed value is the default. */
    cutoff?: number;
    type?: BiquadFilterType;
    /** Resonance. Only worth raising for a bandpass. */
    q?: number;
    /** Slide the filter to this by the end — a pass-by, rather than a hit. */
    sweepTo?: number;
    /** Fade IN over this long first, so the sound arrives instead of starting. */
    swellMs?: number;
    delayMs?: number;
  } = {},
): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delayMs ?? 0) / 1000;
  const frames = Math.floor((c.sampleRate * durMs) / 1000);
  const rise = Math.min(Math.floor((c.sampleRate * (opts.swellMs ?? 0)) / 1000), Math.floor(frames * 0.6));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Up over `rise`, then the same straight fall it always had.
    const shape = i < rise ? i / rise : 1 - (i - rise) / (frames - rise);
    data[i] = (Math.random() * 2 - 1) * shape;
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const g = c.createGain();
  g.gain.value = gain;

  const f = c.createBiquadFilter();
  f.type = opts.type ?? "lowpass";
  f.frequency.setValueAtTime(opts.cutoff ?? 900, t0);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + frames / c.sampleRate);
  if (opts.q) f.Q.value = opts.q;

  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
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
  // A body blow: a short, low thump with no pitch in it.
  hit: () => {
    noise(90, 0.16);
    tone(120, 90, { type: "triangle", slideTo: 60, gain: 0.1 });
  },
  /*
   * Something thrown past you. Or: *"if it is from a distance maybe it
   * needs more wind."*
   *
   * It was 60ms of muffled noise and an 820Hz slide down to 260 — which is
   * a laser, and a short one. Three changes and none of them is volume:
   *
   *   LONGER   60ms to 200. A whoosh you cannot hear travelling is a tick.
   *   A BAND   bandpass rather than lowpass, so there is air in it at all,
   *            and the resonance gives the air a direction.
   *   IT GOES  the band sweeps 2.4kHz down to 650 while it plays, which is
   *   PAST     what something passing your ear does to the sound of itself.
   *
   * The swell matters as much as the sweep: it fades IN over the first
   * 60ms, so the thing approaches rather than appearing beside you — which
   * is the "from a distance" half of what he asked for.
   */
  shoot: () => {
    noise(200, 0.17, { type: "bandpass", cutoff: 2400, q: 1.1, sweepTo: 650, swellMs: 60 });
    // One quiet low knock at the release, so it still reads as a THROW and
    // not just as weather.
    tone(190, 60, { type: "triangle", slideTo: 95, gain: 0.05 });
  },
  /*
   * A card going down. Or: *"it sounds like a thump."*
   *
   * It was a thump: 220ms of 900Hz-lowpassed noise over a falling saw,
   * which is `hit` again with the lows turned up. So the two loudest events
   * in a battle — being struck, and dying — differed by about a tone, and
   * nothing told you which had happened.
   *
   * A death is not an impact, it is a COLLAPSE, and a collapse has three
   * parts in this order: the crack of the thing giving way, the weight
   * going down, and then the pieces settling. The crack is the part `hit`
   * has none of, which is what finally makes them two sounds.
   *
   * ═══ AND THEN THE SECOND HALF OF THE NOTE ARRIVED ═══
   *
   * The first version of this answered *"it sounds like a thump"* and had
   * to stop there, because the rest of his sentence had been eaten by a bug
   * in the sound desk. The rest was: *"it needs a bit more depth to the
   * sound. Really just a bit deeper and longer."*
   *
   * Which is a smaller ask than it looks, and the word that matters is
   * "really just". The collapse is right; it is too SMALL. So nothing here
   * changes shape — every part stays where it was and goes lower and
   * further:
   *
   *   the fall    105→38Hz over 250ms becomes 86→28 over 340
   *   the weight  a 240ms body filtered 800→260 becomes 320ms, 700→200
   *   the debris  the last tap moves from 200ms out to 250
   *
   * And one part is new: a sine under all of it, an octave below the saw.
   * That is where "depth" actually lives. A sawtooth at 86Hz is mostly its
   * own harmonics — the fundamental is the quietest thing in it, and a
   * phone speaker throws away everything under about 200Hz anyway, so the
   * low end has to be LOUD and pure to survive at all. A sine is the one
   * waveform that spends all of itself on the note you asked for.
   */
  die: () => {
    // The crack. High, and gone in a twentieth of a second.
    noise(55, 0.1, { type: "highpass", cutoff: 1800 });
    // The weight. Darkening as it goes down, which a fixed filter cannot do.
    noise(320, 0.1, { cutoff: 700, sweepTo: 200 });
    tone(86, 340, { type: "sawtooth", slideTo: 28, gain: 0.08 });
    // The body underneath it — see above. Quiet, because it is felt more
    // than heard, and it would be mud if it were not.
    tone(58, 300, { type: "sine", slideTo: 26, gain: 0.07 });
    // The pieces settling: three small taps, spaced unevenly on purpose —
    // an even three is a drum roll, and the point is that it is debris.
    [95, 160, 250].forEach((d, i) =>
      noise(50, 0.045 - i * 0.012, { type: "bandpass", cutoff: 1300 - i * 260, q: 2.2, delayMs: d }),
    );
  },
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
/** The same, for card voices — where a miss means silence, not an oscillator. */
const voices = new Map<string, AudioBuffer>();
/** When each voice last started, so it cannot be laid over itself. */
const spokenAt = new Map<string, number>();
/** The looping layers of the card currently in hand. Empty the rest of the time. */
const carried: Array<{ src: AudioBufferSourceNode; g: GainNode }> = [];
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
  /*
   * And the card voices, in the same breath.
   *
   * These have NO fallback recipe and must not get one: an oscillator
   * impression of a dragon is worse than the dragon saying nothing, and the
   * generic `place` has already played underneath. Silence is the correct
   * failure here, which is the whole difference between this map and the
   * one above.
   */
  for (const slug of VOICE_CLIPS) {
    void fetch(`${BASE}sfx/${slug}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => c.decodeAudioData(buf))
      .then((decoded) => voices.set(slug, decoded))
      .catch(() => {
        /* no voice, and the card is still placed */
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
  /**
   * A card's own sound, over the top of whatever the board just played.
   *
   * `delayMs` is the point of the signature. A card landing is two events in
   * quick succession — the card hitting the table, and then the thing on it
   * being there — and ninety milliseconds between them is the difference
   * between a sequence and a smear. Played at the same instant they mask
   * each other and both come out smaller.
   *
   * Scheduled on the AudioContext rather than through setTimeout, so the
   * gap is the gap it says it is and not whatever the main thread was doing
   * at the time.
   */
  voice(slug: string | undefined, delayMs = 0): void {
    if (!slug || muted) return;
    const c = ac();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    const buf = voices.get(slug);
    if (!buf) return; // not loaded, or there is no such clip. Say nothing.
    /*
     * ⚠ THE SAME CLIP ON TOP OF ITSELF, A TENTH OF A SECOND LATE.
     *
     * One tap on a card is two events — a pointerdown that arms the drag and
     * a click that opens the card — and both of them have a reason to say
     * the card's name. Two copies of one voice a hundred milliseconds apart
     * do not sound like a stutter; they sound like a broken recording, and
     * it is the kind of thing that is obvious on a phone and inaudible on a
     * laptop. The same holds in a battle, where three earth cards dying
     * together share one cry.
     *
     * So a voice will not start on top of itself. Different voices overlap
     * freely — that is a crowd, and a crowd is fine.
     */
    const now = performance.now() + delayMs;
    if (now - (spokenAt.get(slug) ?? -Infinity) < 350) return;
    spokenAt.set(slug, now);
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(c.currentTime + delayMs / 1000);
    } catch {
      /* audio is best-effort */
    }
  },
  /**
   * The mix a card makes while it is being carried, started and held.
   *
   * ═══ WHY THE LOOP IS THE MIDDLE OF THE CLIP ═══
   *
   * These go through the same processing as every other sound, which trims
   * the head and fades the last 15ms — and a fade is a hole. Looping the
   * whole buffer would pulse once every two seconds, which is the one thing
   * a background texture must not do. So each source loops a window INSIDE
   * the clip, clear of the attack at the front and the fade at the back,
   * where the material is steady.
   *
   * Each layer gets its own gain and its own playback rate, because that is
   * the entire feature: the same two ingredients at different levels are
   * different dragons (cardSound.ts). The short ramp on the way in and out
   * is not decoration — starting four looping sources at full gain on the
   * same frame is an audible click, four times.
   */
  drag(layers: DragLayer[]): void {
    this.dragStop();
    if (muted || !layers.length) return;
    const c = ac();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    const now = c.currentTime;
    for (const layer of layers) {
      const buf = voices.get(layer.clip);
      if (!buf) continue; // not loaded: this layer is simply absent
      try {
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        // Inside the clip, away from both ends. A quarter of a second is
        // comfortably past the trim and before the fade on a 2.2s loop.
        const edge = Math.min(0.25, buf.duration / 5);
        src.loopStart = edge;
        src.loopEnd = Math.max(edge + 0.1, buf.duration - edge);
        src.playbackRate.value = layer.rate;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(layer.gain, now + 0.09);
        src.connect(g).connect(c.destination);
        src.start(now, edge);
        carried.push({ src, g });
      } catch {
        /* audio is best-effort */
      }
    }
  },
  /** Let go: ramp every layer down and stop it once it is silent. */
  dragStop(): void {
    const c = ac();
    for (const { src, g } of carried) {
      try {
        if (c) {
          g.gain.cancelScheduledValues(c.currentTime);
          g.gain.setValueAtTime(g.gain.value, c.currentTime);
          g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.08);
          src.stop(c.currentTime + 0.1);
        } else {
          src.stop();
        }
      } catch {
        /* already stopped */
      }
    }
    carried.length = 0;
  },
  toggleMute(): boolean {
    muted = !muted;
    // A loop that is already running does not stop by itself.
    if (muted) this.dragStop();
    return muted;
  },
  get muted(): boolean {
    return muted;
  },
};
