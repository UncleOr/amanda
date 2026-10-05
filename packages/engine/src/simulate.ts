import { ARENA, RANGE_REACH, SIMULATION } from "@amanda/shared";
import {
  runAuras,
  runDelayed,
  runOnDamaged,
  runOnDeath,
  runOnHit,
  runOnKill,
  runOnReveal,
  runOnSpawn,
  type BattleOps,
} from "./abilities.js";
import {
  computeDamage,
  gapAhead,
  isAhead,
  leftEdge,
  rightEdge,
  sharesLane,
} from "./combat.js";
import { buildBattle, createUnitFromCard, type BattleSetup } from "./setup.js";
import type {
  BattleFrame,
  BattleResult,
  BattleState,
  Owner,
  Unit,
  WinReason,
} from "./types.js";

const TPS = SIMULATION.ticksPerSecond;
const DT = 1 / TPS;
/** Column distance at which a melee unit is "touching" its target. */
const MELEE_REACH = 0.6;

interface TargetPick {
  unit: Unit;
  gap: number;
}

/**
 * Choose a unit's current target within its lane(s) and facing direction.
 * Melee/ranged hit the nearest enemy in the path; snipers ignore near targets
 * and hit the farthest (the enemy back row).
 */
function pickTarget(state: BattleState, u: Unit): TargetPick | null {
  const ahead = state.units.filter(
    (e) => e.alive && e.owner !== u.owner && sharesLane(e, u) && isAhead(u, e),
  );
  if (ahead.length === 0) return null;

  let best = ahead[0]!;
  let bestGap = gapAhead(u, best);
  const wantFarthest = u.range === "sniper";
  for (const e of ahead) {
    const g = gapAhead(u, e);
    if (wantFarthest ? g > bestGap : g < bestGap) {
      best = e;
      bestGap = g;
    }
  }
  return { unit: best, gap: bestGap };
}

function inAttackRange(u: Unit, gap: number): boolean {
  // Melee must be in contact; everything else has a reach in columns (see
  // RANGE_REACH). The epsilon absorbs float rounding when a unit halts exactly
  // at the edge of its reach.
  const reach = u.range === "melee" ? MELEE_REACH : RANGE_REACH[u.range];
  return gap <= reach + 1e-6;
}

function effectiveMoveSpeed(u: Unit): number {
  if (u.flags.rooted) return 0;
  return u.moveSpeed * u.moveSlowMult;
}

function effectiveCooldown(u: Unit): number {
  return u.attackSpeed / u.attackSpeedMult;
}

/** Run a full battle deterministically and return the result + event log. */
export function runBattle(setup: BattleSetup): BattleResult {
  const state = buildBattle(setup);
  const catalog = setup.catalog;
  const totalTicks = SIMULATION.totalBattleTicks;
  const frames: BattleFrame[] = [];

  function captureFrame(): void {
    frames.push({
      tick: state.tick,
      units: state.units.map((u) => ({
        uid: u.uid,
        owner: u.owner,
        cardId: u.cardId,
        col: u.col,
        lanes: u.lanes,
        hp: Math.max(0, Math.round(u.hp)),
        maxHp: u.maxHp,
        power: Math.round(u.power),
        alive: u.alive,
        isKing: u.isKing,
      })),
    });
  }

  const spawnChild: BattleOps["spawnChild"] = (proto) => {
    const u: Unit = {
      uid: `u${state.nextUid++}`,
      cardId: "__spawn__",
      seriesId: "",
      owner: proto.owner,
      name: proto.name,
      elements: [proto.element],
      activeElement: proto.element,
      maxHp: proto.hp,
      hp: proto.hp,
      power: proto.power,
      attackSpeed: proto.attackSpeed,
      moveSpeed: proto.moveSpeed,
      range: "melee",
      flying: false,
      isKing: false,
      col: proto.col,
      width: 1,
      lanes: [proto.lane],
      facing: proto.facing,
      attackCooldown: 0,
      armor: 0,
      stunnedUntil: -1,
      knockbackImmune: false,
      damageTakenMult: 1,
      attackSpeedMult: 1,
      moveSlowMult: 1,
      auraArmor: 0,
      abilities: [],
      alive: true,
      below: null,
      flags: {},
    };
    state.units.push(u);
    state.events.push({
      tick: state.tick,
      type: "spawn",
      uid: u.uid,
      cardId: u.cardId,
      owner: u.owner,
      col: u.col,
      lanes: u.lanes,
    });
    return u;
  };

  /** Reveal the Ground-Floor card underneath a freshly-dead unit. */
  function reveal(dead: Unit): void {
    if (!dead.below) return;
    const card = catalog.get(dead.below.cardId);
    if (!card) return;
    const u = createUnitFromCard(state, card, dead.owner, {
      col: dead.col,
      lanes: [dead.lanes[0]!],
      width: 1,
      facing: dead.facing,
      isKing: false,
      below: null,
    });
    state.units.push(u);
    state.events.push({
      tick: state.tick,
      type: "reveal",
      uid: u.uid,
      revealedCardId: card.id,
      owner: u.owner,
      col: u.col,
      lanes: u.lanes,
    });
    runOnReveal(state, u);
  }

  const killUnit: BattleOps["killUnit"] = (u) => {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    state.events.push({ tick: state.tick, type: "death", uid: u.uid });
    reveal(u);
    runOnDeath(state, ops, u);
    if (u.isKing) {
      // The King's death ends the match; its owner loses.
      state.winner = u.owner === "A" ? "B" : "A";
      state.winReason = "kingDown";
      state.ended = true;
    }
  };

  const ops: BattleOps = { killUnit, spawnChild };

  function performAttack(u: Unit, target: Unit): void {
    state.events.push({ tick: state.tick, type: "attack", uid: u.uid, targetUid: target.uid });
    const dmg = computeDamage(u.power, u.activeElement, target);
    target.hp -= dmg;
    state.events.push({
      tick: state.tick,
      type: "hit",
      uid: u.uid,
      targetUid: target.uid,
      damage: dmg,
      targetHp: Math.max(0, target.hp),
    });
    runOnHit(state, u, target);
    runOnDamaged(target, u, dmg);

    if (target.hp <= 0 && target.alive) {
      killUnit(target, u);
      if (u.alive) runOnKill(u); // trample: keep momentum
    }
    if (u.hp <= 0 && u.alive) killUnit(u, target); // died to reflected damage
  }

  function moveUnit(u: Unit, nearest: Unit | null): void {
    const step = effectiveMoveSpeed(u) * DT;
    let next = u.col + u.facing * step;
    if (nearest) {
      if (u.facing > 0) {
        const limit = leftEdge(nearest) - MELEE_REACH - u.width / 2;
        if (next > limit) next = Math.max(u.col, limit);
      } else {
        const limit = rightEdge(nearest) + MELEE_REACH + u.width / 2;
        if (next < limit) next = Math.min(u.col, limit);
      }
    }
    u.col = Math.min(ARENA.width, Math.max(0, next));
  }

  function step(): void {
    state.tick++;
    runAuras(state);
    // Stable iteration order (array order) keeps the simulation deterministic.
    const acting = state.units.filter((u) => u.alive);
    for (const u of acting) {
      if (state.ended) break;
      if (!u.alive) continue;

      runDelayed(state, u);
      u.attackCooldown = Math.max(0, u.attackCooldown - DT);
      if (state.tick < u.stunnedUntil) continue; // frozen / stunned

      const picked = pickTarget(state, u);
      if (picked && inAttackRange(u, picked.gap)) {
        if (u.attackCooldown <= 0 && u.power > 0) {
          performAttack(u, picked.unit);
          u.attackCooldown = effectiveCooldown(u);
        }
      } else if (effectiveMoveSpeed(u) > 0) {
        moveUnit(u, picked?.unit ?? null);
      }
    }
  }

  function resolveTimeout(): void {
    // No King destroyed within the time limit → decide by a tiebreak chain so a
    // match is NEVER a draw.
    const kingFrac = (owner: Owner): number => {
      const k = state.units.find((u) => u.isKing && u.owner === owner);
      return k && k.alive ? k.hp / k.maxHp : 0;
    };
    const totalHp = (owner: Owner): number =>
      state.units.reduce((s, u) => (u.alive && u.owner === owner ? s + u.hp : s), 0);
    const aliveCount = (owner: Owner): number =>
      state.units.reduce((n, u) => (u.alive && u.owner === owner ? n + 1 : n), 0);

    const tiebreaks: Array<[WinReason, (o: Owner) => number]> = [
      ["kingHp", kingFrac],
      ["totalHp", totalHp],
      ["aliveCount", aliveCount],
    ];
    for (const [reason, metric] of tiebreaks) {
      const a = metric("A");
      const b = metric("B");
      if (a !== b) {
        state.winner = a > b ? "A" : "B";
        // Record WHICH link of the chain decided it, and by how much, so the
        // result screen can explain a loss where nothing of yours even died.
        state.winReason = reason;
        state.tiebreak = { reason, a, b };
        state.ended = true;
        return;
      }
    }
    // Perfectly even → a deterministic coin flip (seeded), still never a draw.
    state.winner = state.rng.next() < 0.5 ? "A" : "B";
    state.winReason = "coinFlip";
    state.tiebreak = { reason: "coinFlip", a: 0, b: 0 };
    state.ended = true;
  }

  // --- run ---
  runOnSpawn(state, ops);
  if (setup.recordFrames) captureFrame();
  while (!state.ended && state.winner === null && state.tick < totalTicks) {
    step();
    if (setup.recordFrames) captureFrame();
  }
  if (state.winner === null && !state.ended) resolveTimeout();

  state.events.push({ tick: state.tick, type: "win", winner: state.winner });

  return {
    winner: state.winner,
    ticks: state.tick,
    winReason: state.winReason,
    tiebreak: state.tiebreak,
    events: state.events,
    finalUnits: state.units,
    frames,
  };
}
