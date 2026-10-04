/**
 * App icons, built from a card that already carries the game's look.
 *
 * The icons are cropped from existing artwork rather than generated fresh, so
 * the thing on the home screen is unmistakably the same game as the cards.
 *
 *   pnpm art:icons [cardId]
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { REPO_ROOT } from "./catalog.js";

const RAW = join(REPO_ROOT, "assets", "raw");
const OUT = join(REPO_ROOT, "apps", "client", "public");

/** The face of the game. Flame Dragon is the first card of the first series. */
const DEFAULT_SOURCE = join(RAW, "dragons", "dragons_01_flame_dragon.png");

/** Square icons a browser or an installed web app asks for. */
const SIZES = [
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-180.png", size: 180 }, // iOS home screen
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

/**
 * Android asks for a "maskable" icon it may crop to any shape, so the subject
 * has to sit inside the middle ~80%. We pad the artwork rather than crop it.
 */
const MASKABLE = { file: "icon-512-maskable.png", size: 512, padding: 0.1 };

async function main(): Promise<void> {
  const source = process.argv[2]
    ? join(RAW, process.argv[2].split("_")[0] ?? "", `${process.argv[2]}.png`)
    : DEFAULT_SOURCE;
  if (!existsSync(source)) {
    console.error(`No such artwork: ${source}`);
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  // Portrait art — take a square from the top, where the creature's head is.
  const square = await sharp(source)
    .resize(1024, 1024, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  for (const { file, size } of SIZES) {
    await sharp(square).resize(size, size).png().toFile(join(OUT, file));
    console.log(`  ${file}`);
  }

  const inner = Math.round(MASKABLE.size * (1 - MASKABLE.padding * 2));
  const pad = Math.round((MASKABLE.size - inner) / 2);
  await sharp(square)
    .resize(inner, inner)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: "#0b0e17", // the app background, so the padding disappears
    })
    .png()
    .toFile(join(OUT, MASKABLE.file));
  console.log(`  ${MASKABLE.file}`);

  console.log(`\nDone -> apps/client/public/\n`);
}

main().catch((err) => {
  console.error("\nFailed:", err);
  process.exit(1);
});
