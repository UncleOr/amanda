/**
 * The little Amanda that shows while a film has nothing to paint yet.
 *
 *   node scripts/make-loading-mark.mjs
 *   → apps/client/public/brand/mark.webp  (committed)
 *
 * Or: *"make the Amanda loading logo small, in the middle. And have it show
 * while the opening is loading too."* — and then, having seen it: *"there's
 * still a grey square."*
 *
 * ═══ THE GREY SQUARE WAS THE MARK ITSELF ═══
 *
 * The first attempt pointed at `icon-512.png`, because it was to hand and it
 * is Amanda. Measured, it is the wrong file twice over:
 *
 *     512x512   alpha=false   100.0% of pixels fully opaque
 *     corners rgb(5,16,42)    the screen behind rgb(7,10,18)
 *
 * A launcher icon is a SQUARE by definition — Android masks it to whatever
 * shape it likes, so the art is drawn onto a filled plate. Dropped onto the
 * opening at 61px it is a dark navy tile on a near-black screen, with a
 * breathing opacity animation drawing the eye to its edges. That is the
 * square in the photograph.
 *
 * And it weighs 575KB, against the 69KB ident it is there to cover. It
 * arrives after the thing it is waiting for, which is the whole job missed.
 *
 * `amanda_logo.png` is the right picture — a round badge, 53% transparent,
 * corners at alpha 0 — and it is 451KB, which is worse. So it is resized
 * here once and committed small: 192px for a mark that draws at most 96, so
 * it is sharp on a 2x screen and nothing more.
 */
import { createRequire } from "node:module";
import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(
  fileURLToPath(new URL("../packages/art/node_modules/sharp/lib/index.js", import.meta.url)),
);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "apps", "client", "public", "brand", "amanda_logo.png");
const OUT = join(ROOT, "apps", "client", "public", "brand", "mark.webp");

/** Twice the largest size .opening__mark ever draws at (96px). */
const PX = 192;

const png = await sharp(SOURCE).metadata();
if (!png.hasAlpha) {
  // The one thing that must be true. A mark without alpha is the bug again.
  throw new Error(`${SOURCE} has no alpha channel — it would draw as a plate.`);
}

writeFileSync(
  OUT,
  await sharp(SOURCE)
    .resize(PX, PX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 90 })
    .toBuffer(),
);

const { data, info } = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let clear = 0;
for (let i = 3; i < data.length; i += info.channels) if (data[i] < 8) clear++;
const pct = ((100 * clear) / (info.width * info.height)).toFixed(0);

console.log(`  mark → ${OUT}`);
console.log(`    ${PX}x${PX}  ${(statSync(OUT).size / 1024).toFixed(1)}KB  ${pct}% transparent`);
console.log(`    was icon-512.png: 562KB, 0% transparent, a square plate.`);
