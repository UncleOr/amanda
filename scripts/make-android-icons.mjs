/**
 * The Android launcher icon, from the icon the website already uses.
 *
 *   node scripts/make-android-icons.mjs
 *   → android/icons/**  (committed, so the build needs no image library)
 *
 * Or, with a screenshot of his app switcher showing the blue Capacitor
 * logo: *"the app's logo is not the Amanda logo!! Fix it so we can send it
 * to the testers."*
 *
 * ═══ WHY IT WAS CAPACITOR'S ═══
 *
 * Because nothing ever replaced it. `cap add android` generates a complete
 * res/ tree including its own `ic_launcher`, and scripts/android-capacitor.cjs
 * patched the four things that make the app OURS — version, signing, the Play
 * Games id, the name under the icon — and not the picture above the name.
 * The TWA before it took its icon from the web manifest and so never needed
 * this; a WebView wrapper is a real Android app and does.
 *
 * ═══ WHAT ANDROID ACTUALLY WANTS ═══
 *
 * Three things, and the adaptive one is the only one that is subtle:
 *
 *   ic_launcher            48/72/96/144/192 square, for old launchers
 *   ic_launcher_round      the same, circular, for launchers that ask
 *   ic_launcher_foreground 108dp canvas with the art in the middle 72dp
 *
 * An adaptive icon is a 108dp foreground over a 108dp background, and the
 * launcher may mask it to any shape it likes — circle, squircle, teardrop —
 * and animate it. Only the middle 72dp is guaranteed to survive, and the
 * middle 66dp is the part that is safe on every device. So the art is drawn
 * at 66% of the canvas and the rest is transparent: anything closer to the
 * edge is a picture that gets its corners eaten on half the phones in the
 * world.
 *
 * The background is flat, and it is the game's own panel colour rather than
 * white — the icon is a dark picture, and a white plate behind it reads as a
 * mistake the moment the launcher masks it into a circle.
 */
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// sharp lives in packages/art, which is the only place in this repo that
// processes images. Resolved from there rather than added as a second copy.
const require = createRequire(import.meta.url);
const sharp = require(
  fileURLToPath(new URL("../packages/art/node_modules/sharp/lib/index.js", import.meta.url)),
);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "apps", "client", "public", "icon-512.png");
const OUT = join(ROOT, "android", "icons");

/** The game's panel colour, from tokens.css — and capacitor.json's background. */
const BACKDROP = "#0B0E17";

/** Android's density buckets, and the launcher size each one wants. */
const DENSITIES = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

/**
 * How much of the adaptive canvas the art may use.
 *
 * 108dp canvas, 72dp guaranteed visible, 66dp safe on every launcher.
 * 66/108 is 0.611; rounded down to leave the rounding error outside the art
 * rather than inside it.
 */
const SAFE = 0.6;

rmSync(OUT, { recursive: true, force: true });

const round = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );

for (const [density, px] of DENSITIES) {
  const dir = join(OUT, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });

  const square = await sharp(SOURCE).resize(px, px, { fit: "cover" }).png().toBuffer();
  writeFileSync(join(dir, "ic_launcher.png"), square);

  // The round one is the same picture with a circular alpha mask, so the two
  // can never drift apart the way two exported files would.
  writeFileSync(
    join(dir, "ic_launcher_round.png"),
    await sharp(square)
      .composite([{ input: round(px), blend: "dest-in" }])
      .png()
      .toBuffer(),
  );

  /*
   * The adaptive foreground: a 108dp canvas, transparent, with the art in
   * the middle 60%. `px` is the 48dp launcher size, so the 108dp canvas for
   * this density is px * 108/48.
   */
  const canvas = Math.round((px * 108) / 48);
  const art = Math.round(canvas * SAFE);
  writeFileSync(
    join(dir, "ic_launcher_foreground.png"),
    await sharp({
      create: {
        width: canvas,
        height: canvas,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: await sharp(SOURCE).resize(art, art, { fit: "cover" }).png().toBuffer(),
          top: Math.round((canvas - art) / 2),
          left: Math.round((canvas - art) / 2),
        },
      ])
      .png()
      .toBuffer(),
  );
}

/*
 * The two XML files that say "this is an adaptive icon", and the colour
 * behind it. `mipmap-anydpi-v26` wins over every density folder on Android 8
 * and later; the PNGs above are what older launchers fall back to.
 */
const anydpi = join(OUT, "mipmap-anydpi-v26");
mkdirSync(anydpi, { recursive: true });
const adaptive = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
  '    <background android:drawable="@color/ic_launcher_background"/>',
  '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>',
  "</adaptive-icon>",
  "",
].join("\n");
writeFileSync(join(anydpi, "ic_launcher.xml"), adaptive);
writeFileSync(join(anydpi, "ic_launcher_round.xml"), adaptive);

const values = join(OUT, "values");
mkdirSync(values, { recursive: true });
writeFileSync(
  join(values, "ic_launcher_background.xml"),
  [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<resources>",
    `    <color name="ic_launcher_background">${BACKDROP}</color>`,
    "</resources>",
    "",
  ].join("\n"),
);

console.log(`  icons → ${OUT}`);
for (const [density, px] of DENSITIES) console.log(`    mipmap-${density}  ${px}px`);
console.log("    mipmap-anydpi-v26, values/ic_launcher_background.xml");
console.log("\n  Committed on purpose: the Android build has no image library.");
