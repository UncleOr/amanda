/**
 * Merge a batch of English into data/copy.en.json.
 *
 *   node scripts/copy-en-merge.mjs batch.json
 *
 * The batch is { id: "English" }. Existing entries are not overwritten
 * unless --force is passed, so running a batch twice is harmless and a
 * correction has to be deliberate.
 *
 * The document is regenerated afterwards by `pnpm copy`, which reads this
 * file back into the אנגלית column — so the English Or reviews is the
 * English the game will use.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EN = join(ROOT, "data", "copy.en.json");
const MAP = join(ROOT, "docs", "copy.map.json");
const FORCE = process.argv.includes("--force");
const file = process.argv[2];

if (!file) {
  console.error("usage: node scripts/copy-en-merge.mjs <batch.json> [--force]");
  process.exit(1);
}

const known = new Set(JSON.parse(readFileSync(MAP, "utf8")).map((e) => e.id));
const current = existsSync(EN) ? JSON.parse(readFileSync(EN, "utf8")) : {};
const batch = JSON.parse(readFileSync(file, "utf8"));

let added = 0;
let kept = 0;
const unknown = [];
for (const [id, text] of Object.entries(batch)) {
  if (!known.has(id)) {
    unknown.push(id);
    continue;
  }
  if (current[id] && !FORCE) {
    kept++;
    continue;
  }
  current[id] = text;
  added++;
}

writeFileSync(EN, JSON.stringify(current, null, 1) + "\n", "utf8");
console.log(`${added} written, ${kept} already there, ${unknown.length} unknown ids`);
for (const id of unknown.slice(0, 10)) console.log(`   unknown: ${id}`);
console.log(`${Object.keys(current).length} of ${known.size} strings now have English.`);
