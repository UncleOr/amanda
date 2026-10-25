/**
 * The sounds in this game that are MUSIC rather than effects, and are
 * therefore computed here instead of asked for from a model.
 *
 * It began as two — you beat Amanda, and you got a card you have never had
 * — and the rest of this comment is still about those two, because they are
 * where the rules came from. Three more joined after Or listened to every
 * sound in the game in one sitting and marked the ones that were wrong: the
 * battle horn (*"something a bit more epic"*), the defeat sting (*"a bit
 * sadder"*) and the notification (*"not related, needs more 'ting'"*). All
 * three were generated clips, and all three are musical — a horn call, a
 * minor chord, a bell. See STING, at the bottom, which is also where the one
 * sound in this game that is ALLOWED to fall lives.
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
import { air, at, bell, brass, choir, finish, make, note, room, thud, wav } from "./synth.js";

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
  {
    id: "win-4-cheerful",
    idea: "Longer and happier: three stabs, voices on the chord, bells running up off the end.",
    build: () => {
      /*
       * ═══ OR LISTENED TO ALL OF THEM AND MARKED THIS ONE ═══
       *
       * On win-1, which had been the chosen one: *"needs to be a bit longer
       * and happier."*
       *
       * Longer is the easy half — 1.35 seconds to 1.9. Happier is three
       * things this one takes from the other two auditions and one it does
       * not: voices sitting ABOVE the brass (win-2's cheer), bells rather
       * than more brass carrying the top, and a run that keeps CLIMBING
       * after the chord has landed, so the last thing heard is still going
       * up. What it does not take is more weight: a second drum would make
       * it bigger, and bigger is not happier.
       *
       * It stops just under two seconds on purpose. This plays after every
       * single match, and the rule at the top of this file still holds —
       * anything with a tail turns into a nuisance by the tenth time.
       */
      const out = make(1.9);
      const L = 0.3; // where the chord lands

      // The run-up: three stabs now rather than two, climbing C–E–G, so
      // the landing arrives as the top of a line instead of after a jump.
      at(out, brass(note("C4"), 0.15, { gain: 0.5, swell: 0.012, decay: 2.8, open: 2 }), 0);
      at(out, brass(note("E4"), 0.15, { gain: 0.54, swell: 0.012, decay: 2.8, open: 2 }), 0.1);
      at(out, brass(note("G4"), 0.15, { gain: 0.58, swell: 0.012, decay: 2.8, open: 2 }), 0.2);

      // The landing: C major, held longer than win-1 held it.
      ["C4", "E4", "G4", "C5"].forEach((n, i) =>
        at(out, brass(note(n), 1.25, { gain: 0.28 - i * 0.04, swell: 0.025, decay: 1.7, open: 2.6 }), L),
      );
      // The cheer, above the brass rather than doubling it.
      ["E4", "G4", "C5"].forEach((n, i) =>
        at(out, choir(note(n), 1.3, { gain: 0.24 - i * 0.035, swell: 0.05, decay: 1.6 }), L + 0.02),
      );
      // One drum, on the chord. Exactly one.
      at(out, thud(note("C2"), 0.8, { decay: 3.4, gain: 0.8 }), L);

      // And the tail that makes it happy rather than grand: four bells
      // climbing away over the held chord, the last one left ringing.
      ["C5", "E5", "G5", "C6"].forEach((n, i) =>
        at(
          out,
          bell(note(n), 0.75 + i * 0.1, { ratio: 2.0, index: 1.5, decay: 3.0, gain: 0.2 - i * 0.02 }),
          L + 0.34 + i * 0.1,
        ),
      );
      return finish(room(out, { mix: 0.22 }));
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
    idea: "Six bells running up off the top. Pure sparkle, no weight at all.",
    /*
     * Or, on the second listening pass: *"needs to be a bit more festive.
     * Two more sounds."*
     *
     * Both halves of that are one change, and the direction it goes in is
     * decided for us. The spec for this sound says *nothing below C5 and no
     * drum at all — weight means a result, and a new card is a surprise*,
     * which is what keeps it from turning into `win`. So "more festive"
     * cannot be answered the usual way, by putting something underneath it.
     *
     * It goes UP instead. The run used to arrive at C6 and then let two
     * quiet notes drift off the top, apologetically, at a third of the
     * volume — which is a sound ending because it ran out rather than
     * because it got somewhere. Now the whole run is one gesture that
     * accelerates the entire way and lands on two bright bells at the top:
     * C7 and E7, the two more he asked for, loud enough to be the finish
     * rather than the residue.
     *
     * The gaps: 90, 75, 60, 50, 42, 36ms. Each one shorter than the last,
     * all the way to the end — the thing that makes a run read as taking
     * off instead of as a scale being practised.
     */
    build: () => {
      const out = make(1.1);
      const times = [0, 0.09, 0.165, 0.225, 0.275, 0.317];
      ["C5", "E5", "G5", "C6", "E6", "G6"].forEach((n, i) =>
        at(
          out,
          bell(note(n), 0.55 + i * 0.04, {
            ratio: 2.0,
            // Fewer sidebands as it climbs, so the top of the run is pure
            // ring rather than clang — the same bell, struck more gently.
            index: 2.2 - i * 0.18,
            decay: 3.4 - i * 0.12,
            // Barely falling, where it used to drop away to a third.
            gain: 0.3 - i * 0.022,
          }),
          times[i]!,
        ),
      );
      // The arrival. Two bells at the top, close together, bright and thin.
      at(out, bell(note("C7"), 0.85, { ratio: 2.0, index: 1.1, decay: 2.8, gain: 0.2 }), 0.353);
      at(out, bell(note("E7"), 0.95, { ratio: 3.0, index: 0.8, decay: 2.5, gain: 0.15 }), 0.383);
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

/* ── the three that came out of Or's listening pass ─────────────────── */
/*
 * These are not auditions. The two above were built in threes because "fun"
 * has no test except playing them to a seven-year-old; each of these has a
 * specific note attached to it, so each is one build answering that note.
 *
 * What they share with the fanfares: exact pitches, a chosen timbre, nothing
 * merely hoped for. What they do NOT share is the rising rule — see `lose`.
 */
const STING: Fanfare[] = [
  {
    id: "go",
    idea: "The battle horn. An open fifth, a drum, and an answer a fifth higher.",
    build: () => {
      /*
       * Or, on the generated one: *"something a bit more epic."*
       *
       * The old clip was a single honk with a drum under it, which is a horn
       * SOUND and not a horn CALL. Three things make this one epic and none
       * of them is volume:
       *
       *   1. It is an open fifth — G and D, no third. A third tells you
       *      major or minor, which is to say happy or sad, and an army is
       *      neither. Every piece of music that wants to sound ancient and
       *      large leaves it out.
       *   2. There is an ANSWER. The call lands low, and half a second later
       *      a second horn comes back a fifth above it. One note is a honk;
       *      two notes answering each other is a signal, which is what a
       *      horn is actually for.
       *   3. Voices and a room underneath. The choir is quiet enough that
       *      you would not name it if asked, and it is most of the size.
       *
       * It still has to be brutal and short, because it plays at the start
       * of every single match.
       */
      const out = make(1.6);
      const H = 0.3; // where the call lands

      // The rush in. `rise` ramps instead of decaying, so the noise builds
      // INTO the horn rather than hissing after it.
      at(out, air(0.3, { cutoff: 1500, gain: 0.1, rise: true }), 0);

      // The call: G2 and D3, with G3 above it for edge.
      at(out, brass(note("G2"), 1.15, { gain: 0.34, swell: 0.07, decay: 2.0, open: 2.4, sub: 0.5 }), H);
      at(out, brass(note("D3"), 1.1, { gain: 0.26, swell: 0.08, decay: 2.1, open: 2.4 }), H);
      at(out, brass(note("G3"), 1.0, { gain: 0.19, swell: 0.09, decay: 2.3, open: 2.6, sub: 0 }), H + 0.02);
      at(out, thud(note("G1"), 0.8, { decay: 3.6, gain: 0.95 }), H);

      // The voices. Quiet on purpose — see (3).
      at(out, choir(note("G2"), 1.15, { gain: 0.12, swell: 0.18, decay: 1.5 }), H + 0.05);
      at(out, choir(note("D3"), 1.1, { gain: 0.09, swell: 0.2, decay: 1.5 }), H + 0.05);

      // The answer, a fifth up, with its own drum under it.
      at(out, brass(note("D4"), 0.72, { gain: 0.26, swell: 0.03, decay: 2.6, open: 3.0, sub: 0.15 }), H + 0.55);
      at(out, brass(note("G4"), 0.66, { gain: 0.16, swell: 0.035, decay: 2.8, open: 3.0, sub: 0 }), H + 0.57);
      at(out, thud(note("G1"), 0.62, { decay: 4.0, gain: 0.66 }), H + 0.55);

      return finish(room(out, { mix: 0.3, size: 1.3 }));
    },
  },
  {
    id: "lose",
    idea: "The one sound here that falls, because it is the one that means no.",
    build: () => {
      /*
       * Or: *"needs to be a bit sadder."*
       *
       * ═══ THE EXCEPTION TO THE RULE AT THE TOP OF THIS FILE ═══
       *
       * Everything else in here rises and lands on a major chord, because a
       * sting that falls is an error sound. This one IS the error sound. The
       * rule was never "do not fall" — it was "do not let a reward sound
       * like a refusal", and the way to keep that true is to let the refusal
       * fall properly, so that the two can never be confused.
       *
       * Sad is three decisions:
       *
       *   MINOR      D minor to start. The third is what makes a chord sad,
       *              and the old clip had no chord in it at all — only a
       *              slide, which is a noise going down.
       *   IT SAGS    the whole chord steps DOWN a tone to C minor halfway
       *              through, and the top voice is dropped on the way, so it
       *              thins as it falls. A chord change is a feeling going
       *              down, which is not the same thing as a slide.
       *   NO LANDING the drum is at the START, not the end, and everything
       *              after it decays. A drum at the end is a full stop, and
       *              a full stop means a result worth having.
       *
       * Long, which is the other thing he asked for: 2.2s, and unlike the
       * rest of this file it is allowed to be, because it plays once at the
       * end of a match you have already lost and nothing follows it.
       */
      const out = make(2.2);

      // The moment it goes wrong. Soft — a thump, not a hit.
      at(out, thud(note("D2"), 0.95, { decay: 3.0, gain: 0.5 }), 0);

      // D minor, the voices arriving one behind another rather than together.
      at(out, brass(note("D3"), 1.5, { gain: 0.24, swell: 0.12, decay: 1.5, open: 1.4, sub: 0.4 }), 0.02);
      at(out, choir(note("F3"), 1.6, { gain: 0.2, swell: 0.22, decay: 1.4 }), 0.05);
      at(out, choir(note("A3"), 1.55, { gain: 0.15, swell: 0.26, decay: 1.4 }), 0.1);

      // Down a tone, into C minor, and the top voice does not come with it.
      at(out, brass(note("C3"), 1.25, { gain: 0.2, swell: 0.2, decay: 1.6, open: 1.1, sub: 0.45 }), 0.85);
      at(out, choir(note("D#3"), 1.3, { gain: 0.17, swell: 0.3, decay: 1.3 }), 0.9);
      at(out, choir(note("G3"), 1.2, { gain: 0.1, swell: 0.3, decay: 1.4 }), 0.95);

      // The last breath, an octave below where it started.
      at(out, choir(note("C2"), 1.0, { gain: 0.14, swell: 0.3, decay: 1.2 }), 1.25);

      // A wetter, duller room than anything else here. Distance is sad too.
      return finish(room(out, { mix: 0.34, size: 1.4, damp: 0.45 }));
    },
  },
  {
    id: "beep",
    idea: "The notification. Two bells, up, and nothing else at all.",
    build: () => {
      /*
       * Or: *"not related, needs more 'ting'."* He is right twice over — the
       * clip was a muffled wooden temple block, which is a thud, and `beep`
       * has not been the countdown for a long time. It is what plays when an
       * invitation arrives, when a rematch is offered, when somebody says
       * something to you, and at a locked door. All four mean "look here",
       * and none of them is a knock.
       *
       * A ting is a small struck metal thing: a high fundamental, a bright
       * inharmonic partial above it that dies first, and a quick ring. That
       * is precisely what `bell` does with a high `ratio` — so this is three
       * bells, a fifth apart, the top one too quiet to hear as a note and
       * entirely responsible for the word "ting".
       *
       * Up, not down, for the usual reason: this is a notification, and a
       * falling pair is a dismissal.
       */
      const out = make(0.55);
      at(out, bell(note("D6"), 0.42, { ratio: 3.0, index: 1.8, decay: 4.2, gain: 0.34 }), 0);
      at(out, bell(note("D7"), 0.3, { ratio: 2.0, index: 0.8, decay: 4.6, gain: 0.1 }), 0.004);
      at(out, bell(note("A6"), 0.45, { ratio: 3.0, index: 1.2, decay: 3.8, gain: 0.22 }), 0.075);
      // Barely any room. It plays over a screen you are already looking at.
      return finish(room(out, { mix: 0.16 }));
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
  // Was win-1-trumpets, until Or went through every sound in the game and
  // marked this one: *"needs to be a bit longer and happier."* The old one
  // is still rendered into the audition folder beside it.
  "win-4-cheerful": "win",
  "new-1-sparkle": "newcard",
  // The listening-pass three. The same id on both sides, because unlike the
  // two above there was never a choice between options to record here.
  go: "go",
  lose: "lose",
  beep: "beep",
};

mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });
const only = process.argv[2];
console.log();
for (const f of [...WIN, ...NEW, ...STING]) {
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
