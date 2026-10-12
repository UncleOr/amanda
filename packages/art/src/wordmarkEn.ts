/**
 * The English logotype.
 *
 *   pnpm --filter @amanda/art exec tsx src/wordmarkEn.ts
 *   → apps/client/public/brand/wordmark-en.png
 *
 * The brand mark is a Hebrew one — אמנדה, cut out of spiky teal fur. The
 * trailer's end card is the first place that mattered: Or wants a Hebrew
 * cut and an English cut, and an English viewer reading אמנדה reads nothing
 * at all. The Play listing will want it too.
 *
 * So the Hebrew mark goes in as the reference and the model is asked for the
 * same object with different letters, which is the one job this pipeline is
 * reliably good at.
 *
 * ═══ NOT ON A TRANSPARENT BACKGROUND ═══
 *
 * Asked for one, it came back with a picture OF transparency: a grey and
 * white checkerboard, painted, in an opaque rgb24 png. Which is fair — it
 * has seen a million screenshots of that checkerboard labelled "transparent
 * background".
 *
 * A checkerboard cannot be keyed out, because its two colours are also the
 * colours of the highlights inside the letters. A flat fill can. So it is
 * asked for the trailer's own #070a12 instead, and then keyed.
 *
 * ═══ THE KEY THRESHOLD IS 0.03, AND IT WAS MEASURED ═══
 *
 * Or, the moment it reached the home screen: *"in English the Amanda letters
 * are not on a transparent background but on a black one."* They were — the
 * trailer's end card is that same black so the seam was invisible there, and
 * the home screen is a painting of Amanda, where it is a box.
 *
 * The background and the letters' own outline are both nearly black, so the
 * threshold is the whole job. Composited over hot pink and looked at:
 *
 *   0.01   the background survives as a dark box
 *   0.03   background gone, outline intact      <- this one
 *   0.06   the outline goes with it and the letters lose their edge
 *
 * 0.08 of blend on top of that, so the fur's antialiased spikes do not come
 * out as a stair.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";
import { download, generateWithReference, uploadFile } from "./fal.js";

const BRAND = join(REPO_ROOT, "apps", "client", "public", "brand");
const SOURCE = join(BRAND, "wordmark.png");
const OUT = join(BRAND, "wordmark-en.png");

const PROMPT = [
  "The reference image is a logotype: a word cut out of spiky, shaggy fur with",
  "a thick black outline, filled with a vertical gradient from pale mint at the",
  "top to deep teal at the bottom, with small highlights.",
  "Redraw THE SAME LOGOTYPE, in exactly the same style, the same spiky fur",
  "silhouette, the same black outline weight and the same mint-to-teal gradient,",
  "but reading the English word AMANDA in capital Latin letters.",
  "Six letters: A M A N D A. Spell it correctly and do not add, drop or repeat a",
  "letter. One word on one line, horizontal, left to right.",
  "Nothing else in the picture: no frame, no shadow behind it, no extra words,",
  "no creatures and no characters.",
  "The background is ONE FLAT SOLID COLOUR filling the whole frame, the very",
  "dark blue-black hex #070A12. A plain unbroken field of that one colour — NOT",
  "a checkerboard, NOT a grid, NOT a chequered transparency pattern, NOT grey",
  "and white squares, NOT a gradient and NOT a texture.",
].join(" ");

const url = await uploadFile(SOURCE);
const images = await generateWithReference(PROMPT, [url], { aspectRatio: "16:9" });
const image = images[0];
if (!image) {
  console.error("nothing came back");
  process.exit(1);
}
await download(image.url, OUT);

/*
 * Trim it to the letters.
 *
 * What comes back is a 16:9 picture with a wordmark somewhere in the middle
 * of it, and where in the middle is different every time. The Hebrew mark is
 * tight to its letters, so anything laying the two side by side — this
 * trailer's end card, the store listing next — can scale by width and have
 * them match. This one has to be made tight the same way, here, rather than
 * leaving a magic crop in whatever uses it.
 *
 * cropdetect's limit is above the background but well under the black
 * outline, and skip=0 because it ignores the first two frames by default and
 * there is only one.
 */
const ffmpeg = (() => {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
})();

const probe = execFileSync(
  ffmpeg,
  ["-v", "info", "-i", OUT, "-vf", "cropdetect=limit=24:round=2:skip=0", "-frames:v", "1", "-f", "null", "-"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] } as never,
);
const crop = /crop=(\d+:\d+:\d+:\d+)/.exec(String(probe))?.[1];
if (!crop) throw new Error("could not find the wordmark in the generated image");

// A little air around it, so scaling never clips a spike off the fur. Then
// down to 720 across, which is what the Hebrew mark is: the home screen draws
// whichever one applies at 300px at most, and a 1376px png is 400KB of first
// load for a child on a phone to see a 300px logo.
const [w, h, x, y] = crop.split(":").map(Number) as [number, number, number, number];
const PAD = 10;
const WIDTH = 720;
execFileSync(ffmpeg, [
  "-y", "-v", "error", "-i", OUT,
  "-vf", `crop=${w}:${h}:${x}:${y},pad=${w + PAD * 2}:${h + PAD * 2}:${PAD}:${PAD}:color=0x070a12,`
    + `scale=${WIDTH}:-2:flags=lanczos,colorkey=0x070A12:0.03:0.08,format=rgba`,
  "-update", "1", OUT,
]);

const size = execFileSync(ffmpeg.replace(/ffmpeg(\.exe)?$/, "ffprobe$1"), [
  "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", OUT,
], { encoding: "utf8" }).trim();
console.log(`   wordmark-en → ${OUT}  (${size}, trimmed from ${crop})`);
