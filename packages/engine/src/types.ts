import type { Ability, Element, LocalizedString, Range, SquareKind, Targeting } from "@amanda/shared";
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
  /** Who it goes after. Seven answers — see schemas/targeting.ts. */
  targeting: Targeting;
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
  /**
   * What this unit's blows are worth this tick, as a multiplier on `power`.
   *
   * ⚠ A MULTIPLIER AND NOT AN EDIT TO `power`. `power` is what the card IS —
   * the report reads it, the details screen reads it, and the targeting that
   * hunts "the strongest thing over there" reads it. A debuff that wrote
   * itself into that number would make a card stop saying what it is, and
   * would compound every tick it was applied. See `gazeWeaken`.
   */
  powerMult: number;
  /** Flat armor granted by allied auras this tick (on top of `armor`). */
  auraArmor: number;

  abilities: Ability[];
  alive: boolean;

  /** Ground-floor card revealed when this unit dies (Stacking). */
  below: StackedCard | null;
  /** Runtime flags used by ability handlers (e.g. rooted, elementStolen). */
  flags: Record<string, boolean | number | string>;
  /**
   * The special square this unit is standing on, if any.
   *
   * Or, 11 November: *"1-3 random positions on every board … possible for
   * any card except the King."* Carried on the unit rather than looked up
   * from the board, because a unit MOVES: the hospital heals whoever is
   * standing on it at setup and goes on healing them as they walk away,
   * which is the reading that makes it a property of the card rather than
   * of a patch of floor they happened to cross.
   */
  square?: SquareKind | null;

  /*
   * ── the two facts a card needs about the battle so far ──
   *
   * Neither is a stat and neither is a flag: they are what the `avenger` and
   * `invader` targeting modes are ABOUT, and a mode that had to guess them
   * from the board would guess wrong. `flags` is typed boolean | number and
   * a uid is a string, which is the other half of why they live here.
   */
  /** uid of whatever hit it last, for as long as that is true. */
  lastHitBy: string | null;
  /** Has it swung at anything yet? Sticky — it never goes back to false. */
  hasAttacked: boolean;
  /**
   * Whose King this unit has actually landed a blow on, if any.
   *
   * The third fact of the same kind, and it is what `bodyguard` is about:
   * Or asked for *"somebody who shoots whoever is shooting at the King"*,
   * and a card cannot be told to watch the crown without the battle
   * remembering who has touched it.
   *
   * Sticky, like `hasAttacked`: a card that hit the crown once and backed
   * off is still the card that hit the crown, and a guard that forgot it
   * the moment the attacker paused would change its mind every swing.
   */
  struckKing: Owner | null;
}

/** A card sitting under another via the Stacking / "Ground Floor" mechanic. */
export interface StackedCard {
  cardId: string;
  /**
   * And what is under THAT one.
   *
   * ═══ THE BUNKER MADE THIS A CHAIN ═══
   *
   * Or: *"the bunker — you can put up to 3 cards there one on top of the
   * other."* Stacking has existed since the Ground Floor ability and it was
   * exactly one deep: `below` held a card id, and `reveal` spawned that card
   * with `below: null`, so a third could not be expressed at all.
   *
   * One link instead of one card, and the ability that used it is a chain of
   * length one — which is the same thing it always was.
   */
  below: StackedCard | null;
}

/** A pile of card ids, top first, as the unit carries it. */
export function stackOf(ids: readonly string[]): StackedCard | null {
  let out: StackedCard | null = null;
  for (let i = ids.length - 1; i >= 0; i--) out = { cardId: ids[i]!, below: out };
  return out;
}

/** The same pile, back as a list of ids. */
export function idsBelow(stack: StackedCard | null): string[] {
  const out: string[] = [];
  for (let s = stack; s; s = s.below) out.push(s.cardId);
  return out;
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
    /** A delayed transform came due: this unit is now a different card. */
    | "transform"
    /**
     * It went round the back — dived, teleported or burrowed — and is
     * standing at the far end of the enemy's board facing the other way.
     * Fires once, at spawn. `col` is where it came up.
     */
    | "dig"
    /**
     * A mine went off under somebody.
     *
     * Or: *"minefield — if the enemy steps there while it is free … he
     * explodes. Once, only the first enemy soldier."* Its own event rather
     * than a `hit` with no attacker, because the screen has to be able to
     * draw a bang where there is nobody swinging.
     */
    | "explode"
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
  /**
   * The element matchup this blow landed on: 1.5 when the attacker beats the
   * defender's element, 0.75 when it loses to it, 1 otherwise.
   *
   * The engine already works this out to compute the damage (combat.ts). It
   * is carried out so the PICTURE can say it — Or: *"the shooting, the dying,
   * the movement, all of it has to be much more fun and impressive"* — and
   * because a bonus the player is never shown is a rule they have to be told
   * instead of one they can see.
   */
  edge?: number;
  /**
   * How much of this blow was stopped before it landed — armour, a damage
   * reduction aura, a neighbour taking part of it.
   *
   * The screen had no way of knowing: it saw the number that got through and
   * nothing about the number that did not, so a card whose whole job is to
   * absorb looked exactly like a card that was simply not being hit hard.
   * The engine works both out to arrive at the first one.
   */
  absorbed?: number;
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
  /**
   * Mines that have not gone off yet.
   *
   * Or: *"minefield — if the enemy steps there while it is free (say when
   * our card died or walked/flew away) — he explodes. Once, only the first
   * enemy soldier."* So a mine is a PLACE, not a card: it belongs to the
   * board it was rolled on, it is armed only while nothing of that board's
   * own is standing on it, and it is spent the first time it fires.
   */
  mines: Array<{ owner: Owner; col: number; lane: number; spent: boolean }>;
  /** Lanes in this arena — 4 normally, 8 in Amanda mode. */
  lanes: number;
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
  /**
   * A piece of something that died, rather than a card somebody placed.
   *
   * Or: *"there is some monster that splits into 4 small monsters — they
   * look like little squares and they just move, with no motion of their
   * own."* They carry the parent's CARD now, so they are drawn with its
   * artwork and walk — and this is what still makes them read as pieces:
   * the screen draws them small.
   *
   * On the frame rather than inferred, because nothing else in a snapshot
   * can tell "a child of a slime" from "a slime on low health".
   */
  spawned?: boolean;
  /**
   * It is fighting the other way round.
   *
   * A card that went round the back starts this way, and any card that has
   * cleared everything in front of it and found something behind turns to
   * face it (see simulate.ts). Everything else on the screen takes its
   * direction from which side it belongs to — the artwork, the walk cycle,
   * the death throw — so without this a unit under attack from behind is
   * drawn facing the empty board in front of it.
   *
   * Absent on all but a handful of units in a battle, so it is written only
   * when true rather than carried on every unit of every frame.
   */
  turned?: boolean;
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

/**
 * **What stopped the battle**, which is not the same question as who won it.
 *
 * Or: *"a match ends if you brought the king down or if the time ran out.
 * And if you reach a dead end where no card can move, the clock is cut
 * short. I want some indication of that — in big letters in the middle of
 * the screen."*
 *
 * `WinReason` cannot answer him. It says how the WINNER was decided, and a
 * dead end is resolved through the very same tiebreak chain as a clock
 * running out — so "kingHp" is the honest answer to both and tells a player
 * nothing about why the fighting stopped.
 *
 *   king      somebody's crown fell. The battle ended the moment it did.
 *   time      the full ninety seconds were fought.
 *   deadEnd   nothing moved, fired to effect or lost health for three
 *             seconds — see SIMULATION.stalemateSeconds. The clock would
 *             have spent the rest of the battle showing a photograph.
 */
export type EndedBy = "king" | "time" | "deadEnd";

/** The numbers that settled a timeout, for showing the player the margin. */
export interface Tiebreak {
  reason: WinReason;
  a: number;
  b: number;
}

export interface BattleResult {
  winner: Owner | null;
  ticks: number;
  /** What stopped the battle — the king, the clock, or a dead end. */
  endedBy: EndedBy;
  /** How the match was decided. */
  winReason: WinReason;
  /** Present only when the clock ran out and a tiebreak settled it. */
  tiebreak: Tiebreak | null;
  events: BattleEvent[];
  /** Final unit snapshot (useful for tests and post-battle UI). */
  finalUnits: Unit[];
  /** Per-tick snapshots for animated replay (only when setup.recordFrames). */
  frames: BattleFrame[];
  /**
   * How many lanes this battle was fought in — four normally, eight in Amanda
   * mode. The replay has to be told, because it cannot infer an empty lane
   * from a snapshot of units.
   */
  lanes: number;
}
