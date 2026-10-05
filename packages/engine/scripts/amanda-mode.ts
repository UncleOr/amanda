/**
 * Amanda mode, run headlessly before any of it reaches a screen.
 *
 * Or asked for this to be tested because it has "a lot of potential for bugs,
 * or just things that do not add up because we did not think it through". He
 * is right, and a boss fight is exactly the kind of thing that looks fine in a
 * diagram and is unplayable in practice. This answers, in order:
 *
 *   1. Does an eight-lane arena even run?
 *   2. Do units in lanes 4-7 actually fight, or do they stand there?
 *   3. Is she beatable by two boards, and unbeatable by one?
 *   4. How long does it take?
 *
 *   pnpm --filter @amanda/engine amanda [runs]
 */
import { ARENA, BOARD } from "@amanda/shared";
import { runBattle, type Placement } from "../src/index.js";
import { CARDS, SERIES } from "../../art/src/catalog.js";

const AMANDA = "legends_01_amanda";
/** Both players' boards stacked on one side: four lanes each, eight in all. */
const AMANDA_LANES = BOARD.height * 2;

const launch = [...CARDS.values()].filter((c) => c.launch);
const rnd = (n: number) => Math.floor(Math.random() * n);

/** One player's 4×4, offset into its half of the eight-lane side. */
function playerHalf(laneOffset: number, withKing: boolean): Placement[] {
  const dps = (id: string) => {
    const c = CARDS.get(id)!;
    return c.stats.attackSpeed > 0 ? c.stats.power / c.stats.attackSpeed : 0;
  };
  const ranked = launch.map((c) => c.id).sort((a, b) => dps(b) - dps(a));
  const tanks = launch
    .filter((c) => c.stats.moveSpeed === 0)
    .sort((a, b) => b.stats.hp - a.stats.hp)
    .map((c) => c.id);

  const out: Placement[] = [];
  if (withKing) {
    const king = [...launch].sort((a, b) => b.stats.hp - a.stats.hp)[0]!.id;
    out.push({ cardId: king, x: BOARD.kingSlot.x, y: laneOffset + BOARD.kingSlot.y, king: true });
  }
  for (let x = 0; x < BOARD.width; x++) {
    for (let y = 0; y < BOARD.height; y++) {
      const lane = laneOffset + y;
      // skip the 2×2 the King occupies in this half
      if (
        withKing &&
        x >= BOARD.kingSlot.x &&
        x < BOARD.kingSlot.x + BOARD.kingSlot.width &&
        y >= BOARD.kingSlot.y &&
        y < BOARD.kingSlot.y + BOARD.kingSlot.height
      )
        continue;
      const id = x === 3 ? (tanks[rnd(Math.min(4, tanks.length))] ?? ranked[0]!) : ranked[rnd(8)]!;
      out.push({ cardId: id, x, y: lane });
    }
  }
  return out;
}

/** Her side: Amanda as its King, with a guard of the toughest things around. */
function amandaSide(): Placement[] {
  const tanks = launch
    .filter((c) => c.stats.moveSpeed === 0)
    .sort((a, b) => b.stats.hp - a.stats.hp)
    .map((c) => c.id);
  const out: Placement[] = [
    // Her King slot is the centre of the EIGHT lanes, not of four.
    { cardId: AMANDA, x: BOARD.kingSlot.x, y: 3, king: true },
  ];
  for (let x = 0; x < BOARD.width; x++) {
    for (let y = 0; y < AMANDA_LANES; y++) {
      if (x >= 1 && x <= 2 && (y === 3 || y === 4)) continue; // her 2×2
      out.push({ cardId: tanks[rnd(Math.min(6, tanks.length))] ?? launch[0]!.id, x, y });
    }
  }
  return out;
}

function one(bothPlayers: boolean) {
  const players = bothPlayers
    ? [...playerHalf(0, true), ...playerHalf(BOARD.height, true)]
    : playerHalf(0, true);
  const res = runBattle({
    seed: 1 + rnd(2_000_000_000),
    catalog: CARDS,
    synergies: SERIES.flatMap((s) =>
      s.synergy ? [{ seriesId: s.id, threshold: s.synergy.threshold, ability: s.synergy.ability }] : [],
    ),
    a: { owner: "A", placements: players },
    b: { owner: "B", placements: amandaSide() },
    lanes: AMANDA_LANES,
  });
  return res;
}

const runs = Number(process.argv[2] ?? 40);
for (const bothPlayers of [true, false]) {
  let playersWon = 0;
  let seconds = 0;
  let silent = 0;
  let total = 0;
  const why: Record<string, number> = {};
  let amandaHp = 0;
  for (let i = 0; i < runs; i++) {
    const r = one(bothPlayers);
    if (r.winner === "A") playersWon++;
    seconds += r.ticks / 30;
    const key = `${r.winner}:${r.winReason}${r.tiebreak ? "/" + r.tiebreak : ""}`;
    why[key] = (why[key] ?? 0) + 1;
    const her = (r.units ?? []).find((u) => u.cardId === AMANDA);
    if (her) amandaHp += (her.hpLeft ?? 0) / (her.maxHp || 1);
    // A unit that neither dealt nor took damage never joined in. In an arena
    // twice as deep, that is the thing most likely to be quietly broken.
    for (const u of r.units ?? []) {
      total++;
      if ((u.damageDealt ?? 0) === 0 && (u.damageTaken ?? 0) === 0) silent++;
    }
  }
  console.log(
    `${bothPlayers ? "two players" : "ONE player "} — players win ${Math.round(
      (playersWon / runs) * 100,
    )}%  ·  ${(seconds / runs).toFixed(1)}s average  ·  ${
      total ? Math.round((silent / total) * 100) : 0
    }% of units never fought`,
  );
  console.log(
    `              how it ended: ${Object.entries(why)
      .map(([k, v]) => `${k}×${v}`)
      .join("  ")}  ·  Amanda left with ${Math.round((amandaHp / runs) * 100)}% hp`,
  );
}
console.log(`\n(arena ${ARENA.width} wide × ${AMANDA_LANES} lanes)`);
