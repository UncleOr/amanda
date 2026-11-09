/**
 * The Siren's song — where the melody came from.
 *
 *   node scripts/make-siren.mjs            the in-key reading of their takes
 *   node scripts/make-siren.mjs faithful   their notes exactly, in tune
 *
 * ⚠ THIS NO LONGER MAKES THE CLIP THE GAME PLAYS. Or, on the first attempt,
 * which was their own recording pulled into tune: *"it needs to be COMPLETELY
 * regenerated, the singing, in a beautiful soprano opera voice. Our
 * recordings are only a reference for the melody itself."*
 *
 * So this script's job is now the MEASUREMENT. It is where the notes in
 * `SIREN` in packages/art/src/fanfare.ts come from, and it still renders the
 * autotuned version of their own voices into the audition folder beside the
 * soprano — because comparing the two is the only way to check the soprano is
 * singing the right tune. It writes nothing the pipeline reads.
 *
 * Or: *"the Siren — when you place her you should hear an opera song like
 * Sirenaaa Sirenna, twice."* And then, with two voice notes attached: *"I
 * put you two references where we roughly fake the Siren's melody in our own
 * voices. Make it autotune and a beautiful opera and that will be the
 * sound."*
 *
 * ═══ WHY THIS IS NOT A PROMPT ═══
 *
 * The first answer was a text-to-speech spec with the vowels stretched, and
 * it would have been wrong for the reason this project has now met four
 * times: a feeling is music, and music is the one thing that model cannot
 * make. Asked for opera it returns somebody SAYING a word theatrically.
 *
 * It is also not `fanfare.ts`, which computes music note by note. That is
 * for a sound nobody sang. This one was sung — by a father and a
 * seven-year-old, into a phone — and the whole value of it is that it is
 * THEM. So it is neither generated nor synthesised: it is a recording, with
 * its pitch corrected onto a melody that was measured out of it.
 *
 * ═══ THE MELODY, MEASURED FROM BOTH TAKES ═══
 *
 * Autocorrelation pitch tracking over both voice notes, 10ms frames. The two
 * takes agree, which is the only reason any of this is trustworthy:
 *
 *             take 1              take 2            agreed
 *   held      A#3/B3 ~620ms       B3 ~290ms         B3        "Siii—"
 *   scoop     C4→F4 fast          C4→F4 fast        a slide
 *   PEAK      F#4 ~980ms          F#4 ~930ms        F#4       "—reeee"
 *   fall      D#4 279ms           D#4 150ms         D#4       "naaa"
 *   PEAK      F#4 ~1120ms         F#4 ~470ms        F#4       "Siii-reee"
 *   lift      G#4                 G4                see below
 *   land      F4 349ms            F4 339ms          see below
 *
 * B, D# and F# is a B MAJOR triad, so the song is in B major and the two
 * phrases Or asked for are right there: each one climbs to F#4 and falls.
 *
 * ⚠ TAKE 2 IS THE SOURCE, because take 1 CLIPS — it peaks at 0.999 against
 * take 2's 0.867, and there is no fixing a squared-off waveform afterwards.
 * Take 2 is also the tighter of the two, at 3.0 seconds against 3.6.
 *
 * ═══ THE ONE PLACE A DECISION HAD TO BE MADE ═══
 *
 * Both of them sing the last note a semitone FLAT — F natural, under the F#
 * the whole song circles — and in both takes the volume is tailing off right
 * there. That is a breath running out, not a note. Take 1's lift reaches
 * G#4 (in key); take 2's stops at G natural (not).
 *
 * So there are two honest answers and the script makes both:
 *
 *   inkey      B3 · F#4 · D#4 · F#4 · G#4 · F#4   — a clean B major siren
 *              call. Needs +123 cents on the lift and +96 on the landing,
 *              which is more than correction: it is the "beautiful" half of
 *              what Or asked for. THIS IS WHAT SHIPS.
 *   faithful   B3 · F#4 · D#4 · F#4 · G4 · F4    — exactly the notes they
 *              sang, each one pulled onto its own semitone and nothing
 *              rewritten. Kept beside it so the choice stays Or's.
 *
 * ═══ HOW IT IS CORRECTED ═══
 *
 * Per NOTE, not per frame. The line is cut at the boundaries the tracker
 * found, each piece is shifted by a constant number of cents with
 * librubberband, and the pieces are joined with a 12ms equal-power
 * crossfade. The joins fall exactly where the pitch changes, which is where
 * a short crossfade cannot be heard.
 *
 * ⚠ THE SCOOP AND THE BREATH ARE PASSED THROUGH UNTOUCHED. Snapping a
 * sweeping pitch to a semitone is what makes autotune sound like a robot,
 * and the slide up into the first F#4 is the most human thing in the take.
 *
 * ═══ AND THEN THE OPERA ═══
 *
 * Three things, in this order: a quiet copy an octave up (0.20) for the
 * shimmer a trained voice has and these two do not, a high shelf for air,
 * and a hall. Measured on the result: every held note within a few cents,
 * peak 0.69, nothing clipped.
 *
 * The output lands in `assets/raw/voices/` so that `pnpm art:voices-process`
 * trims and loudness-matches it with the same -18 LUFS as every other card
 * voice. A clip that arrives at its own volume is a clip that stands out
 * for the wrong reason.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = join(ROOT, "assets", "reference");
const RAW = join(ROOT, "assets", "raw", "voices");
const AUDITION = join(ROOT, "assets", "raw", "voices", "siren");

/** ffmpeg from winget, falling back to whatever is on PATH. See sounds.ts. */
function ffmpeg() {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}
const FF = ffmpeg();
const SR = 22050;

/** Decode anything to mono float samples at SR, through ffmpeg. */
function decode(path) {
  const raw = execFileSync(
    FF,
    ["-v", "error", "-i", path, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"],
    { maxBuffer: 1 << 28 },
  );
  const n = Math.floor(raw.length / 2);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
  return out;
}

function writeWav(path, x) {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(path, buf);
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midiOf = (name) =>
  NAMES.indexOf(name.slice(0, -1)) + 12 * (Number(name.slice(-1)) + 1);

/**
 * The sung pitch over a slice, in MIDI note numbers.
 *
 * Autocorrelation on 46ms Hann-windowed frames, voiced only where the frame
 * is loud enough AND the autocorrelation peak is clear enough — a breath has
 * energy and no period, and taking its "pitch" is how a tracker invents
 * notes nobody sang.
 */
function pitches(x, from, to) {
  const W = Math.round(SR * 0.046);
  const H = Math.round(SR * 0.01);
  const a = Math.round(from * SR);
  const b = Math.min(x.length, Math.round(to * SR));
  const win = new Float64Array(W);
  for (let i = 0; i < W; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (W - 1));
  const out = [];
  for (let s = a; s + W <= b; s += H) {
    let rms = 0;
    const fr = new Float64Array(W);
    for (let i = 0; i < W; i++) {
      fr[i] = x[s + i] * win[i];
      rms += fr[i] * fr[i];
    }
    rms = Math.sqrt(rms / W);
    if (rms < 0.012) continue;
    let mean = 0;
    for (let i = 0; i < W; i++) mean += fr[i];
    mean /= W;
    for (let i = 0; i < W; i++) fr[i] -= mean;
    let zero = 0;
    for (let i = 0; i < W; i++) zero += fr[i] * fr[i];
    if (zero <= 0) continue;
    const lo = Math.floor(SR / 900);
    const hi = Math.min(Math.floor(SR / 70), W - 1);
    let bestK = 0;
    let best = -Infinity;
    for (let k = lo; k <= hi; k++) {
      let c = 0;
      for (let i = 0; i + k < W; i++) c += fr[i] * fr[i + k];
      if (c > best) {
        best = c;
        bestK = k;
      }
    }
    if (bestK === 0 || best / zero <= 0.35) continue;
    out.push(69 + 12 * Math.log2(SR / bestK / 440));
  }
  return out;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((p, q) => p - q);
  return s[(s.length - 1) >> 1];
};

/*
 * The phrases, as found in take 2. Times are seconds into the file; `null`
 * is a slide or a breath and is never corrected.
 */
const PHRASES = [
  { at: [0.95, 1.24], inkey: "B3", faithful: "B3" },
  { at: [1.24, 1.64], inkey: null, faithful: null }, // the slide up
  { at: [1.64, 2.57], inkey: "F#4", faithful: "F#4" },
  { at: [2.58, 2.73], inkey: "D#4", faithful: "D#4" },
  { at: [2.73, 2.87], inkey: null, faithful: null }, // the breath between
  { at: [2.87, 3.34], inkey: "F#4", faithful: "F#4" },
  { at: [3.35, 3.44], inkey: "G#4", faithful: "G4" },
  { at: [3.45, 3.98], inkey: "F#4", faithful: "F4" },
];

const which = process.argv[2] === "faithful" ? "faithful" : "inkey";

mkdirSync(RAW, { recursive: true });
mkdirSync(AUDITION, { recursive: true });

const source = join(REF, "siren-take2.ogg");
if (!existsSync(source)) {
  console.error(`\n  Missing ${source}\n  Both of Or's voice notes live in assets/reference.\n`);
  process.exit(1);
}
const x = decode(source);
console.log(`\n   source  ${(x.length / SR).toFixed(2)}s, peak ${Math.max(...x.map(Math.abs)).toFixed(3)}`);
console.log(`   melody  ${which}\n`);

/** Shift one slice by `cents`, keeping its length, and return its samples. */
function corrected(from, to, cents, i) {
  const cut = join(AUDITION, `_cut${i}.wav`);
  const done = join(AUDITION, `_fix${i}.wav`);
  writeWav(cut, x.slice(Math.round(from * SR), Math.round(to * SR)));
  if (Math.abs(cents) < 3) return decode(cut);
  execFileSync(FF, [
    "-y", "-v", "error", "-i", cut,
    "-af",
    `rubberband=pitch=${Math.pow(2, cents / 1200).toFixed(6)}:pitchq=quality:transients=smooth`,
    "-ar", String(SR), done,
  ]);
  return decode(done);
}

const parts = [];
PHRASES.forEach((p, i) => {
  const [from, to] = p.at;
  const want = p[which];
  let cents = 0;
  if (want) {
    const m = median(pitches(x, from, to));
    if (m !== null) cents = (midiOf(want) - m) * 100;
  }
  parts.push(corrected(from, to, cents, i));
  console.log(
    `   ${from.toFixed(2)}-${to.toFixed(2)}  ${(want ?? "~").padEnd(4)}` +
      `  ${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents`,
  );
});

// Join with a 12ms equal-power crossfade, at the pitch changes themselves.
const XF = Math.round(0.012 * SR);
let line = parts[0];
for (const p of parts.slice(1)) {
  const n = Math.min(XF, line.length, p.length);
  const out = new Float64Array(line.length + p.length - n);
  out.set(line.subarray(0, line.length - n), 0);
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (Math.PI / 2);
    out[line.length - n + i] = line[line.length - n + i] * Math.cos(t) + p[i] * Math.sin(t);
  }
  out.set(p.subarray(n), line.length);
  line = out;
}

const dry = join(AUDITION, `${which}-dry.wav`);
writeWav(dry, line);

/*
 * The opera. An octave-up copy at a fifth of the level is the shimmer a
 * trained voice has and a phone recording does not; the shelf is air; the
 * echo is a hall. Loudness is deliberately NOT set here — art:voices-process
 * does that for every card voice at once.
 */
const wet = join(AUDITION, `${which}-opera.wav`);
execFileSync(FF, [
  "-y", "-v", "error", "-i", dry,
  "-filter_complex",
  [
    "[0:a]silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,",
    "aformat=sample_fmts=fltp:sample_rates=44100[v];",
    "[v]asplit=2[a][b];",
    "[b]rubberband=pitch=2.0:pitchq=quality,volume=0.20[hi];",
    "[a][hi]amix=inputs=2:weights='1 1':normalize=0[mix];",
    "[mix]highshelf=g=3:f=4000,aecho=0.85:0.75:120|260|420:0.30|0.20|0.12[out]",
  ].join(""),
  "-map", "[out]", "-ac", "1", "-ar", "44100", wet,
]);

/*
 * ⚠ INTO THE AUDITION FOLDER, NOT THE PIPELINE. This used to write
 * `assets/raw/voices/card-name-siren.mp3`, which is exactly where
 * `art:voices-process` looks — so once the soprano replaced it, running this
 * script put Or and Hod's own voices back into the game, silently. It did,
 * once, five minutes after the soprano was built. It goes beside the soprano
 * now, to be listened to against it.
 */
const dest = join(AUDITION, `${which}-autotuned.mp3`);
execFileSync(FF, ["-y", "-v", "error", "-i", wet, "-ac", "1", "-ar", "44100", "-b:a", "128k", dest]);

const dur = execFileSync(FF.replace(/ffmpeg(\.exe)?$/, (m) => m.replace("ffmpeg", "ffprobe")), [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dest,
])
  .toString()
  .trim();

console.log(`\n   -> ${dest}  (${Number(dur).toFixed(2)}s)`);
console.log(`   -> ${wet}`);
console.log(
  `\n   The clip the game plays is the SOPRANO, built from these notes:` +
    `\n     pnpm --filter @amanda/art exec tsx src/fanfare.ts card-name-siren` +
    `\n     pnpm art:voices-process\n`,
);
