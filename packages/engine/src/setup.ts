import {
  ARENA,
  ARENA_POWER_BONUS,
  BOARD,
  KING,
  TUNED,
  type Card,
  SQUARE_KINDS,
  type SquareKind,
} from "@amanda/shared";
import { createRng } from "./rng.js";
import { stackOf } from "./types.js";
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
  /**
   * Cards stacked underneath, top first — revealed one at a time as the one
   * above dies.
   *
   * One id is the "Ground Floor" ability, which is what this field has always
   * been. A LIST is the bunker: Or, *"you can put up to 3 cards there one on
   * top of the other."* Both shapes are accepted because the ability came
   * first and there is no reason to make it say `["x"]`.
   */
  below?: string | readonly string[];
  /** Stat modifier (Action Card boosts). */
  buff?: PlacementBuff;
}

export interface BoardInput {
  owner: Owner;
  placements: Placement[];
  /** Extra flat HP added to the King from account level (GDD §7). */
  kingAccountLevelHp?: number;
  /**
   * The special squares on THIS board, keyed "x-y" in local coordinates.
   *
   * Or, 11 November: *"1-3 random ones on every board (ours and the
   * opponent's) with a unique colour and icon."* Rolled before the match by
   * whoever owns the match — the server online, the browser solo — and
   * handed to the engine with the boards, because the engine has never
   * decided anything about a board and should not start.
   *
   * Left out, nothing happens: every battle that is not an arena match — the
   * tutorial, the playground, the FX bench, every test written before this —
   * simply does not pass it.
   */
  squares?: Readonly<Record<string, string>>;
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
  below: readonly string[];
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
    powerMult: 1,
    auraArmor: 0,
    abilities: card.abilities,
    alive: true,
    below: stackOf(p.below),
    flags: {},
    lastHitBy: null,
    hasAttacked: false,
    struckKing: null,
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
    below: asStack(placement.below),
    buff: placement.buff,
  });
}

/**
 * The filler monster's card id.
 *
 * `CRUMB_DEMON` in shared is its STATS, not its name — the id is the string
 * the catalogue is keyed by, and it is spelled out here rather than imported
 * because shared does not export it and the one place that needs it is this.
 */
const CRUMB_ID = "crumb_demon";

/**
 * Is this string one of the eight?
 *
 * ⚠ The squares arrive as plain strings over the wire (see NetBoard), and a
 * board is the one thing in this game that comes from somewhere else. An
 * unknown kind is ignored rather than trusted: a client inventing
 * `"superCharger"` must not become a card with no limits.
 */
function isSquareKind(kind: string): kind is SquareKind {
  return (SQUARE_KINDS as readonly string[]).includes(kind);
}

/** One id or several, as the engine's chain of cards underneath. */
const asStack = (below: string | readonly string[] | undefined): readonly string[] =>
  below === undefined ? [] : typeof below === "string" ? [below] : [...below];

/**
 * ═══ WHAT A SPECIAL SQUARE DOES AT SETUP ═══
 *
 * Four of the eight are decided here, once, before a tick has run, because
 * what they change is what the card IS rather than what happens to it:
 *
 *   charger   ×2 power and ×2 health. Or's own numbers.
 *   pancake   becomes a Crumb Demon carrying the original card's power and
 *             health, and NONE of its abilities. His own answer to "there is
 *             no fried bread card": *"every card there becomes a crumb
 *             monster with the power and health of the original card, but
 *             without abilities."* Which is better than a new card, because
 *             the joke lands on something the player already knows.
 *   mirror    takes the identity, abilities and numbers of a neighbour.
 *   blackhole pays the REST of the board, and only if this square is empty.
 *
 * The other four need the battle to be running and live in simulate.ts.
 *
 * ⚠ ORDER MATTERS AND IT IS THE ORDER BELOW. A mirror next to a charged card
 * copies what that card IS, not what the charger made of it — the identity
 * is the card's, and the charge belongs to the square it is standing on. So
 * the mirror reads the CATALOGUE, never the finished unit.
 */
function applySquare(
  state: BattleState,
  unit: Unit,
  kind: SquareKind,
  board: BoardInput,
  catalog: Map<string, Card>,
  placement: Placement,
): void {
  unit.square = kind;
  if (kind === "charger") {
    unit.power = Math.round(unit.power * 2);
    unit.maxHp = Math.round(unit.maxHp * 2);
    unit.hp = unit.maxHp;
    return;
  }
  if (kind === "pancake") {
    const crumb = catalog.get(CRUMB_ID);
    if (!crumb) return;
    // The numbers are the card's own and stay; the identity and the tricks
    // are the Crumb Demon's, which has none.
    unit.cardId = crumb.id;
    unit.seriesId = crumb.seriesId;
    unit.name = crumb.name;
    unit.elements = crumb.elements;
    unit.activeElement = crumb.elements[0]!;
    unit.abilities = [];
    unit.targeting = crumb.targeting;
    return;
  }
  if (kind === "mirror") {
    /*
     * ⚠ "IF IT TAKES THE KING'S POWER IT TAKES IT PLAIN, WITHOUT THE ×3."
     * His sentence, and the reason it had to be said: a King's numbers on
     * the unit are already tripled (KING.powerMultiplier), so copying the
     * UNIT would hand a one-square card the crown's whole output. Copying
     * the CARD gives what the sentence means — the king's card, as a card.
     */
    const mates = board.placements.filter(
      (p) => p !== placement && touching(p, placement) && catalog.has(p.cardId),
    );
    if (!mates.length) return;
    const pick = state.rng.pick(mates);
    const card = catalog.get(pick.cardId)!;
    unit.cardId = card.id;
    unit.seriesId = card.seriesId;
    unit.name = card.name;
    unit.elements = card.elements;
    unit.activeElement = card.elements[0]!;
    unit.abilities = card.abilities;
    unit.targeting = card.targeting;
    unit.range = card.stats.range;
    unit.flying = card.flying;
    unit.attackSpeed = card.stats.attackSpeed;
    unit.moveSpeed = unit.isKing ? 0 : card.stats.moveSpeed;
    unit.power = Math.round(card.stats.power);
    unit.maxHp = Math.round(card.stats.hp);
    unit.hp = unit.maxHp;
    unit.flags.mirrored = card.id;
  }
}

/** Do these two cells share an edge? Diagonals are not neighbours here. */
function touching(a: Placement, b: Placement): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
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
    mines: [],
    lanes: setup.lanes ?? ARENA.lanes,
  };

  /*
   * ═══ THE MINES, LAID BEFORE ANYBODY STANDS UP ═══
   *
   * Or: *"minefield — if the enemy steps there while it is free … he
   * explodes. Once, only the first enemy soldier."* A mine is a PLACE, so it
   * is laid whether or not the cell is occupied: a card standing on its own
   * minefield simply keeps it covered, and the mine is live again the moment
   * that card dies or walks off — which is the case his sentence names.
   */
  for (const board of [setup.a, setup.b])
    for (const [cell, kind] of Object.entries(board.squares ?? {})) {
      if (kind !== "minefield") continue;
      const [x, y] = cell.split("-").map(Number);
      if (x === undefined || y === undefined) continue;
      state.mines.push({ owner: board.owner, col: toArenaCol(board.owner, x), lane: y, spent: false });
    }

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

    /*
     * ═══ AND THE ONE THAT PAYS FOR BEING LEFT ALONE ═══
     *
     * Or: *"black hole — if you do not put a card there, the other cards on
     * the board get ×1.3 power and ×1.3 health."* So it is worked out BEFORE
     * the units are made: whether the cell is occupied is a fact about the
     * board, and the bonus lands on everybody else.
     */
    const taken = new Set(board.placements.map((p) => `${p.x}-${p.y}`));
    const voids = Object.entries(board.squares ?? {}).filter(
      ([cell, kind]) => kind === "blackhole" && !taken.has(cell),
    ).length;

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
      /*
       * The square this card is standing on, if its board has one there.
       * After the family bonus and the ground, because those are about who
       * the card IS and these are about where it is — and a mirror has to
       * copy a card, not a card plus the floor it is on.
       */
      const cell = `${placement.x}-${placement.y}`;
      const kind = unit.isKing ? undefined : board.squares?.[cell];
      if (kind && isSquareKind(kind)) applySquare(state, unit, kind, board, setup.catalog, placement);
      if (unit.isKing && board.kingAccountLevelHp) {
        unit.maxHp += board.kingAccountLevelHp;
        unit.hp = unit.maxHp;
      }
      /*
       * ⚠ LAST, AND ON TOP OF EVERYTHING. The black hole is the only square
       * that pays a card standing somewhere else, so it compounds with the
       * family bonus, the ground and whatever square that card is on —
       * which is correct: it is rent for a square nobody is using.
       */
      if (voids) {
        const mult = TUNED.blackHolePct / 100;
        for (let i = 0; i < voids; i++) {
          unit.power = Math.round(unit.power * mult);
          unit.maxHp = Math.round(unit.maxHp * mult);
        }
        unit.hp = unit.maxHp;
        unit.flags.blackhole = true;
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
