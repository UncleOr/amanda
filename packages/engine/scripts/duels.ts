/**
 * Every card against every other card, and what each one's record is next to
 * what it COSTS.
 *
 *   pnpm --filter @amanda/engine duels
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * `measure.ts` asks whether a MATCH is a fight. It cannot see one card being
 * wrong, because a board of thirteen hides it. When twenty cards arrive at
 * once — the Machines and the Sea Dwellers did — the question is narrower and
 * nothing answered it: is any of them winning more than it is paid for?
 *
 * A price band is a promise. `cardCost.ts` says what a card costs out of a
 * deck's budget, and the promise that makes a budget mean anything is that a
 * 2 loses to a 5 more often than not. A card that breaks that is not
 * "strong" — it is mispriced, and the deck builder is lying to a child about
 * what their points bought.
 *
 * ═══ WHAT A DUEL IS HERE ═══
 *
 * Three copies of one card against three of another, with a very tough King
 * behind each so the duel is decided by the duel rather than by a King
 * falling over. Both orderings are played, because side A reaches the middle
 * first. A draw counts half.
 *
 * It is a PROBE, not a verdict: one card three times over is not a deck, and
 * a card built to stand beside other cards (the Repair Rig, the Assembly
 * Line) will read low here and be right. What it catches is the outlier —
 * the cheap card with a champion's record.
 */
import { runBattle } from "../src/index.js";
import type { Placement } from "../src/index.js";
import { CARDS } from "../../art/src/catalog.js";
import { cardCost, type Card } from "@amanda/shared";

/** Tough enough that nobody snipes it, armed enough not to be a free kill. */
const KING = {
  id: "duel_king",
  seriesId: "system",
  numberInSeries: 1,
  name: { he: "מלך", en: "King" },
  elements: ["earth"],
  rarity: "common",
  stats: { hp: 6000, power: 120, attackSpeed: 2, moveSpeed: 0, range: "melee" },
  flying: false,
  targeting: "lane",
  midBoss: false,
  launch: false,
  abilities: [],
  art: { placeholderColor: "#888", sprite: null },
} as unknown as Card;

const cards = [...CARDS.values()].filter((c) => c.launch && c.id !== "crumb_demon");
const catalog = new Map<string, Card>([[KING.id, KING], ...cards.map((c) => [c.id, c] as const)]);

/** Three copies: two in the front corners, one in the back, so no single lane decides it. */
function board(owner: "A" | "B", id: string) {
  const placements: Placement[] = [
    { cardId: KING.id, x: 1, y: 1, king: true },
    { cardId: id, x: 3, y: 0 },
    { cardId: id, x: 3, y: 3 },
    { cardId: id, x: 0, y: 0 },
  ];
  return { owner, placements };
}

const score = new Map(cards.map((c) => [c.id, { w: 0, l: 0, d: 0 }]));

for (let i = 0; i < cards.length; i++) {
  for (let j = i + 1; j < cards.length; j++) {
    for (const [x, y] of [
      [cards[i]!.id, cards[j]!.id],
      [cards[j]!.id, cards[i]!.id],
    ]) {
      const r = runBattle({
        seed: 11,
        catalog,
        synergies: [],
        a: board("A", x!),
        b: board("B", y!),
        recordFrames: false,
      });
      const sx = score.get(x!)!;
      const sy = score.get(y!)!;
      if (r.winner === "A") (sx.w++, sy.l++);
      else if (r.winner === "B") (sy.w++, sx.l++);
      else (sx.d++, sy.d++);
    }
  }
}

const rows = cards
  .map((c) => {
    const s = score.get(c.id)!;
    const n = s.w + s.l + s.d;
    return { c, cost: cardCost(c), pct: Math.round((100 * (s.w + s.d / 2)) / n), ...s };
  })
  .sort((p, q) => q.pct - p.pct);

console.log("\n  card                      cost   win%     W/L/D   series");
for (const r of rows)
  console.log(
    `  ${r.c.name.en.padEnd(24)} ${String(r.cost).padStart(4)} ${String(r.pct).padStart(6)}% ` +
      `${`${r.w}/${r.l}/${r.d}`.padStart(9)}   ${r.c.seriesId}`,
  );

console.log("\n  average win% by cost — this is the line that has to slope up:");
const byCost = new Map<number, number[]>();
for (const r of rows) byCost.set(r.cost, [...(byCost.get(r.cost) ?? []), r.pct]);
for (const k of [...byCost.keys()].sort()) {
  const v = byCost.get(k)!;
  const avg = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  console.log(`    cost ${k}: ${String(avg).padStart(3)}%  (${v.length} cards)`);
}

console.log("\n  by series:");
const bySeries = new Map<string, number[]>();
for (const r of rows) bySeries.set(r.c.seriesId, [...(bySeries.get(r.c.seriesId) ?? []), r.pct]);
for (const [k, v] of [...bySeries].sort())
  console.log(
    `    ${k.padEnd(10)} ${String(Math.round(v.reduce((a, b) => a + b, 0) / v.length)).padStart(3)}%  (${v.length} cards)`,
  );
console.log();
