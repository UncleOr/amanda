import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

export default defineConfig(({ command }) => ({
  // Where the site is served from. GitHub Pages puts it under /amanda/; Vercel
  // (and any root domain) serves it at /. Set VITE_BASE_PATH to override —
  // the Pages workflow passes /amanda/, Vercel passes nothing and gets /.
  base: command === "build" ? (process.env.VITE_BASE_PATH ?? "/amanda/") : "/",
  plugins: [react()],
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
