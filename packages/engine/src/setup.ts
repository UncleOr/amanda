import { BOARD, KING, type Card } from "@amanda/shared";
import { createRng } from "./rng.js";
import type { BattleState, Owner, SynergyDef, Unit } from "./types.js";

/** Optional stat modifier applied to a placed card (e.g. from Action Cards). */
export interface PlacementBuff {
  powerAdd?: number;
  powerMult?: number;
  hpMult?: number;
}

/** One card placed on a player's local 4×4 board. */
export interface Placement {
  cardId: string;
  /** Local column 0..3 — 0 = back (Surprise Row), 3 = front (faces enemy). */
  x: number;
  /** Local lane/row 0..3. */
  y: number;
  /** Marks this card as the King (forced to the central 2×2, static). */
  king?: boolean;
  /** Card stacked underneath via "Ground Floor" — revealed when this one dies. */
  below?: string;
  /** Stat modifier (Action Card boosts). */
  buff?: PlacementBuff;
}

export interface BoardInput {
  owner: Owner;
  placements: Placement[];
  /** Extra flat HP added to the King from account level (GDD §7). */
  kingAccountLevelHp?: number;
}

export interface BattleSetup {
  a: BoardInput;
  b: BoardInput;
  seed: number;
  catalog: Map<string, Card>;
  /** Series synergies to apply (activate at their threshold of same-series units). */
  synergies?: SynergyDef[];
  /** Capture a per-tick snapshot for animated client replay. */
  recordFrames?: boolean;
}

/** Map a local board coordinate to the shared arena column. */
function toArenaCol(owner: Owner, localX: number): number {
  // Side A occupies columns 0..3; side B is mirrored into 7..4 so the two
  // front rows (localX = 3) end up adjacent in the middle (cols 3 and 4).
  return owner === "A" ? localX : BOARD.width * 2 - 1 - localX;
}

/** Coordinates/kind resolved for a unit about to be created. */
interface UnitPlacement {
  col: number;
  lanes: number[];
  width: number;
  facing: 1 | -1;
  isKing: boolean;
  below: string | null;
  buff?: PlacementBuff;
}

/**
 * Low-level unit factory shared by initial setup and runtime reveals
 * (Ground-Floor stacking). Position/kind is decided by the caller.
 */
export function createUnitFromCard(
  state: BattleState,
  card: Card,
  owner: Owner,
  p: UnitPlacement,
): Unit {
  const buff = p.buff ?? {};
  const baseHp = card.stats.hp * (buff.hpMult ?? 1);
  const basePower = card.stats.power * (buff.powerMult ?? 1) + (buff.powerAdd ?? 0);
  const maxHp = Math.round(p.isKing ? baseHp * KING.hpMultiplier : baseHp);
  return {
    uid: `u${state.nextUid++}`,
    cardId: card.id,
    seriesId: card.seriesId,
    owner,
    name: card.name,
    elements: card.elements,
    activeElement: card.elements[0]!,
    maxHp,
    hp: maxHp,
    power: Math.round(p.isKing ? basePower * KING.powerMultiplier : basePower),
    attackSpeed: card.stats.attackSpeed,
    moveSpeed: p.isKing ? 0 : card.stats.moveSpeed, // King's Trap: rooted
    range: card.stats.range,
    flying: card.flying,
    targeting: card.targeting,
    isKing: p.isKing,
    col: p.col,
    width: p.width,
    lanes: p.lanes,
    facing: p.facing,
    attackCooldown: 0,
    armor: 0,
    stunnedUntil: -1,
    knockbackImmune: p.isKing || card.abilities.some((a) => a.type === "knockbackImmune"),
    damageTakenMult: 1,
    attackSpeedMult: 1,
    moveSlowMult: 1,
    auraArmor: 0,
    abilities: card.abilities,
    alive: true,
    below: p.below ? { cardId: p.below } : null,
    flags: {},
  };
}

function makeUnit(
  state: BattleState,
  card: Card,
  owner: Owner,
  placement: Placement,
): Unit {
  const facing: 1 | -1 = owner === "A" ? 1 : -1;
  const isKing = placement.king === true;

  // King occupies the central 2×2 (local cols 1-2, lanes 1-2), is static, ×5 HP.
  const lanes = isKing ? [BOARD.kingSlot.y, BOARD.kingSlot.y + 1] : [placement.y];
  const width = isKing ? BOARD.kingSlot.width : 1;
  const col = isKing
    ? (toArenaCol(owner, BOARD.kingSlot.x) + toArenaCol(owner, BOARD.kingSlot.x + 1)) / 2
    : toArenaCol(owner, placement.x);

  return createUnitFromCard(state, card, owner, {
    col,
    lanes,
    width,
    facing,
    isKing,
    below: placement.below ?? null,
    buff: placement.buff,
  });
}

/** Build the initial battle state from both players' boards. */
export function buildBattle(setup: BattleSetup): BattleState {
  const state: BattleState = {
    tick: 0,
    rng: createRng(setup.seed),
    units: [],
    events: [],
    winner: null,
    winReason: "kingDown",
    tiebreak: null,
    ended: false,
    nextUid: 0,
    synergies: setup.synergies ?? [],
  };

  for (const board of [setup.a, setup.b]) {
    for (const placement of board.placements) {
      const card = setup.catalog.get(placement.cardId);
      if (!card) throw new Error(`Unknown cardId in placement: ${placement.cardId}`);
      const unit = makeUnit(state, card, board.owner, placement);
      if (unit.isKing && board.kingAccountLevelHp) {
        unit.maxHp += board.kingAccountLevelHp;
        unit.hp = unit.maxHp;
      }
      state.units.push(unit);
      state.events.push({
        tick: 0,
        type: "spawn",
        uid: unit.uid,
        cardId: unit.cardId,
        owner: unit.owner,
        col: unit.col,
        lanes: unit.lanes,
      });
    }
  }

  return state;
}
