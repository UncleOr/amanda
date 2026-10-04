import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CRUMB_DEMON, parseSeries, type Card } from "@amanda/shared";

const here = dirname(fileURLToPath(import.meta.url));
const seriesDir = join(here, "..", "..", "..", "data", "series");

const series = readdirSync(seriesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => parseSeries(JSON.parse(readFileSync(join(seriesDir, f), "utf8"))));

/** Every monster card the server may need to instantiate a battle, by id. */
export const CATALOG = new Map<string, Card>();
for (const s of series) for (const c of s.cards) CATALOG.set(c.id, c);

CATALOG.set("crumb_demon", {
  id: "crumb_demon",
  seriesId: "system",
  numberInSeries: 1,
  name: { he: "מפלץ פירורים", en: "Crumb Demon" },
  elements: ["earth"],
  rarity: "common",
  stats: { hp: CRUMB_DEMON.hp, power: CRUMB_DEMON.power, attackSpeed: CRUMB_DEMON.attackSpeed, moveSpeed: 0, range: "melee" },
  flying: false,
  midBoss: false,
  launch: false,
  abilities: [],
  art: { placeholderColor: "#7a7a7a", sprite: null },
});

/** Series synergies applied in battle (same as the client passes). */
export const SYNERGIES = series.map((s) => ({
  seriesId: s.id,
  threshold: s.synergy.threshold,
  ability: s.synergy.ability,
}));

console.log(`[content] loaded ${CATALOG.size} cards, ${SYNERGIES.length} synergies`);
