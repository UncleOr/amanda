import { ARENA, SIMULATION } from "@amanda/shared";
import type { Element, LocalizedString } from "@amanda/shared";
import { sharesLane } from "./combat.js";
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
function clampLane(lane: number): number {
  return Math.min(ARENA.lanes - 1, Math.max(0, lane));
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

  // Series synergies: a bonus aura for a family once enough of them are alive.
  if (state.synergies.length > 0) {
    const counts: Record<Owner, Record<string, number>> = { A: {}, B: {} };
    for (const u of state.units)
      if (u.alive && u.seriesId)
        counts[u.owner][u.seriesId] = (counts[u.owner][u.seriesId] ?? 0) + 1;

    for (const syn of state.synergies) {
      for (const owner of ["A", "B"] as const) {
        if ((counts[owner][syn.seriesId] ?? 0) < syn.threshold) continue;
        const pct = num(syn.ability.params.pct);
        const members = state.units.filter(
          (u) => u.alive && u.owner === owner && u.seriesId === syn.seriesId,
        );
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
          const to = clampLane(from + (from < ARENA.lanes - 1 ? 1 : -1) * num(ab.params.columns, 1));
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
          lane: clampLane(baseLane + offset),
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
