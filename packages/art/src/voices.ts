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
import { download, speak, type Accent } from "./fal.js";
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
  /**
   * Not the model's. The clip is built somewhere else and this entry exists
   * only so the card is wired up and the gap tests can see it.
   *
   * ⚠ `generateVoices` REFUSES these. One of them took a recording of Or and
   * Hod singing and spent an afternoon pulling it into tune; `pnpm art:voices
   * siren` would overwrite it with a text-to-speech take of the word "Siren"
   * and nothing would say so until somebody placed the card.
   */
  computed?: { by: string };
  /** A language to lean the phonetics on, for an accent. See fal.ts. */
  accent?: Accent;
  /** Why these three numbers, in one line. */
  why: string;
}


/* ── Amanda herself ─────────────────────────────────────────────────── */
/*
 * ═══ THE OPPONENT GETS A VOICE ═══
 *
 * Or: *"and for Amanda make several random options for the voices, a woman of
 * about 40-50 with a slight Spanish accent."* And then the seven lines, in his
 * own words and in his own order.
 *
 * ⚠ THEY ARE A POOL, NOT A SCRIPT. "Several random options" is what these
 * are: the game picks one when she has something to say, so that meeting her
 * twice is not the same scene twice. See AMANDA_LINES in the client, which is
 * the list it picks from, and `sfx.amanda()`, which picks.
 *
 * ═══ HOW THE ACCENT IS DONE ═══
 *
 * Not by naming a Spanish-accented voice, because there is no way to know
 * from here whether one exists and a guess is a generation paid for a name.
 * `accent: "Spanish"` sets `language_boost` to Spanish over English text,
 * which leans the vowels and consonants that way — which is what an accent
 * is. See fal.ts.
 *
 * ⚠ AND IT IS SEVEN GENERATIONS ON ONE UNTESTED DIAL. If the boost goes too
 * far the model reads the words AS Spanish rather than with a Spanish colour.
 * `pnpm art:voices amanda-iam` makes exactly one of them — listen to that
 * before paying for the other six.
 *
 * ═══ THE AGE, WHICH IS THE PART THE DIALS ACTUALLY DO ═══
 *
 * 40-50 is not a voice in any list; it is a pitch and a tempo. `Wise_Woman`
 * sits lower than `Calm_Woman` to begin with, pitch -2 takes it a little
 * further, and every line is SLOWER than speech — between 0.8 and 0.9. An
 * unhurried voice is an older voice, and it is also the whole character: she
 * is not chasing anybody. She has all evening.
 */
const AMANDA: VoiceSpec[] = [
  {
    id: "amanda-kiddo",
    cardId: "legends_01_amanda",
    says: "Kiddo, <#0.2#> kiddo, <#0.2#> kiddo",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.9,
    emotion: "neutral",
    accent: "Spanish",
    why: "Three times, slowing. Calling a child in from the garden, except for dinner.",
  },
  {
    id: "amanda-iam",
    cardId: "legends_01_amanda",
    says: "I'm Amanda",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.85,
    emotion: "neutral",
    accent: "Spanish",
    why: "Her name, said the way somebody says it who expects you to know it.",
  },
  {
    id: "amanda-name",
    cardId: "legends_01_amanda",
    says: "Amanda",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.8,
    emotion: "happy",
    accent: "Spanish",
    why: "Just the name. The shortest one, for the moment she arrives.",
  },
  {
    id: "amanda-dinner",
    cardId: "legends_01_amanda",
    says: "Dinner is ready",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.85,
    emotion: "happy",
    accent: "Spanish",
    why: "Cheerful, and that is the joke — she means you.",
  },
  {
    id: "amanda-tasty",
    cardId: "legends_01_amanda",
    says: "You look tasty",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.9,
    emotion: "happy",
    accent: "Spanish",
    why: "A compliment, delivered as one.",
  },
  {
    id: "amanda-menu",
    cardId: "legends_01_amanda",
    says: "Oh, <#0.25#> kids menu",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.9,
    emotion: "surprised",
    accent: "Spanish",
    why: "Delighted. The pause before 'kids' is the whole line.",
  },
  {
    id: "amanda-comehere",
    cardId: "legends_01_amanda",
    says: "Come here, <#0.2#> delicious kid",
    voice: "Wise_Woman",
    pitch: -2,
    speed: 0.85,
    emotion: "happy",
    accent: "Spanish",
    why: "Warm and unhurried. Nothing about it is a threat, which is worse.",
  },
];

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
    /*
     * ═══ THE ONE CLIP IN THIS GAME THAT WAS SUNG BY THE PEOPLE MAKING IT ═══
     *
     * Or: *"the Siren — when you place her you should hear an opera song
     * like Sirenaaa Sirenna, twice."* And then, with two voice notes: *"I put
     * you two references where we roughly fake the Siren's melody in our own
     * voices. Make it autotune and a beautiful opera and that will be the
     * sound."*
     *
     * The first answer here was a text-to-speech spec with the vowels
     * stretched, and it was wrong for the reason this project has now met
     * four times: a feeling is music, and music is the one thing that model
     * cannot make. Asked for opera it returns somebody SAYING a word.
     *
     * So this one is neither generated nor synthesised. It is Or and Hod,
     * recorded into a phone, with the pitch of every held note corrected onto
     * a melody measured out of their own two takes — B major, two phrases,
     * each climbing to F#4 and falling, which is exactly the "twice" he asked
     * for. See scripts/make-siren.mjs, which has the measurements, the one
     * musical decision it had to make, and both answers to it.
     *
     * The settings below are what the TTS take USED to be, kept so the
     * record of what she sounded like before is not lost. Nothing reads them
     * while `computed` is set.
     */
    computed: { by: "node scripts/make-siren.mjs" },
    says: "Siren",
    voice: "Wise_Woman",
    pitch: 3,
    speed: 0.75,
    emotion: "happy",
    why: "Or and Hod singing it, pulled into tune. The only sung clip in the game.",
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
  /* ── three more Or named, 9 November 2026 ───────────────────────────── */
  /*
   * Or: *"add a sound that says its name for Torch, for Kioory, Avenging
   * Wasp, Sky King."* Three of the four exist; Kioory is the card he is
   * having me build from the keychain and its spec waits for the card.
   *
   * None of these three is a MAIN, which is the first time that has come up.
   * The precedent is already here — Zelig and the Great Mother Tree speak
   * because they are the biggest card in their family — and the rule it
   * settles is worth writing down: *nothing about "the two you meet a family
   * with" says nobody else may speak.* A card earns a voice by being
   * somebody.
   */
  {
    id: "card-name-torch",
    cardId: "dragons_03_thunderwing",
    says: "Torch",
    /*
     * ⚠ NOT THE FLAME DRAGON AGAIN. That one is this same voice at -5 and
     * 0.9 — big, cross and slow. Torch is the dragon that goes STRAIGHT FOR
     * THE KING (`targeting: "king"`) at three hits a second, so the whole
     * character is speed: barely under natural pitch and faster than speech,
     * one syllable spat out. Two dragons that sound the same would make the
     * family one card.
     */
    voice: "Deep_Voice_Man",
    pitch: -1,
    speed: 1.3,
    emotion: "angry",
    why: "A dragon with one syllable and somewhere to be. Fast, where the Flame Dragon is heavy.",
  },
  {
    id: "card-name-sky-king",
    cardId: "dragons_10_sky_king",
    says: "Sky <#0.15#> King",
    /*
     * ⚠ THE THIRD KING, AND THE THREE ARE TOLD APART BY PITCH ALONE. Titan
     * King is this voice at -6 and the Alley King at -4, so a Sky King at
     * -5 would be the file's own warning come true — one actor reading a
     * list. It goes UP instead: +1 is the only king here that is not
     * underneath you, which is the one thing its name actually says.
     *
     * Slow, because every king in this game is slow. Commanding is a
     * tempo before it is a pitch.
     */
    voice: "Deep_Voice_Man",
    pitch: 1,
    speed: 0.8,
    emotion: "neutral",
    why: "Titan -6 under a mountain, Alley -4 in a street, Sky +1 above the clouds.",
  },
  {
    id: "card-name-avenging-wasp",
    cardId: "insects_07_aggressive_wasp",
    says: "Avenging Wasp",
    /*
     * ⚠ AND NOT THE THORN SPROUT, which is Friendly_Person at +8, 1.3 and
     * angry — a small furious thing, which is also exactly what a wasp is.
     * Same brief, so it needs a different instrument: a woman's voice taken
     * high and run FASTER than anything else in this file.
     *
     * 1.6 is the top end here on purpose. The card attacks once a second —
     * the quickest thing in the game — and it only exists to go after
     * whoever stung it. Anything unhurried would be a different card.
     */
    voice: "Calm_Woman",
    pitch: 7,
    speed: 1.6,
    emotion: "angry",
    why: "The fastest line in the file, for the fastest card in the game. High and personal.",
  },
  {
    id: "card-name-kioory",
    cardId: "furries_02_kioory",
    says: "Kioory",
    /*
     * Or's own spelling of the name, in his own message: *"Kioory"*. Said in
     * English like every other name here, which is the game's answer from an
     * earlier round — a Hebrew card with an English name said out loud is a
     * thing a seven-year-old repeats.
     *
     * ⚠ AND IT HAS TO BE FUNNY-UGLY, NOT FRIGHTENING. The whole card is that
     * looking at it costs you, and a growl would make it a horror — which it
     * is not, and which would also put it next to the Alley King. So: a
     * squashed, nasal, slightly wet voice, gurgled out too slowly. Disgusted
     * is the one emotion in this file used ONCE before, on the Slime, and
     * for the same reason.
     *
     * Not Chuppy's instrument either, although they are family: Chuppy is
     * Friendly_Person at +4 and the brief on him is a list of what he must
     * NOT be. Two Furries that sound alike would make the family one card.
     */
    voice: "Deep_Voice_Man",
    pitch: 5,
    speed: 0.65,
    emotion: "disgusted",
    why: "Squashed, nasal and too slow. Gross on purpose — a laugh, not a scare.",
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
  ...AMANDA,
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
    /*
     * ⚠ SOME CLIPS ARE NOT THIS MODEL'S TO MAKE, and naming one explicitly
     * must not be a way round that. The Siren is Or and Hod singing, pulled
     * into tune by hand; a text-to-speech take of the word would overwrite
     * it and nothing would say so until somebody placed the card.
     */
    if (spec.computed) {
      console.log(`   keep  ${spec.id} — built by \`${spec.computed.by}\`, not by this model`);
      continue;
    }
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
        accent: spec.accent,
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
      /*
       * A backstop, not a trim.
       *
       * ⚠ RAISED FROM 4 TO 6 THE DAY A CARD SANG. Four was chosen when every
       * clip here was somebody saying a name — the longest was the Mother
       * Tree at 4.0s and the comment said nothing should come close. The
       * Siren is 4.64 seconds of the original film recording, three phrases
       * of it, and at 4 the third "Sirena" was simply gone — which is a
       * backstop doing the one thing a backstop must not do.
       */
      "-t", "6",
      "-ac", "1", "-ar", "44100", "-b:a", "96k",
      join(OUT, `${spec.id}.mp3`),
    ]);
    console.log(`   ok    ${spec.id}`);
    done++;
  }
  console.log(`\n${done} names -> ${OUT}\n`);
}
