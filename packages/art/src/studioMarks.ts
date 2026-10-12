/**
 * Asulins — the images the studio lockup is built from.
 *
 *   pnpm --filter @amanda/art exec tsx src/studioMarks.ts
 *   pnpm --filter @amanda/art exec tsx src/studioMarks.ts pads   (that one again)
 *
 * Or, on the first four: *"the four logos are a bit meh. Let's write ASULINS,
 * and make a big game controller with a small one next to it — they stand for
 * father and son. Or a big monster and a small monster would work too."*
 *
 * So these are no longer whole logos. They are the PICTURE half, and
 * scripts/studio-lockups.sh sets the word beside them in a dozen
 * combinations of font, colour and layout — which is the other half of what
 * he asked for, and the half a model is bad at.
 *
 * ═══ STILL NOT ONE LETTER ═══
 *
 * The name is typeset, never generated. A studio name misspelt by one letter
 * in the thing that plays before every launch is the worst place in the whole
 * product for that to happen, and "it came back right last time" is luck
 * rather than a method.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";
import { generate, download } from "./fal.js";

const OUT = join(REPO_ROOT, "assets", "raw", "studio");

/** The lockups are laid on the game's own black, so the art is drawn on it. */
const BG = "#070A12";

const STYLE = [
  "FLAT VECTOR LOGO ART, the kind a game studio puts on a business card:",
  "clean geometry, solid shapes, thick confident outlines, no gradients, no",
  "shading, no 3D, no bevel, no glow, no drop shadow, no texture.",
  `The background is ONE FLAT SOLID COLOUR filling the entire frame, hex ${BG},`,
  "a very dark blue-black. EVERY pixel that is not part of the two objects is",
  "that one colour, edge to edge and corner to corner.",
  "THE BACKGROUND IS NOT WHITE. There is no white box, no white panel, no",
  "white card, no light rectangle and no border anywhere in the picture. Not a",
  "checkerboard, not a grid, not a gradient, not a mockup, not a sticker, not a",
  "photograph of a logo printed on something.",
  "The two objects sit SIDE BY SIDE on the same baseline, centred together,",
  "with a clear gap between them, and they fill the middle half of the frame.",
  "ABSOLUTELY NO TEXT. No letters, no words, no numbers, no signature, no",
  "watermark. The picture contains the two objects and nothing else.",
];

interface Mark {
  id: string;
  /** What it is, for us. Never sent. */
  idea: string;
  prompt: string;
}

const MARKS: Mark[] = [
  {
    id: "pads",
    idea: "A big game controller and a small one. Or's own description.",
    prompt: [
      "Two video game controllers, seen flat from the front as simple symmetrical",
      "silhouettes: a LARGE one on the left and a SMALL one on the right, about",
      "half its size, exactly the same shape as each other.",
      "Each is a rounded body with two grips, a round d-pad on one side and two",
      "small round buttons on the other, drawn as a thick outline with the",
      "background showing through the holes.",
      "The large controller is warm orange, the small one is bright teal.",
      "Simple, bold and symmetrical — a pair of pictograms, not an illustration",
      "of plastic.",
    ].join(" "),
  },
  {
    id: "pads-cord",
    idea: "The same pair, joined by one cord — the bit that says father and son.",
    prompt: [
      "Two video game controllers, seen flat from the front as simple symmetrical",
      "silhouettes: a LARGE one on the left and a SMALL one on the right, about",
      "half its size, the same shape as each other.",
      "ONE single cord runs out of the top of each and the two cords join into a",
      "single curve between them, so the pair reads as connected — like a hand",
      "held.",
      "Each controller is a rounded body with two grips, a round d-pad on one side",
      "and two small round buttons on the other, drawn as a thick outline with the",
      "background showing through the holes.",
      "The large controller and its cord are warm orange, the small one and its",
      "cord are bright teal.",
      "Bold, simple pictograms, not an illustration of plastic.",
    ].join(" "),
  },
  {
    id: "monsters",
    idea: "A big monster and a small one, standing together.",
    prompt: [
      "Two friendly cartoon monsters standing side by side and facing forward,",
      "drawn as simple bold flat shapes with thick outlines: a LARGE round monster",
      "on the left with two horns, two big eyes and a wide grin showing square",
      "teeth, and a SMALL monster on the right about half its height, one horn,",
      "two big eyes, the same grin.",
      "The small one's arm is raised and resting against the big one's side.",
      "The large monster is warm orange, the small one is bright teal; the eyes",
      "and teeth are the background colour showing through.",
      "Chunky, symmetrical and simple enough to read at the size of a favicon.",
      "Not furry, not detailed, not painted.",
    ].join(" "),
  },
  {
    id: "monsters-pad",
    idea: "Both at once: a big monster and a small one sharing a controller.",
    prompt: [
      "Two friendly cartoon monsters standing side by side and facing forward,",
      "drawn as simple bold flat shapes with thick outlines: a LARGE round monster",
      "on the left with two horns and a wide grin, and a SMALL monster on the",
      "right about half its height with one horn and the same grin.",
      "Between them, held by both, is ONE simple video game controller seen flat",
      "from the front — a rounded body with two grips, a round d-pad and two round",
      "buttons.",
      "The large monster is warm orange, the small one is bright teal, and the",
      "controller between them is cream.",
      "Chunky, symmetrical, and simple enough to read small.",
    ].join(" "),
  },
];

const markPath = (m: Mark) => join(OUT, `art-${m.id}.png`);

async function main(only?: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const picked = only ? MARKS.filter((m) => m.id === only) : MARKS;
  if (picked.length === 0) {
    console.error(`\nNo mark "${only}". Options:\n  ${MARKS.map((m) => m.id).join("\n  ")}\n`);
    process.exit(1);
  }
  // Naming one means you did not like it, so make room for the replacement.
  if (only) for (const m of picked) rmSync(markPath(m), { force: true });

  const todo = picked.filter((m) => !existsSync(markPath(m)));
  console.log(`\nAsulins art — ${todo.length} to draw, ${picked.length - todo.length} on disk\n`);

  for (const mark of todo) {
    process.stdout.write(`   ${mark.id.padEnd(14)} `);
    const images = await generate(`${mark.prompt} ${STYLE.join(" ")}`, { aspectRatio: "16:9" });
    const image = images[0];
    if (!image) {
      console.log("FAILED — nothing came back");
      continue;
    }
    await download(image.url, markPath(mark));
    console.log("OK");
  }
  console.log(`\n   → ${OUT}\n   Next: bash scripts/studio-lockups.sh\n`);
}

await main(process.argv[2]);
