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
const ARENA_OUT = join(REPO_ROOT, "apps", "client", "public", "arena");
const BRAND_OUT = join(REPO_ROOT, "apps", "client", "public", "brand");
const ICON_OUT = join(REPO_ROOT, "apps", "client", "public", "icons");
const SURFACE_OUT = join(REPO_ROOT, "apps", "client", "public", "surfaces");
const SCENE_OUT = join(REPO_ROOT, "apps", "client", "public", "scenes");
/** Portrait card art (3:4). Hand card is ~124px wide, so 384 covers retina. */
const W = 384;
const H = 512;
/** Arena backdrops are a wide 2:1 strip, not a card. */
const ARENA_W = 1152;
const ARENA_H = 576;


/**
 * Lift a logo off its flat backdrop.
 *
 * Asking the model for transparency produced a painted checkerboard, so the
 * logo is generated on one flat colour instead and the colour is removed here.
 * The fill starts from the edges and spreads inwards, stopping at the emblem's
 * black outline — so the violet INSIDE the badge, which is the same colour,
 * stays exactly where it is. A plain "make every violet pixel transparent"
 * would have punched holes through the middle of her.
 */
async function cutBackdrop(src: string, dest: string, width: number): Promise<void> {
  const img = sharp(src).resize(width, null, { withoutEnlargement: true }).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const at = (x: number, y: number) => (y * w + x) * channels;
  // The corner is backdrop by definition.
  const c = at(0, 0);
  const [br, bg, bb] = [data[c]!, data[c + 1]!, data[c + 2]!];
  const TOL = 42; // generous: the backdrop has a soft gradient across it
  const near = (i: number) =>
    Math.abs(data[i]! - br) + Math.abs(data[i + 1]! - bg) + Math.abs(data[i + 2]! - bb) < TOL * 3;

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, 0, x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    stack.push(0, y, w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (seen[p]) continue;
    const i = p * channels;
    if (!near(i)) continue;
    seen[p] = 1;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  await sharp(data, { raw: { width: w, height: h, channels } }).png().toFile(dest);
}

async function main(): Promise<void> {
  if (!existsSync(RAW)) {
    console.error("❌ No assets/raw — generate art first (pnpm art:cards <style>).");
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  let processed = 0;
  const spriteFor = new Map<string, string>();

  // "system" holds cards synthesised in code (the Crumb Demon filler) and
  // "actions" holds the Action Card artwork — neither lives in data/series.
  const folders = [...SERIES.map((s) => s.id), "system", "actions"];
  for (const seriesId of folders) {
    const dir = join(RAW, seriesId);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".png"))) {
      const cardId = file.replace(/\.png$/, "");
      if (!CARDS.has(cardId) && seriesId !== "system" && seriesId !== "actions") {
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

  // Arena backdrops live in their own folder at their own (wide) size.
  const arenaDir = join(RAW, "arena");
  if (existsSync(arenaDir)) {
    await mkdir(ARENA_OUT, { recursive: true });
    for (const file of readdirSync(arenaDir).filter((f) => f.endsWith(".png"))) {
      const id = file.replace(/\.png$/, "");
      await sharp(join(arenaDir, file))
        .resize(ARENA_W, ARENA_H, { fit: "cover", position: "centre" })
        .webp({ quality: 80 })
        .toFile(join(ARENA_OUT, `${id}.webp`));
      processed++;
      console.log(`  arena ${id}`);
    }
  }

  /*
   * The surfaces everything else sits on: album paper, the table, the attic.
   *
   * Compressed hard and kept small on purpose. These are backgrounds, they
   * stretch to whatever size the element is, and nobody ever looks straight
   * at one — a sharper file would cost a slower first paint for nothing.
   */
  const surfaceDir = join(RAW, "surfaces");
  if (existsSync(surfaceDir)) {
    await mkdir(SURFACE_OUT, { recursive: true });
    for (const file of readdirSync(surfaceDir).filter((f) => f.endsWith(".png"))) {
      const id = file.replace(/\.png$/, "");
      await sharp(join(surfaceDir, file))
        .resize(900, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(join(SURFACE_OUT, `${id}.webp`));
      processed++;
      console.log(`  surface ${id}`);
    }
  }

  /*
   * The painted scenes: the win, the loss, the banners. Bigger and sharper
   * than the surfaces, because these are the picture the player is actually
   * looking at rather than the thing behind it.
   */
  const sceneDir = join(RAW, "scenes");
  if (existsSync(sceneDir)) {
    await mkdir(SCENE_OUT, { recursive: true });
    for (const file of readdirSync(sceneDir).filter((f) => f.endsWith(".png"))) {
      const id = file.replace(/\.png$/, "");
      /*
       * Trimmed first. The model likes to leave a plain border around a
       * banner — the profile plaque came back with white down both sides —
       * and a background-image stretched to cover shows every pixel of it.
       * The threshold is loose enough to take a near-white margin and tight
       * enough to leave a painting that happens to be pale at one edge.
       */
      await sharp(join(sceneDir, file))
        .trim({ threshold: 12 })
        .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(join(SCENE_OUT, `${id}.webp`));
      processed++;
      console.log(`  scene ${id}`);
    }
  }

  // Amanda herself: the logo keeps its transparency (png), the rest compress.
  const brandDir = join(RAW, "brand");
  if (existsSync(brandDir)) {
    await mkdir(BRAND_OUT, { recursive: true });
    for (const file of readdirSync(brandDir).filter((f) => f.endsWith(".png"))) {
      const id = file.replace(/\.png$/, "");
      // The banner is wide furniture; the logo and portrait are square marks
      // that never need to be bigger than the screens they sit on.
      const width = id === "amanda_banner" ? 1400 : 512;
      if (id === "amanda_logo") {
        await cutBackdrop(join(brandDir, file), join(BRAND_OUT, `${id}.png`), width);
      } else {
        await sharp(join(brandDir, file))
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 86 })
          .toFile(join(BRAND_OUT, `${id}.webp`));
      }
      processed++;
      console.log(`  brand ${id}`);
    }
  }

  // The icon set. Every one is generated on a flat backdrop and cut out here,
  // and they ship small because they are drawn at 128px, not scaled down from
  // a picture.
  const iconDir = join(RAW, "icons");
  if (existsSync(iconDir)) {
    await mkdir(ICON_OUT, { recursive: true });
    for (const file of readdirSync(iconDir).filter((f) => f.endsWith(".png"))) {
      const id = file.replace(/[.]png$/, "");
      await cutBackdrop(join(iconDir, file), join(ICON_OUT, `${id}.png`), 128);
      processed++;
      console.log(`  icon  ${id}`);
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
