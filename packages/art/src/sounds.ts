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
 * they exist (they cost money). The COMPUTED ones are the exception and cost
 * nothing: `pnpm art:fanfare` rebuilds them from fanfare.ts note by note,
 * which is also the only way to get them back on a fresh clone, since
 * assets/raw is not in git. The client copies are trimmed and loudness-
 * matched into `apps/client/public/sfx/`.
 *
 * There are five computed ones — `win`, `newcard`, `go`, `lose`, `beep` —
 * and the last three arrived together, after Or sat down and listened to
 * every sound in this game in one go. What he marked wrong divides cleanly:
 * the things that are EVENTS in the world stayed with the model (a bin, a
 * burst, a thrown stone), and every single one he wanted a FEELING from —
 * epic, sad, a ting — turned out to be music, and music is the thing this
 * model cannot do. Twice a fanfare was asked for and twice it came back as
 * an error sound. That was never a wording problem.
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
  return tool("ffmpeg");
}

/** Its sibling, for asking how long a file is before cutting it short. */
function ffprobe(): string {
  return tool("ffprobe");
}

function tool(name: "ffmpeg" | "ffprobe"): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    `ffmpeg-8.1.1-full_build/bin/${name}.exe`,
  );
  return existsSync(winget) ? winget : name;
}

/** Said at the end of every prompt, because the model forgets otherwise. */
const DRY =
  "Dry close-miked recording, no music, no reverb, no room tone, no voice, mono, starts immediately.";

export interface SoundSpec {
  id: string;
  /** What it is, in the game. Not sent to the model — it is for us. */
  what: string;
  /**
   * What to ask the model for — absent when the sound is COMPUTED instead.
   *
   * `win` and `newcard` are built by fanfare.ts, note by note. Twice now a
   * fanfare has been asked for and twice it came back as an error sound, and
   * the reason is the method: this is an effects model, and a fanfare is
   * music. Leaving the prompt off is what stops `pnpm art:sounds` from ever
   * quietly putting a generated one back over the top.
   */
  prompt?: string;
  /** How long the clip ends up, after trimming. */
  seconds: number;
  /**
   * How long to ASK for. The model takes whole seconds and needs room to put
   * the sound somewhere, so a 0.4s click is generated as 2s of mostly silence
   * and then cut down — which is also why the head-trim below matters.
   */
  generate?: number;
  /** Peak level in the client copy, 0–1. The quiet ones play constantly. */
  level: number;
}

export const SOUNDS: SoundSpec[] = [
  {
    id: "click",
    what: "any button",
    /*
     * Or: *"not really related. It sounds like a die being thrown. It needs
     * to be more of a click."*
     *
     * And the old prompt asked for exactly that, in writing: *"like a
     * fingernail tapping a lacquered board game box"*. A board game box is
     * a hollow wooden container, which is the thing dice are thrown into —
     * so "wooden", "box" and "low" together could only ever produce a
     * rattle. The simile was doing the opposite of its job: it was there to
     * say "warm, not electronic", and it named the object instead of the
     * quality.
     *
     * A click is ONE transient and then nothing. Everything that makes it
     * sound like dice is the stuff after the first millisecond — a bounce,
     * a hollow ring, a second tap. So the prompt now forbids each of those
     * by name, and the trim is the belt to that braces: 0.4s was room for a
     * rattle to happen in, and a click that is still going 180ms later is
     * not a click whatever the model thought it was making.
     */
    prompt: `One single crisp click, like a small plastic switch or a mouse button. One sharp transient and silence after it. Tiny, dry, bright and immediate. No wood, no hollow box, no rattle, no bounce, no roll, no second tap, no ring. ${DRY}`,
    generate: 2,
    seconds: 0.18,
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
    /*
     * It is not only the bin: it also plays for the eraser and for the
     * freeze — three different ways of getting rid of something. Which is
     * part of why the bin's metallic tap was wrong for it.
     */
    what: "a card is thrown away",
    /*
     * Or: *"not related at all. It should be the sound of paper being
     * crumpled, maybe."*
     *
     * The old prompt asked for a flutter and a tap on a metal bin, and the
     * tap is the problem — it is the sound of the BIN, and what the player
     * is doing is destroying a card. Crumpling is the right idea and it is
     * his: it has the paper in it, and it is violent in a small way.
     */
    prompt: `One sheet of paper being crushed into a ball in a fist — dry crumpling and crackling, close and quick, dying away. No tap, no metal, no bin, no impact at the end. ${DRY}`,
    generate: 3,
    seconds: 0.8,
    level: 0.5,
  },
  {
    id: "beep",
    /*
     * This said "each second of the countdown before building" until today,
     * and had not been true since the countdown became a clock — which is
     * half of why the sound was wrong. It is a notification: an invitation
     * arrives, a rematch is offered, somebody says something to you, or you
     * push at a locked door.
     */
    what: "something wants your attention",
    /*
     * Computed — see fanfare.ts. Or: *"not related, needs more 'ting'."*
     *
     * The clip was a muffled wooden temple block, which is a knock. Three
     * bells now, and the one that does the actual work is the top one, too
     * quiet to hear as a note.
     */
    seconds: 0.55,
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
    /*
     * Computed — see fanfare.ts. Or, listening to the generated one:
     * *"something a bit more epic."*
     *
     * It is here rather than at the model for the same reason `win` is: a
     * horn CALL is music. The clip this replaces was one honk with a drum
     * under it, and no sentence was going to turn that into two horns
     * answering each other a fifth apart.
     *
     * The prompt is deliberately gone. While it was here, `pnpm art:sounds`
     * on a fresh clone would have quietly put the honk back.
     */
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
  /*
   * ═══ THE BATTLE ITSELF, AND THE THREE THAT WERE NEVER GENERATED ═══
   *
   * Seventeen sounds in this game and not one of them was a blow, a shot or
   * a card going down: a match played out in silence apart from the clock.
   * These three play dozens of times a match, so the brief is harder than
   * usual — under a third of a second, no tail, no character, nothing
   * anybody could get tired of.
   *
   * They were written as prompts and the prompts were never run. What Or
   * heard, and judged, is the OSCILLATOR version in the client's sfx.ts:
   * `hit` he approved as it stands, and of the other two he said *"it
   * sounds like a thump"* and *"maybe it needs more wind"* — both of which
   * were true of noise through a fixed 900Hz lowpass, which is what all
   * three were. That filter is a parameter now and the two are rebuilt.
   *
   * ⚠ THE PROMPTS ARE GONE ON PURPOSE. Left in place, the next person to
   * run `pnpm art:sounds` on a clone — where nothing in assets/raw exists —
   * would have paid for three clips and silently replaced a sound Or had
   * already signed off, with one he has never heard. That is the same
   * failure as trimming the new victory fanfare back to the old length:
   * a change nobody can hear, in the other direction. The wording is kept
   * below so it costs nothing to change our minds.
   *
   *   hit    A single dull body impact — a padded thud with a little grit
   *          in it, like a mallet into a sandbag. No metal, no ring, no tail.
   *   shoot  A short dry whoosh of something small being thrown hard past
   *          the microphone. Airy, no pitch, no whistle, gone instantly.
   *   die    A short low collapse — a soft thump with a dry crack on top,
   *          like a stack of cards slapped flat. Smaller than an explosion.
   */
  {
    id: "hit",
    what: "a heavy blow lands on a monster",
    // Synthesised, and approved that way. See above before adding a prompt.
    seconds: 0.3,
    level: 0.5,
  },
  {
    id: "shoot",
    what: "a ranged monster looses something",
    // Synthesised. Rebuilt for *"maybe it needs more wind"* — sfx.ts.
    seconds: 0.25,
    level: 0.4,
  },
  {
    id: "die",
    what: "one card goes down mid-battle",
    // Synthesised. Rebuilt for *"it sounds like a thump"* — sfx.ts.
    seconds: 0.4,
    level: 0.55,
  },
  {
    id: "explode",
    /*
     * This has not been "a monster dies" for a while — `die` is that. It is
     * the two biggest moments in the game: the losing board coming down at
     * the end of a match (Arena.tsx, triggerFinale) and a chest finally
     * giving way on the last tap. Both are endings, which is exactly what
     * Or asked it to sound like.
     */
    what: "a board comes down, or a chest gives way",
    /*
     * Or: *"it is not clear what that slurp is. It needs a big, final
     * explosion."*
     *
     * The slurp is in the prompt, in writing: it asked for "a wet thump".
     * Wet was meant to keep it organic and away from an action-film bomb,
     * and instead it is the only thing you can hear. Dry now, and bigger —
     * and allowed to be, because unlike `die` it plays once.
     *
     * "Final" is the harder half, and it is about the END of the sound
     * rather than the start: rubble that stops dead reads as finished,
     * rubble that fades out reads as something still going on offscreen.
     */
    prompt: `One huge final explosion: a sharp crack, then a deep heavy boom, then a short burst of falling rubble that stops dead. Dry, close and enormous. No wet or squelchy sounds, no growl, no slurp, no fade-out. ${DRY}`,
    generate: 4,
    seconds: 1.4,
    level: 0.7,
  },
  {
    id: "win",
    what: "you won",
    /*
     * Computed — see fanfare.ts. Or: *"the win sound and the new-chest sound
     * are really awful."* He picked the trumpets; then, going through every
     * sound in the game: *"needs to be a bit longer and happier."*
     *
     * This number is a CEILING, not a label: the processor trims to it. The
     * new fanfare is 1.9s long and came out of here at 1.35 — the same 16,972
     * bytes as the old one, which is how a change to a sound can be made and
     * heard by nobody.
     */
    seconds: 1.9,
    level: 0.8,
  },
  {
    id: "newcard",
    what: "a card the album has never held",
    /*
     * Its own sound, and that is the point of it. It used to play `win`, so
     * the rarest moment in the game sounded exactly like the commonest one.
     * Bells only, nothing below C5 and no drum at all — weight means a
     * result, and a new card is a surprise.
     */
    seconds: 1.1,
    level: 0.75,
  },
  {
    id: "lose",
    what: "you lost",
    /*
     * Computed — see fanfare.ts. Or: *"needs to be a bit sadder."*
     *
     * Sad is a chord, and the clip had none — it was a slide. A slide is a
     * noise going down; D minor sagging to C minor is a feeling going down,
     * and only one of the two can be asked for by name.
     */
    seconds: 2.2,
    level: 0.8,
  },
];

/** Generate the missing ones (or the named ones) into assets/raw/sfx. */
export async function generateSounds(only: string[]): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const list = (
    only.length ? SOUNDS.filter((s) => only.includes(s.id)) : SOUNDS
  )
    // The computed ones have no prompt and are not the model's to make.
    .filter((s) => s.prompt);
  if (!list.length) {
    console.error(
      `No such sound. Options: ${SOUNDS.map((s) => s.id).join(", ")}`,
    );
    process.exit(1);
  }
  console.log(`\nGenerating ${list.length} sounds\n`);
  for (const spec of list) {
    const dest = join(RAW, `${spec.id}.wav`);
    // Named explicitly means "do it again"; otherwise never pay twice.
    if (!only.length && existsSync(dest)) {
      console.log(`   skip  ${spec.id} (exists)`);
      continue;
    }
    process.stdout.write(
      `   ${spec.id.padEnd(12)} ${spec.what.padEnd(34)} ... `,
    );
    try {
      const url = await sound(spec.prompt!, {
        seconds: spec.generate ?? Math.max(2, Math.ceil(spec.seconds)),
      });
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
    const src = join(RAW, `${spec.id}.wav`);
    if (!existsSync(src)) {
      console.log(`   miss  ${spec.id} (generate it first)`);
      continue;
    }
    /*
     * ⚠ SAY SO WHEN MOST OF A SOUND IS BEING THROWN AWAY.
     *
     * `atrim` below cuts at spec.seconds, and the day a new victory fanfare
     * was built at 1.9s against a spec that still said 1.35, this loop
     * printed "ok win" and wrote the same 16,972 bytes as the day before.
     * A change to a sound that nobody can hear is worse than no change: it
     * is a change you believe you have made.
     *
     * COMPUTED SOUNDS ONLY. A generated clip is asked for long on purpose —
     * the model takes whole seconds and needs somewhere to put the sound —
     * so a 2-second source behind a 0.4s click is the system working. The
     * first version of this warned about all of them, which is eleven lines
     * of noise around the one line that matters, and a warning nobody reads
     * is the same as no warning. fanfare.ts builds to an exact length, so
     * there every hundredth of a second of gap is a mistake.
     */
    if (!spec.prompt) {
      const raw = Number(
        execFileSync(ffprobe(), [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "csv=p=0",
          src,
        ])
          .toString()
          .trim(),
      );
      if (Number.isFinite(raw) && raw - spec.seconds > 0.15) {
        console.log(
          `   ⚠     ${spec.id}: the source is ${raw.toFixed(2)}s and seconds is ` +
            `${spec.seconds} — ${(raw - spec.seconds).toFixed(2)}s is being cut off the end.`,
        );
      }
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
          "afade=t=out:st=" +
            Math.max(0, spec.seconds - 0.05).toFixed(2) +
            ":d=0.05",
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
