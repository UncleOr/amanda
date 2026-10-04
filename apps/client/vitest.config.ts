import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // workspace packages ship as TypeScript source — let Vitest transform them
    server: { deps: { inline: [/@amanda\//] } },
  },
});
