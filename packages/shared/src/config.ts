import type { Element } from "./schemas/elements.js";

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Amanda — central game configuration
 * ─────────────────────────────────────────────────────────────────────────
 *  Every tunable rule the GDD asked to keep flexible lives HERE, in one place.
 *  Changing deck size, action-card count, action-slot count, or switching
 *  action-card selection from random → manual is a one-line edit — no engine
 *  or UI logic depends on hard-coded values.
 */

/** Board geometry per player (GDD §1). */
export const BOARD = {
  /** Each player's grid is 4×4 (16 slots). */
  width: 4,
  height: 4,
  /** The central 2×2 area merges into a single King slot. */
  kingSlot: { x: 1, y: 1, width: 2, height: 2 },
} as const;

/** The combined battle arena (two boards joined) — GDD §10. */
export const ARENA = {
  /** 4 wide (own board) + 4 wide (enemy board) laid end to end = 8. */
  width: 8,
  height: 4,
  /** 4 horizontal lanes. */
  lanes: 4,
} as const;

/** King slot rules (GDD §2). */
export const KING = {
  /** The card in the King slot gets ×3 HP (Or's tuned rule, overriding the GDD's ×5). */
  hpMultiplier: 3,
  /** The King also hits ×3 harder (Power/damage multiplier). */
  powerMultiplier: 3,
  /** The King slot is permanently static (King's Trap). */
  static: true,
  /** Per account level, add this flat HP to the King slot base (GDD §7). */
  hpPerAccountLevel: 100,
  /** Instant-kill effects deal this flat damage to the King instead of erasing it. */
  instantKillFlatDamage: 2000,
} as const;

/**
 * Match phase timeline in seconds (GDD §4). Total ≈ 105s.
 *
 * Tuned from playtesting (Or, 2026-10-04): a minute is plenty to build a
 * board, and 15 seconds of battle was too short for the fight to resolve —
 * most matches were timing out with both Kings untouched.
 */
export const PHASES = {
  build: { seconds: 60, label: { he: "טירוף הבנייה", en: "Build Frenzy" } },
  panic: { seconds: 15, label: { he: "שניות הפאניקה", en: "Panic Seconds" } },
  battle: { seconds: 30, label: { he: "הקרב האוטומטי", en: "Auto-Battle" } },
} as const;

/**
 * How far each kind of attacker can actually reach, in arena columns.
 *
 * Ranged units used to fire down the WHOLE lane, which made the depth of the
 * board meaningless: a static ranged King could kill the enemy King across the
 * entire arena from its own square, and in a 300-battle sample a third of all
 * decisive matches were over inside five seconds. With a real reach, the front
 * row is a shield again and distance is a decision.
 *
 * For scale: the two front rows touch at columns 3 and 4, and each King sits
 * about 4 columns from the other. So a ranged unit can cover the enemy's front
 * half, and only a sniper can threaten the far King.
 */
export const RANGE_REACH = {
  /** Contact only — the engine's melee reach applies instead. */
  melee: 0,
  ranged: 3,
  sniper: 6,
} as const;

/**
 * Global pace of combat. Raising this shortens every battle without touching a
 * single card's numbers, which is the one dial that changes how long a match
 * FEELS without changing what any card IS.
 */
export const COMBAT = {
  /**
   * Left at 1: sudden death does the work of keeping matches short, which is
   * better than a blanket multiplier because it leaves every card's numbers
   * exactly as designed for the part of the battle people actually watch.
   */
  damageMultiplier: 1,
} as const;

/**
 * Sudden death. Two well-built boards can wall each other off completely —
 * neither King reachable, nothing decided, 30 seconds of nothing. From the
 * halfway mark every hit lands harder, rising to `peak` by the final second,
 * so a stalemate is broken by the clock instead of surviving it.
 */
export const SUDDEN_DEATH = {
  /**
   * Fraction of the battle after which damage starts climbing. Measured over
   * 250 well-built boards, 0.6 rising to 2.5 lands the average match at 18.8s
   * of the 30s clock with a third going to time — against 41% and a flat
   * stalemate before it existed.
   */
  startsAt: 0.6,
  /** Damage multiplier at the very last tick. */
  peak: 2.5,
} as const;

/**
 * Deterministic simulation cadence. The battle is computed as a fixed number of
 * integer ticks so both server and clients reproduce it identically.
 */
export const SIMULATION = {
  ticksPerSecond: 30,
  get totalBattleTicks() {
    return this.ticksPerSecond * PHASES.battle.seconds;
  },
} as const;

/** Deck composition — all values intentionally editable (GDD §12 dev note). */
export const DECK = {
  /** Monster cards per match deck (18 monsters + 4 action cards per GDD). */
  size: 18,
  allowedSizes: [18, 24] as const,
  /** Starter deck = one card from each series. */
  starterDeckSize: 18,
} as const;

/** Action ("System") card rules — the GDD's flagship flexibility example. */
export const ACTION_CARDS = {
  /** How many action cards a player gets per match. */
  perMatch: 4,
  /** Hidden action slots on the board. */
  slots: 3,
  /**
   * How the match's action cards are chosen.
   * "random"  → system draws them (current MVP behavior)
   * "manual"  → player picks from their collection (future)
   * Flip this string to switch mechanics — nothing else changes.
   */
  selectionMode: "random" as "random" | "manual",
} as const;

/** The auto-fill penalty for empty slots when the build timer ends (GDD §4). */
export const CRUMB_DEMON = {
  hp: 1,
  power: 1,
  attackSpeed: 2,
} as const;

/** Card upgrade scaling (GDD §7). */
export const UPGRADE = {
  /** Each level multiplies HP and Power by this (≈ +10%). */
  statMultiplierPerLevel: 1.1,
} as const;

/** Trophy rewards (GDD §7). */
export const TROPHIES = {
  win: 25,
  loss: -20,
} as const;

/** Series synergy threshold (GDD §4). */
export const SYNERGY = {
  defaultThreshold: 3,
} as const;

/**
 * Element rock-paper-scissors chart (GDD §4). Multipliers below are a sane
 * STARTING POINT for balancing — expected to be tuned during playtests.
 * `strongVs` = deals extra damage to; the reverse is applied as weakness.
 */
export const ELEMENT_COMBAT = {
  strongMultiplier: 1.5,
  weakMultiplier: 0.75,
  neutralMultiplier: 1.0,
  /** Elements a given attacker is strong against. */
  strongVs: {
    fire: ["earth", "metal"],
    water: ["fire"],
    earth: ["electric", "poison"],
    air: ["earth"],
    electric: ["water", "metal"],
    metal: ["poison", "air"],
    light: ["dark"],
    dark: ["light"],
    poison: ["water"],
    variable: [],
  } satisfies Record<Element, Element[]>,
} as const;

/** Convenience: everything under one namespace for the engine to import. */
export const GameConfig = {
  BOARD,
  ARENA,
  KING,
  PHASES,
  SIMULATION,
  DECK,
  ACTION_CARDS,
  CRUMB_DEMON,
  UPGRADE,
  TROPHIES,
  SYNERGY,
  ELEMENT_COMBAT,
} as const;
export type GameConfig = typeof GameConfig;
