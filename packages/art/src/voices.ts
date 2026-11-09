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
import { changeVoice, download, speak, speakEleven, type Accent } from "./fal.js";
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
  /**
   * Which service says it. MiniMax unless stated.
   *
   * ⚠ AND THE TWO DO NOT SHARE A SYNTAX. MiniMax takes `<#0.2#>` for a
   * pause and a pitch in semitones; ElevenLabs has never heard of either and
   * takes punctuation and a stability instead. A spec written for one and
   * handed to the other does not fail — it reads the markup out loud.
   */
  engine?: "minimax" | "eleven";
  /** ElevenLabs only: 0-1, how expressive. Low varies between takes. */
  stability?: number;
  /** ElevenLabs only: 0-1, how hard it holds the voice's character. */
  similarity?: number;
  /**
   * A recording of somebody SAYING the line, to be re-voiced rather than
   * re-invented.
   *
   * Or: *"everything is fine except Kiddo Kiddo Kiddo. I have put a reference
   * for the intonation. Run it through ElevenLabs."* Relative to
   * `assets/reference/`. When this is set, `says` is no longer the input —
   * it is only there so the table still reads as a list of what she says.
   *
   * ⚠ WHICH MAKES IT THE ONE SPEC THAT IS NOT REPRODUCIBLE FROM CODE. Every
   * other line here can be regenerated from this file alone; this one needs
   * the wav beside it. That is the trade for being able to specify a
   * delivery at all, and the reference is committed for exactly that reason.
   */
  perform?: string;
  /** Why these three numbers, in one line. */
  why: string;
}


/**
 * ═══ WHICH VOICE AMANDA IS, AND WHY IT IS A CONSTANT ═══
 *
 * Or: *"anyway let's use ElevenLabs — Lucia, or Tosca."*
 *
 * ⚠ NEITHER NAME WORKS THROUGH FAL, AND THAT WAS CHECKED RATHER THAN
 * ASSUMED. The endpoint answers 422 `"Voice not found: Lucia"`, and the same
 * for Tosca, Valentina, Sofia, Carmen, Isabella, Martina, Camila and
 * Paulina — while "Rachel" generates. So fal exposes a small set of BUILT-IN
 * voices by name, and not one of them is Spanish.
 *
 * But `Lucía`, spelled with the accent, failed DIFFERENTLY: `"Invalid voice
 * ID provided."` A different error means an unrecognised string is passed
 * through to ElevenLabs as a voice id rather than rejected — so raw ids work,
 * and two real ones prove it: 21m00Tcm4TlvDq8ikWAM (Rachel) and
 * XB0fDUnXU5powFXDhCwa (Charlotte) both generate.
 *
 * Which makes Lucia and Tosca reachable after all. They are VOICE LIBRARY
 * voices, and a library voice's id exists only inside an ElevenLabs account:
 * app → Voices → Voice Library → search the name → copy the id, about twenty
 * characters. Paste it here and run `pnpm art:voices amanda`. Nothing else
 * changes.
 *
 * Until then it is Charlotte — a real voice, a woman rather than a girl, and
 * not American, which is the nearest the built-in set gets. She is NOT
 * Spanish, and that is the one thing still missing.
 */
const AMANDA_VOICE = "XB0fDUnXU5powFXDhCwa";

/* ── Amanda herself ─────────────────────────────────────────────────── */
/*
 * ═══ THE OPPONENT GETS A VOICE ═══
 *
 * Or: *"and for Amanda make several random options for the voices, a woman
 * of about 40-50 with a slight Spanish accent"* — and then the seven lines,
 * in his own words and in his own order.
 *
 * ⚠ THEY ARE A POOL, NOT A SCRIPT. "Several random options" is what these
 * are: the game picks one when she has something to say, so that meeting her
 * twice is not the same scene twice. See AMANDA_LINES in the client, which is
 * the list it picks from, and `sfx.amanda()`, which picks.
 *
 * ═══ WHY THEY WERE REWRITTEN FOR THE SECOND ENGINE ═══
 *
 * Or, having heard the MiniMax takes: *"Kiddo Kiddo Kiddo did not come out
 * well, and Come here is not good either. The rest are fine."*
 *
 * Measured, those two were the LONGEST of the seven — 4.37s for three words
 * and 3.69s — against 1.56s for the one he liked best. Both were the ones
 * carrying `<#0.2#>` pause markers on top of a speed below 1. Stretched into
 * a dirge, in other words, by two dials pulling the same way.
 *
 * ⚠ AND THOSE MARKERS ARE MINIMAX'S OWN SYNTAX. ElevenLabs has never heard
 * of them and would read them out or choke; pauses here are PUNCTUATION. So
 * every line is punctuated rather than marked up, and nothing is slowed —
 * the age comes from the voice, not from dragging the words out.
 */
const AMANDA: VoiceSpec[] = [
  {
    id: "amanda-kiddo",
    cardId: "legends_01_amanda",
    says: "Kiddo. Kiddo. Kiddo.",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    /*
     * ⚠ THE ONLY LINE IN THIS FILE THAT IS A PERFORMANCE RATHER THAN A
     * PROMPT, and it took three rejections to get here. MiniMax stretched it
     * to 4.37 seconds for three words; ElevenLabs tightened it to 1.89 and
     * Or still said *"everything is fine except Kiddo Kiddo Kiddo."*
     *
     * Which was the answer: the argument was never about the voice, it was
     * about the PHRASING — where the stress falls, how long the gaps are,
     * which of the three climbs. None of that is a parameter on any
     * text-to-speech model. So he recorded it, and the voice changer keeps
     * his delivery and swaps in hers.
     *
     * `says` below is now only documentation. The input is the wav.
     */
    perform: "amanda-kiddo-reference.mp3",
    speed: 1.0,
    why: "Or's own delivery, re-voiced. Three takes argued about phrasing; this one is given it.",
  },
  {
    id: "amanda-iam",
    cardId: "legends_01_amanda",
    says: "I'm Amanda.",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    speed: 0.95,
    why: "Her name, said by somebody who expects you to know it already.",
  },
  {
    id: "amanda-name",
    cardId: "legends_01_amanda",
    says: "Amanda.",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    speed: 0.92,
    why: "Just the name. The shortest one, for the moment she arrives.",
  },
  {
    id: "amanda-dinner",
    cardId: "legends_01_amanda",
    says: "Dinner is ready!",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    speed: 1.0,
    why: "Cheerful, and that is the joke — she means you. The best of the seven at 1.56s.",
  },
  {
    id: "amanda-tasty",
    cardId: "legends_01_amanda",
    says: "You look tasty.",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    speed: 0.95,
    why: "A compliment, delivered as one.",
  },
  {
    id: "amanda-menu",
    cardId: "legends_01_amanda",
    says: "Oh! A kids menu.",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    speed: 0.95,
    why: "Delighted. The break after Oh is the whole line, and a full stop does it.",
  },
  {
    id: "amanda-comehere",
    cardId: "legends_01_amanda",
    says: "Come here, delicious kid.",
    engine: "eleven",
    voice: AMANDA_VOICE,
    stability: 0.42,
    similarity: 0.85,
    speed: 0.95,
    why: "One comma and normal speed. A woman calling a child does not draw it out.",
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
    const where = spec.engine === "eleven" ? "eleven" : "minimax";
    process.stdout.write(
      `   ${spec.says.slice(0, 24).padEnd(26)} ${where.padEnd(8)} ${spec.voice.slice(0, 20).padEnd(21)} ... `,
    );
    try {
      /*
       * Two services, and the spec says which. Not a flag that changes a
       * parameter — a different API with different field names, a different
       * pause syntax and a different idea of what `speed` ranges over. See
       * `engine` on VoiceSpec.
       */
      const url = spec.perform
        ? /*
           * A performance, re-voiced. Not generated from the words at all —
           * see `perform`, and changeVoice in fal.ts.
           */
          await changeVoice(join(REPO_ROOT, "assets", "reference", spec.perform), spec.voice)
        : spec.engine === "eleven"
          ? await speakEleven(spec.says, {
              id: spec.voice,
              stability: spec.stability,
              similarity: spec.similarity,
              speed: spec.speed,
            })
          : await speak(spec.says, {
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
