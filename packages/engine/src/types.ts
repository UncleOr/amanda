import type { Ability, Element, LocalizedString, Range } from "@amanda/shared";
import type { Rng } from "./rng.js";

/** Which side of the arena a unit belongs to. */
export type Owner = "A" | "B";

/**
 * A series synergy passed into the battle: when a player has `threshold`+ alive
 * units of `seriesId`, `ability` (an aura) applies to those units.
 */
export interface SynergyDef {
  seriesId: string;
  threshold: number;
  ability: Ability;
}

/** A live combatant in the arena. Positions use the 4×8 arena coordinate space. */
export interface Unit {
  uid: string;
  cardId: string;
  seriesId: string;
  owner: Owner;
  name: LocalizedString;
  elements: Element[];
  /** Element used for damage math; may change at runtime (elementSteal). */
  activeElement: Element;

  // --- base stats ---
  maxHp: number;
  hp: number;
  power: number;
  /** Base seconds between attacks. */
  attackSpeed: number;
  /** Base columns advanced per second (0 = static). */
  moveSpeed: number;
  range: Range;
  flying: boolean;
  /** "lane" fights whatever is in front; "king" hunts the enemy King. */
  targeting: "lane" | "king";
  isKing: boolean;

  // --- spatial (arena space: col 0..7, lanes are rows 0..3) ---
  /** Continuous center column. */
  col: number;
  /** Columns occupied (1 for normal, 2 for the King). */
  width: number;
  /** Lanes (rows) occupied (King spans two). */
  lanes: number[];
  /** +1 advances toward higher columns (side A), -1 toward lower (side B). */
  facing: 1 | -1;

  // --- combat runtime ---
  /** Seconds until this unit can attack again. */
  attackCooldown: number;
  /** Flat damage blocked per incoming hit. */
  armor: number;
  /** Tick index until which the unit is stunned (frozen). */
  stunnedUntil: number;
  /** Cannot be pushed by knockback. */
  knockbackImmune: boolean;

  // --- per-tick aura-derived values (recomputed every tick) ---
  damageTakenMult: number;
  attackSpeedMult: number;
  moveSlowMult: number;
  /** Flat armor granted by allied auras this tick (on top of `armor`). */
  auraArmor: number;

  abilities: Ability[];
  alive: boolean;

  /** Ground-floor card revealed when this unit dies (Stacking). */
  below: StackedCard | null;
  /** Runtime flags used by ability handlers (e.g. rooted, elementStolen). */
  flags: Record<string, boolean | number>;
}

/** A card sitting under another via the Stacking / "Ground Floor" mechanic. */
export interface StackedCard {
  cardId: string;
}

export interface BattleEvent {
  tick: number;
  type:
    | "spawn"
    | "attack"
    | "hit"
    | "death"
    | "knockback"
    | "stun"
    | "split"
    | "reveal"
    | "win";
  /** Acting unit. */
  uid?: string;
  targetUid?: string;
  cardId?: string;
  owner?: Owner;
  col?: number;
  lanes?: number[];
  damage?: number;
  targetHp?: number;
  /** This hit was damage thrown back at an attacker, not a strike of its own. */
  reflected?: boolean;
  untilTick?: number;
  childUids?: string[];
  revealedCardId?: string;
  winner?: Owner | null;
}

export interface BattleState {
  tick: number;
  rng: Rng;
  units: Unit[];
  events: BattleEvent[];
  winner: Owner | null;
  winReason: WinReason;
  tiebreak: Tiebreak | null;
  ended: boolean;
  nextUid: number;
  synergies: SynergyDef[];
}

/** Lightweight per-unit snapshot used for animated replay on the client. */
export interface FrameUnit {
  uid: string;
  owner: Owner;
  cardId: string;
  col: number;
  lanes: number[];
  hp: number;
  maxHp: number;
  power: number;
  alive: boolean;
  isKing: boolean;
}

/** A snapshot of the whole arena at one tick. */
export interface BattleFrame {
  tick: number;
  units: FrameUnit[];
}

/**
 * Why the battle ended. A match is never a draw, so when the clock runs out a
 * tiebreak chain decides it — and the player is owed an explanation of which
 * link in that chain did the deciding.
 */
export type WinReason = "kingDown" | "kingHp" | "totalHp" | "aliveCount" | "coinFlip";

/** The numbers that settled a timeout, for showing the player the margin. */
export interface Tiebreak {
  reason: WinReason;
  a: number;
  b: number;
}

export interface BattleResult {
  winner: Owner | null;
  ticks: number;
  /** How the match was decided. */
  winReason: WinReason;
  /** Present only when the clock ran out and a tiebreak settled it. */
  tiebreak: Tiebreak | null;
  events: BattleEvent[];
  /** Final unit snapshot (useful for tests and post-battle UI). */
  finalUnits: Unit[];
  /** Per-tick snapshots for animated replay (only when setup.recordFrames). */
  frames: BattleFrame[];
}
