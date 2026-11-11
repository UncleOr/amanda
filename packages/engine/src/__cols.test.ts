import { describe, expect, it } from "vitest";
import { runBattle } from "./simulate.js";
import type { Card } from "@amanda/shared";
const BASE = { seriesId: "furries", number: 1, rarity: "common", elements: ["electric"], midBoss: false, launch: true, art: { placeholderColor: "#888", sprite: null } } as never;
const card = (id: string): Card => ({ ...(BASE as object), id, name: { he: id, en: id }, flying: false, targeting: "lane", stats: { hp: 999999, power: 0, attackSpeed: 0.5, moveSpeed: 0, range: "ranged" }, abilities: [] }) as unknown as Card;
const CATALOG = new Map([["m", card("m")]]);
describe("cols", () => { it("prints", () => {
  const r = runBattle({ a: { owner: "A", placements: [0,1,2,3].map((x) => ({ cardId: "m", x, y: 0 })) },
    b: { owner: "B", placements: [0,1,2,3].map((x) => ({ cardId: "m", x, y: 0 })) },
    seed: 1, catalog: CATALOG, synergies: [] });
  console.log(r.finalUnits.map((u) => `${u.owner}:col${u.col}`).join("  "));
  expect(1).toBe(1);
}); });
