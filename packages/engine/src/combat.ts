import { COMBAT, ELEMENT_COMBAT } from "@amanda/shared";
import type { Element } from "@amanda/shared";
import type { Unit } from "./types.js";

/** Rock-paper-scissors element multiplier for attacker → defender. */
export function elementMultiplier(attacker: Element, defender: Element): number {
  const strong = ELEMENT_COMBAT.strongVs[attacker] as readonly Element[];
  if (strong.includes(defender)) return ELEMENT_COMBAT.strongMultiplier;
  const defenderStrong = ELEMENT_COMBAT.strongVs[defender] as readonly Element[];
  if (defenderStrong.includes(attacker)) return ELEMENT_COMBAT.weakMultiplier;
  return ELEMENT_COMBAT.neutralMultiplier;
}

export function leftEdge(u: Unit): number {
  return u.col - u.width / 2;
}
export function rightEdge(u: Unit): number {
  return u.col + u.width / 2;
}

/** Do two units share at least one lane? */
export function sharesLane(a: Unit, b: Unit): boolean {
  return a.lanes.some((l) => b.lanes.includes(l));
}

/** Is `other` ahead of `u` in u's facing direction? */
export function isAhead(u: Unit, other: Unit): boolean {
  return u.facing > 0 ? other.col > u.col : other.col < u.col;
}

/**
 * Gap between `u`'s front edge and `other`'s near edge along the lane.
 * Negative when the two overlap.
 */
export function gapAhead(u: Unit, other: Unit): number {
  return u.facing > 0
    ? leftEdge(other) - rightEdge(u)
    : leftEdge(u) - rightEdge(other);
}

/**
 * Final damage applied to `target` from a raw hit, after the target's
 * damage-reduction aura and flat armor. Never negative.
 */
export function computeDamage(
  rawPower: number,
  attackerElement: Element,
  target: Unit,
): number {
  const withElement =
    rawPower * COMBAT.damageMultiplier * elementMultiplier(attackerElement, target.activeElement);
  const afterReduction = withElement * target.damageTakenMult;
  return Math.max(0, Math.floor(afterReduction) - target.armor - target.auraArmor);
}
