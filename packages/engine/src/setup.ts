import { ARENA, ARENA_POWER_BONUS, BOARD, KING, type Card } from "@amanda/shared";
import { createRng } from "./rng.js";
import { synergyMembers } from "./synergy.js";
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
  /**
   * ═══ WHOSE GROUND THIS IS ═══
   *
   * The seriesId of the family that lives in the arena being fought in. Its
   * cards hit ARENA_POWER_BONUS harder here, on both sides of the board.
   *
   * A series id and not an arena id, because the engine has never heard of
   * arenas and should not start now: it knows cards, and "this family is
   * stronger in this battle" is a thing it can be told. Who decides which
   * family — trophies, the server, the two players' rungs — is a question
   * for the callers (groundFor in arenas.ts).
   *
   * Left out, nothing changes. Every battle that is not fought in an arena
   * — the tutorial, the playground bench, the FX workbench — simply does
   * not pass it.
   */
  ground?: string;
  /**
   * How many lanes the arena has. Four for an ordinary 1v1 — but Amanda mode
   * stacks both players' boards on one side, which is eight. Nothing else in
   * the engine cares how many there are: a unit's lanes come straight from its
   * placement. This exists so the things that CLAMP to the arena know how big
   * it is.
   */
  lanes?: number;
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

  /*
   * A King occupies a 2×2: two lanes, starting at the lane it was PLACED in.
   *
   * This used to ignore placement.y and hard-code BOARD.kingSlot.y, which is
   * invisible in an ordinary match — every 4×4 puts its King at y=1 anyway —
   * and wrong the moment a side is deeper than one board. In Amanda mode both
   * players stack on one side, and every King on it, theirs and hers, was
   * being stacked into lanes 1-2 on top of each other.
   */
  const lanes = isKing ? [placement.y, placement.y + 1] : [placement.y];
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
    lanes: setup.lanes ?? ARENA.lanes,
  };

  const seriesOf = (cardId: string) => setup.catalog.get(cardId)?.seriesId;

  for (const board of [setup.a, setup.b]) {
    /*
     * Which of this board's cards are in a touching group of their family.
     * Worked out here, once, from the board as it was locked — see synergy.ts
     * for why it is not recomputed while the battle runs.
     */
    const inGroup = new Set<number>();
    for (const syn of state.synergies)
      for (const i of synergyMembers(board.placements, seriesOf, syn.seriesId, syn.threshold))
        inGroup.add(i);

    for (const [index, placement] of board.placements.entries()) {
      const card = setup.catalog.get(placement.cardId);
      if (!card) throw new Error(`Unknown cardId in placement: ${placement.cardId}`);
      const unit = makeUnit(state, card, board.owner, placement);
      if (inGroup.has(index)) {
        unit.flags.synergy = true;
        /*
         * ═══ THE BONUS ITSELF, AT SETUP ═══
         *
         * Or: *"make it +20% power and +20% health, the same for everyone."*
         *
         * Applied HERE and not in the tick loop, which is where every other
         * synergy lives. Those work on multipliers that are rebuilt from
         * scratch each tick — `damageTakenMult *= 0.8` is safe to run fifteen
         * times a second because it starts from 1 every time. `power` and
         * `maxHp` are the unit's own numbers: scaling them per tick would
         * compound 20% until the first exchange decided the match.
         *
         * Health is raised AND filled. A card that gains 20% maximum health
         * and starts the battle 20% wounded has been given nothing.
         */
        for (const syn of state.synergies) {
          if (syn.seriesId !== unit.seriesId || syn.ability.type !== "statAura") continue;
          const pct = syn.ability.params?.pct ?? 0;
          if (typeof pct !== "number" || pct === 0) continue;
          unit.power = Math.round(unit.power * (1 + pct / 100));
          unit.maxHp = Math.round(unit.maxHp * (1 + pct / 100));
          unit.hp = unit.maxHp;
        }
      }
      /*
       * ═══ AND THE GROUND ITSELF ═══
       *
       * Applied after the synergy bonus and on top of it: a family on its
       * own ground AND in a touching group of its own kind is the best
       * place that family will ever be, which is exactly the board a
       * player should be rewarded for having built where they built it.
       *
       * Power only. See ARENA_POWER_BONUS for why not health.
       */
      if (setup.ground && unit.seriesId === setup.ground) {
        unit.flags.ground = true;
        unit.power = Math.round(unit.power * (1 + ARENA_POWER_BONUS));
      }
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
