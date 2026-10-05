/**
 * Balance probe: run many battles between random full boards and report how
 * they end. Used to answer "is a match a fight, or a race to snipe a King?"
 *
 *   pnpm --filter @amanda/engine measure [runs]
 */
import { SIMULATION } from "@amanda/shared";
import { runBattle, buildReport, type Placement } from "../src/index.js";
import { CARDS, SERIES } from "../../art/src/catalog.js";

const launch = [...CARDS.values()].filter((c) => c.launch);
const pool = launch.map((c) => c.id);
const rnd = (n: number) => Math.floor(Math.random() * n);

function board(owner: "A" | "B"): { owner: "A" | "B"; placements: Placement[] } {
  const ps: Placement[] = [{ cardId: pool[rnd(pool.length)]!, x: 1, y: 1, king: true }];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue;
      ps.push({ cardId: pool[rnd(pool.length)]!, x, y });
    }
  return { owner, placements: ps };
}

const runs = Number(process.argv[2] ?? 300);
const catalog = new Map(CARDS);
let kingDown = 0;
let timeout = 0;
let totalTicks = 0;
const quick: number[] = [];
let rangedKingKills = 0;

for (let i = 0; i < runs; i++) {
  const r = runBattle({
    seed: i,
    catalog,
    synergies: SERIES.map((s) => ({
      seriesId: s.id,
      threshold: s.synergy.threshold,
      ability: s.synergy.ability,
    })),
    a: board("A"),
    b: board("B"),
  });
  totalTicks += r.ticks;
  if (r.winReason === "kingDown") {
    kingDown++;
    quick.push(r.ticks);
    const rep = buildReport(r, catalog);
    const killer = [...rep.sides.A.units, ...rep.sides.B.units]
      .filter((u) => u.kills > 0)
      .sort((a, b) => b.damageDealt - a.damageDealt)[0];
    const card = killer ? catalog.get(killer.cardId) : undefined;
    if (card && card.stats.range !== "melee") rangedKingKills++;
  } else timeout++;
}

const TPS = SIMULATION.ticksPerSecond;
const under5 = quick.filter((t) => t < TPS * 5).length;
console.log(`runs                    ${runs}`);
console.log(`decided by a King dying ${kingDown} (${Math.round((kingDown / runs) * 100)}%)`);
console.log(`ran out of time         ${timeout} (${Math.round((timeout / runs) * 100)}%)`);
console.log(`average length          ${(totalTicks / runs / TPS).toFixed(1)}s of ${SIMULATION.totalBattleTicks / TPS}s`);
console.log(`King deaths under 5s    ${under5} (${kingDown ? Math.round((under5 / kingDown) * 100) : 0}% of them)`);
console.log(`top damage was a ranged unit in ${rangedKingKills}/${kingDown} King-death matches`);
