import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
        /const VERSION = "([^"]+)"/,
        `const VERSION = "$1-${Date.now().toString(36)}"`,
      );
      if (out === src) {
        // The shape this depends on is gone. Stopping the build beats shipping
        // a worker that quietly serves last week's artwork.
        throw new Error('sw.js has no `const VERSION = "…"` to stamp');
      }
      writeFileSync(file, out);
    },
  };
}

export default defineConfig(({ command }) => ({
  // Where the site is served from. GitHub Pages puts it under /amanda/; Vercel
  // (and any root domain) serves it at /. Set VITE_BASE_PATH to override —
  // the Pages workflow passes /amanda/, Vercel passes nothing and gets /.
  base: command === "build" ? (process.env.VITE_BASE_PATH ?? "/amanda/") : "/",
  plugins: [react(), stampServiceWorker()],
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
