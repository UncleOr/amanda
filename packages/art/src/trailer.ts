/**
 * The trailer's opening: eight cinematic shots, generated.
 *
 *   pnpm art:trailer stills            every frame that is not on disk yet
 *   pnpm art:trailer stills 05-bread   that one again (it is deleted first)
 *   pnpm art:trailer sheet             a contact sheet of whatever exists
 *   pnpm art:trailer motion            five seconds of movement per frame
 *
 * ═══ STILLS FIRST. ALWAYS. ═══
 *
 * Or: *"approve a storyboard with me first so we don't waste money for
 * nothing."* A still is about fifteen cents and takes under a minute; the
 * motion is twice that and takes several. So the money is spent in the order
 * that wastes least: generate all eight stills, look at the sheet, delete
 * the frames that came back wrong, regenerate just those, and only animate
 * once the whole sheet is right.
 *
 * ═══ THE DIRECTORY IS THE APPROVAL ═══
 *
 * Nothing here has an --approve flag, because a flag is a second place to
 * forget something. `stills` skips any frame already on disk and `motion`
 * animates exactly the frames that are on disk. So rejecting a shot is
 * deleting its png, and approving it is leaving it alone.
 *
 * Everything lands in assets/raw/trailer/, which is outside the client and
 * never shipped. scripts/make-trailer.sh does the cutting afterwards.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO_ROOT } from "./catalog.js";
import { SHOTS, OPENING_SECONDS, type Shot } from "./trailerShots.js";
import { animate, download, generateWithReference, uploadFile } from "./fal.js";

const OUT = join(REPO_ROOT, "assets", "raw", "trailer");
const STILLS = join(OUT, "stills");
const CLIPS = join(OUT, "clips");
const SHEET = join(OUT, "storyboard.png");

const stillPath = (s: Shot) => join(STILLS, `${s.id}.png`);
const clipPath = (s: Shot) => join(CLIPS, `${s.id}.mp4`);

/** ffmpeg from winget, falling back to whatever is on PATH. Same as animate.ts. */
function ffmpeg(): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

/**
 * Reference images are uploaded once per run and reused.
 *
 * Eight shots share five references between them; uploading the dragon four
 * separate times is four times the wait for the same bytes.
 */
const uploaded = new Map<string, string>();
async function refUrl(path: string): Promise<string> {
  const had = uploaded.get(path);
  if (had) return had;
  if (!existsSync(path)) throw new Error(`reference missing: ${path}`);
  const url = await uploadFile(path);
  uploaded.set(path, url);
  return url;
}

async function cmdStills(only?: string): Promise<void> {
  const shots = only ? SHOTS.filter((s) => s.id === only) : SHOTS;
  if (only && shots.length === 0) {
    console.error(`\nNo shot called "${only}". Options:\n  ${SHOTS.map((s) => s.id).join("\n  ")}\n`);
    process.exit(1);
  }
  mkdirSync(STILLS, { recursive: true });

  // Naming a shot means you did not like what came back, so make room for the
  // replacement — otherwise the skip below would hand you the same frame again.
  const named = shots[0];
  if (only && named) rmSync(stillPath(named), { force: true });

  // Shots that borrow another shot's still go last, so a full run from empty
  // generates the solos first and the group shot sees them.
  const todo = shots
    .filter((s) => !existsSync(stillPath(s)))
    .sort((a, b) => (a.refShots?.length ?? 0) - (b.refShots?.length ?? 0));
  console.log(`\n🎬 Stills — ${todo.length} to generate, ${shots.length - todo.length} already on disk\n`);
  if (todo.length === 0) {
    console.log("   Nothing to do. Delete a png from assets/raw/trailer/stills to redo it.\n");
    return;
  }

  for (const shot of todo) {
    process.stdout.write(`   ${shot.id.padEnd(12)} `);

    /*
     * A shot may reference other shots' approved stills — see refShots. Those
     * have to exist, and saying so here beats letting the upload fail with a
     * path: "needs 03-dragon" tells you to generate it, a missing-file error
     * tells you to go looking.
     */
    const borrowed = (shot.refShots ?? []).map((id) => {
      const from = SHOTS.find((other) => other.id === id);
      if (!from) throw new Error(`${shot.id} references unknown shot "${id}"`);
      const path = stillPath(from);
      if (!existsSync(path)) throw new Error(`${shot.id} needs ${id} — generate that first`);
      return path;
    });

    const urls = await Promise.all([...borrowed, ...shot.refs].map(refUrl));
    const images = await generateWithReference(shot.prompt, urls, { aspectRatio: "16:9" });
    const image = images[0];
    if (!image) {
      console.log("FAILED — nothing came back");
      continue;
    }
    await download(image.url, stillPath(shot));
    console.log("OK");
  }
  console.log();
  await cmdSheet();
}

/**
 * One picture of the whole opening, to look at on a phone.
 *
 * Two columns rather than four: a storyboard judged at thumbnail size is a
 * storyboard approved by mistake, and the thing being judged here is whether
 * a creature survived the trip into 3D.
 */
async function cmdSheet(): Promise<void> {
  const have = SHOTS.filter((s) => existsSync(stillPath(s)));
  if (have.length === 0) {
    console.log("   No stills yet — run `pnpm art:trailer stills` first.\n");
    return;
  }
  const args = ["-y", "-v", "error"];
  for (const s of have) args.push("-i", stillPath(s));

  const tiles = have.map((_, i) => `[${i}:v]scale=720:405,pad=744:429:12:12:color=0x070a12[t${i}]`);
  const rows: string[] = [];
  for (let i = 0; i < have.length; i += 2) {
    const pair = have[i + 1] ? `[t${i}][t${i + 1}]hstack=2` : `[t${i}]pad=1488:429:0:0:color=0x070a12`;
    rows.push(`${pair}[r${rows.length}]`);
  }
  const stack = rows.map((_, i) => `[r${i}]`).join("") + `vstack=${rows.length}[v]`;

  args.push("-filter_complex", [...tiles, ...rows, stack].join(";"), "-map", "[v]", "-frames:v", "1", SHEET);
  execFileSync(ffmpeg(), args, { stdio: "pipe" });

  console.log(`   storyboard → ${SHEET}`);
  console.log(`   ${have.length}/${SHOTS.length} frames · opening runs ${OPENING_SECONDS.toFixed(1)}s\n`);
  for (const s of have) console.log(`     ${s.id.padEnd(12)} ${s.hold.toFixed(1)}s  ${s.he}`);
  console.log();
}

async function cmdMotion(only?: string): Promise<void> {
  const shots = (only ? SHOTS.filter((s) => s.id === only) : SHOTS).filter((s) => existsSync(stillPath(s)));
  if (shots.length === 0) {
    console.error("\nNo approved stills. Run `pnpm art:trailer stills` and keep the good ones.\n");
    process.exit(1);
  }
  mkdirSync(CLIPS, { recursive: true });
  const named = shots[0];
  if (only && named) rmSync(clipPath(named), { force: true });

  const todo = shots.filter((s) => !existsSync(clipPath(s)));
  console.log(`\n🎥 Motion — ${todo.length} clips, a few minutes each\n`);

  for (const shot of todo) {
    process.stdout.write(`   ${shot.id.padEnd(12)} `);
    const url = await uploadFile(stillPath(shot));
    const video = await animate(url, shot.motion, { seconds: "5" });
    if (!video) {
      console.log("FAILED — no video came back");
      continue;
    }
    await download(video, clipPath(shot));
    console.log("OK");
  }
  console.log(`\n   clips → ${CLIPS}\n   Next: bash scripts/make-trailer.sh\n`);
}

const [cmd, arg] = process.argv.slice(2);
const run =
  cmd === "stills" ? cmdStills(arg)
  : cmd === "motion" ? cmdMotion(arg)
  : cmd === "sheet" ? cmdSheet()
  : null;

if (!run) {
  console.error(
    "\n  pnpm art:trailer stills [id]   generate the frames\n" +
      "  pnpm art:trailer sheet         look at them\n" +
      "  pnpm art:trailer motion [id]   animate the ones you kept\n\n" +
      `  shots: ${SHOTS.map((s) => s.id).join(", ")}\n`,
  );
  process.exit(1);
}

run.catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
