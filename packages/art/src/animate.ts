/**
 * A looping clip of Amanda barely moving, for the home screen.
 *
 *   pnpm art:animate
 *
 * Generates once and keeps the result: `assets/raw/brand/amanda_idle.mp4` is
 * the source of truth, and this skips the (paid, slow) generation if it is
 * already there. Delete that file to redo it.
 *
 * The clip is then made to loop SEAMLESSLY by playing it forwards and then
 * backwards — a generated video never ends where it began, and a hero image
 * that visibly snaps every five seconds is worse than one that does not move.
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { animate, download, uploadFile } from "./fal.js";
import { REPO_ROOT } from "./catalog.js";

const RAW = join(REPO_ROOT, "assets", "raw", "brand");
const OUT = join(REPO_ROOT, "apps", "client", "public", "brand");

/** ffmpeg from winget, falling back to whatever is on PATH. */
function ffmpeg(): string {
  const winget = join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
  );
  return existsSync(winget) ? winget : "ffmpeg";
}

const BRIEF = [
  // Or, on the first attempt: the movement is too big. SHE does not move —
  // the wind does. So this says so four different ways, because a video model
  // will happily animate a whole character if you leave it any room to.
  "Animate ONLY the wind and the background of this still illustration.",
  "THE CHARACTER IS COMPLETELY STILL: her body, head, face, arms, hands and",
  "shoulders do not move at all, not even slightly. She does not breathe, blink,",
  "turn, lean, gesture or shift her weight. Treat her body as a frozen photograph.",
  "What moves: strands of her hair lift and settle in a breeze, the hem and folds",
  "of her long dress sway gently at the bottom, the floating runes drift slowly,",
  "the embers and sparks rise, and the teal flame and the lion's mane flicker.",
  "THE CAMERA IS LOCKED: no zoom, no pan, no push in, no drift, no parallax.",
  "Nothing enters or leaves the frame. Barely perceptible — this sits behind a",
  "menu and must never pull the eye.",
].join(" ");

async function main(): Promise<void> {
  const still = join(RAW, "amanda_banner.png");
  const mp4 = join(RAW, "amanda_idle.mp4");

  if (!existsSync(still)) {
    console.error(`Missing ${still} — run \`pnpm art:brand\` first.`);
    process.exit(1);
  }

  if (existsSync(mp4)) {
    console.log("   skip  generation (assets/raw/brand/amanda_idle.mp4 exists)");
  } else {
    process.stdout.write("   uploading the still ... ");
    const url = await uploadFile(still);
    console.log("OK");
    process.stdout.write("   animating (this takes a few minutes) ... ");
    const videoUrl = await animate(url, BRIEF, { seconds: "5" });
    if (!videoUrl) {
      console.log("FAILED — no video came back");
      process.exit(1);
    }
    await download(videoUrl, mp4);
    console.log("OK");
  }

  // Forward then backward, so the last frame IS the first frame.
  process.stdout.write("   making it loop seamlessly ... ");
  const webm = join(OUT, "amanda_idle.webm");
  execFileSync(
    ffmpeg(),
    [
      "-y",
      "-i", mp4,
      "-filter_complex",
      // scale down (it only ever sits behind a menu), then ping-pong
      "[0:v]scale=1280:-2,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]",
      "-map", "[v]",
      "-an",
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", "40",
      "-row-mt", "1",
      webm,
    ],
    { stdio: "pipe" },
  );
  console.log("OK");
  console.log(`\nDone -> ${webm}\n`);
}

main().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
