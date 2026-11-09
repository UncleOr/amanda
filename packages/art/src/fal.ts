import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fal } from "@fal-ai/client";
import { config as loadEnv } from "dotenv";

// The CLI runs from packages/art, but .env lives at the repo root.
loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".env") });

/** The aspect ratios the model accepts. */
type AspectRatio =
  | "auto" | "21:9" | "16:9" | "3:2" | "4:3" | "5:4"
  | "1:1" | "4:5" | "3:4" | "2:3" | "9:16";

const MODEL = "fal-ai/nano-banana-pro";
const EDIT_MODEL = "fal-ai/nano-banana-pro/edit";

if (!process.env.FAL_KEY) {
  console.error(
    "\n❌ FAL_KEY is missing.\n" +
      "   Create a .env file in the repo root containing:\n" +
      "     FAL_KEY=your_key_here\n" +
      "   (.env is git-ignored — the key never leaves your machine.)\n",
  );
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

interface FalImage {
  url: string;
}
interface FalResult {
  images?: FalImage[];
}

/** Generate from text only. Used for the style bake-off and the anchor. */
export async function generate(
  prompt: string,
  opts: { numImages?: number; seed?: number; aspectRatio?: AspectRatio } = {},
) {
  const res = (await fal.subscribe(MODEL, {
    input: {
      prompt,
      // portrait by default — it matches the 1:1.3 card shape
      aspect_ratio: opts.aspectRatio ?? "3:4",
      resolution: "1K",
      output_format: "png",
      num_images: opts.numImages ?? 1,
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    },
  })) as { data: FalResult };
  return res.data.images ?? [];
}

/** Generate a new creature while inheriting the style of the reference image(s). */
export async function generateWithReference(
  prompt: string,
  referenceUrls: string[],
  opts: { numImages?: number; seed?: number; aspectRatio?: AspectRatio } = {},
) {
  const res = (await fal.subscribe(EDIT_MODEL, {
    input: {
      prompt,
      image_urls: referenceUrls,
      // Portrait by default — it matches the 1:1.3 card shape. An emoji is
      // square, which is the only other thing that asks for this.
      aspect_ratio: opts.aspectRatio ?? "3:4",
      resolution: "1K",
      output_format: "png",
      num_images: opts.numImages ?? 1,
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    },
  })) as { data: FalResult };
  return res.data.images ?? [];
}

/**
 * Turn a still into a few seconds of very slight movement.
 *
 * Or asked for her hair and the hem of her dress to move — which a CSS
 * transform cannot do, because moving the whole picture is not the same as
 * moving part of it. This is image-to-video, and the prompt spends most of its
 * words saying what must NOT happen: the camera must not move, she must not
 * walk, nothing may zoom. A hero image that drifts is alive; one that performs
 * is a distraction behind a menu.
 */
export async function animate(
  imageUrl: string,
  prompt: string,
  opts: { seconds?: "5" | "10" } = {},
): Promise<string | null> {
  const res = (await fal.subscribe("fal-ai/kling-video/v1/standard/image-to-video", {
    input: {
      prompt,
      image_url: imageUrl,
      duration: opts.seconds ?? "5",
      // No aspect ratio here: this model takes it from the source image, which
      // is what we want — the banner's shape IS the shape.
    },
  })) as { data?: { video?: { url?: string } } };
  return res.data?.video?.url ?? null;
}

/**
 * A single sound effect, from a sentence describing it.
 *
 * Or's note on the old sounds: "a 386 could make these out of the CPU with no
 * speakers". They were literally square and sawtooth oscillators, so he was
 * right. These are recorded-sounding instead, which no amount of Web Audio
 * will ever be.
 *
 * ElevenLabs is the obvious model for this and it is the one that failed —
 * every request came back "Sound effect generation failed" from fal's side,
 * whatever the input. Cassette answers, so Cassette it is.
 *
 * ⚠ THAT WAS `elevenlabs/sound-effects` AND ONLY THAT. Their text-to-speech
 * is a different endpoint and it works fine — see `speakEleven` below, which
 * Amanda is voiced with. The sentence above is about effects, and reading it
 * as "ElevenLabs does not work here" cost an afternoon of not trying. It returns a wav
 * and takes whole seconds, which is why nothing here asks for 0.4s: the clips
 * are generated long and cut down with ffmpeg afterwards.
 */
export async function sound(
  prompt: string,
  opts: { seconds?: number } = {},
): Promise<string | null> {
  const res = (await fal.subscribe("cassetteai/sound-effects-generator", {
    input: {
      prompt,
      duration: Math.max(1, Math.round(opts.seconds ?? 2)),
    },
  })) as { data?: { audio_file?: { url?: string } } };
  return res.data?.audio_file?.url ?? null;
}

/**
 * The languages whose phonetics can be leaned on for an accent.
 *
 * A narrow union rather than `string`, because the service takes a fixed
 * list and the compiler already knows it — the first version of this typed
 * it as a string and tsc said so, in as many words, with the whole list.
 * Widen it when somebody needs one of the other twenty-odd.
 */
export type Accent = "English" | "Spanish" | "Italian" | "French" | "German" | "Portuguese";

/**
 * A card saying its own name, in a voice chosen for it.
 *
 * Or: *"those specific ones should also say their name in their own special
 * voice when you press them."*
 *
 * A DIFFERENT MODEL from `sound()` above, and it has to be: the effects
 * model is told "no voice" in the last line of every prompt it is ever
 * given, because a human noise in a card-placing sound is a fault. Speech
 * is the one thing it must never do, so speech comes from somewhere else.
 *
 * MiniMax, because of `voice_setting` — a voice id, a pitch of -12 to +12,
 * a speed of 0.5 to 2 and an emotion. Without those, eleven cards saying
 * their names is one actor reading a list, which is worse than silence: it
 * would make every card sound like the SAME card. The settings are the
 * whole feature.
 */
export async function speak(
  text: string,
  voice: {
    id: string;
    /** -12 to +12. Down for anything enormous. */
    pitch?: number;
    /** 0.5 to 2. Slow is heavy; slow is also stupid. */
    speed?: number;
    emotion?: "happy" | "sad" | "angry" | "fearful" | "disgusted" | "surprised" | "neutral";
    /**
     * Which language's phonetics to lean on, for an ACCENT.
     *
     * Or, on Amanda: *"a woman of about 40-50 with a slight Spanish
     * accent."* There is no "Spanish-accented English woman" in the preset
     * list, and guessing at one is a generation spent on a name that may
     * not exist. `language_boost` is the dial that does exist: set to
     * Spanish over English text it biases the model's vowels and consonants
     * that way, which is what an accent IS.
     *
     * ⚠ AND IT CAN GO TOO FAR. Pushed on text that is already English it may
     * read the words AS Spanish rather than with a Spanish colour. That is
     * one generation to find out and the reason Amanda's lines are worth
     * listening to before the rest of a batch is paid for.
     */
    accent?: Accent;
  },
): Promise<string | null> {
  const res = (await fal.subscribe("fal-ai/minimax/speech-2.6-turbo", {
    input: {
      prompt: text,
      voice_setting: {
        voice_id: voice.id,
        pitch: voice.pitch ?? 0,
        speed: voice.speed ?? 1,
        ...(voice.emotion ? { emotion: voice.emotion } : {}),
      },
      /*
       * Mono and 44.1k, to match every other clip in the game.
       *
       * ⚠ The cast is not laziness. The fal client's generated types declare
       * `sample_rate` and `channel` as STRING literals; the service rejects
       * strings and asks for numbers, in as many words:
       *
       *   loc: ["body","audio_setting","sample_rate"]
       *   msg: "Input should be 8000, 16000, 22050, 24000, 32000 or 44100"
       *   input: "44100"
       *
       * So the types and the server disagree, and the server is the one that
       * has to be satisfied. Written as numbers with the types silenced,
       * rather than as strings with the API failing — and the reason is here
       * so that the next person to "fix the cast" reads this first.
       */
      audio_setting: { sample_rate: 44100, channel: 1, format: "mp3" } as unknown as never,
      language_boost: voice.accent ?? "English",
      output_format: "url",
    },
  })) as { data?: { audio?: { url?: string } } };
  return res.data?.audio?.url ?? null;
}

/**
 * The same job as `speak`, through ElevenLabs instead.
 *
 * Or, having heard the MiniMax takes: *"Kiddo Kiddo Kiddo did not come out
 * well, and Come here is not good either. The rest are fine. Anyway, let's
 * use ElevenLabs — Lucia, or Tosca."*
 *
 * ═══ WHAT IS DIFFERENT, AND WHY IT MATTERS FOR THE TEXT ═══
 *
 * The field is `text`, not `prompt`, and the voice is `voice`, not
 * `voice_id`. Neither of those is a detail: a wrong field name here is a
 * paid request that fails, and the two services disagree on both.
 *
 * ⚠ AND MINIMAX'S PAUSE MARKERS DO NOT WORK HERE. `<#0.2#>` is MiniMax's own
 * syntax; ElevenLabs has never heard of it and will either read it aloud or
 * choke on it. Pauses are punctuation here — a comma, or an ellipsis for a
 * longer one — which is why Amanda's lines were rewritten rather than
 * copied across.
 *
 * `speed` is a narrow 0.7 to 1.2, against MiniMax's 0.5 to 2. That is the
 * service telling you something true: a voice slowed to half speed does not
 * sound older, it sounds broken, and the two lines Or rejected were the two
 * slowest and longest of the seven (4.37s and 3.69s, against 1.56 for the
 * one he liked best).
 */
export async function speakEleven(
  text: string,
  voice: {
    /** A voice NAME, as ElevenLabs lists it: "Rachel", "Lucia", "Tosca". */
    id: string;
    /** 0 to 1. Low is expressive and varies between takes; high is flat. */
    stability?: number;
    /** 0 to 1. How hard it holds onto the original voice's character. */
    similarity?: number;
    /** 0 to 1. Exaggeration. Past about 0.5 it starts acting. */
    style?: number;
    /** 0.7 to 1.2, and the ends of that range are the ends for a reason. */
    speed?: number;
  },
): Promise<string | null> {
  const res = (await fal.subscribe("fal-ai/elevenlabs/tts/multilingual-v2", {
    input: {
      text,
      voice: voice.id,
      ...(voice.stability !== undefined ? { stability: voice.stability } : {}),
      ...(voice.similarity !== undefined ? { similarity_boost: voice.similarity } : {}),
      ...(voice.style !== undefined ? { style: voice.style } : {}),
      ...(voice.speed !== undefined ? { speed: voice.speed } : {}),
    } as unknown as never,
  })) as { data?: { audio?: { url?: string } } };
  return res.data?.audio?.url ?? null;
}

/**
 * The same voice, saying it exactly the way somebody else said it.
 *
 * Or, having rejected "Kiddo Kiddo Kiddo" twice: *"everything is fine except
 * Kiddo Kiddo Kiddo. I have put a reference for the INTONATION. Run it
 * through ElevenLabs."*
 *
 * ═══ WHY THIS AND NOT ANOTHER TEXT-TO-SPEECH TAKE ═══
 *
 * Text-to-speech is handed words and invents a delivery. Two takes of "Kiddo.
 * Kiddo. Kiddo." differ in where the stress lands, how long the gaps are and
 * which of the three climbs — and none of that is a parameter. Three
 * rejections in, the thing being argued about was never the voice, it was the
 * PHRASING.
 *
 * Speech-to-speech takes a recording and keeps all of it — rhythm, stress,
 * the shape of the line — and changes only who is saying it. So the reference
 * is Or performing the line, and the output is Amanda performing Or's
 * performance. It is the only tool here that can be given an intonation
 * rather than asked for one.
 *
 * ⚠ THE MODEL IS `voice-changer`, WHICH TOOK FINDING. There is no
 * `fal-ai/elevenlabs/speech-to-speech` — that path 404s, and
 * `fal-ai/elevenlabs/sts` does too. The field is `audio_url` and it must be a
 * URL fal can fetch, so the file is uploaded to fal's own storage first.
 */
export async function changeVoice(
  audioPath: string,
  voiceId: string,
): Promise<string | null> {
  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(audioPath);
  /*
   * ⚠ WITH AN AUDIO CONTENT TYPE. `uploadFile` below hardcodes image/png
   * because every other thing this file uploads is a style anchor; handing
   * that to the voice changer uploads an .mpeg announced as a picture.
   */
  const blob = new Blob([new Uint8Array(buf)], { type: "audio/mpeg" });
  const url = await fal.storage.upload(blob as unknown as File);
  const res = (await fal.subscribe("fal-ai/elevenlabs/voice-changer", {
    input: { audio_url: url, voice: voiceId } as unknown as never,
  })) as { data?: { audio?: { url?: string } } };
  return res.data?.audio?.url ?? null;
}

/** Download a generated image to disk. */
export async function download(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
}

/** Upload a local file so it can be used as a reference image. */
export async function uploadFile(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(path);
  const blob = new Blob([new Uint8Array(buf)], { type: "image/png" });
  return fal.storage.upload(blob as unknown as File);
}
