/**
 * What is wrong with the computer's board, measured rather than guessed.
 *
 * Or's idea: *"tuning the AI from the battle report's finding codes — what
 * are you planning there?"* This is the first half of the answer, and it has
 * to come first: eleven finding codes are already emitted after every battle
 * (packages/engine/src/report.ts), and nobody has ever counted them.
 *
 * ═══ WHAT IT DOES ═══
 *
 * Plays the bot against a board built the way a person builds one, several
 * hundred times, and counts how often each finding lands on each side. A code
 * that fires far more often for the bot than for the player is a habit the
 * bot has and the player does not — which is exactly what a rule change
 * should be aimed at.
 *
 * ═══ WHY IT COMPARES, RATHER THAN JUST COUNTING ═══
 *
 * "The bot has dead weight in 40% of battles" means nothing on its own:
 * everybody does, because a board of thirteen cards always has a passenger.
 * "The bot has dead weight in 40% and the player in 12%" is a finding.
 *
 * Run it with vite-node, NOT tsx — the card catalogue is loaded with
 * `import.meta.glob`, which only Vite understands:
 *
 *   BIN=$(ls -d node_modules/.pnpm/vite-node@...)
 *   cd apps/client && node "$BIN" scripts/bot-report.ts 900 normal
 *
 * (the glob for that path is spelled out in the shell rather than here,
 * because a star followed by a slash closes this comment)
 *
 * ═══ USE AT LEAST 900 RUNS ═══
 *
 * At 200 the ranking is wrong. Measured twice on the SAME code, 200 runs gave
 * a win rate of 57% and then 52%, and put `overkill` at the top of the list —
 * at 900 it is third. Every number below moves by several points between
 * runs, so a rule change worth keeping has to beat that, not just beat the
 * last measurement.
 *
 * ═══ WHAT IT SAID, AND WHAT CAME OF IT ═══
 *
 * Baseline over 900 battles: the bot wins ~52-55%, and its three habits are
 * laneCollapse +22, diedToThorns +19..23, overkill +17.
 *
 * Two rule changes were tried against that, and BOTH WERE THROWN AWAY. They
 * are written down here so nobody spends an afternoon rediscovering them:
 *
 *   SPREAD THE DAMAGE EVENLY ACROSS LANES. Made it worse: the win rate fell
 *   to 47% and lane collapse went from +4 to +19. Every lane became too weak
 *   to kill what was in front of it, which is the opposite of the goal.
 *
 *   PUT TOUGH CARDS ALONG THE WHOLE FRONT ROW, not just the two guard posts.
 *   Did nothing to the win rate and made lane collapse slightly worse
 *   (+22 → +26).
 *
 * ═══ AND THE THING THAT EXPLAINS IT ═══
 *
 * The planner chooses PLACEMENT and nothing else. Who a unit attacks is
 * decided by the engine, at the time, from the board in front of it — so
 * `overkill` and `diedToThorns` are outcomes of targeting that no amount of
 * clever placing can reach. Only `laneCollapse` is really placement's to fix,
 * and two honest attempts at it both made things worse.
 *
 * Which suggests the bot does not need to be cleverer. If anything it needs a
 * difficulty DIAL — an easy one for a seven-year-old, which is the thing
 * docs/TASKS.md has been calling "בוט קליל" all along.
 */
import { buildReport, runBattle, type Placement } from "@amanda/engine";
import { CATALOG, SERIES } from "../src/data/catalog";
import { __testing } from "../src/game/useMatch";

const RUNS = Number(process.argv[2] ?? 300);
/** Which setting of the difficulty dial to measure. */
const LEVEL = (process.argv[3] ?? "normal") as "easy" | "normal" | "hard";

const synergies = [...SERIES.values()].map((s) => ({
  seriesId: s.id,
  threshold: s.synergy.threshold,
  ability: s.synergy.ability,
}));

/**
 * A board built the way a child builds one.
 *
 * NOT the bot's own planner with a different seed — that would compare the
 * bot to itself and every difference would be noise. A person puts their
 * toughest thing in front, their favourite in the middle, and fills the rest
 * in roughly at random, which is what this does.
 */
function humanish(): Placement[] {
  const pool = [...CATALOG.values()].filter((c) => c.launch && c.id !== "crumb_demon");
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
  const byHp = [...pool].sort((a, b) => b.stats.hp - a.stats.hp);

  const out: Placement[] = [
    { cardId: byHp[Math.floor(Math.random() * 4)]!.id, x: 1, y: 1, king: true },
  ];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue; // the King's 2x2
      // Front row gets something tough, because that is what people do.
      const card = x === 3 ? pick(byHp.slice(0, 8)) : pick(pool);
      out.push({ cardId: card.id, x, y });
    }
  return out;
}

const counts = { bot: new Map<string, number>(), human: new Map<string, number>() };
const bump = (who: "bot" | "human", code: string) =>
  counts[who].set(code, (counts[who].get(code) ?? 0) + 1);

let botWins = 0;
let seconds = 0;

for (let i = 0; i < RUNS; i++) {
  // The bot is side B, the person side A — the same way round as a real match.
  const res = runBattle({
    seed: 1 + Math.floor(Math.random() * 2_000_000_000),
    catalog: CATALOG,
    synergies,
    a: { owner: "A", placements: humanish() },
    b: { owner: "B", placements: __testing.generateAiPlan(undefined, LEVEL) },
    recordFrames: false,
  });
  if (res.winner === "B") botWins++;
  seconds += res.ticks / 30;
  // The report is built from the result rather than carried on it — see
  // buildReport. Nothing here needs frames, so the battles run without them.
  for (const f of buildReport(res, CATALOG).findings)
    bump(f.owner === "B" ? "bot" : "human", f.code);
}

const pct = (n: number) => `${Math.round((n / RUNS) * 100)}%`;
const codes = [...new Set([...counts.bot.keys(), ...counts.human.keys()])].sort();

console.log(`\n${RUNS} battles · bot wins ${pct(botWins)} · ${(seconds / RUNS).toFixed(1)}s average\n`);
console.log("  finding          bot     person   gap");
console.log("  ───────────────────────────────────────");
const gaps: Array<[string, number]> = [];
for (const code of codes) {
  const b = counts.bot.get(code) ?? 0;
  const h = counts.human.get(code) ?? 0;
  const gap = (b - h) / RUNS;
  gaps.push([code, gap]);
  const flag = Math.abs(gap) >= 0.12 ? (gap > 0 ? "  ← the bot's habit" : "  ← the bot avoids") : "";
  console.log(
    `  ${code.padEnd(15)} ${pct(b).padStart(5)}  ${pct(h).padStart(6)}  ${(gap >= 0 ? "+" : "") + Math.round(gap * 100)}%${flag}`,
  );
}

console.log("\nWhat to aim a rule change at, worst first:");
for (const [code, gap] of gaps.sort((x, y) => y[1] - x[1]).slice(0, 3))
  console.log(`  ${code}  (${gap > 0 ? "+" : ""}${Math.round(gap * 100)} points)`);
console.log("");
