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
import { execFileSync, spawnSync } from "node:child_process";
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

/** The same, for anything outside this file — voices.ts needs it too. */
export function ffmpegBin(): string {
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

/**
 * The loudest sample in a file, in dBFS. Silence comes back as -91.
 *
 * `volumedetect` prints to STDERR and exits 0, which is why this is a
 * spawnSync rather than the execFileSync every other call here uses.
 */
function peakDb(path: string): number {
  const r = spawnSync(
    ffmpeg(),
    ["-hide_banner", "-i", path, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const m = /max_volume:\s*(-?[\d.]+) dB/.exec(r.stderr ?? "");
  return m ? Number(m[1]) : 0;
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
    /*
     * Or, twice: *"the sound of sticking a card into the album should not
     * sound like a gunshot, it should be much gentler — it is only a card
     * being stuck onto an album. Let's keep the gunshots for the battle."*
     * And then, going through the flow of a single card: *"when you place
     * it, a placing sound — which should not be like a gunshot (what is in
     * the sound desk now) but much gentler."*
     *
     * The old prompt asked for it in as many words: "SLAPPED down flat",
     * "one hit", "PUNCHY". Every one of those is an instruction to make an
     * impact, and the level was 0.75 — louder than the explosion that ends
     * a match, for the commonest gesture in the game, twelve times a build
     * phase.
     *
     * It is the quietest thing a card can do. The weight in a placement
     * comes from the CARD'S OWN voice landing on top of it ninety
     * milliseconds later (cardSound.ts); this only has to say "that is
     * down now", and anything more than that is in the way of the thing it
     * is announcing.
     */
    prompt: `One thin playing card set down gently onto a soft felt table — a quiet brush of paper settling, no snap and no impact at all. Very light, soft, close and brief. No slap, no bang, no knock, no wood, no echo. ${DRY}`,
    generate: 2,
    seconds: 0.35,
    level: 0.45,
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

  /* ── the cards that say something when they land ──────────────────────
   *
   * Or, naming eight of them in one line each: *"make a special sound for
   * Flame Dragon too, the rattle of a breaking egg when you put down the
   * Obsidian Egg, a deep scorched sound for Lava, a deep sound from the
   * depths of the earth for the Father of Giants, an energetic ant soldier,
   * a spiritual high Healing Bloom, the slime slimy and disgusting, a stone
   * golem huge and a bit stupid."*
   *
   * These are not board sounds, they are CARDS. `place` is the card hitting
   * the table and stays exactly as it is; this plays ninety milliseconds
   * later, over the top, and is the creature waking up. Two events, in the
   * order they happen: the thing lands, and then the thing is there.
   *
   * Seven of the eight are EVENTS and go to the model — an egg cracking,
   * rock grinding, something wet. The Healing Bloom is the exception and the
   * reason is the rule this file has been learning all day: "spiritual and
   * high" is not a thing that happens in a room, it is a FEELING, which
   * means it is music, which is the one thing this model cannot do. It is
   * built note by note in fanfare.ts with the other computed ones.
   *
   * `level` is low across all of them on purpose. A card voice that competes
   * with `place` turns every placement into a pile-up, and there are twelve
   * placements in a build phase.
   */
  {
    id: "card-flame-dragon",
    what: "Flame Dragon is put down",
    prompt: `A small fire-breathing dragon: one short guttural roar and a quick burst of flame. Close, dry and immediate. One roar only. No echo, no music, no human voice, no crowd. ${DRY}`,
    generate: 3,
    seconds: 0.95,
    level: 0.45,
  },
  {
    id: "card-obsidian-egg",
    what: "the Obsidian Egg is put down",
    /*
     * His most specific brief of the eight — *"the rattle of a breaking egg
     * when you put down the Obsidian Egg"* — so the prompt is nearly a
     * transcription. The thing to keep OUT is the impact: a thud at the
     * front would be `place` happening twice, and `place` is already playing
     * under this.
     */
    prompt: `A large stone egg cracking: one sharp crisp crack, then fine shell crackling, then a few small fragments settling. Dry, close and quick. No impact thud at the start, no glass, no echo, no music. ${DRY}`,
    generate: 3,
    seconds: 0.85,
    level: 0.5,
  },
  {
    id: "card-lava",
    what: "Lava is put down",
    prompt: `Thick molten lava moving: one deep slow gloop and a scorched sizzling hiss over it. Heavy, close and dry. No water splash, no steam whistle, no boiling kettle, no music. ${DRY}`,
    generate: 3,
    seconds: 1.1,
    level: 0.45,
  },
  {
    id: "card-titan-king",
    what: "the Father of Giants is put down",
    /*
     * *"A deep sound from the depths of the earth."* The hard part is that
     * "from the depths" is normally bought with reverb, and reverb is the
     * one thing every prompt in this file spends its last sentence
     * forbidding — a game sound with a tail is a nuisance by the tenth time
     * you hear it. So the depth has to come from the SOURCE being low and
     * enormous rather than from the room being large, which is why the
     * prompt says "close" and "enormous" in the same breath.
     */
    prompt: `A deep subterranean rumble from far underground: a low groaning earth movement with rock shifting inside it, enormous and slow. Close and dry despite its size. No explosion, no thunder, no echo, no music. ${DRY}`,
    generate: 4,
    seconds: 1.3,
    level: 0.5,
  },
  {
    id: "card-ant-soldier",
    what: "the Ant Soldier is put down",
    /*
     * ⚠ THIS ONE CAME BACK EMPTY THE FIRST TIME, and it is worth saying why
     * rather than just trying again.
     *
     * The first prompt asked for "a small insect soldier" and the model
     * returned two seconds of silence — an honest answer, in its way, since
     * an insect soldier is not a thing that makes a sound. Of the eight
     * cards, this was the only brief that named a CHARACTER instead of a
     * physical event; the egg cracks, the rock grinds, the slime squelches,
     * and this one was asked to be a rank.
     *
     * So it names the movement instead. "Energetic" survives as the only
     * adjective, because it is about the tempo of the skittering, which is
     * something the model can actually do.
     */
    prompt: `Many small hard insect legs skittering very fast across a stone floor, with dry clicking and scratching as they go. Brisk, busy and close. No wing buzz, no echo, no music. ${DRY}`,
    generate: 3,
    seconds: 0.6,
    level: 0.4,
  },
  {
    id: "card-slime",
    what: "the Slime is put down",
    /*
     * The wet, slurping quality that was wrong for `explode` is exactly
     * right here. It is the same note from the other side: *"it is not
     * clear what that slurp is"* about a board collapsing, and *"slimy and
     * disgusting"* about a slime. The sound was never bad; it was in the
     * wrong place.
     */
    prompt: `A wet gelatinous blob: one thick slimy squelch and a sticky peel after it. Gooey, close and unpleasant. No water splash, no footsteps in mud, no echo, no music. ${DRY}`,
    generate: 2,
    seconds: 0.7,
    level: 0.45,
  },
  {
    id: "card-stone-golem",
    what: "the Stone Golem is put down",
    /*
     * *"Huge and a bit stupid."* Huge is the easy half and the prompt can
     * ask for it. Stupid is TIMING, and no prompt gets it: it is a second
     * footfall arriving a beat later than it should, which is why the trim
     * here is generous rather than tight. A golem that finishes briskly is
     * a competent golem.
     */
    prompt: `A huge stone body moving: heavy grinding rock, one slow lumbering step, and a few loose pebbles falling afterwards. Massive, clumsy and unhurried. Close and dry. No explosion, no echo, no music. ${DRY}`,
    generate: 3,
    seconds: 1.15,
    level: 0.5,
  },
  {
    id: "card-healing-bloom",
    what: "the Healing Bloom is put down",
    /*
     * Computed — see fanfare.ts. *"Spiritual and high."*
     *
     * The only one of the eight with no prompt, and the reason is the same
     * one that cost this file two generated error-sounds earlier: every
     * clause Or has ever written asking for a FEELING turned out to be
     * music. Epic, sad, a ting, and now spiritual. The other seven are
     * things that happen — an egg, a rock, a slurp — and those are the
     * model's.
     */
    seconds: 1.3,
    level: 0.4,
  },

  /* ── the ingredients a drag is mixed from ─────────────────────────────
   *
   * Or, after hearing the eight: *"the sound that is now in the 'cards that
   * say something' category is pretty much the sound cards should make when
   * you DRAG them. The egg specifically. But Flame Dragon with a wingbeat
   * would suit all the dragons. The Father of Giants with a bit of rubbing
   * stones would suit the giants. You can make combinations — flame +
   * wings = Flame Dragon, wings + cracking ice = Ice Dragon, different
   * levels of flame + wings give different dragons. Do them all like that."*
   *
   * Which is a better idea than the one it replaces, and it is the
   * difference between fifty-two clips and eight. A card's drag sound is
   * MIXED at the moment it is picked up, out of layers chosen by what the
   * card already says it is — it flies, it is made of fire, it is a slime —
   * with the levels set by how big it is. Nothing here is written per card.
   *
   * They are longer than every other sound in this file and that is on
   * purpose: they LOOP for as long as a finger is down, so each one has to
   * be a continuous texture with no shape of its own. Anything with a
   * beginning in it announces itself every two seconds.
   *
   * Wings are two ingredients, not one. Or: *"the wings you made suit
   * insects, but dragons will of course need different wings (which also
   * sound different from insect wings)."*
   */
  {
    id: "ing-wings-dragon",
    what: "a dragon's wings, while it is carried",
    prompt: `Two or three slow heavy leathery wingbeats of a very large creature — a deep whoomph of displaced air on each downstroke, unhurried and powerful. Close and dry. No bird chirps, no cloth flapping, no wind howl, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-wings-insect",
    what: "an insect's wings, while it is carried",
    prompt: `Fast papery insect wings beating continuously, a dry thin whirr very close to the microphone. Light and quick and steady. No deep whoomph, no bee buzz melody, no wind, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-flame",
    what: "fire, while it is carried",
    prompt: `A steady close flame burning — low roaring and soft crackling, continuous and even. No explosion, no fire alarm, no sizzling water, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-ice",
    what: "ice, while it is carried",
    prompt: `Ice creaking and cracking slowly under pressure — dry brittle crackles and a low groan, continuous. No water, no splash, no glass smashing, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-stone",
    what: "stone, while it is carried",
    prompt: `Two heavy stone surfaces rubbing and grinding slowly against each other, with loose grit between them. Continuous, low and rough. No impact, no explosion, no echo, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-slime",
    what: "something wet, while it is carried",
    prompt: `A thick wet gelatinous mass shifting and squelching slowly and continuously. Gooey and sticky and close. No water splash, no footsteps, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-spark",
    what: "electricity, while it is carried",
    prompt: `A continuous close electrical crackle and fizz, like current arcing across a small gap. Dry and bright and constant. No thunder, no explosion, no machine hum, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-skitter",
    what: "many small legs, while it is carried",
    prompt: `Many small hard insect legs skittering continuously over stone, dry clicking and scratching without pause. Light, busy and close. No wing buzz, no echo, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  /*
   * ═══ TEN MORE INGREDIENTS ═══
   *
   * Or: *"and you need to invent another ten sounds and ten animations."*
   *
   * The ten animations cost nothing and shipped with the request. These cost
   * money and are therefore his to start — `pnpm art:sounds` makes only what
   * is missing, so running it with these added makes exactly these ten.
   *
   * They are chosen to be the things the eight above CANNOT be mixed into.
   * The mixer already covers fire, ice, stone, slime, electricity, skittering
   * and two kinds of wing; what it has no way to say is wind, water, machinery,
   * a voice, or anything with a pulse. Every one below is a texture that loops
   * — the same brief as the eight: short, dry, close, continuous, no music and
   * no room.
   */
  {
    id: "ing-wind",
    what: "wind, while it is carried",
    prompt: `A steady close wind rushing past, continuous and even with no gusts. Airy and dry and constant. No howling, no whistling through gaps, no leaves, no rain, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-bubbles",
    what: "water, while it is carried",
    prompt: `Continuous small bubbles rising through water very close to the microphone — soft wet blips and gurgles without pause. No splashing, no pouring, no drain, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-gears",
    what: "machinery, while it is carried",
    prompt: `Small metal gears turning continuously — a dry mechanical clicking and ratcheting, close and even. No engine, no motor hum, no clock tick melody, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-steam",
    what: "steam, while it is carried",
    prompt: `A continuous close hiss of escaping steam under pressure, even and unbroken. Dry and white and constant. No kettle whistle, no explosion, no water, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-leaves",
    what: "leaves, while it is carried",
    prompt: `Dry leaves rustling continuously very close to the microphone, a light papery shuffling without pause. No footsteps, no wind, no branches breaking, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-sand",
    what: "sand, while it is carried",
    prompt: `Fine dry sand pouring continuously onto sand, a soft grainy hiss very close. Even and unbroken. No wind, no water, no footsteps, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-growl",
    what: "a low growl, while it is carried",
    prompt: `A low continuous animal growl deep in the throat, rumbling and even, close to the microphone. Threatening but quiet. No roar, no bark, no human voice, no words, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-chains",
    what: "chains, while it is carried",
    prompt: `Heavy iron chain links dragging and clinking continuously, dull metal on metal, close and dry. No bell, no keys, no sword, no echo, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-heartbeat",
    what: "a heartbeat, while it is carried",
    prompt: `A slow steady heartbeat, two dull low thumps per beat, close and muffled as if heard through a chest. Even tempo, no acceleration. No drum kit, no bass line, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
  },
  {
    id: "ing-magic",
    what: "magic, while it is carried",
    prompt: `A continuous soft shimmering magical hum, high and airy with a faint glassy sparkle, even and unbroken. No melody, no notes, no chord, no choir, no music. ${DRY}`,
    generate: 4,
    seconds: 2.2,
    level: 0.5,
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
    /*
     * ⚠ AND SAY SO WHEN THERE IS NO SOUND IN IT AT ALL.
     *
     * The model answered the Ant Soldier with two seconds of silence — a
     * perfectly valid 352,878-byte wav whose loudest sample was -63.5dBFS.
     * Nothing downstream noticed: `loudnorm` dutifully normalised the noise
     * floor, ffmpeg wrote a 358-byte mp3 that is not decodable, and this
     * loop printed "ok card-ant-soldier" and moved on. The first I knew of
     * it was a file listing.
     *
     * A generation that comes back empty is not rare enough to find by
     * accident, and it is invisible at every single stage unless something
     * asks. -45dBFS is far below anything deliberate and far above a true
     * noise floor, so there is no judgement in the threshold.
     *
     * This one applies to computed sounds too: a fanfare that renders
     * silent is a bug in the builder, and the same line catches it.
     */
    const loudest = peakDb(src);
    if (loudest < -45) {
      console.log(
        `   ⚠     ${spec.id}: the source peaks at ${loudest.toFixed(1)}dBFS — there is ` +
          `no sound in it. ${spec.prompt ? "Generate it again." : "The builder produced silence."}`,
      );
    }

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
