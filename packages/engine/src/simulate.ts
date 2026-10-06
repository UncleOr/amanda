import { ARENA, RANGE_REACH, SIMULATION, SUDDEN_DEATH } from "@amanda/shared";
import {
  damageSharer,
  rowAttackTargets,
  runAuras,
  runDamageOverTime,
  runDelayed,
  runOnAttack,
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
 * Who is standing between an attacker and the enemy King — the King's actual
 * bodyguards, whatever lane they happen to be in.
 */
function guardsOf(state: BattleState, u: Unit, king: Unit): Unit[] {
  const kingGap = gapAhead(u, king);
  return state.units.filter(
    (e) => e.alive && e.owner === king.owner && !e.isKing && isAhead(u, e) && gapAhead(u, e) < kingGap,
  );
}

/**
 * Choose what a unit is attacking.
 *
 * An ordinary card fights whatever is in front of it, in its own lane. A card
 * whose targeting is "king" hunts the enemy King instead — across the lanes if
 * it has to — and while the King is still shielded it works on the guards
 * standing in the way. Snipers pick the farthest target rather than the
 * nearest; that is what makes them snipers.
 */
function pickTarget(state: BattleState, u: Unit): TargetPick | null {
  const enemies = state.units.filter((e) => e.alive && e.owner !== u.owner && isAhead(u, e));
  if (enemies.length === 0) return null;

  if (u.targeting === "king") {
    /*
     * The NEAREST King, not simply the first one in the list.
     *
     * A side can hold two of them now (Amanda mode: a King per player), and a
     * King-hunter crosses lanes to reach one — so "the first King in the unit
     * array" would send it marching past the crown in front of it to go and
     * find the other player's.
     */
    let king: Unit | undefined;
    let kingGap = Infinity;
    for (const e of enemies) {
      if (!e.isKing) continue;
      const g = gapAhead(u, e);
      if (g < kingGap) {
        king = e;
        kingGap = g;
      }
    }
    if (king) {
      const guards = guardsOf(state, u, king);
      // The King is only reachable once nothing of its own stands in the way.
      const prey = guards.length ? guards : [king];
      let best = prey[0]!;
      let bestGap = gapAhead(u, best);
      for (const e of prey) {
        const g = gapAhead(u, e);
        if (g < bestGap) {
          best = e;
          bestGap = g;
        }
      }
      return { unit: best, gap: bestGap };
    }
    // No King left to hunt: fall through and fight like anything else.
  }

  let ahead = enemies.filter((e) => sharesLane(e, u));
  // A King is shielded by its own units STANDING BETWEEN it and the attacker —
  // not by anything that merely shares the lane. Counting the whole lane meant
  // a 1 HP filler monster parked in the back row made a King untouchable, and
  // sent attackers walking straight past that King to go and kill it.
  const theirKing = ahead.find((e) => e.isKing);
  if (theirKing) {
    const kingGap = gapAhead(u, theirKing);
    const shielded = ahead.some((e) => !e.isKing && gapAhead(u, e) < kingGap);
    if (shielded) ahead = ahead.filter((e) => !e.isKing);
  }
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
      targeting: "lane",
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
      /*
       * A side falls when its LAST King falls.
       *
       * With one King a side that is the same thing it always was. With two —
       * Amanda mode, where two players share one side and bring a King each —
       * it is Or's ruling: "הצד נופל רק כששני המלכים נפלו". Before it, the
       * first crown to drop ended the battle for both players, so one player
       * could be knocked out and take their partner with them before the
       * partner had lost anything.
       */
      const stillStanding = state.units.some(
        (o) => o.alive && o.isKing && o.owner === u.owner,
      );
      if (!stillStanding) {
        state.winner = u.owner === "A" ? "B" : "A";
        state.winReason = "kingDown";
        state.ended = true;
      }
    }
  };

  const ops: BattleOps = { killUnit, spawnChild };

  /**
   * How much harder hits land right now. 1 for the first half of the battle,
   * then climbing to SUDDEN_DEATH.peak by the final tick — the clock itself
   * breaking a deadlock that neither board can.
   */
  function escalation(): number {
    const from = totalTicks * SUDDEN_DEATH.startsAt;
    if (state.tick <= from) return 1;
    const through = (state.tick - from) / Math.max(1, totalTicks - from);
    return 1 + (SUDDEN_DEATH.peak - 1) * Math.min(1, through);
  }

  function performAttack(u: Unit, target: Unit): void {
    state.events.push({ tick: state.tick, type: "attack", uid: u.uid, targetUid: target.uid });
    // Fires as the swing starts, before anything lands: a vacuum drags the
    // line in, a gelatinous cube swallows what walked into it.
    runOnAttack(state, u, target);
    let dmg = computeDamage(u.power * escalation(), u.activeElement, target);

    /*
     * A neighbour can step in front of part of the blow (Pudding Shield).
     * Taken off the top, before the target's own armor has done its work on
     * the rest — a bodyguard throwing itself in the way does not get to use
     * the protected card's armor to do it.
     */
    const share = damageSharer(state, target);
    if (share && dmg > 0) {
      const moved = Math.floor((dmg * share.pct) / 100);
      dmg -= moved;
      share.ally.hp -= moved;
      state.events.push({
        tick: state.tick,
        type: "hit",
        uid: u.uid,
        targetUid: share.ally.uid,
        damage: moved,
        targetHp: Math.max(0, share.ally.hp),
      });
      if (share.ally.hp <= 0 && share.ally.alive) killUnit(share.ally, u);
    }

    target.hp -= dmg;
    state.events.push({
      tick: state.tick,
      type: "hit",
      uid: u.uid,
      targetUid: target.uid,
      damage: dmg,
      targetHp: Math.max(0, target.hp),
    });

    /*
     * A swing wide enough to catch the lanes either side. This is what beats
     * anything that multiplies: swarms and splitters fan out sideways when
     * they die, straight into the arc of the next swing.
     */
    for (const splash of rowAttackTargets(state, u, target)) {
      const extra = computeDamage(u.power * escalation(), u.activeElement, splash);
      splash.hp -= extra;
      state.events.push({
        tick: state.tick,
        type: "hit",
        uid: u.uid,
        targetUid: splash.uid,
        damage: extra,
        targetHp: Math.max(0, splash.hp),
      });
      if (splash.hp <= 0 && splash.alive) killUnit(splash, u);
    }

    runOnHit(state, u, target);
    // Reflected damage is a real hit and has to be recorded as one. Without
    // this a King could kill itself on a thorned defender while its own report
    // showed zero damage taken and no killer — the single most important event
    // of the match, invisible.
    const reflected = runOnDamaged(target, u, dmg);
    if (reflected > 0)
      state.events.push({
        tick: state.tick,
        type: "hit",
        uid: target.uid,
        targetUid: u.uid,
        damage: reflected,
        targetHp: Math.max(0, u.hp),
        reflected: true,
      });

    if (target.hp <= 0 && target.alive) {
      killUnit(target, u);
      if (u.alive) runOnKill(u); // trample: keep momentum
    }
    if (u.hp <= 0 && u.alive) killUnit(u, target); // died to reflected damage
  }

  /**
   * The closest ally standing between this unit and the enemy, if any.
   * Ground units queue up behind their own front line instead of walking
   * through it; flyers pass over and ignore this entirely.
   */
  function blockingAlly(u: Unit): Unit | null {
    let best: Unit | null = null;
    let bestGap = Infinity;
    for (const o of state.units) {
      if (!o.alive || o === u || o.owner !== u.owner) continue;
      if (!sharesLane(o, u) || !isAhead(u, o)) continue;
      const gap = gapAhead(u, o);
      if (gap < bestGap) {
        best = o;
        bestGap = gap;
      }
    }
    return best;
  }

  /** How close a unit will stand behind the ally in front of it. */
  const FOLLOW_GAP = 0.15;
  /** Lanes crossed per second by a unit moving toward a target beside it. */
  const LANE_CHANGE_PER_SECOND = 1.2;

  /**
   * Drift toward the lane its target is in. A King-hunter has to be able to
   * leave its own lane or it can never reach a King sitting in the middle two.
   * A flyer crosses over whatever is in the way; anything on the ground only
   * steps across into a lane it is not blocked out of.
   */
  function driftTowardLane(u: Unit, target: Unit): void {
    if (u.isKing || u.lanes.length > 1) return; // the King holds its 2x2
    const here = u.lanes[0]!;
    const there = target.lanes[0] ?? here;
    if (here === there) return;

    const progress = (u.flags.laneDrift as number | undefined) ?? 0;
    const next = progress + LANE_CHANGE_PER_SECOND * DT;
    if (next < 1) {
      u.flags.laneDrift = next;
      return;
    }
    const step = there > here ? 1 : -1;
    const want = here + step;
    // On the ground you cannot walk through your own; in the air you can.
    if (!u.flying) {
      const occupied = state.units.some(
        (o) =>
          o.alive &&
          o !== u &&
          o.owner === u.owner &&
          o.lanes.includes(want) &&
          Math.abs(o.col - u.col) < 1,
      );
      if (occupied) return;
    }
    u.lanes = [want];
    u.flags.laneDrift = 0;
  }

  function moveUnit(u: Unit, nearest: Unit | null): void {
    const step = effectiveMoveSpeed(u) * DT;
    let next = u.col + u.facing * step;

    const clampTo = (limit: number) => {
      if (u.facing > 0) next = next > limit ? Math.max(u.col, limit) : next;
      else next = next < limit ? Math.min(u.col, limit) : next;
    };

    // Stop at reach of whatever it is attacking.
    if (nearest)
      clampTo(
        u.facing > 0
          ? leftEdge(nearest) - MELEE_REACH - u.width / 2
          : rightEdge(nearest) + MELEE_REACH + u.width / 2,
      );

    // And stop behind its own front line, unless it can fly over it.
    if (!u.flying) {
      const ally = blockingAlly(u);
      if (ally)
        clampTo(
          u.facing > 0
            ? leftEdge(ally) - FOLLOW_GAP - u.width / 2
            : rightEdge(ally) + FOLLOW_GAP + u.width / 2,
        );
    }

    // Columns are 0..width-1. Clamping to `width` let a unit that had cleared
    // its lane walk one step PAST the last column and stand outside the drawn
    // arena — it simply vanished from the battle.
    u.col = Math.min(ARENA.width - 1, Math.max(0, next));
  }

  function step(): void {
    state.tick++;
    runAuras(state);
    // Poison and burning lanes, after the auras that could have healed through
    // them and before anybody acts. Both can kill, so this runs with the
    // simulation's own death bookkeeping available to it.
    runDamageOverTime(state, ops);
    // Stable iteration order (array order) keeps the simulation deterministic.
    const acting = state.units.filter((u) => u.alive);
    for (const u of acting) {
      if (state.ended) break;
      if (!u.alive) continue;

      runDelayed(state, u);
      u.attackCooldown = Math.max(0, u.attackCooldown - DT);
      if (state.tick < u.stunnedUntil) continue; // frozen / stunned

      const picked = pickTarget(state, u);
      // A card that hunts the King has to be able to cross to it. Static cards
      // stay put and shoot; only something that can move changes lane.
      if (picked && u.targeting === "king" && effectiveMoveSpeed(u) > 0)
        driftTowardLane(u, picked.unit);
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
    lanes: state.lanes,
  };
}
