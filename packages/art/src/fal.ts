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
  opts: { numImages?: number; seed?: number } = {},
) {
  const res = (await fal.subscribe(EDIT_MODEL, {
    input: {
      prompt,
      image_urls: referenceUrls,
      aspect_ratio: "3:4", // portrait — matches the 1:1.3 card shape
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
 * whatever the input. Cassette answers, so Cassette it is. It returns a wav
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
