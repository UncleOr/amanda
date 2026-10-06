import { ARENA, SIMULATION } from "@amanda/shared";
import type { Element, LocalizedString } from "@amanda/shared";
import { isAhead, sharesLane } from "./combat.js";
import type { BattleState, Owner, Unit } from "./types.js";

const TPS = SIMULATION.ticksPerSecond;

/**
 * Operations the simulation exposes to ability handlers so they can spawn or
 * destroy units without a circular import. simulate.ts supplies the concrete
 * implementations.
 */
export interface BattleOps {
  killUnit(u: Unit, killer: Unit | null): void;
  spawnChild(proto: ChildProto): Unit;
}

export interface ChildProto {
  owner: Owner;
  facing: 1 | -1;
  col: number;
  lane: number;
  hp: number;
  power: number;
  attackSpeed: number;
  moveSpeed: number;
  element: Element;
  name: LocalizedString;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}
function clampCol(col: number): number {
  return Math.min(ARENA.width, Math.max(0, col));
}
/**
 * Clamp to THIS battle's lanes rather than the constant. In Amanda mode the
 * arena is eight lanes deep, and a knockback that clamped to four would have
 * flung half the board into lane 3.
 */
function clampLane(state: BattleState, lane: number): number {
  return Math.min(state.lanes - 1, Math.max(0, lane));
}

/**
 * Recompute every unit's aura-derived multipliers from scratch. Called each
 * tick, so auras are stateless and deterministic.
 */
export function runAuras(state: BattleState): void {
  for (const u of state.units) {
    if (!u.alive) continue;
    u.damageTakenMult = 1;
    u.attackSpeedMult = 1;
    u.moveSlowMult = 1;
    u.auraArmor = 0;
  }
  for (const src of state.units) {
    if (!src.alive) continue;
    for (const ab of src.abilities) {
      if (ab.trigger !== "aura") continue;
      const pct = num(ab.params.pct);
      switch (ab.type) {
        case "damageReductionAura":
          for (const ally of state.units)
            if (ally.alive && ally.owner === src.owner)
              ally.damageTakenMult *= 1 - pct / 100;
          break;
        case "attackSpeedAura":
          for (const ally of state.units)
            if (ally.alive && ally.owner === src.owner) ally.attackSpeedMult += pct / 100;
          break;
        case "slowAura":
          for (const enemy of state.units)
            if (enemy.alive && enemy.owner !== src.owner && sharesLane(enemy, src))
              enemy.moveSlowMult *= 1 - pct / 100;
          break;
        case "armorAura":
          for (const ally of state.units)
            if (ally.alive && ally.owner === src.owner)
              ally.auraArmor += num(ab.params.armor, 100);
          break;
        case "healAura":
          // Nearby allies only. Healing the whole board meant 50hp/s reached
          // every unit everywhere, which simply outran the damage in the game:
          // a defender under attack could not be killed by arithmetic, and the
          // battle stalled until the clock ran out. A healer now has to be
          // placed near what it is keeping alive.
          for (const ally of state.units)
            if (
              ally.alive &&
              ally.owner === src.owner &&
              ally.hp < ally.maxHp &&
              nearbyLane(src, ally)
            )
              ally.hp = Math.min(ally.maxHp, ally.hp + num(ab.params.hpPerSecond, 50) / TPS);
          break;
        default:
          break;
      }
    }
    // Self-sustain (regen) also recomputed per tick.
    for (const ab of src.abilities) {
      if (ab.trigger === "passive" && ab.type === "regen" && src.hp < src.maxHp) {
        src.hp = Math.min(src.maxHp, src.hp + num(ab.params.hpPerSecond, 40) / TPS);
      }
    }
  }

  /*
   * Series synergies.
   *
   * Who qualifies was settled when the board was built — three of the family
   * TOUCHING each other (Or, 2026-10-06; see synergy.ts). This used to count
   * everything alive of that series anywhere on the board, which is why the
   * count is gone from here: the decision is not made at this point any more,
   * it is made on the building screen where the player can see it.
   */
  if (state.synergies.length > 0) {
    for (const syn of state.synergies) {
      for (const owner of ["A", "B"] as const) {
        const pct = num(syn.ability.params.pct);
        const members = state.units.filter(
          (u) => u.alive && u.owner === owner && u.seriesId === syn.seriesId && u.flags.synergy,
        );
        if (members.length === 0) continue;
        switch (syn.ability.type) {
          case "damageReductionAura":
            for (const m of members) m.damageTakenMult *= 1 - pct / 100;
            break;
          case "attackSpeedAura":
            for (const m of members) m.attackSpeedMult += pct / 100;
            break;
          case "armorAura":
            for (const m of members) m.auraArmor += num(syn.ability.params.armor, 120);
            break;
          case "healAura":
            for (const m of members)
              if (m.hp < m.maxHp)
                m.hp = Math.min(m.maxHp, m.hp + num(syn.ability.params.hpPerSecond, 40) / TPS);
            break;
          case "slowAura":
            for (const e of state.units)
              if (e.alive && e.owner !== owner && members.some((m) => sharesLane(e, m)))
                e.moveSlowMult *= 1 - pct / 100;
            break;
          default:
            break;
        }
      }
    }
  }
}

/**
 * Damage over time, and the lanes that burn.
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * Six abilities were in the card data with no handler in the engine — they
 * were printed on thirteen cards and did nothing. Or asked for cards that beat
 * each other ("if I see the opponent played X it pays me to play Y"), and the
 * answers were already written on the cards; they just were not wired up.
 *
 * Poison is the answer to a wall. It ignores armor and it ignores how much
 * health something has, because it ramps: every hit adds a stack, and the
 * stacks keep burning whether or not the poisoner is still alive. A Venom
 * Scorpion with 400hp loses a straight fight to a 2500hp Titan King and still
 * kills it, which is exactly the shape a counter should have.
 *
 * Lane denial is the answer to a column. Stack a lane with cheap bodies and
 * the lava dragon ahead of it bills every one of them per second.
 *
 * Both are applied here rather than in an aura pass because both can kill, and
 * killing needs the simulation's own bookkeeping (death events, the King's
 * loss condition, what drops out of a stack).
 */
export function runDamageOverTime(state: BattleState, ops: BattleOps): void {
  // A lane that burns: anything of the other side standing ahead of the source
  // in its lane pays per second, armor or no armor.
  for (const src of state.units) {
    if (!src.alive) continue;
    for (const ab of src.abilities) {
      if (ab.type !== "lineDenialDot") continue;
      const dps = num(ab.params.dps, 100);
      for (const enemy of state.units) {
        if (!enemy.alive || enemy.owner === src.owner) continue;
        if (!sharesLane(enemy, src) || !isAhead(src, enemy)) continue;
        enemy.hp -= dps / TPS;
      }
    }
  }

  // Stacks already on a unit keep burning; the poisoner does not have to live.
  for (const u of state.units) {
    if (!u.alive) continue;
    const dps = num(u.flags.dotDps, 0);
    if (dps > 0) u.hp -= dps / TPS;
  }

  for (const u of state.units) {
    if (u.alive && u.hp <= 0) ops.killUnit(u, null);
  }
}

/** The most stacks one unit can be carrying. Enough to kill a King, not instantly. */
const MAX_DOT_STACKS = 8;

/**
 * Add one poison stack to the target.
 *
 * Stacks from different poisoners add together, which is the combo half of
 * Or's ask: two cheap insects do what neither of them can do alone.
 */
function addDotStack(target: Unit, perStack: number): void {
  const stacks = num(target.flags.dotStacks, 0);
  if (stacks >= MAX_DOT_STACKS) return;
  target.flags.dotStacks = stacks + 1;
  target.flags.dotDps = num(target.flags.dotDps, 0) + perStack;
}

/**
 * Effects that fire as a unit swings, before the blow lands.
 *
 * `onCollision` is folded in here on purpose: the engine has no separate
 * collision event, and a melee unit's first swing at something IS the moment
 * it met it in the lane. Pretending otherwise would mean a new event type that
 * fires at exactly the same instant.
 */
export function runOnAttack(state: BattleState, u: Unit, target: Unit): void {
  for (const ab of u.abilities) {
    if (ab.trigger !== "onAttack" && ab.trigger !== "onCollision") continue;
    switch (ab.type) {
      case "pullVacuum": {
        // Every few seconds, drag the enemy line one step closer. The answer
        // to a board that wants to keep its distance and shoot.
        const every = num(ab.params.everySeconds, 6);
        const last = num(u.flags.lastPullTick, -Infinity);
        if (state.tick - last < every * TPS) break;
        u.flags.lastPullTick = state.tick;
        const slots = num(ab.params.slots, 1);
        let pulled = 0;
        for (const enemy of state.units) {
          if (!enemy.alive || enemy.owner === u.owner || enemy.isKing) continue;
          if (enemy.knockbackImmune || enemy.moveSpeed <= 0) continue;
          // Toward the thing doing the pulling, worked out from where it
          // actually is. Deriving it from the victim's facing was wrong, and
          // wrong in the most embarrassing direction: it pushed them away.
          const toward = Math.sign(u.col - enemy.col) || 1;
          enemy.col = clampCol(enemy.col + toward * slots);
          pulled++;
        }
        if (pulled > 0)
          state.events.push({ tick: state.tick, type: "knockback", uid: u.uid, targetUid: target.uid, col: target.col });
        break;
      }
      case "absorbOnCollision": {
        // Swallowed: held and unable to act. Once per victim, so a slow blob
        // cannot keep one card stunned for the whole battle.
        const key = `absorbed:${target.uid}`;
        if (u.flags[key]) break;
        u.flags[key] = true;
        const until = state.tick + Math.round(num(ab.params.stunSeconds, 3) * TPS);
        target.stunnedUntil = Math.max(target.stunnedUntil, until);
        target.flags.rooted = true;
        state.events.push({ tick: state.tick, type: "stun", uid: u.uid, targetUid: target.uid, untilTick: until });
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Which other enemies a wide attack also catches.
 *
 * The counter to anything that multiplies. Swarms and splitters fan out into
 * NEIGHBOURING lanes when they die, so the one thing that undoes them is a
 * swing that covers lanes rather than one that hits hard.
 */
export function rowAttackTargets(state: BattleState, u: Unit, target: Unit): Unit[] {
  const ab = u.abilities.find((a) => a.type === "aoeRowAttack");
  if (!ab) return [];
  // `lanes` is the total width of the swing, so a 3 reaches one lane each way.
  const reach = Math.floor((num(ab.params.lanes, 2) - 1) / 2) || 1;
  const hit: Unit[] = [];
  for (const other of state.units) {
    if (!other.alive || other === target || other.owner === u.owner) continue;
    // Beside the real target, not merely somewhere on the board.
    const beside = other.lanes.some((l) => target.lanes.some((tl) => Math.abs(tl - l) <= reach));
    if (!beside) continue;
    if (Math.abs(other.col - target.col) > 1.5) continue;
    hit.push(other);
  }
  return hit;
}

/**
 * The ally that takes part of a blow aimed at this one.
 *
 * The protector half of Or's ask: a Pudding Shield next to something fragile
 * and expensive turns it from a card that dies first into a card that fights.
 * Returns the sharer and the fraction it absorbs.
 */
export function damageSharer(
  state: BattleState,
  target: Unit,
): { ally: Unit; pct: number } | null {
  for (const ally of state.units) {
    if (!ally.alive || ally === target || ally.owner !== target.owner) continue;
    if (!nearbyLane(ally, target)) continue;
    if (Math.abs(ally.col - target.col) > 1.5) continue;
    const ab = ally.abilities.find((a) => a.type === "damageShareAdjacent");
    if (!ab) continue;
    return { ally, pct: num(ab.params.pct, 50) };
  }
  return null;
}

/** One-time effects that fire when the battle begins. */
export function runOnSpawn(state: BattleState, ops: BattleOps): void {
  for (const u of state.units) {
    if (!u.alive) continue;
    for (const ab of u.abilities) {
      if (ab.trigger !== "onSpawn") continue;
      if (ab.type === "sacrificeAdjacent") {
        // Consume the weakest adjacent same-owner, non-King ally for armor.
        const victim = state.units
          .filter(
            (o) =>
              o.alive &&
              o !== u &&
              o.owner === u.owner &&
              !o.isKing &&
              o.lanes.some((l) => u.lanes.some((ul) => Math.abs(ul - l) <= 1)),
          )
          .sort((a, b) => a.hp - b.hp)[0];
        if (victim) ops.killUnit(victim, u);
        u.armor += num(ab.params.armorGain, 300);
      }
    }
  }
}

/** Time-triggered effects (delayed transforms). */
export function runDelayed(state: BattleState, u: Unit): void {
  const elapsed = state.tick / TPS;
  for (const ab of u.abilities) {
    if (ab.trigger !== "delayed") continue;
    if (ab.type === "delayedTransform" && !u.flags.transformed) {
      if (elapsed >= num(ab.params.afterSeconds, 10)) {
        u.power += num(ab.params.powerBonus, 0);
        u.flags.transformed = true;
      }
    }
  }
}

/** Attacker-side effects that fire when a hit lands. */
export function runOnHit(state: BattleState, attacker: Unit, target: Unit): void {
  for (const ab of attacker.abilities) {
    if (ab.trigger !== "onHit") continue;
    switch (ab.type) {
      case "knockback":
        if (!target.knockbackImmune) {
          target.col = clampCol(target.col + attacker.facing * num(ab.params.slots, 1));
          state.events.push({ tick: state.tick, type: "knockback", uid: attacker.uid, targetUid: target.uid, col: target.col });
        }
        break;
      case "sideKnockback":
        if (!target.knockbackImmune && target.lanes.length === 1) {
          const from = target.lanes[0]!;
          const to = clampLane(state, from + (from < state.lanes - 1 ? 1 : -1) * num(ab.params.columns, 1));
          target.lanes = [to];
          state.events.push({ tick: state.tick, type: "knockback", uid: attacker.uid, targetUid: target.uid, lanes: target.lanes });
        }
        break;
      case "freezeOnHit": {
        const until = state.tick + Math.round(num(ab.params.freezeSeconds, 2) * TPS);
        target.stunnedUntil = Math.max(target.stunnedUntil, until);
        if (ab.params.resetCooldown) target.attackCooldown = target.attackSpeed;
        state.events.push({ tick: state.tick, type: "stun", uid: attacker.uid, targetUid: target.uid, untilTick: until });
        break;
      }
      case "armorBreak":
        target.armor = 0;
        break;
      case "stackingDot":
        // The point of poison: it does not care about armor, and it does not
        // care how much health the thing in front of it has.
        addDotStack(target, num(ab.params.dotPerStack, 40));
        break;
      case "elementSteal":
        if (!attacker.flags.elementStolen) {
          attacker.activeElement = target.activeElement;
          attacker.flags.elementStolen = true;
        }
        break;
      default:
        break;
    }
  }
}

/** Target-side reaction to taking damage. Returns reflected damage dealt back. */
/** Within one lane of each other — the reach of an aura that is not global. */
function nearbyLane(a: Unit, b: Unit): boolean {
  return a.lanes.some((la) => b.lanes.some((lb) => Math.abs(la - lb) <= 1));
}

export function runOnDamaged(target: Unit, attacker: Unit, damage: number): number {
  let reflected = 0;
  for (const ab of target.abilities) {
    if (ab.trigger !== "onDamaged") continue;
    if (ab.type === "damageReflect") {
      reflected += Math.floor((damage * num(ab.params.pct, 0)) / 100);
    }
  }
  if (reflected > 0) attacker.hp -= reflected;
  return reflected;
}

/** Attacker-side effect after a kill (trample = keep momentum). */
export function runOnKill(attacker: Unit): void {
  for (const ab of attacker.abilities) {
    if (ab.trigger === "onKill" && ab.type === "trample") {
      attacker.attackCooldown = 0; // immediately ready to engage the next target
    }
  }
}

/** Death-triggered spawning effects (split / swarm). */
export function runOnDeath(state: BattleState, ops: BattleOps, u: Unit): void {
  for (const ab of u.abilities) {
    if (ab.trigger !== "onDeath") continue;
    if (ab.type === "splitOnDeath" || ab.type === "swarmOnDeath") {
      const count = num(ab.params.count, 2);
      const hp = num(ab.params.childHp ?? ab.params.spiritHp, Math.floor(u.maxHp / 2));
      const power = num(ab.params.childPower ?? ab.params.spiritPower, Math.floor(u.power / 2));
      const baseLane = u.lanes[0]!;
      const childUids: string[] = [];
      for (let i = 0; i < count; i++) {
        // fan out into adjacent lanes: 0 -> same, then ±1, ±2 …
        const offset = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2);
        const child = ops.spawnChild({
          owner: u.owner,
          facing: u.facing,
          col: u.col,
          lane: clampLane(state, baseLane + offset),
          hp,
          power,
          attackSpeed: u.attackSpeed,
          moveSpeed: u.moveSpeed > 0 ? u.moveSpeed : 1,
          element: u.activeElement,
          name: u.name,
        });
        childUids.push(child.uid);
      }
      state.events.push({ tick: state.tick, type: "split", uid: u.uid, childUids });
    }
  }
}

/** Effects when a stacked (Ground Floor) card is revealed. */
export function runOnReveal(state: BattleState, u: Unit): void {
  for (const ab of u.abilities) {
    if (ab.trigger === "onReveal" && ab.type === "rootOnReveal") {
      // Root the enemy directly ahead in this lane.
      const enemy = state.units.find(
        (e) => e.alive && e.owner !== u.owner && sharesLane(e, u),
      );
      if (enemy) enemy.flags.rooted = true;
    }
  }
}
