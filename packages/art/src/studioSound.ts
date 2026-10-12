/**
 * The noise the Asulins ident makes.
 *
 *   pnpm --filter @amanda/art exec tsx src/studioSound.ts
 *   pnpm --filter @amanda/art exec tsx src/studioSound.ts chime   (that one again)
 *
 * Or: *"it needs some kind of sound hook for the opener."* Four of them, to
 * be picked tonight with Hod alongside the logo — a mark and its noise are
 * one decision, and choosing them separately gets you two things that do not
 * belong to each other.
 *
 * ═══ WHAT A STUDIO IDENT SOUND HAS TO DO ═══
 *
 * It plays before EVERY launch, which is the whole brief:
 *
 *   - under two seconds, because the fifth time you hear it is the one that
 *     decides whether it was a good idea;
 *   - one gesture, not a tune — a tune has a second half you start waiting
 *     for;
 *   - it ENDS. No tail, no reverb wash running under the first frame of the
 *     game.
 *
 * Generated at four seconds and cut to the gesture, the same way the game's
 * own effects are (see sounds.ts): the model takes whole seconds and needs
 * room to put the sound somewhere.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";
import { download, sound } from "./fal.js";

const RAW = join(REPO_ROOT, "assets", "raw", "studio", "sfx");

const DRY =
  "Clean close recording, no music bed, no voice, no speech, ends cleanly with no long tail.";

interface Hook {
  id: string;
  /** What it is, for us. Never sent. */
  idea: string;
  prompt: string;
  /** Length of the finished clip. */
  seconds: number;
}

const HOOKS: Hook[] = [
  {
    id: "1-two-notes",
    idea: "A low note and a high note — the father and the son, as sound.",
    seconds: 1.6,
    prompt: [
      "Two warm synthesizer notes played one after the other, a low one and then",
      "a higher one, like a short friendly two-note logo sting. Soft bell-like",
      "attack, a little shimmer, no melody beyond those two notes.",
    ].join(" "),
  },
  {
    id: "2-coin-up",
    idea: "An arcade power-up. The most gaming-native option.",
    seconds: 1.4,
    prompt: [
      "A short bright 8-bit arcade power-up sound: a quick rising sequence of",
      "clean square-wave blips climbing in pitch, like collecting a coin and",
      "levelling up, ending on one held note.",
    ].join(" "),
  },
  {
    id: "3-click-chord",
    idea: "A controller button pressed, and the game answering.",
    seconds: 1.5,
    prompt: [
      "A single firm plastic button click, immediately followed by a warm",
      "synthesizer chord blooming open underneath it and fading out quickly.",
      "Tight, close, deliberate — a switch being pressed and something waking up.",
    ].join(" "),
  },
  {
    id: "4-little-roar",
    idea: "A small monster's roar. Amanda's world, in one second.",
    seconds: 1.5,
    prompt: [
      "One short playful cartoon monster growl, small and friendly rather than",
      "frightening, ending in a quick upward squeak like a happy question.",
      "Dry and close, no echo.",
    ].join(" "),
  },
];

function ffmpeg(): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

const rawPath = (h: Hook) => join(RAW, `${h.id}.wav`);
const cutPath = (h: Hook) => join(RAW, `${h.id}.mp3`);

async function main(only?: string): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const picked = only ? HOOKS.filter((h) => h.id.startsWith(only)) : HOOKS;
  if (picked.length === 0) {
    console.error(`\nNo hook "${only}". Options:\n  ${HOOKS.map((h) => h.id).join("\n  ")}\n`);
    process.exit(1);
  }
  if (only) for (const h of picked) rmSync(rawPath(h), { force: true });

  console.log(`\nAsulins sound — ${picked.length} hook(s)\n`);
  for (const hook of picked) {
    process.stdout.write(`   ${hook.id.padEnd(16)} `);
    if (!existsSync(rawPath(hook))) {
      const url = await sound(`${hook.prompt} ${DRY}`, { seconds: 4 });
      if (!url) {
        console.log("FAILED — nothing came back");
        continue;
      }
      await download(url, rawPath(hook));
    }
    /*
     * Cut to the gesture and levelled.
     *
     * `silenceremove` on the head because the model happily spends the first
     * second on nothing, and an ident that starts late is an ident that feels
     * broken. The fade at the end is 80ms — just enough that it stops rather
     * than cuts.
     */
    execFileSync(ffmpeg(), [
      "-y", "-v", "error", "-i", rawPath(hook),
      "-af",
      `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,`
        + `atrim=0:${hook.seconds},`
        + `afade=t=out:st=${(hook.seconds - 0.08).toFixed(2)}:d=0.08,`
        + `loudnorm=I=-16:TP=-1.5:LRA=11`,
      "-ac", "1", "-ar", "44100", "-b:a", "128k",
      cutPath(hook),
    ]);
    console.log("OK");
  }
  console.log(`\n   → ${RAW}\n`);
  for (const h of HOOKS) if (existsSync(cutPath(h))) console.log(`     ${h.id.padEnd(16)} ${h.idea}`);
  console.log();
}

await main(process.argv[2]);
