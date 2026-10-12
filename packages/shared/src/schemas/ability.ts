import { z } from "zod";
import { LocalizedStringSchema } from "./common.js";

/**
 * WHEN an ability fires. The deterministic battle engine evaluates abilities
 * by matching their trigger against events it emits each tick.
 */
export const ABILITY_TRIGGERS = [
  "onSpawn", // when the card enters the battle
  "onAttack", // each time it starts an attack
  "onHit", // when its attack lands on a target
  "onKill", // when its attack destroys a target
  "onDamaged", // when it takes damage
  "onDeath", // when it is destroyed
  "onCollision", // when it meets an enemy in its lane
  "onReveal", // when uncovered under a stack ("Ground Floor")
  "delayed", // fires once after params.afterSeconds
  "aura", // continuous, area effect while alive
  "passive", // continuous, self effect while alive
] as const;
export const AbilityTriggerSchema = z.enum(ABILITY_TRIGGERS);
export type AbilityTrigger = z.infer<typeof AbilityTriggerSchema>;

/**
 * WHAT an ability does. This enum is intentionally the single growth point of
 * the engine: to add a new card behavior you add a type here and one handler
 * in the engine — the JSON data and the rest of the pipeline are untouched.
 * Seeded from the mechanics of the 20 cards already written in the GDD.
 */
export const ABILITY_TYPES = [
  // --- movement / displacement ---
  "knockback", // push the target back N slots
  "sideKnockback", // push the target sideways to an adjacent lane
  "trample", // continue advancing after a kill
  "pullVacuum", // pull advancing enemies one slot toward center
  "rootOnReveal", // glue the enemy in front so it cannot move
  "knockbackImmune", // cannot be pushed back
  // --- defensive ---
  "damageReflect", // return a % of damage taken to the attacker
  "armorGain", // gain flat armor (blocks damage instances)
  "armorBreak", // destroy the target's armor on hit
  "armorAura", // grant flat armor to allies in range while alive
  "damageShareAdjacent", // absorb a % of damage aimed at neighbors
  "damageReductionAura", // reduce incoming damage for allies in range
  // --- sustain ---
  "regen", // heal self over time
  "healAura", // heal allies in range over time
  // --- offensive / control ---
  "aoeRowAttack", // hit across multiple lanes at once
  "lineDenialDot", // leave a lingering damage-over-time zone in the lane
  "freezeOnHit", // stun target + reset its attack cooldown
  "stackingDot", // poison that ramps up per stack
  "absorbOnCollision", // swallow a colliding enemy, stunning it
  "slowAura", // slow enemies advancing through the lane
  "attackSpeedAura", // buff attack speed of nearby allies
  /*
   * The series bonus, and now the ONLY series bonus.
   *
   * Or: *"make it +20% power and +20% health, the same for everyone."* Six
   * families had six different bonuses — armour, attack speed, slow, healing
   * — which is six rules to learn before the one thing they share, that
   * three of a family TOUCHING is worth building for, has landed at all.
   *
   * Applied once at setup, not per tick: see packages/engine/src/setup.ts.
   */
  "statAura", // +pct% power and +pct% max health, for a touching family
  // --- spawn / transform / death ---
  "delayedTransform", // after a delay, transform into a stronger form
  "swarmOnDeath", // spawn small units on death
  "splitOnDeath", // split into smaller copies on death
  "sacrificeAdjacent", // consume an adjacent ally for a benefit
  "elementSteal", // copy the element of the first enemy hit
] as const;
export const AbilityTypeSchema = z.enum(ABILITY_TYPES);
export type AbilityType = z.infer<typeof AbilityTypeSchema>;

/**
 * A single data-driven behavior. `params` is an open bag of numbers/strings so
 * designers can tune an ability (e.g. { slots: 1 }, { pct: 20 }, { afterSeconds: 10 })
 * purely in JSON. The engine handler for each `type` knows which params it reads.
 */
export const AbilitySchema = z.object({
  type: AbilityTypeSchema,
  trigger: AbilityTriggerSchema,
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  /** Optional human-facing text for tooltips; not read by the engine. */
  description: LocalizedStringSchema.optional(),
});
export type Ability = z.infer<typeof AbilitySchema>;
