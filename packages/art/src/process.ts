/**
 * Compresses approved raw art into web-ready assets and points the card JSON at
 * them. Raw PNGs stay out of the app bundle (they are large); the client only
 * ever ships the compressed webp files.
 *
 *   pnpm art:process
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { CARDS, REPO_ROOT, SERIES } from "./catalog.js";

const RAW = join(REPO_ROOT, "assets", "raw");
const OUT = join(REPO_ROOT, "apps", "client", "public", "cards");
/** Portrait card art (3:4). Hand card is ~124px wide, so 384 covers retina. */
const W = 384;
const H = 512;

async function main(): Promise<void> {
  if (!existsSync(RAW)) {
    console.error("❌ No assets/raw — generate art first (pnpm art:cards <style>).");
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  let processed = 0;
  const spriteFor = new Map<string, string>();

  // "system" holds cards synthesised in code (the Crumb Demon filler) rather
  // than defined in data/series.
  const folders = [...SERIES.map((s) => s.id), "system"];
  for (const seriesId of folders) {
    const dir = join(RAW, seriesId);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
      const cardId = file.replace(/\.png$/, "");
      if (!CARDS.has(cardId) && seriesId !== "system") {
        console.warn(`  ⚠ ${file} has no matching card id — skipped`);
        continue;
      }
      const outFile = `${cardId}.webp`;
      await sharp(join(dir, file))
        .resize(W, H, { fit: "cover", position: "top" })
        .webp({ quality: 82 })
        .toFile(join(OUT, outFile));
      spriteFor.set(cardId, `cards/${outFile}`);
      processed++;
      console.log(`  ✓ ${cardId}`);
    }
  }

  // Point each card's art.sprite at its compressed file (engine already reads this).
  const seriesDir = join(REPO_ROOT, "data", "series");
  for (const file of readdirSync(seriesDir).filter((f) => f.endsWith(".json"))) {
    const path = join(seriesDir, file);
    const json = JSON.parse(readFileSync(path, "utf8")) as {
      cards: Array<{ id: string; art: { sprite: string | null } }>;
    };
    let changed = false;
    for (const card of json.cards) {
      const sprite = spriteFor.get(card.id);
      if (sprite && card.art.sprite !== sprite) {
        card.art.sprite = sprite;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf8");
      console.log(`  ↻ updated ${file}`);
    }
  }

  console.log(`\n✅ ${processed} images → apps/client/public/cards/\n`);
}

main().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
