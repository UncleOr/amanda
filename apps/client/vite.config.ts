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
  // The workspace packages ship as TypeScript source; let Vite transform them
  // through its normal pipeline instead of pre-bundling.
  optimizeDeps: {
    exclude: ["@amanda/shared", "@amanda/engine"],
  },
}));
