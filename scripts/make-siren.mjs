/**
 * The Siren's song, cut from the Amanda film.
 *
 *   node scripts/make-siren.mjs          (or: pnpm art:siren)
 *
 * Or: *"the Siren — when you place her you should hear an opera song like
 * Sirenaaa Sirenna, twice."* Then, with the track: *"take the Sirena Sirena
 * Sirena three times from second 00:11."* Then, when asked whose recording it
 * is: *"the recording is mine — you can use it exactly. It is the original
 * Siren from Amanda's film."*
 *
 * So it is a SAMPLE, and the two detours it took to get here are worth
 * keeping, because both were wrong for reasons that will come round again:
 *
 *   FIRST a text-to-speech spec with the vowels stretched. Wrong for the
 *     reason this project has met four times — a feeling is music, and music
 *     is the one thing that model cannot make. Asked for opera it returns
 *     somebody SAYING a word.
 *   THEN two voice notes of Or and Hod faking the tune, pitch-corrected onto
 *     a melody measured out of them. He: *"it needs to be COMPLETELY
 *     regenerated... our recordings are only a reference for the melody."*
 *   THEN a soprano synthesised from scratch (`soprano` in synth.ts, which is
 *     still there and still earns its place), singing the melody measured
 *     from THIS recording.
 *
 * And then the simplest answer turned out to be available all along: he owns
 * the original. Nothing synthesised beats the thing itself.
 *
 * ═══ WHERE THE CUT IS, AND WHY EXACTLY THERE ═══
 *
 * Measured rather than eyeballed — a 20ms envelope over the region:
 *
 *   11.22-11.26   a dip to rms 0.008. The gap before she starts.
 *   11.28         the voice, rms 0.037 and climbing
 *   15.78         the last note has decayed to 0.038
 *   15.80 on      a steady bed at about 0.037 that does not stop — the next
 *                 section, not her tail
 *
 * So: in at 11.24, inside the gap, and out at 15.88 with a 120ms fade that
 * covers the join into that bed. 4.64 seconds.
 *
 * ⚠ AND THE VOICE IS EXPOSED, which is the thing that makes this usable at
 * all. Measured across all three phrases there is 0.0% of the energy below
 * 200Hz — no bass, no drums, nothing to cut around. A sample with a backing
 * track under it would have had to be synthesised after all.
 *
 * ═══ WHAT IT SINGS ═══
 *
 * Autocorrelation at 20ms frames, which is also where the notes in the
 * (now unused) synthesised version came from:
 *
 *   11.28  D4   520ms   "Si"
 *   11.82       80ms    a scoop, D#-E-F#-G-G#
 *   11.92  A4  1200ms   "—reeenaaa"      <- the note the song is about
 *   13.14  G4   200ms   falling away
 *   13.48  A4   320ms   "Si"
 *   13.82  A#4  300ms   "re"
 *   14.14  B4/C5 60ms   a flick off the top
 *   14.22  A#4 -> A4    "naaa"
 *   14.76  G4   480ms   "Si-re"
 *   15.26  A4   520ms   "naaa"
 *
 * Every vocal note is in D minor, which is why it sounds like something
 * luring you rather than a fanfare.
 *
 * ═══ WHAT GOES IN GIT AND WHAT DOES NOT ═══
 *
 * The 2:11 track stays out: UncleOr/amanda is public, and publishing the
 * whole thing to make a four-second clip is not a trade worth making even
 * when it is yours. The EXCERPT is committed, because it ships inside the
 * game anyway. Put the full track at the path below to re-cut it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = join(ROOT, "assets", "reference");
const RAW = join(ROOT, "assets", "raw", "voices");

/** The excerpt, committed — this is what the game plays. */
const EXCERPT = join(REF, "siren-film-excerpt.mp3");
/**
 * The full track, NOT committed. Or's copy lives outside the repo; drop it
 * here (or beside it under any of these names) to cut the excerpt again.
 */
const SOURCES = [
  join(REF, "siren-film.mp3"),
  join(ROOT, "..", "Amanda-refs", "sirena sirena sirena.mp3"),
];

/** In at the gap before she starts, out just past the last note. */
const FROM = 11.24;
const TO = 15.88;
const FADE = 0.12;

/** ffmpeg from winget, falling back to whatever is on PATH. See sounds.ts. */
function ffmpeg() {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

mkdirSync(RAW, { recursive: true });
mkdirSync(REF, { recursive: true });

const dur = (TO - FROM).toFixed(2);
const source = SOURCES.find(existsSync);

if (source) {
  console.log(`\n   cutting ${FROM}s -> ${TO}s (${dur}s) from\n   ${source}\n`);
  execFileSync(ffmpeg(), [
    "-y", "-v", "error",
    "-ss", String(FROM),
    "-t", String(TO - FROM),
    "-i", source,
    // `-vn` because the file carries cover art, which would otherwise ride
    // along as a video stream into a clip the game decodes as audio.
    "-vn",
    "-af", `afade=t=out:st=${(TO - FROM - FADE).toFixed(3)}:d=${FADE}`,
    "-ac", "1", "-ar", "44100", "-b:a", "160k",
    EXCERPT,
  ]);
} else if (existsSync(EXCERPT)) {
  // A clone has the excerpt and not the track, which is the normal state.
  console.log(`\n   no full track here; using the committed excerpt\n   ${EXCERPT}\n`);
} else {
  console.error(
    `\n  Nothing to cut from. Put the full track at one of:\n` +
      SOURCES.map((s) => `    ${s}`).join("\n") +
      `\n`,
  );
  process.exit(1);
}

// Into the voices pipeline, which trims and loudness-matches every card
// voice together — see processVoices in packages/art/src/voices.ts.
copyFileSync(EXCERPT, join(RAW, "card-name-siren.mp3"));

console.log(`   -> ${EXCERPT}`);
console.log(`   -> ${join(RAW, "card-name-siren.mp3")}`);
console.log(`\n   Now run:  pnpm art:voices-process\n`);
