/**
 * Happy Birthday, on a piano, slowly, in the dark.
 *
 *   node scripts/make-birthday-tune.mjs
 *   → apps/client/public/sfx/birthday.wav  (ffmpeg then makes the mp3)
 *
 * Or: *"about 3 seconds of a generated birthday tune with no copyright — the
 * normal Happy Birthday To You, right? — arranged Amanda style."*
 *
 * ═══ THE COPYRIGHT ANSWER IS YES, AND IT IS RECENT ═══
 *
 * "Happy Birthday to You" was Warner/Chappell's until 2015, when a US court
 * found the copyright invalid, and the 2016 settlement put it in the public
 * domain. In Europe it followed in 2017 — Patty Hill died in 1946, and 70
 * years after that is 2016. So the melody is free, and it is free of the
 * thing that matters here: it cannot be taken down from a store listing.
 *
 * Synthesised rather than sampled for the same reason as the clock ticks: a
 * RECORDING of it would have its own copyright even though the tune does
 * not. These are waveforms generated from a list of note names.
 *
 * ═══ THE BRIEF, WHICH TOOK THREE GOES ═══
 *
 * The first version was a sweet triangle-ish lead over a bare low fifth.
 * Then: *"needs a darker and more precise arrangement"*, which bought a
 * minor ground and notes that stopped smearing into each other. Then,
 * listening to that:
 *
 *   *"Birthday isn't good. It needs to be slower. Piano. Low, short notes.
 *   A rhythm a bit different and darker than the original. Happy birthday
 *   to YOU. That's it."*
 *
 * Which is the whole specification, and every clause of it changes
 * something that was still inherited from the first attempt:
 *
 *   SLOWER      150bpm → 88. The old tempo is a party; this one is a room.
 *   PIANO       a struck string, not a held lead — see `piano()` below.
 *   LOW         the melody drops an octave, G3 to C4 instead of G4 to C5.
 *   SHORT       each note is cut at 45% of its own beat. Staccato is most
 *               of why a slow tune sounds deliberate rather than merely
 *               slow: the silence between the notes is the tempo.
 *   RHYTHM      a 0.35-beat hesitation before the last word, which is the
 *               only structural change to the tune and does all the work.
 *   "THAT'S IT" the flourish is gone. One phrase, nothing after it.
 *
 * The hesitation is worth its own line. The tune is in everybody's head, so
 * the ear knows exactly when "you" is due — and holding it back by a third
 * of a beat is heard as intent rather than as a mistake. Nothing else in
 * the arrangement says "something is slightly wrong here" so cheaply, and
 * it costs not one note of the melody.
 */
import { writeFileSync } from "node:fs";

const RATE = 44100;

/** Equal temperament, A4 = 440. */
const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(note) {
  const m = /^([A-G])(#?)(\d)$/.exec(note);
  const semis = SEMITONE[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

const BPM = 88;
const BEAT = 60 / BPM;

/**
 * The phrase, an octave below where it used to sit.
 *
 *   G . G | A  G  C | (wait) B
 *   Hap-py  birth-day  to     you
 *
 * `at` is in beats from the start, so the hesitation is just a gap in the
 * numbers rather than a rest that has to be modelled.
 */
const MELODY = [
  { note: "G3", at: 0, beats: 0.75 },
  { note: "G3", at: 0.75, beats: 0.25 },
  { note: "A3", at: 1, beats: 1 },
  { note: "G3", at: 2, beats: 1 },
  { note: "C4", at: 3, beats: 1 },
  // …and then the third of a beat that makes it Amanda's.
  { note: "B3", at: 4.35, beats: 2 },
];

const END = 4.35 + 2;
const total = Math.round(RATE * (END * BEAT + 1.1));
const out = new Float32Array(total);

/**
 * One piano note.
 *
 * A piano is not a waveform, it is a DECAY SHAPE. Strike a string and the
 * high partials die almost at once while the fundamental rings on, which is
 * why a piano is bright for a tenth of a second and dark for the rest of
 * the note. That one behaviour — `exp(-(base + h * perPartial) * t)`, each
 * harmonic fading faster than the one below it — is most of what makes this
 * read as struck rather than played.
 *
 * The other half is inharmonicity. A real string is stiff, so its partials
 * sit slightly SHARP of whole multiples, and the error grows with the
 * harmonic number. It is a few cents and it is the difference between a
 * piano and an organ; without it the stack fuses into one tone and sounds
 * electronic. Low notes on a real piano are the most inharmonic of all,
 * which is lucky, because low is where this tune now lives.
 */
const PARTIALS = [1, 0.52, 0.3, 0.15, 0.09, 0.055, 0.03, 0.018];
function piano(start, seconds, freq, gain, opts = {}) {
  const n = Math.round(seconds * RATE);
  // 25ms release: enough to stop a cut sounding like a click, short enough
  // that a staccato note is still staccato.
  const rel = Math.min(Math.round(0.025 * RATE), Math.floor(n / 2));
  const B = opts.stiffness ?? 0.0006;
  const base = opts.decay ?? 2.4;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (let k = 0; k < PARTIALS.length; k++) {
      const h = k + 1;
      const f = freq * h * Math.sqrt(1 + B * h * h);
      if (f > RATE / 2) break;
      v += PARTIALS[k] * Math.exp(-(base + h * 0.9) * t) * Math.sin(2 * Math.PI * f * t);
    }
    // 1.4ms in. A piano has no attack to speak of; the hammer has already
    // happened by the time you hear anything.
    const env = Math.min(1, t * 700) * (i > n - rel ? (n - i) / rel : 1);
    const at = start + i;
    if (at < out.length) out[at] += v * env * gain;
  }
}

/**
 * The felt hitting the string: a very short, very dull thud under the note.
 *
 * One-pole lowpassed noise, because unfiltered noise is a click and a
 * hammer is not a click. Quiet enough that it is only ever heard as the
 * note starting a fraction more solidly.
 */
function hammer(start, freq, gain) {
  const n = Math.round(0.03 * RATE);
  let lp = 0;
  const k = Math.min(1, (freq * 6) / RATE);
  for (let i = 0; i < n; i++) {
    lp += k * ((Math.random() * 2 - 1) - lp);
    const env = Math.exp(-90 * (i / RATE));
    const at = start + i;
    if (at < out.length) out[at] += lp * env * gain;
  }
}

/* The melody: low, and cut at 45% of its own beat. See SHORT, above. */
for (const [i, m] of MELODY.entries()) {
  const last = i === MELODY.length - 1;
  const start = Math.round(m.at * BEAT * RATE);
  // The last note is allowed to ring, because there is nothing for it to
  // blur into and because a phrase has to be able to stop.
  piano(start, m.beats * BEAT * (last ? 1.5 : 0.45), hz(m.note), 0.3);
  hammer(start, hz(m.note), 0.035);
}

/*
 * The ground, and it is two struck notes rather than a drone — a drone is
 * an organ, and he asked for a piano.
 *
 * C2 at the start, and C2 again under the last word, so the phrase is held
 * at both ends. The E-flat is struck once, with "you", and that single note
 * is what makes the whole thing minor: the melody is G G A G C B and has no
 * third in it at all, so it never says major or minor by itself. Against
 * C and E-flat, the held B becomes a C-minor-major-seventh — the most
 * unsettled chord in common use, arriving on exactly the word the tune is
 * addressed to.
 */
const lastAt = Math.round(MELODY[MELODY.length - 1].at * BEAT * RATE);
/*
 * The opening C2 rings for 3.4 seconds, which is longer than it needs to be
 * for its own sake and exactly as long as it needs to be for the pause.
 *
 * Measured, the first cut of this had ELEVEN fifty-millisecond windows of
 * true digital silence before the last word — the staccato cut and the
 * hesitation landing back to back, with the old 2.4s bass having already
 * stopped. Six hundred milliseconds of nothing in the middle of a tune does
 * not read as a held breath, it reads as a file that has broken. With a low
 * note still dying underneath, the same gap is the thing it was meant to be.
 *
 * `decay: 0.25` looks absurdly low beside every other note here, and is
 * not: the shape is `exp(-(decay + h * 0.9) * t)`, so the FUNDAMENTAL of
 * this note decays at 1.15, not at 0.25. The first attempt said 0.85 — the
 * fundamental then died at 1.75 and the gap measured −54dB, which is
 * silence by any honest reckoning. At 0.25 it measures −42: thirty dB under
 * the melody, present, and nowhere near loud enough to be a note of its own.
 */
piano(0, 3.4, hz("C2"), 0.17, { decay: 0.25, stiffness: 0.0014 });
piano(lastAt, 2.6, hz("C2"), 0.15, { decay: 1.0, stiffness: 0.0014 });
piano(lastAt, 2.2, hz("D#3"), 0.085, { decay: 1.3 });
hammer(0, hz("C2"), 0.05);
hammer(lastAt, hz("C2"), 0.045);

/* Normalise to a hair under full scale, then a soft fade so nothing clicks. */
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const fade = Math.round(0.35 * RATE);
const pcm = Buffer.alloc(out.length * 2);
for (let i = 0; i < out.length; i++) {
  const tail = i > out.length - fade ? (out.length - i) / fade : 1;
  const v = Math.max(-1, Math.min(1, (out[i] / peak) * 0.92 * tail));
  pcm.writeInt16LE(Math.round(v * 32767), i * 2);
}

/** A 16-bit mono WAV header, so ffmpeg has something to read. */
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const path = "apps/client/public/sfx/birthday.wav";
writeFileSync(path, Buffer.concat([header, pcm]));
console.log(`${(out.length / RATE).toFixed(2)}s → ${path}`);
console.log("now: ffmpeg -v error -y -i " + path + " -b:a 96k apps/client/public/sfx/birthday.mp3");
