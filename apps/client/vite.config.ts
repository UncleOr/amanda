import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

/**
 * Give the service worker a new cache name on every build.
 *
 * ═══ WHY THIS MATTERS MORE THAN IT LOOKS ═══
 *
 * sw.js treats anything matching .png/.webp/.mp3/.ogg as IMMUTABLE and serves
 * it from cache first, for ever, until the cache NAME changes. That is right
 * for everything under assets/, cards/ and arena/, because Vite gives those
 * hashed filenames — a changed file is a different URL, so it misses the
 * cache by construction.
 *
 * It is wrong for brand/. Those names are stable: `wordmark.png` is always
 * `wordmark.png`. So when the English wordmark was keyed to transparency, a
 * returning player kept the old one — the black box behind the logo, still
 * there days after it was fixed, invisible from here and with nothing they
 * could do about it.
 *
 * Bumping the version by hand was the alternative, and that works until the
 * once it is forgotten, which is the once that ships a logo nobody can
 * explain. The build stamps it instead.
 *
 * ⚠ THIS NO LONGER REACHES THE ARTWORK, and that is the point of the change.
 * The stamp empties the BUILD cache — the page and the hashed code. Pictures
 * and sound live in a second, permanent cache that is pruned file by file
 * against `artManifest()` below, so a deploy costs a returning player the
 * bundle and nothing else. Measured before: every deploy cost them 22MB of
 * artwork, re-fetched one card at a time as they happened to meet it.
 */
function stampServiceWorker() {
  return {
    name: "stamp-service-worker",
    // `writeBundle` and not a transform: sw.js lives in public/ and is copied
    // verbatim, so it never enters the module graph to be transformed.
    writeBundle(options: { dir?: string }) {
      const file = join(options.dir ?? "dist", "sw.js");
      if (!existsSync(file)) return;
      const src = readFileSync(file, "utf8");
      const out = src.replace(
        /const BUILD = "([^"]+)"/,
        `const BUILD = "$1-${Date.now().toString(36)}"`,
      );
      if (out === src) {
        // The shape this depends on is gone. Stopping the build beats shipping
        // a worker that quietly serves last week's bundle.
        throw new Error('sw.js has no `const BUILD = "…"` to stamp');
      }
      writeFileSync(file, out);
    },
  };
}

/**
 * ═══ WHAT EVERY PICTURE CURRENTLY CONTAINS ═══
 *
 * Or: *"in places with no reception the game loads without pictures."*
 *
 * The service worker can now keep artwork in a cache that a deploy does NOT
 * empty — which is the whole fix — but only if something can tell it which
 * files actually changed. That is this: one hash per image, video and sound
 * in the site, written next to them at build time.
 *
 * Without it the worker would face the same choice it used to face, between
 * serving a wordmark that was fixed last week and losing 82 card portraits
 * every time anything at all is deployed. The hashes are what let it do
 * neither. See apps/client/public/sw.js.
 *
 * EAGER vs LAZY is a measurement, not a guess. A cold home screen pulls
 * 1.8MB; the whole library is 22MB. `eager` is the 8MB that makes the game
 * WHOLE — icons, the 82 card portraits, arena backdrops, sound effects, the
 * brand furniture — fetched quietly in the background after the game is up.
 * `lazy` is the rest: two music tracks (5MB), the chest scenes (3.1MB) and
 * the two opening films (3MB). Big, late in a session, and kept for ever
 * once seen anyway.
 */
function artManifest() {
  /** Folders worth having before the player goes down a lift. */
  const EAGER_DIRS = ["cards", "arena", "icons", "sfx", "emoji", "surfaces"];
  const ART = /\.(png|webp|jpe?g|svg|mp3|ogg|mp4|webm)$/i;
  const VIDEO = /\.(mp4|webm)$/i;

  return {
    name: "art-manifest",
    // Same reason as the worker's stamp: these files live in public/ and are
    // copied verbatim, so they never enter the module graph.
    writeBundle(options: { dir?: string }) {
      const dir = options.dir ?? "dist";
      const all: Record<string, string> = {};
      const eager: Record<string, string> = {};

      const walk = (abs: string, rel: string) => {
        for (const entry of readdirSync(abs, { withFileTypes: true })) {
          const next = join(abs, entry.name);
          const path = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            // Vite's own output is hashed, so it is already immutable by
            // name and belongs to the build's cache, not the permanent one.
            if (path !== "assets") walk(next, path);
            continue;
          }
          if (!ART.test(entry.name)) continue;
          const hash = createHash("sha1").update(readFileSync(next)).digest("hex").slice(0, 8);
          all[path] = hash;
          const top = path.split("/")[0] ?? "";
          /*
           * brand/ is split rather than taken whole: the wordmark, the
           * banner and the twenty avatars are furniture the home screen
           * cannot do without, while intro-he.mp4 and intro-en.mp4 are 1.5MB
           * each and play once, ever.
           *
           * Two videos are furniture all the same and are named here: the
           * ident is 69KB and opens the game, and amanda_idle.webm is the
           * Amanda who breathes on the home screen behind every button. A
           * home screen missing her is the thing being fixed, not a saving.
           */
          const KEEP_VIDEO = ["ident.mp4", "amanda_idle.webm"];
          const wanted =
            EAGER_DIRS.includes(top) ||
            (top === "brand" && (!VIDEO.test(entry.name) || KEEP_VIDEO.includes(entry.name)));
          if (wanted) eager[path] = hash;
        }
      };
      walk(dir, "");

      if (!Object.keys(all).length) {
        // Nothing to describe means the worker would prune the entire art
        // cache against an empty manifest. Stop rather than ship that.
        throw new Error("art-manifest found no artwork in the build output");
      }
      writeFileSync(join(dir, "art.json"), JSON.stringify({ eager, all }));
    },
  };
}

export default defineConfig(({ command }) => ({
  // Where the site is served from. GitHub Pages puts it under /amanda/; Vercel
  // (and any root domain) serves it at /. Set VITE_BASE_PATH to override —
  // the Pages workflow passes /amanda/, Vercel passes nothing and gets /.
  base: command === "build" ? (process.env.VITE_BASE_PATH ?? "/amanda/") : "/",
  plugins: [react(), stampServiceWorker(), artManifest()],
  // Stamped into the build so the app can show which version is running —
  // the difference between "it is broken" and "you are on an old copy".
  define: {
    __BUILD_ID__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    ),
  },
  server: {
    // Allow importing the shared card JSON that lives at the repo root /data.
    fs: { allow: [repoRoot] },
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * ═══ PIXI IS ONE FILE, AND THAT IS A BUG FIX ═══
         *
         * Or, at the end of a tutorial stage: *"it said it could not show me
         * the battle."* The reason was printed underneath it —
         *
         *     Failed to fetch dynamically imported module:
         *     .../assets/WebGLRenderer-CF5Wwt7Y.js
         *
         * Pixi does not load its renderer until `Application.init()` runs,
         * which is the moment the battle starts. The Arena chunk itself is
         * prefetched the second the build phase opens (App.tsx), so the one
         * piece that arrives late is the one piece nobody pulled early.
         *
         * Every deploy gives these files new hashed names and the old ones
         * stop existing. A page that has been open across a deploy — which
         * is every page, while this game is worked on daily — then asks for
         * a file that is gone, mid-match, and the arena cannot draw.
         *
         * Merging pixi into one chunk means the renderer rides along with
         * everything else pixi needs, and the prefetch pulls all of it while
         * the page is still young. A deploy cannot break a file the browser
         * already has.
         */
        manualChunks(id: string) {
          if (id.includes("node_modules/pixi.js") || id.includes("node_modules/@pixi")) {
            return "pixi";
          }
          return undefined;
        },
      },
    },
  },
  // The workspace packages ship as TypeScript source; let Vite transform them
  // through its normal pipeline instead of pre-bundling.
  optimizeDeps: {
    exclude: ["@amanda/shared", "@amanda/engine"],
  },
}));
