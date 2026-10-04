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
