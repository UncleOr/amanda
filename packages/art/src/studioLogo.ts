/**
 * Asulins — the studio ident.
 *
 *   pnpm --filter @amanda/art exec tsx src/studioLogo.ts marks
 *   pnpm --filter @amanda/art exec tsx src/studioLogo.ts marks 3   (that one again)
 *   pnpm --filter @amanda/art exec tsx src/studioLogo.ts sheet
 *
 * Or: *"shall we also do an animated logo opener for Asulins, my and Hod's
 * development company? A logo that's maybe about father and son? But with
 * some gaming element? Approve a logo with me first before animating, of
 * course."*
 *
 * ═══ THE MARK ONLY. THE NAME IS TYPESET AFTERWARDS. ═══
 *
 * Nothing generated here contains a letter. Amanda's English wordmark came
 * back spelled correctly, which was luck as much as prompting — and a studio
 * name misspelt by one letter, in the thing that plays before every single
 * launch, is the worst place in the whole product for that to happen.
 *
 * So the model draws the MARK and the name is set in a font, where the
 * spelling is a fact rather than an outcome.
 *
 * ═══ WHY ALL FOUR ARE TWO SHAPES ═══
 *
 * An ident is three seconds long and ends up the size of a favicon, so every
 * one of these is built from a big shape and a small shape. That IS the
 * father and the son, and it is also the only version of the idea that
 * survives being shrunk — an illustration of a man and a boy at a console
 * reads at 1080p and is a smudge anywhere else.
 *
 * Each one also has an obvious motion beat, because animating it is the next
 * step and a mark with no moving parts gets animated by fading it in.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";
import { generate, download } from "./fal.js";

const OUT = join(REPO_ROOT, "assets", "raw", "studio");
const SHEET = join(OUT, "marks.png");

/** The ident plays into the game, so it is built on the game's own black. */
const BG = "#070A12";

const STYLE = [
  "A FLAT VECTOR LOGO MARK, the kind a game studio puts on a business card:",
  "clean geometry, solid shapes, thick confident edges, no gradients, no",
  "shading, no 3D, no bevel, no glow, no drop shadow, no texture, no sketch",
  "lines.",
  `The background is ONE FLAT SOLID COLOUR filling the entire frame, hex ${BG}.`,
  "A plain unbroken field of that colour — not a checkerboard, not a grid, not",
  "a gradient, not a pattern, not a mockup, not a business card, not a",
  "photograph of a logo printed on something.",
  "The mark is CENTRED, fills the middle half of the frame, and is drawn in",
  "two colours against that background.",
  "ABSOLUTELY NO TEXT. No letters, no words, no numbers, no signature, no",
  "caption, no watermark. The picture contains the symbol and nothing else.",
].join(" ");

interface Mark {
  id: string;
  /** What it is and why. For us; never sent. */
  idea: string;
  /** The motion beat it is built for. */
  beat: string;
  prompt: string;
}

const MARKS: Mark[] = [
  {
    id: "1-high-five",
    idea: "A tall blocky figure and a short one, hands meeting above the small head.",
    beat: "The small one runs in from the side and the hands clap together.",
    prompt: [
      "Two simple blocky pixel-art figures standing side by side and facing",
      "forward, drawn as solid silhouettes with no faces and no detail: one TALL",
      "adult figure and one SHORT child figure beside it, about two thirds its",
      "height. Their nearest arms are raised and their hands meet in a high five",
      "above the small one's head, so the two bodies and the joined arms enclose",
      "one clean triangle of empty space between them.",
      "The tall figure is warm orange, the short one is bright teal.",
      "Built from large square blocks with hard corners, like two characters from",
      "an 8-bit game simplified all the way down to a logo.",
    ].join(" "),
  },
  {
    id: "2-monogram-a",
    idea: "A capital A built from a tall figure and a short one. A monogram.",
    beat: "The two strokes slide together and the crossbar snaps in.",
    prompt: [
      "A geometric symbol shaped like a capital letter A, built out of two",
      "simplified human figures leaning against each other: a TALL figure forming",
      "the right stroke, a SHORTER figure forming the left stroke, their heads",
      "meeting at the apex, and one straight horizontal bar between them forming",
      "the crossbar, like an arm laid across a shoulder.",
      "It must read first as a triangle-topped letterform and only second as two",
      "people. Thick even strokes, sharp corners, a symmetrical overall",
      "silhouette, a clear triangular hole under the apex.",
      "The tall stroke is warm orange; the short stroke and the crossbar are",
      "bright teal.",
      "A geometric mark, not an illustration of people.",
    ].join(" "),
  },
  {
    id: "3-two-buttons",
    idea: "A controller face: one big button, one small. Pure geometry.",
    beat: "The small button presses, then the big one, then both light up.",
    prompt: [
      "A simple geometric emblem: a rounded square plate carrying two circles",
      "arranged like the action buttons on a game controller. One circle is LARGE",
      "and sits lower left; the other is SMALLER, about half its diameter, and",
      "sits upper right, overlapping the big one's edge so the two rings touch.",
      "Each circle is a thick ring with a hollow centre showing the background",
      "through it. The large ring is warm orange, the small ring is bright teal,",
      "and the plate behind them is a thin dim grey outline.",
      "Flat, mechanical, extremely simple — a mark that still reads at the size",
      "of a favicon.",
    ].join(" "),
  },
  {
    id: "4-two-lives",
    idea: "Two pixel hearts, big and small: the life counter in an old game.",
    beat: "The big heart beats once and the small one answers.",
    prompt: [
      "Two hearts drawn in chunky 8-bit pixel-art style, made of large visible",
      "square pixels with hard stepped edges, like the life counter in an old",
      "arcade game. One heart is LARGE; the other is SMALLER, about half its size,",
      "and overlaps the lower right of the big one so their outlines interlock",
      "into one connected shape.",
      "The large heart is warm orange, the small heart is bright teal.",
      "Completely flat, no gradient inside the pixels, no glow. A clean symbol,",
      "not an illustration.",
    ].join(" "),
  },
];

function ffmpeg(): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

const markPath = (m: Mark) => join(OUT, `${m.id}.png`);

async function cmdMarks(only?: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const picked = only ? MARKS.filter((m) => m.id.startsWith(only)) : MARKS;
  if (picked.length === 0) {
    console.error(`\nNo mark "${only}". Options:\n  ${MARKS.map((m) => m.id).join("\n  ")}\n`);
    process.exit(1);
  }
  // Naming one means you did not like it, so make room for the replacement.
  if (only) for (const m of picked) rmSync(markPath(m), { force: true });

  const todo = picked.filter((m) => !existsSync(markPath(m)));
  console.log(`\nAsulins — ${todo.length} to draw, ${picked.length - todo.length} already on disk\n`);

  for (const mark of todo) {
    process.stdout.write(`   ${mark.id.padEnd(16)} `);
    const images = await generate(`${mark.prompt} ${STYLE}`, { aspectRatio: "1:1" });
    const image = images[0];
    if (!image) {
      console.log("FAILED — nothing came back");
      continue;
    }
    await download(image.url, markPath(mark));
    console.log("OK");
  }
  console.log();
  cmdSheet();
}

/** All four side by side, to look at on a phone. */
function cmdSheet(): void {
  const have = MARKS.filter((m) => existsSync(markPath(m)));
  if (have.length === 0) {
    console.log("   Nothing drawn yet.\n");
    return;
  }
  const args = ["-y", "-v", "error"];
  for (const m of have) args.push("-i", markPath(m));
  const tiles = have.map((_, i) => `[${i}:v]scale=440:440,pad=460:470:10:10:color=0x070a12[t${i}]`);
  const rows: string[] = [];
  for (let i = 0; i < have.length; i += 2) {
    const pair = have[i + 1] ? `[t${i}][t${i + 1}]hstack=2` : `[t${i}]pad=920:470:0:0:color=0x070a12`;
    rows.push(`${pair}[r${rows.length}]`);
  }
  const stack = rows.map((_, i) => `[r${i}]`).join("") + `vstack=${rows.length}[v]`;
  args.push("-filter_complex", [...tiles, ...rows, stack].join(";"), "-map", "[v]", "-frames:v", "1", SHEET);
  execFileSync(ffmpeg(), args, { stdio: "pipe" });

  console.log(`   sheet → ${SHEET}\n`);
  for (const m of have) {
    console.log(`     ${m.id.padEnd(16)} ${m.idea}`);
    console.log(`${" ".repeat(22)}↳ ${m.beat}`);
  }
  console.log();
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "marks") await cmdMarks(arg);
else if (cmd === "sheet") cmdSheet();
else {
  console.error("\n  marks [id]   draw them\n  sheet        look at them\n");
  process.exit(1);
}
