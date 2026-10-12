/**
 * The two moments worth a noise: you beat Amanda, and you got a card you
 * have never had.
 *
 *   pnpm --filter @amanda/art exec tsx src/fanfare.ts
 *   → assets/raw/sfx/fanfare/*.mp3
 *
 * Or: *"the win sound and the new-chest sound are really awful — make a
 * DIFFERENT victory sound for each of them, and fun."*
 *
 * ═══ WHY THEY HAVE TO BE TWO DIFFERENT SOUNDS ═══
 *
 * They were the same sound. `win` played at the end of a match AND over the
 * new-card celebration, which is how a game teaches a child that nothing in
 * particular just happened. Two events that mean different things and sound
 * identical cancel each other out: the rarer one stops being rare.
 *
 * So they are built to be told apart with the lights off:
 *
 *   WIN       low and wide. A drum under it, brass in it, and it lands on a
 *             chord you could hum. The sound of something ENDING well.
 *   NEW CARD  high and narrow. No drum at all, no bass, bells only, and it
 *             runs UPWARDS off the top. The sound of something OPENING.
 *
 * The drum is the whole distinction, and it is deliberate: weight means a
 * result, and a card you have not seen before is not a result, it is a
 * surprise.
 *
 * ═══ THE RULE FROM THE REJECTED ONES ═══
 *
 * Five generated stings were rejected and *"2 of them were error sounds"* —
 * one being a descending minor third, which is a doorbell for "no". Nothing
 * here falls. Every one rises and lands on a major chord, and the landing is
 * the loudest moment rather than the first.
 *
 * ═══ AND THEY ARE SHORT ═══
 *
 * `win` plays after every single match and the new-card sound plays whenever
 * a chest holds something fresh. sounds.ts puts it best: anything with a
 * tail turns into a nuisance by the tenth time you hear it. Nothing below is
 * over 1.4 seconds, against the 2.0s thing they are replacing.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";
import type { Buf } from "./synth.js";
import { at, bell, brass, choir, finish, make, note, room, thud, wav } from "./synth.js";

const OUT = join(REPO_ROOT, "assets", "raw", "sfx", "fanfare");
/** Where sounds.ts reads from, for the ones that end up in the game. */
const RAW = join(REPO_ROOT, "assets", "raw", "sfx");

interface Fanfare {
  id: string;
  /** What it is for, and what makes this one different from its neighbours. */
  idea: string;
  build: () => Buf;
}

/* ── you won ───────────────────────────────────────────────────────── */
/*
 * All three are in C major, because that is the brightest thing available and
 * a win is not the place for restraint. They differ in what carries the
 * chord: brass is a trumpet call, bells are a toy, and the third has both.
 */
const WIN: Fanfare[] = [
  {
    id: "win-1-trumpets",
    idea: "Two rising stabs into a held chord, with a drum on the landing.",
    build: () => {
      const out = make(1.35);
      const L = 0.26; // where the chord lands
      /*
       * The run-up: two short stabs, a fourth apart, both under the landing.
       *
       * Loud, and that is measured rather than taste. At the gains they
       * started on, the per-50ms shape of the finished file came out
       * `.  . @@%` — the stabs were a tenth of the landing and the sound
       * effectively began a sixth of a second late. A win sound that starts
       * quietly is a win sound that starts late, because the player's ear
       * marks the beginning at the first thing it can hear.
       */
      at(out, brass(note("G3"), 0.17, { gain: 0.52, swell: 0.012, decay: 2.8, open: 2 }), 0);
      at(out, brass(note("C4"), 0.17, { gain: 0.58, swell: 0.012, decay: 2.8, open: 2 }), 0.13);
      // The landing: a C major triad with the octave on top, held.
      ["C4", "E4", "G4", "C5"].forEach((n, i) =>
        at(out, brass(note(n), 1.0, { gain: 0.3 - i * 0.045, swell: 0.025, decay: 2.0, open: 2.6 }), L),
      );
      // The weight. Low, short, and exactly on the chord — a drum one frame
      // late reads as a mistake rather than as a drum.
      at(out, thud(note("C2"), 0.75, { decay: 3.4, gain: 0.85 }), L);
      // One bell on top so it sparkles rather than just blares.
      at(out, bell(note("C6"), 0.8, { ratio: 2.0, index: 1.4, decay: 3.2, gain: 0.16 }), L + 0.02);
      return finish(room(out, { mix: 0.2 }));
    },
  },
  {
    id: "win-2-cheer",
    idea: "Voices join the brass on the chord. Warmer, more of a cheer.",
    build: () => {
      const out = make(1.4);
      const L = 0.24;
      // Same correction as win-1: the run-up has to be heard to be a run-up.
      at(out, brass(note("G3"), 0.16, { gain: 0.5, swell: 0.012, decay: 2.8, open: 2 }), 0);
      at(out, brass(note("C4"), 0.16, { gain: 0.56, swell: 0.012, decay: 2.8, open: 2 }), 0.12);
      ["C4", "E4", "G4"].forEach((n, i) =>
        at(out, brass(note(n), 0.95, { gain: 0.24 - i * 0.04, swell: 0.025, decay: 2.2, open: 2.6 }), L),
      );
      // The crowd. Voices sit ABOVE the brass rather than doubling it, which
      // is the difference between a fanfare and a cheer.
      ["E4", "G4", "C5"].forEach((n, i) =>
        at(out, choir(note(n), 1.05, { gain: 0.26 - i * 0.04, swell: 0.05, decay: 1.9 }), L + 0.02),
      );
      at(out, thud(note("C2"), 0.7, { decay: 3.6, gain: 0.78 }), L);
      return finish(room(out, { mix: 0.26 }));
    },
  },
  {
    id: "win-3-quick",
    idea: "The shortest. Three notes up and done — for a sound heard daily.",
    build: () => {
      const out = make(1.05);
      // A straight major arpeggio, fast, each note still ringing when the
      // next arrives. Nothing to wait through.
      ["C4", "E4", "G4"].forEach((n, i) =>
        at(out, bell(note(n), 0.5, { ratio: 1.0, index: 2.4, decay: 3.4, gain: 0.34 }), i * 0.075),
      );
      const L = 0.225;
      ["C5", "E5", "G5"].forEach((n, i) =>
        at(out, bell(note(n), 0.75, { ratio: 2.0, index: 1.8, decay: 2.8, gain: 0.3 - i * 0.05 }), L),
      );
      at(out, brass(note("C3"), 0.7, { gain: 0.22, swell: 0.03, decay: 2.4, open: 2.4 }), L);
      at(out, thud(note("C2"), 0.6, { decay: 3.8, gain: 0.7 }), L);
      return finish(room(out, { mix: 0.18 }));
    },
  },
];

/* ── a card you have never had ─────────────────────────────────────── */
/*
 * No drum in any of them, and nothing below C4. That is the rule that makes
 * these unmistakably not the win sound, even at the volume a phone in a
 * living room actually plays at.
 */
const NEW: Fanfare[] = [
  {
    id: "new-1-sparkle",
    idea: "Four bells running up off the top. Pure sparkle, no weight at all.",
    build: () => {
      const out = make(1.1);
      // Accelerating: 90ms, 75ms, 60ms between notes. A constant gap reads as
      // a scale being practised; a shrinking one reads as something taking
      // off, which is the feeling.
      const times = [0, 0.09, 0.165, 0.225];
      ["C5", "E5", "G5", "C6"].forEach((n, i) =>
        at(out, bell(note(n), 0.55, { ratio: 2.0, index: 2.2, decay: 3.4, gain: 0.3 }), times[i]!),
      );
      // And one more, higher and quieter, as if it carried on past the top.
      at(out, bell(note("E6"), 0.7, { ratio: 2.0, index: 1.6, decay: 3.0, gain: 0.2 }), 0.29);
      at(out, bell(note("G6"), 0.8, { ratio: 3.0, index: 1.1, decay: 2.6, gain: 0.12 }), 0.34);
      return finish(room(out, { mix: 0.3 }));
    },
  },
  {
    id: "new-2-twinkle",
    idea: "Two bells and a shimmer. The shortest and lightest of everything.",
    build: () => {
      const out = make(0.95);
      // A fifth, up. Two notes is the whole sound — the same reason the
      // idents Or named are two notes.
      at(out, bell(note("G5"), 0.5, { ratio: 2.0, index: 2.4, decay: 3.6, gain: 0.34 }), 0);
      at(out, bell(note("D6"), 0.8, { ratio: 2.0, index: 1.8, decay: 2.8, gain: 0.32 }), 0.11);
      // The shimmer: three bells a semitone apart, far too quiet to be heard
      // as notes, which makes the second one glitter instead of ring.
      ["D7", "D#7", "E7"].forEach((n, i) =>
        at(out, bell(note(n), 0.5, { ratio: 3.0, index: 0.9, decay: 3.2, gain: 0.07 }), 0.12 + i * 0.045),
      );
      return finish(room(out, { mix: 0.34 }));
    },
  },
  {
    id: "new-3-reveal",
    idea: "A held voice under the bells. Softer, more 'look what you got'.",
    build: () => {
      const out = make(1.3);
      ["C5", "G5", "C6"].forEach((n, i) =>
        at(out, bell(note(n), 0.6, { ratio: 2.0, index: 2.0, decay: 3.2, gain: 0.3 }), i * 0.085),
      );
      // One voice, high and quiet, holding the major third — the note that
      // makes a chord sound happy rather than merely finished.
      at(out, choir(note("E5"), 1.0, { gain: 0.16, swell: 0.12, decay: 2.0 }), 0.17);
      at(out, choir(note("C6"), 1.0, { gain: 0.12, swell: 0.12, decay: 2.0 }), 0.17);
      at(out, bell(note("E6"), 0.9, { ratio: 2.0, index: 1.4, decay: 2.6, gain: 0.18 }), 0.26);
      return finish(room(out, { mix: 0.32 }));
    },
  },
];

/* ── render ────────────────────────────────────────────────────────── */

function ffmpeg(): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

/**
 * The two Or picked, and where they go.
 *
 *   win     → "option 1" — two rising stabs into a held C major with a drum
 *   newcard → "option 1" — four bells running up off the top, no weight
 *
 * Written into `assets/raw/sfx/` as well as the audition folder, because that
 * is where sounds.ts looks and the client copies are made by the SAME trim,
 * loudness and fade as every other effect in the game. A fanfare dropped
 * straight into public/sfx would arrive at a different volume from the sound
 * before it, and the choice between these was never about volume.
 */
const CHOSEN: Record<string, string> = {
  "win-1-trumpets": "win",
  "new-1-sparkle": "newcard",
};

mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });
const only = process.argv[2];
console.log();
for (const f of [...WIN, ...NEW]) {
  if (only && !f.id.startsWith(only)) continue;
  const raw = join(OUT, `${f.id}.wav`);
  const mp3 = join(OUT, `${f.id}.mp3`);
  const rendered = wav(f.build());
  writeFileSync(raw, rendered);
  if (CHOSEN[f.id]) writeFileSync(join(RAW, `${CHOSEN[f.id]}.wav`), rendered);
  execFileSync(ffmpeg(), [
    "-y", "-v", "error", "-i", raw,
    // The same -16 LUFS as every other effect in the game, so choosing one of
    // these is a choice about the SOUND and not about which was loudest.
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac", "1", "-ar", "44100", "-b:a", "160k", mp3,
  ]);
  console.log(`   ${f.id.padEnd(16)}${CHOSEN[f.id] ? " → " + CHOSEN[f.id] : "   "}  ${f.idea}`);
}
console.log(`\n   → ${OUT}\n`);
