/**
 * The cards that say their own name.
 *
 *   pnpm art:voices                 make the ones that are missing
 *   pnpm art:voices flame-dragon    make that one again
 *
 * Or: *"those specific ones should also say their name in their own special
 * voice when you press them."* Tapping a card picks it up; this is what it
 * says as it comes up, before the drag sound and long before it lands.
 *
 * ═══ WHY THIS IS NOT IN sounds.ts ═══
 *
 * Different model, opposite instruction. Every prompt in sounds.ts ends with
 * "no voice", because a human noise inside a card-placing sound is a fault
 * to be designed out. Keeping speech in the same file as that rule would be
 * asking somebody to break it eventually.
 *
 * ═══ THE SETTINGS ARE THE CHARACTER ═══
 *
 * Twenty cards saying twenty names in the default voice is one actor reading
 * a list, and it would make every card sound like the same card — worse than
 * saying nothing. So each line below moves three dials: a voice, a pitch
 * (-12 to +12) and a speed (0.5 to 2). Those three are the whole brief.
 *
 * The names are said in ENGLISH, which is the game's own answer from an
 * earlier round: a Hebrew card with an English name said out loud is a thing
 * a seven-year-old repeats.
 */
import { existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { download, speak } from "./fal.js";
import { REPO_ROOT } from "./catalog.js";
import { ffmpegBin } from "./sounds.js";

const RAW = join(REPO_ROOT, "assets", "raw", "voices");
const OUT = join(REPO_ROOT, "apps", "client", "public", "sfx");

export interface VoiceSpec {
  /** The clip, and the file: `card-name-<id>.mp3`. */
  id: string;
  /** Which card it belongs to — for the table in the client. */
  cardId: string;
  /** What it says. */
  says: string;
  /** A MiniMax voice id. */
  voice: string;
  /** -12 to +12. Down for anything enormous. */
  pitch?: number;
  /** 0.5 to 2. Slow is heavy, and slow is also slow-witted. */
  speed?: number;
  emotion?: "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised" | "neutral";
  /** Why these three numbers, in one line. */
  why: string;
}

export const VOICES: VoiceSpec[] = [
  {
    id: "card-name-flame-dragon",
    cardId: "dragons_01_flame_dragon",
    says: "Flame Dragon",
    voice: "Deep_Voice_Man",
    pitch: -5,
    speed: 0.9,
    emotion: "angry",
    why: "A dragon is big and cross. Low, and a little slower than speech.",
  },
  {
    id: "card-name-obsidian-egg",
    cardId: "dragons_02_obsidian_egg",
    says: "Obsidian Egg",
    voice: "Calm_Woman",
    pitch: 3,
    speed: 0.85,
    emotion: "neutral",
    why: "Something unhatched: quiet, careful, and not yet anything.",
  },
  {
    id: "card-name-lava",
    cardId: "dragons_04_lava",
    says: "Lava",
    voice: "Deep_Voice_Man",
    pitch: -7,
    speed: 0.7,
    why: "The lowest and slowest of them. Lava does not hurry.",
  },
  {
    id: "card-name-titan-king",
    cardId: "giants_10_titan_king",
    /*
     * Or: *"and Titan King is not clear, it sounds like Titan Ching —
     * clear it up a bit."*
     *
     * Pitch -9 at speed 0.75 was the problem and the two compound: dropping
     * a voice nine semitones moves its formants down with it, and a hard K
     * lives entirely in the formants. Said slowly on top of that, the two
     * words run together and "n K" comes out as one soft sound.
     *
     * Three small corrections rather than one big one, so he stays the
     * deepest card in the game: up to -6, a little quicker at 0.85, and a
     * 0.15s pause between the words — `<#x#>` is this model's pause marker.
     * The gap is what actually fixes it. A consonant at the START of a word
     * is articulated; the same consonant swallowed into the end of the word
     * before it is not.
     */
    says: "Titan <#0.15#> King",
    voice: "Deep_Voice_Man",
    pitch: -6,
    speed: 0.85,
    emotion: "neutral",
    why: "Still the deepest, and now with a beat before King so the K lands.",
  },
  {
    id: "card-name-ant-soldier",
    cardId: "insects_01_ant_soldier",
    says: "Ant Soldier",
    voice: "Friendly_Person",
    pitch: 7,
    speed: 1.45,
    emotion: "happy",
    why: "Small, quick and eager. The only one that talks faster than normal.",
  },
  {
    id: "card-name-healing-bloom",
    cardId: "plants_03_healing_bloom",
    says: "Healing Bloom",
    voice: "Calm_Woman",
    pitch: 4,
    // Or: "even more airy and spiritual and drawn out". Drawn out is the
    // speed, and 0.6 is as slow as this model goes before it slurs.
    speed: 0.6,
    emotion: "neutral",
    why: "The slowest and highest of the gentle ones — airy is mostly SLOW.",
  },
  {
    id: "card-name-slime",
    cardId: "slimes_01_basic_slime",
    says: "Slime",
    voice: "Deep_Voice_Man",
    // Or: "more revolting and disgusting, as if it has spit in its mouth."
    // Lower and slower is a thicker mouth; the disgust was already there and
    // was being spoken by too clean a voice to land.
    pitch: -7,
    speed: 0.6,
    emotion: "disgusted",
    why: "Low, slow and disgusted — a mouth too full to say its own name.",
  },
  {
    id: "card-name-stone-golem",
    cardId: "giants_01_stone_colossus",
    says: "Stone Golem",
    voice: "Deep_Voice_Man",
    pitch: -6,
    speed: 0.6,
    emotion: "neutral",
    why: "Huge and a bit stupid — and stupid is the SPEED. 0.6 is as slow as it goes.",
  },
  {
    /*
     * ⚠ THE ONE WITH A CONSTRAINT INSTEAD OF A DESCRIPTION.
     *
     * Or: *"Chuppy is too similar to Pikachu — he electrifies, he is yellow,
     * and even the name is close. So at least let his voice be far from
     * Pikachu (but still cute)."*
     *
     * Which rules out the obvious answer. "Cute electric creature" in a high
     * squeaky yelp IS the thing being avoided, so cute has to come from
     * somewhere else: a warm, friendly, ordinary voice, only a little above
     * its natural pitch, talking at an unhurried pace. Small and friendly
     * rather than small and shrill — a toddler rather than a cartoon mouse.
     *
     * Deliberately the least processed voice of the eleven. Everything that
     * would make it sound "electric" is the thing to stay away from.
     */
    id: "card-name-chuppy",
    cardId: "furries_01_chuppy",
    /*
     * Or: *"Chuppy is with a U — Choopy."*
     *
     * The text IS the pronunciation guide here: nothing else is sent to the
     * model. "Chuppy" is read with the vowel in "cup", which is the wrong
     * animal entirely; "Choopy" is read with the vowel in "boot", which is
     * the name as it is said in Hebrew. The card's English name in the
     * catalogue is a separate question and his to answer.
     */
    says: "Choopy",
    voice: "Friendly_Person",
    pitch: 4,
    speed: 0.95,
    emotion: "happy",
    why: "Cute by being warm and unhurried, not by being high and fast. See above.",
  },
  {
    id: "card-name-zelig",
    cardId: "slimes_10_zelig_giant_ooze",
    says: "Zelig the Giant",
    voice: "Deep_Voice_Man",
    pitch: -8,
    speed: 0.7,
    why: "Or asked for Zelig deep, back when the drag voices were first described.",
  },
  {
    id: "card-name-mother-tree",
    cardId: "plants_10_great_mother_tree",
    says: "Great Mother Tree",
    voice: "Wise_Woman",
    // Or: "much older and creakier". Both of those are the same two dials
    // pushed much further than the first attempt dared.
    pitch: -7,
    speed: 0.55,
    emotion: "sad",
    why: "Old wood: as low and as slow as the model goes, and sad rather than wise.",
  },

  /* ═══ THE NINE MAINS WITH NO RECORDING YET ═══
   *
   * Or: *"pick which 2 from each series are the main ones, that are the
   * first ones you get, and that also say their own name when you tap them,
   * in a fitting voice."* The two per family are chosen in
   * packages/shared/src/mains.ts; eleven of the twenty already had a clip,
   * and these are the nine that did not.
   *
   * ⚠ WRITTEN BUT NOT RUN. `pnpm art:voices` skips anything already in
   * assets/raw/voices, so one run makes exactly these nine — and that run
   * spends Or's fal.ai credit, so it is his to start, not mine.
   *
   * ═══ FOUR VOICES, NINE CHARACTERS ═══
   *
   * Every id below is one of the four this project has already paid for and
   * heard. Reaching for an unproven MiniMax voice would risk nine failed
   * calls to find out a name was spelled wrong, and the file already says
   * where the character actually comes from: the three dials. A Calm Woman
   * nine semitones up at one and a half speed is not a calm woman.
   */
  {
    id: "card-name-boltling",
    cardId: "machines_01_boltling",
    says: "Boltling",
    voice: "Calm_Woman",
    pitch: 9,
    speed: 1.5,
    emotion: "surprised",
    why: "A screw with legs: the highest and quickest card, startled to be here.",
  },
  {
    id: "card-name-mandroid",
    cardId: "machines_06_mandroid",
    says: "Mandroid",
    voice: "Deep_Voice_Man",
    pitch: -2,
    speed: 1,
    emotion: "neutral",
    why: "A machine doing an impression of a man — every dial left exactly flat.",
  },
  {
    id: "card-name-jellyfish",
    cardId: "sea_02_jellyfish",
    says: "Jellyfish",
    voice: "Calm_Woman",
    pitch: 6,
    speed: 0.7,
    emotion: "neutral",
    why: "No bones and nowhere to be. High and slow is a thing that drifts.",
  },
  {
    /*
     * The one card in the game whose voice is what it DOES — a siren sings
     * you onto the rocks. So it is the only one here that is pleasant on
     * purpose, and the trap is overdoing it: shrill is a warning, and a
     * warning is the opposite of a lure.
     */
    id: "card-name-siren",
    cardId: "sea_07_siren",
    says: "Siren",
    voice: "Wise_Woman",
    pitch: 3,
    speed: 0.75,
    emotion: "happy",
    why: "Warm, unhurried and a little too pleased to see you.",
  },
  {
    id: "card-name-iron-bulwark",
    cardId: "giants_07_iron_bulwark",
    says: "Iron Bulwark",
    voice: "Deep_Voice_Man",
    pitch: -8,
    speed: 0.75,
    emotion: "neutral",
    why: "Two tons of door. Lower than the Stone Golem and not as slow-witted.",
  },
  {
    id: "card-name-alley-king",
    cardId: "demons_01_alley_king",
    says: "The Alley King",
    voice: "Deep_Voice_Man",
    pitch: -4,
    speed: 0.95,
    emotion: "angry",
    why: "Not big — dangerous. Quicker and less deep than the giants, and cross.",
  },
  {
    id: "card-name-ant-queen",
    cardId: "insects_02_ant_queen",
    says: "Ant Queen",
    voice: "Wise_Woman",
    pitch: 0,
    speed: 0.85,
    emotion: "neutral",
    why: "The one insect that does not hurry, said against a soldier who does.",
  },
  {
    id: "card-name-thorn-sprout",
    cardId: "plants_01_thorn_sprout",
    says: "Thorn Sprout",
    voice: "Friendly_Person",
    pitch: 8,
    speed: 1.3,
    emotion: "angry",
    why: "A very small plant that is very annoyed — the Healing Bloom inverted.",
  },
  {
    id: "card-name-thing-in-the-bin",
    cardId: "slimes_11_thing_in_the_bin",
    says: "The Thing <#0.15#> in the Bin",
    voice: "Deep_Voice_Man",
    pitch: -4,
    speed: 0.85,
    emotion: "surprised",
    /*
     * The pause is the Titan King fix again: five words at 0.85 run into one
     * another, and "Thing in" is exactly the join that disappears.
     */
    why: "Something that lives in a bin and did not expect the lid to come off.",
  },
];

/** Say the missing ones (or the named ones) into assets/raw/voices. */
export async function generateVoices(only: string[]): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  const list = only.length
    ? VOICES.filter((v) => only.some((o) => v.id.includes(o)))
    : VOICES;
  if (!list.length) {
    console.error(`No such voice. Options: ${VOICES.map((v) => v.id).join(", ")}`);
    process.exit(1);
  }
  console.log(`\nSaying ${list.length} names\n`);
  for (const spec of list) {
    const dest = join(RAW, `${spec.id}.mp3`);
    // Named explicitly means "do it again"; otherwise never pay twice.
    if (!only.length && existsSync(dest)) {
      console.log(`   skip  ${spec.says} (exists)`);
      continue;
    }
    process.stdout.write(`   ${spec.says.padEnd(20)} ${spec.voice.padEnd(16)} ... `);
    try {
      const url = await speak(spec.says, {
        id: spec.voice,
        pitch: spec.pitch,
        speed: spec.speed,
        emotion: spec.emotion,
      });
      if (!url) throw new Error("no audio returned");
      await download(url, dest);
      console.log("OK");
    } catch (err) {
      /*
       * fal rejects a bad input shape with "Unprocessable Entity" and puts
       * the ACTUAL complaint — which field, and why — in `body.detail`. The
       * message alone says nothing, and eleven identical nothings is how an
       * afternoon goes missing.
       */
      const detail = (err as { body?: { detail?: unknown } }).body?.detail;
      console.log(`FAIL ${(err as Error).message}`);
      if (detail) console.log(`         ${JSON.stringify(detail)}`);
    }
  }
  console.log(`\nDone -> assets/raw/voices/  (run art:voices-process next)\n`);
}

/**
 * Trim and level them into the client.
 *
 * The same three jobs as processSounds: cut the silence at the head so the
 * card answers the tap rather than lagging behind it, level everything to
 * one loudness so a name is not louder than the card landing, and fade the
 * end so nothing clicks.
 *
 * A name is quieter than an effect on purpose. It plays on every tap, which
 * is the commonest gesture in the game.
 */
export function processVoices(): void {
  mkdirSync(OUT, { recursive: true });
  const bin = ffmpegBin();
  let done = 0;
  for (const spec of VOICES) {
    const src = join(RAW, `${spec.id}.mp3`);
    if (!existsSync(src)) {
      console.log(`   miss  ${spec.id} (say it first)`);
      continue;
    }
    /*
     * ⚠ TRIMMED BY SILENCE, NOT BY THE CLOCK.
     *
     * The first version of this cut every clip at a flat `-t 1.5`, which is
     * the same mistake the victory fanfare made when it was built at 1.9s
     * against a spec that still said 1.35 — a number written once, against
     * material that then changed underneath it.
     *
     * And it changed the moment Or asked for slower voices. Measured, the
     * raws run 1.37s (Flame Dragon) to 4.0s (the Mother Tree at speed 0.55),
     * so a 1.5s guillotine was taking the end off the slowest four — which
     * would have cut the K off "Titan King" in the very take that existed to
     * put it back.
     *
     * So both ends are found rather than assumed. The tail is trimmed by
     * REVERSING the audio, cutting the silence that is now at the front, and
     * reversing back — and the fade rides along with it: `afade=t=in` while
     * reversed is a fade-OUT on the real end, which is how you fade the end
     * of a clip whose length you do not know yet.
     *
     * The internal pause survives all of this, because `start_periods=1`
     * only ever cuts the silence at the front. The 0.15s beat inside "Titan
     * King" is the whole reason that take works.
     */
    const trimHead = "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB";
    execFileSync(bin, [
      "-y", "-v", "error", "-i", src,
      "-af",
      [
        trimHead,
        "areverse",
        trimHead,
        "afade=t=in:st=0:d=0.08",
        "areverse",
        "loudnorm=I=-18:TP=-1.5:LRA=11",
      ].join(","),
      // A backstop, not a trim: nothing here should come close to it.
      "-t", "4",
      "-ac", "1", "-ar", "44100", "-b:a", "96k",
      join(OUT, `${spec.id}.mp3`),
    ]);
    console.log(`   ok    ${spec.id}`);
    done++;
  }
  console.log(`\n${done} names -> ${OUT}\n`);
}
