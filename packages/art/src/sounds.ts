/**
 * The game's sound effects, generated rather than synthesised.
 *
 *   pnpm art:sounds           generate whatever is missing
 *   pnpm art:sounds place go  regenerate just those two
 *
 * Or, on the old ones: "they sound like a 386 making noise out of the CPU with
 * no speakers. It could have been cool if that was our thing, but it isn't."
 * He was describing the implementation exactly — square and sawtooth
 * oscillators in the browser. No amount of Web Audio gets you a recording, so
 * these are recordings.
 *
 * Raw results are kept in `assets/raw/sfx/*.mp3` and never regenerated once
 * they exist (they cost money). The client copies are trimmed and loudness-
 * matched into `apps/client/public/sfx/`.
 *
 * The brief for every one of them: SHORT, DRY, CLOSE. A game sound plays a
 * hundred times an hour. Anything with a tail, a room, or a tune in it turns
 * into a nuisance by the tenth time you hear it — which is why the durations
 * below are mostly under a second, and why the prompts keep saying "no music"
 * and "no reverb" to a model that loves adding both.
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { download, sound } from "./fal.js";
import { REPO_ROOT } from "./catalog.js";

const RAW = join(REPO_ROOT, "assets", "raw", "sfx");
const OUT = join(REPO_ROOT, "apps", "client", "public", "sfx");

/** ffmpeg from winget, falling back to whatever is on PATH. */
function ffmpeg(): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

/** Said at the end of every prompt, because the model forgets otherwise. */
const DRY = "Dry close-miked recording, no music, no reverb, no room tone, no voice, mono, starts immediately.";

export interface SoundSpec {
  id: string;
  /** What it is, in the game. Not sent to the model — it is for us. */
  what: string;
  prompt: string;
  seconds: number;
  /** Peak level in the client copy, 0–1. The quiet ones play constantly. */
  level: number;
}

export const SOUNDS: SoundSpec[] = [
  {
    id: "click",
    what: "any button",
    prompt: `A single soft wooden UI click, like a fingernail tapping a lacquered board game box. Very short, tactile, low. ${DRY}`,
    seconds: 0.4,
    level: 0.35,
  },
  {
    id: "draw",
    what: "a card comes into your hand",
    prompt: `One playing card being drawn off the top of a deck — a short dry paper slide with a crisp flick at the end. ${DRY}`,
    seconds: 0.6,
    level: 0.5,
  },
  {
    id: "place",
    what: "a monster lands on the board",
    prompt: `A thick trading card slapped down flat onto a wooden table. One hit, punchy, a little card-stock snap, no echo. ${DRY}`,
    seconds: 0.6,
    level: 0.75,
  },
  {
    id: "discard",
    what: "a card goes in the bin",
    prompt: `A card flicked into a metal bin — light paper flutter followed by one small hollow metallic tap. ${DRY}`,
    seconds: 0.8,
    level: 0.5,
  },
  {
    id: "beep",
    what: "each second of the countdown before building",
    prompt: `One muffled wooden temple-block hit, deep and short, like a countdown marker. Single hit only. ${DRY}`,
    seconds: 0.4,
    level: 0.5,
  },
  {
    id: "tick",
    what: "the clock, while there is still time",
    prompt: `A single soft mechanical clock tick from an old wind-up timer. Quiet, dry, one tick only. ${DRY}`,
    seconds: 0.3,
    level: 0.3,
  },
  {
    id: "tickUrgent",
    what: "the clock, in the last seconds",
    prompt: `A single hard clock tick with a metallic edge, like a kitchen timer under tension. Sharp, urgent, one tick only. ${DRY}`,
    seconds: 0.3,
    level: 0.55,
  },
  {
    id: "timeUp",
    what: "building is over",
    prompt: `A short dungeon buzzer — one low brass honk that collapses into a dull wooden thud. Not musical, not a fanfare. ${DRY}`,
    seconds: 1.2,
    level: 0.7,
  },
  {
    id: "go",
    what: "the battle starts",
    prompt: `A monstrous war horn blast with one deep taiko drum hit under it. Dark fantasy, short and brutal, no melody. ${DRY}`,
    seconds: 1.6,
    level: 0.85,
  },
  {
    id: "crumbs",
    what: "the empty slots fill with Crumb Demons",
    prompt: `Small stones and grit scattering across a stone floor, with a few tiny squeaky creature chirps mixed in. Short. ${DRY}`,
    seconds: 1.0,
    level: 0.5,
  },
  {
    id: "explode",
    what: "a monster dies",
    prompt: `A short punchy monster burst — a wet thump with debris and a brief gravelly growl cut off. Not a bomb, not cartoonish. ${DRY}`,
    seconds: 0.9,
    level: 0.7,
  },
  {
    id: "win",
    what: "you won",
    prompt: `A short triumphant dark-fantasy sting: low brass swell and one big drum hit, ending clean. Under two seconds. ${DRY}`,
    seconds: 2.0,
    level: 0.8,
  },
  {
    id: "lose",
    what: "you lost",
    prompt: `A short descending dark-fantasy sting: low strings sliding down into a dying monstrous groan. Under two seconds. ${DRY}`,
    seconds: 2.2,
    level: 0.8,
  },
];

/** Generate the missing ones (or the named ones) into assets/raw/sfx. */
export async function generateSounds(only: string[]): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const list = only.length ? SOUNDS.filter((s) => only.includes(s.id)) : SOUNDS;
  if (!list.length) {
    console.error(`No such sound. Options: ${SOUNDS.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  console.log(`\nGenerating ${list.length} sounds\n`);
  for (const spec of list) {
    const dest = join(RAW, `${spec.id}.mp3`);
    // Named explicitly means "do it again"; otherwise never pay twice.
    if (!only.length && existsSync(dest)) {
      console.log(`   skip  ${spec.id} (exists)`);
      continue;
    }
    process.stdout.write(`   ${spec.id.padEnd(12)} ${spec.what.padEnd(34)} ... `);
    try {
      const url = await sound(spec.prompt, { seconds: spec.seconds });
      if (!url) throw new Error("no audio returned");
      await download(url, dest);
      console.log("OK");
    } catch (err) {
      console.log(`FAIL ${(err as Error).message}`);
    }
  }
  console.log(`\nDone -> assets/raw/sfx/  (run art:sounds-process next)\n`);
}

/**
 * Trim and level the raw clips into the client.
 *
 * Three things happen here, and all three matter more than they sound:
 *   - silence at the head is cut, because a game sound that answers a tap 200ms
 *     late feels like lag, not like a sound;
 *   - everything is normalised then scaled to its own level, so the clock tick
 *     does not shout as loudly as the war horn;
 *   - a 15ms fade out, because an abrupt cut is a click, and we just spent
 *     money to stop making clicks.
 */
export function processSounds(): void {
  mkdirSync(OUT, { recursive: true });
  const bin = ffmpeg();
  let done = 0;
  for (const spec of SOUNDS) {
    const src = join(RAW, `${spec.id}.mp3`);
    if (!existsSync(src)) {
      console.log(`   miss  ${spec.id} (generate it first)`);
      continue;
    }
    const dest = join(OUT, `${spec.id}.mp3`);
    execFileSync(
      bin,
      [
        "-y",
        "-i",
        src,
        "-af",
        [
          "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0",
          `atrim=0:${spec.seconds}`,
          "loudnorm=I=-16:TP=-1.5:LRA=11",
          `volume=${spec.level}`,
          "afade=t=out:st=" + Math.max(0, spec.seconds - 0.05).toFixed(2) + ":d=0.05",
        ].join(","),
        "-ac",
        "1",
        "-ar",
        "44100",
        "-b:a",
        "96k",
        dest,
      ],
      { stdio: "ignore" },
    );
    console.log(`   ok    ${spec.id}`);
    done++;
  }
  console.log(`\n${done} sounds -> apps/client/public/sfx/\n`);
}
