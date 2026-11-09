/**
 * End-to-end smoke test on the REAL GDD cards: loads the Dragons and Slimes
 * series from data/, builds two boards, and runs a full deterministic battle.
 *   pnpm --filter @amanda/engine demo
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSeries, type Card } from "@amanda/shared";
import { runBattle, type BattleSetup } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "..", "data", "series");

function loadSeries(file: string) {
  return parseSeries(JSON.parse(readFileSync(join(dataDir, file), "utf8")));
}

const dragons = loadSeries("01-dragons.json");
const slimes = loadSeries("17-slimes.json");

const catalog = new Map<string, Card>();
for (const s of [dragons, slimes]) for (const c of s.cards) catalog.set(c.id, c);

const setup: BattleSetup = {
  seed: 2025,
  catalog,
  a: {
    owner: "A",
    placements: [
      // Advancing bruisers routed into the King's lanes (1 & 2).
      { cardId: "dragons_01_flame_dragon", x: 3, y: 1 },
      { cardId: "dragons_08_ghost_dragon", x: 3, y: 2 },
      // Snipers on the flanks.
      { cardId: "dragons_03_thunderwing", x: 0, y: 0 },
      { cardId: "dragons_09_typhoon_dragon", x: 0, y: 3 },
      { cardId: "dragons_10_sky_king", x: 1, y: 1, king: true },
    ],
  },
  b: {
    owner: "B",
    placements: [
      // Slime blockers guarding the King lanes.
      { cardId: "slimes_01_basic_slime", x: 3, y: 1 },
      { cardId: "slimes_02_gelatinous_cube", x: 3, y: 2 },
      { cardId: "slimes_09_pudding_shield", x: 0, y: 0 },
      { cardId: "slimes_07_floating_brain", x: 0, y: 3 },
      { cardId: "slimes_10_zelig_giant_ooze", x: 1, y: 1, king: true },
    ],
  },
};

const result = runBattle(setup);

const label = { A: "🐉 Dragons", B: "🟢 Slimes" } as const;
console.log("\n⚔️  Amanda — demo auto-battle (Dragons vs Slimes)\n");
console.log(
  `Winner: ${result.winner ? label[result.winner] : "Draw"}  ` +
    `(after ${result.ticks} ticks ≈ ${(result.ticks / 30).toFixed(1)}s)\n`,
);

const byType = new Map<string, number>();
for (const e of result.events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
console.log("Event breakdown:");
for (const [type, n] of byType) console.log(`  ${type.padEnd(10)} ${n}`);

console.log("\nSurvivors:");
for (const u of result.finalUnits.filter((u) => u.alive)) {
  console.log(
    `  ${label[u.owner]}  ${u.name.en.padEnd(22)} hp ${Math.round(u.hp)}/${u.maxHp}` +
      `${u.isKing ? "  👑" : ""}`,
  );
}
console.log("");
