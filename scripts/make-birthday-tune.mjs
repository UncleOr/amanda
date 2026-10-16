/**
 * Three seconds of Happy Birthday, synthesised.
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
 * not. These are sine waves generated from a list of note names.
 *
 * ═══ WHAT "AMANDA STYLE" MEANS HERE ═══
 *
 * The game's own voice is playful-sinister: a children's card game whose
 * host is a monster. So the melody is sweet and the ground under it is not —
 * a lead with a little vibrato over a low fifth that sits a semitone wider
 * than it should, and a shimmer at the end that is almost but not quite a
 * sparkle. It reads as a birthday; it does not read as a greetings card.
 *
 * One phrase, not two. "Happy birthday to you" at 150bpm is 2.4 seconds,
 * and with the flourish that is the three he asked for — two phrases would
 * be 5, and a jingle that outstays the card it plays on is worse than a
 * short one.
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

/**
 * The first phrase, in C. Beats, not seconds — the tempo is below.
 *
 *   G . G | A  G  C | B . .
 *   Hap-py  birth-day  to  you
 */
const BPM = 150;
const BEAT = 60 / BPM;
const MELODY = [
  ["G4", 0.75],
  ["G4", 0.25],
  ["A4", 1],
  ["G4", 1],
  ["C5", 1],
  ["B4", 2],
];

const total = Math.round(RATE * (MELODY.reduce((n, [, b]) => n + b, 0) * BEAT + 0.8));
const out = new Float32Array(total);

/**
 * One note.
 *
 * A triangle-ish stack (odd harmonics, falling fast) rather than a pure
 * sine, because a pure sine on a phone speaker is almost inaudible — there
 * is nothing above 1kHz in it for a 15mm driver to move.
 */
function note(start, seconds, freq, gain) {
  const n = Math.round(seconds * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // A little vibrato, arriving after the note has spoken.
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 4);
    const w = 2 * Math.PI * freq * vib * t;
    const v =
      Math.sin(w) + 0.33 * Math.sin(3 * w) + 0.12 * Math.sin(5 * w) + 0.05 * Math.sin(7 * w);
    // Pluck: fast in, slow out, and silent before the next note begins.
    const env = Math.min(1, t * 90) * Math.exp(-2.6 * t);
    const at = start + i;
    if (at < out.length) out[at] += v * env * gain;
  }
}

let at = 0;
for (const [name, beats] of MELODY) {
  const seconds = beats * BEAT;
  note(Math.round(at * RATE), seconds * 1.6, hz(name), 0.16);
  at += seconds;
}

/*
 * The ground: a low fifth under the whole phrase, and the fifth is a hair
 * wide. Four cents is nothing you can name and everything you can feel —
 * the chord never quite settles, which is the monster under the party.
 */
const under = MELODY.reduce((n, [, b]) => n + b, 0) * BEAT;
note(0, under + 0.5, hz("C3"), 0.07);
note(0, under + 0.5, hz("G3") * Math.pow(2, 4 / 1200), 0.05);

/*
 * The flourish: the octave above the tonic, twice, quick — a wink rather
 * than an ending. It is what makes 2.4 seconds feel finished.
 */
note(Math.round(under * RATE), 0.5, hz("C6"), 0.07);
note(Math.round((under + 0.12) * RATE), 0.6, hz("E6"), 0.05);

/* Normalise to a hair under full scale, then a soft fade so nothing clicks. */
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const fade = Math.round(0.25 * RATE);
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
