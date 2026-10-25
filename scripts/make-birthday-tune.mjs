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
 * ═══ THE CHORDS, TAKEN OFF THREE RECORDINGS HE MADE ═══
 *
 * Or: *"a chord is missing there. And the last chord needs to break towards
 * dark. I put three references in the folder that I played on an untuned
 * piano, take it from there."*
 *
 * So I took it from there. Onset detection and an FFT at each strike, and
 * all three takes say the same two things.
 *
 * FIRST, THERE IS A PROGRESSION. This had ONE chord holding under the whole
 * phrase, which is a drone with a tune on top; his moves. The take in C —
 * the same key as this — goes Cmaj9, down to Am7 under "birth-day", back to
 * Cmaj9, and then away. That movement is the missing chord, and it is also
 * why his sounds like an arrangement and this sounded like a backing.
 *
 * SECOND, AND IT IS THE INTERESTING ONE: the darkness is NOT in the key. I
 * had made the whole thing C minor with a quiet E-flat, which darkens every
 * bar equally and therefore darkens none of them — a sad tune is just a sad
 * tune. He keeps it major and sweet all the way through and breaks exactly
 * one chord, the last:
 *
 *     take 1   B D# F# A# C#   Bmaj9        …with a G in it (a flat 13th)
 *     take 2   G B D F# A      Gmaj9        …with a D# in it (a sharp 5th)
 *     take 3   Bb D F Ab       Bb7          …with an E in it (a sharp 11th)
 *
 * Three different chords, one idea: a lush MAJOR chord with a single note
 * in it that should not be there. That is what "break towards dark" means,
 * and it only works because everything before it was sweet.
 *
 * ═══ AND THE LAST CHORD WRITES ITSELF ═══
 *
 * His third take ends on B-flat 7 — the flat seventh of the key, which is
 * already a step outside C and is the most quietly wrong place a tune in C
 * can land on.
 *
 * The melody's last note is B natural, and it is held. B natural against a
 * B-flat 7 IS the broken note: the flat ninth. So the chord does not need a
 * colour added to it — the word "you", which the whole tune is addressed
 * to, is the thing that breaks it. Bb7(b9), arriving under the one note
 * that was always going to be there.
 */
const beat = (b) => Math.round(b * BEAT * RATE);

/**
 * One chord, struck.
 *
 * Quieter per note than the melody and spread across more of them, so it is
 * a bed rather than a competitor — and the lowest note of each is given the
 * hammer, because that is the one a hand lands on hardest.
 */
function chord(at, notes, gain, seconds, opts = {}) {
  notes.forEach((n, i) => {
    // The top of a voicing is always a touch quieter than the bottom.
    piano(beat(at), seconds, hz(n), gain * (1 - i * 0.12), {
      decay: opts.decay ?? 0.6,
      stiffness: i === 0 ? 0.0014 : 0.0006,
    });
  });
  hammer(beat(at), hz(notes[0]), gain * 0.3);
}

/* Cmaj7, low and open, under "happy". The melody's A makes it the ninth. */
chord(0, ["C2", "G2", "B2", "E3"], 0.1, 2.0);
/* Am7 under "birth-day" — the same notes a tone lower in feel, nothing new. */
chord(2, ["A2", "E3", "G3"], 0.095, 1.6);
/* and home, under "to". */
chord(3, ["C2", "G2", "E3"], 0.1, 1.9);
/*
 * Bb7, under "you", after the hesitation. The melody's own held B natural
 * is the flat ninth sitting on top of it — see above. Longer than the rest
 * and allowed to ring out under the fade, because it is the thing the tune
 * is left on.
 */
chord(4.35, ["A#2", "F3", "G#3", "D4"], 0.105, 3.0, { decay: 0.35 });

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
