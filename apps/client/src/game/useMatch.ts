import { useCallback, useEffect, useRef, useState } from "react";
import { DECK, KING, PHASES, type Card, type RoomError, type Side } from "@amanda/shared";
import {
  runBattle,
  type BattleResult,
  type BoardInput,
  type Placement,
  type PlacementBuff,
} from "@amanda/engine";
import {
  ACTIONS,
  ACTION_DECK_COUNT,
  ACTION_SLOTS,
  CATALOG,
  KING_CANDIDATES,
  ACTIVE_ACTIONS,
  FILL_CARDS_PER_DECK,
  GROUND_FLOOR_SLOTS,
  FILL_CARD_CHANCE,
  PASSIVE_ACTIONS,
  SYNERGIES,
  cardPool,
  isCornerKey,
  isPassiveAction,
  isTargetedAction,
} from "../data/catalog";
import { sfx } from "./sfx";
import { Net, ONLINE_AVAILABLE, type Intent } from "./net";

export type Phase =
  | "intro"
  | "waiting"
  | "countdown"
  | "build"
  | "panic"
  | "prebattle"
  | "battle"
  | "result";

const BATTLE_SEED = 20260707;
const COUNTDOWN_SECONDS = 3;
/**
 * The pause between locking the boards and the first blow. It has to exist —
 * both players lock at the same moment, and the empty slots fill — but it is
 * four seconds of a blocked screen when you are still placing cards, so it is
 * kept to the shortest beat that still reads.
 */
const PREBATTLE_SECONDS = 2;
const XRAY_MS = 6000;
const KING_KEY = "king";

export const BOARD_SIZE = 4;
export function isKingCell(x: number, y: number): boolean {
  return x >= 1 && x <= 2 && y >= 1 && y <= 2;
}
export function cellKey(x: number, y: number): string {
  return `${x}-${y}`;
}
function isActionId(id: string): boolean {
  return ACTIONS.has(id);
}
function isMonsterId(id: string): boolean {
  return CATALOG.has(id);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 18 monster cards + 4 action cards (GDD), all shuffled together. */
function matchDeck(): string[] {
  const monsters = shuffle(cardPool()).slice(0, DECK.size);
  // Fill cards are the dramatic ones — at most one per deck, and not every
  // deck. The rest of the action slots go to the active cards.
  const fills =
    Math.random() < FILL_CARD_CHANCE
      ? shuffle([...PASSIVE_ACTIONS]).slice(0, FILL_CARDS_PER_DECK)
      : [];
  const actives = shuffle([...ACTIVE_ACTIONS]).slice(0, ACTION_DECK_COUNT - fills.length);
  return shuffle([...monsters, ...actives, ...fills]);
}

function perimeterCells(): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < BOARD_SIZE; x++)
    for (let y = 0; y < BOARD_SIZE; y++) if (!isKingCell(x, y)) cells.push({ x, y });
  return cells;
}

/** The two cells directly in front of the King — the posts that keep it alive. */
function isGuardPost(x: number, y: number): boolean {
  return x === 3 && (y === 1 || y === 2);
}

/**
 * Build the computer's board the way the game actually rewards, instead of
 * scattering cards at random: a fat King, static walls on the two guard posts,
 * the hardest hitters leading the flanks, and shooters and movers behind.
 *
 * It is deliberately not optimal — it picks from the top handful of each role
 * rather than the single best card — so the opponent has a personality and the
 * same board never turns up twice.
 */
function generateAiPlan(): Placement[] {
  const pool = shuffle(cardPool())
    .slice(0, DECK.size)
    .map((id) => CATALOG.get(id)!)
    .filter(Boolean);
  if (pool.length === 0) return [];

  const pick = <T,>(xs: T[], fallback: T): T =>
    xs.length ? xs[Math.floor(Math.random() * Math.min(4, xs.length))]! : fallback;
  const dps = (c: Card) => (c.stats.attackSpeed > 0 ? c.stats.power / c.stats.attackSpeed : 0);

  const used = new Set<string>();
  const take = (ranked: Card[]): Card => {
    const free = ranked.filter((c) => !used.has(c.id));
    const chosen = pick(free, free[0] ?? ranked[0] ?? pool[0]!);
    used.add(chosen.id);
    return chosen;
  };

  // A King is chosen for health first — it is pinned in place and shielded, so
  // what it mostly has to do is survive.
  const kingCard = take([...pool].sort((a, b) => b.stats.hp - a.stats.hp));
  // Walls hold the posts: the toughest things that will not wander off them.
  const walls = pool.filter((c) => c.stats.moveSpeed === 0).sort((a, b) => b.stats.hp - a.stats.hp);
  // The flanks are a straight trade, so they get the damage.
  const hitters = [...pool].sort((a, b) => dps(b) - dps(a));
  // Behind the line, only shooters and movers can ever do anything.
  const useful = pool.filter((c) => c.stats.range !== "melee" || c.stats.moveSpeed > 0);

  const placements: Placement[] = [{ cardId: kingCard.id, x: 1, y: 1, king: true }];
  for (const cell of perimeterCells()) {
    const ranked = isGuardPost(cell.x, cell.y)
      ? walls.length
        ? walls
        : hitters
      : cell.x === 3
        ? hitters
        : useful.length
          ? useful
          : hitters;
    placements.push({ cardId: take(ranked).id, x: cell.x, y: cell.y });
  }
  // Front row first keeps the battle readable when the boards are revealed.
  placements.sort((a, b) => (b.x ?? 0) - (a.x ?? 0));
  return placements;
}

function fillCrumbs(placements: Placement[]): Placement[] {
  const out = [...placements];
  for (const c of perimeterCells())
    if (!out.some((p) => !p.king && p.x === c.x && p.y === c.y))
      out.push({ cardId: "crumb_demon", x: c.x, y: c.y });
  return out;
}

function resolveKing(
  king: string | null,
  placements: Record<string, string>,
): { king: string; placements: Record<string, string> } {
  if (king) return { king, placements };
  let bestKey: string | null = null;
  let bestScore = -1;
  for (const [k, id] of Object.entries(placements)) {
    const c = CATALOG.get(id);
    const score = (c?.stats.hp ?? 0) + (c?.stats.power ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestKey = k;
    }
  }
  if (bestKey) {
    const rest = { ...placements };
    const promoted = rest[bestKey]!;
    delete rest[bestKey];
    return { king: promoted, placements: rest };
  }
  return { king: "crumb_demon", placements };
}

export interface BattleMods {
  /** Flat +power added to every non-crumb card you placed (Energy Boost). */
  boardPowerAdd: number;
  /** Cells (cellKey or "king") upgraded ×1.5 by Full Refuel. */
  boostedCells: Record<string, true>;
}

/** Combine the board buff + a per-cell ×1.5 boost into an engine PlacementBuff. */
export function cellBuff(
  mods: BattleMods,
  key: string,
  isCrumb: boolean,
): PlacementBuff | undefined {
  const buff: PlacementBuff = {};
  if (mods.boardPowerAdd > 0 && !isCrumb) buff.powerAdd = mods.boardPowerAdd;
  if (mods.boostedCells[key]) {
    buff.powerMult = 1.5;
    buff.hpMult = 1.5;
  }
  return Object.keys(buff).length ? buff : undefined;
}

function buildPlayerBoard(
  state: GameState,
  mods: BattleMods,
  stacked: Record<string, string> = {},
): BoardInput {
  const resolved = resolveKing(state.king, state.placements);
  const ps: Placement[] = [
    { cardId: resolved.king, x: 1, y: 1, king: true, buff: cellBuff(mods, KING_KEY, false) },
  ];
  for (const [key, cardId] of Object.entries(resolved.placements)) {
    const [x, y] = key.split("-").map(Number) as [number, number];
    ps.push({
      cardId,
      x,
      y,
      buff: cellBuff(mods, key, cardId === "crumb_demon"),
      // Ground Floor: when the card on top dies, this one is revealed.
      ...(stacked[key] ? { below: stacked[key] } : {}),
    });
  }
  return { owner: "A", placements: fillCrumbs(ps) };
}

interface GameState {
  deck: string[];
  hand: string | null;
  discard: string[];
  placements: Record<string, string>;
  king: string | null;
}

/**
 * Lock the board: auto-promote a King if needed, then fill empty slots with the
 * held Fill-action cards first and Crumb Demons after. Pure + used once so the
 * displayed board and the battle board match exactly (the shuffle runs once).
 */
/**
 * Sandstorm: rotate the lanes of the opponent's front-row cards.
 * A rotation by a random non-zero offset guarantees every card actually moves —
 * a plain shuffle of two or three cards often returned the original order, so
 * the card looked like it did nothing. Returns how many cards moved.
 */
export function rotateFrontLanes(plan: Placement[]): number {
  const fronts = plan.filter((p) => !p.king && p.x === 3);
  if (fronts.length < 2) return 0;
  const ys = fronts.map((p) => p.y);
  const shift = 1 + Math.floor(Math.random() * (ys.length - 1));
  fronts.forEach((p, i) => (p.y = ys[(i + shift) % ys.length]!));
  return fronts.length;
}

function fillGs(s: GameState, bar: string[]): GameState {
  // Every monster a held Fill card can place, in order.
  const fillQueue: string[] = [];
  for (const actId of bar) {
    const a = ACTIONS.get(actId);
    if (a?.effect !== "fillEmpty") continue;
    const cardId = String(a.params.cardId);
    const count = Number(a.params.count ?? 3);
    for (let n = 0; n < count; n++) fillQueue.push(cardId);
  }

  let king = s.king;
  let placements = { ...s.placements };
  // An empty King slot IS an empty slot: fill it from the Fill card first.
  // (Previously we auto-promoted one of the player's placed cards here, so the
  // Fill monster never reached the centre and a placed card was swallowed.)
  if (!king && fillQueue.length > 0) king = fillQueue.shift()!;
  if (!king) {
    const resolved = resolveKing(null, placements);
    king = resolved.king;
    placements = resolved.placements;
  }

  const empties = shuffle(perimeterCells().filter((c) => !placements[cellKey(c.x, c.y)]));
  let idx = 0;
  for (; idx < empties.length && fillQueue.length > 0; idx++)
    placements[cellKey(empties[idx]!.x, empties[idx]!.y)] = fillQueue.shift()!;
  for (; idx < empties.length; idx++)
    placements[cellKey(empties[idx]!.x, empties[idx]!.y)] = "crumb_demon";

  return { ...s, king, placements, hand: null };
}

function initialGameState(): GameState {
  return { deck: matchDeck(), hand: null, discard: [], placements: {}, king: null };
}

function drawIfEmpty(s: GameState): GameState {
  if (s.hand !== null || s.deck.length === 0) return s;
  return { ...s, hand: s.deck[0]!, deck: s.deck.slice(1) };
}

export interface BoardView {
  placements: Record<string, string>;
  king: string | null;
}
export interface ActionState {
  id: string;
  used: boolean;
  passive: boolean;
}

export interface MatchApi {
  phase: Phase;
  timeLeft: number;
  hand: string | null;
  handIsAction: boolean;
  discardTop: string | null;
  /** Cards still face-down in the deck — drives the "do I discard?" decision. */
  deckLeft: number;
  /** Cards in the discard pile (any of which the top one can be taken back). */
  discardCount: number;
  /** Cards already drawn ahead, waiting behind the one in your hand. */
  extraHand: string[];
  /** Cells you may still stack a second card onto. */
  stackSlots: number;
  /** True once "dark corners" has opened the four corners for stacking. */
  stackCorners: boolean;
  /** Which cells have a card hidden underneath. */
  stacked: Record<string, string>;
  /** True while the next action card played against you will be blocked. */
  shielded: boolean;
  /** First cell chosen for a two-step action, or null. */
  firstPick: string | null;
  placements: Record<string, string>;
  king: string | null;
  result: BattleResult | null;
  hasKing: boolean;
  opponent: BoardView;
  revealOpponentCell: (x: number, y: number) => boolean;
  revealOpponentKing: boolean;
  actionBar: ActionState[];
  barFull: boolean;
  /** Action id currently awaiting a board target, or null. */
  targeting: string | null;
  mods: BattleMods;
  /** Multiplayer state. */
  online: boolean;
  onlineAvailable: boolean;
  mySide: Side;
  oppLeft: boolean;
  /** Set when the server could not be reached, so "searching" never hangs. */
  netError: boolean;
  /** Code of the private room you opened, once the server has given one. */
  roomCode: string | null;
  /** Why joining a room failed, if it did. */
  roomError: RoomError | null;
  iWon: boolean;
  takeAction: () => void;
  activateAction: (id: string) => void;
  applyTargetCell: (x: number, y: number) => void;
  applyTargetKing: () => void;
  cancelTargeting: () => void;
  startMatch: () => void;
  startOnline: () => void;
  /** Open a private room and wait for a friend to join it. */
  hostRoom: () => void;
  /** Join a friend's private room by its code. */
  joinRoom: (code: string) => void;
  discardHand: () => void;
  takeDiscard: () => void;
  placeAt: (x: number, y: number) => void;
  placeKing: () => void;
  toBattle: () => void;
  finishBattle: () => void;
  /** Back to the main menu, abandoning whatever is in progress. */
  reset: () => void;
  /** Straight into another match of the same kind, skipping the menu. */
  playAgain: () => void;
}

export function useMatch(): MatchApi {
  const [phase, setPhase] = useState<Phase>("intro");
  const [timeLeft, setTimeLeft] = useState<number>(COUNTDOWN_SECONDS);
  const [gs, setGs] = useState<GameState>(initialGameState);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [actionBar, setActionBar] = useState<string[]>([]);
  const [usedActions, setUsedActions] = useState<Record<string, boolean>>({});
  const [boardPowerAdd, setBoardPowerAdd] = useState(0);
  const [boostedCells, setBoostedCells] = useState<Record<string, true>>({});
  const [xrayActive, setXrayActive] = useState(false);
  const [targeting, setTargeting] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [netError, setNetError] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<RoomError | null>(null);
  /** Cards stacked underneath a placed card, revealed when the top one dies. */
  const [stacked, setStacked] = useState<Record<string, string>>({});
  /** Cells "ground floor" has unlocked for stacking but not yet used. */
  const [stackSlots, setStackSlots] = useState(0);
  /** "Dark corners" opens the four corners for stacking, and never runs out. */
  const [stackCorners, setStackCorners] = useState(false);
  /** Blocks the next action card the opponent plays against you. */
  const [shielded, setShielded] = useState(false);
  /** Cards drawn ahead by "triple draw", offered before the deck is touched. */
  const [extraHand, setExtraHand] = useState<string[]>([]);
  /** First cell picked by a two-step action, waiting for its partner. */
  const [firstPick, setFirstPick] = useState<string | null>(null);
  /** True once the server has paired us with an opponent. */
  const matchStartedRef = useRef(false);
  const [mySide, setMySide] = useState<Side>("A");
  const [oppLeft, setOppLeft] = useState(false);
  const [netOpp, setNetOpp] = useState<BoardView>({ placements: {}, king: null });

  const onlineRef = useRef(online);
  onlineRef.current = online;
  const firstPickRef = useRef(firstPick);
  firstPickRef.current = firstPick;
  const extraHandRef = useRef(extraHand);
  extraHandRef.current = extraHand;
  const stackSlotsRef = useRef(stackSlots);
  stackSlotsRef.current = stackSlots;
  const stackCornersRef = useRef(stackCorners);
  stackCornersRef.current = stackCorners;
  const stackedRef = useRef(stacked);
  stackedRef.current = stacked;
  const mySideRef = useRef(mySide);
  mySideRef.current = mySide;
  const netRef = useRef<Net | null>(null);

  const gsRef = useRef(gs);
  gsRef.current = gs;
  const barRef = useRef(actionBar);
  barRef.current = actionBar;
  const usedRef = useRef(usedActions);
  usedRef.current = usedActions;
  const targetingRef = useRef(targeting);
  targetingRef.current = targeting;
  const modsRef = useRef<BattleMods>({ boardPowerAdd: 0, boostedCells: {} });
  modsRef.current = { boardPowerAdd, boostedCells };
  const aiPlanRef = useRef<Placement[] | null>(null);
  if (!aiPlanRef.current) aiPlanRef.current = generateAiPlan();

  /** Refill the hand, preferring cards already drawn ahead by "triple draw". */
  const refill = useCallback((next: GameState): GameState => {
    if (next.hand !== null) return next;
    const ahead = extraHandRef.current;
    if (ahead.length) {
      setExtraHand(ahead.slice(1));
      return { ...next, hand: ahead[0]! };
    }
    return drawIfEmpty(next);
  }, []);

  const placeAt = useCallback(
    (x: number, y: number) => {
      if (isKingCell(x, y)) return;
      const key = cellKey(x, y);
      const s = gsRef.current;
      if (s.hand === null || !isMonsterId(s.hand)) return;

      // Stacking: "ground floor" lets a card go on TOP of one already placed,
      // and the one underneath is revealed when the top card dies in battle.
      if (s.placements[key]) {
        if (stackedRef.current[key]) return;
        // A corner opened by "dark corners" is free; anywhere else spends one
        // of the slots "ground floor" handed out.
        const onTheHouse = stackCornersRef.current && isCornerKey(key);
        if (!onTheHouse && stackSlotsRef.current <= 0) return;
        const under = s.placements[key]!;
        setStacked((st) => ({ ...st, [key]: under }));
        if (!onTheHouse) setStackSlots((n) => n - 1);
        setGs(refill({ ...s, placements: { ...s.placements, [key]: s.hand }, hand: null }));
        sfx.play("place");
        return;
      }
      setGs(refill({ ...s, placements: { ...s.placements, [key]: s.hand }, hand: null }));
      sfx.play("place");
    },
    [refill],
  );

  const placeKing = useCallback(() => {
    let ok = false;
    setGs((s) => {
      if (s.hand === null || !isMonsterId(s.hand) || s.king !== null) return s;
      ok = true;
      return drawIfEmpty({ ...s, king: s.hand, hand: null });
    });
    if (ok) sfx.play("place");
  }, []);

  const discardHand = useCallback(() => {
    let ok = false;
    setGs((s) => {
      if (s.hand === null) return s;
      ok = true;
      return refill({ ...s, discard: [...s.discard, s.hand], hand: null });
    });
    if (ok) sfx.play("discard");
  }, [refill]);

  const takeDiscard = useCallback(() => {
    let ok = false;
    setGs((s) => {
      if (s.discard.length === 0) return s;
      ok = true;
      const top = s.discard[s.discard.length - 1]!;
      const discard = s.discard.slice(0, -1);
      if (s.hand !== null) discard.push(s.hand);
      return { ...s, hand: top, discard };
    });
    if (ok) sfx.play("draw");
  }, []);

  // Guards against a fast double-click taking the same action card twice: the
  // refs still hold the old hand until React commits the state update.
  const takingRef = useRef(false);
  const takeAction = useCallback(() => {
    if (takingRef.current) return;
    const hand = gsRef.current.hand;
    if (hand === null || !isActionId(hand) || barRef.current.length >= ACTION_SLOTS) return;
    takingRef.current = true;
    setActionBar((bar) => (bar.length < ACTION_SLOTS ? [...bar, hand] : bar));
    setGs((s) => drawIfEmpty({ ...s, hand: null }));
    sfx.play("draw");
  }, []);
  // released once the take above has actually been committed
  useEffect(() => {
    takingRef.current = false;
  });

  /**
   * Shuffle the lanes of the opponent's front-row cards (Sandstorm).
   * Uses a derangement so every card really moves — a plain shuffle of two or
   * three cards frequently returned the original order and looked like a dud.
   * Returns how many cards were moved.
   */
  const shuffleEnemyFront = useCallback(
    (): number => rotateFrontLanes(aiPlanRef.current!),
    [],
  );

  /**
   * The radioactive eraser, aimed at a cell on the opponent's board. An
   * ordinary card is simply gone; a King is too important to delete, so it
   * takes a heavy wound instead — carried into the battle as a health cut.
   */
  const eraseEnemyAt = useCallback((key: string, kingDamage: number) => {
    const plan = aiPlanRef.current;
    if (!plan) return;
    if (key === KING_KEY) {
      const king = plan.find((p) => p.king);
      if (!king) return;
      const card = CATALOG.get(king.cardId);
      const full = (card?.stats.hp ?? 0) * KING.hpMultiplier;
      if (full <= 0) return;
      const left = Math.max(1, full - kingDamage);
      king.buff = { ...(king.buff ?? {}), hpMult: left / full };
      return;
    }
    const [x, y] = key.split("-").map(Number) as [number, number];
    const at = plan.findIndex((p) => !p.king && p.x === x && p.y === y);
    if (at >= 0) plan.splice(at, 1);
    setNetOpp((v) => {
      const placements = { ...v.placements };
      delete placements[key];
      return { ...v, placements };
    });
  }, []);

  const activateAction = useCallback(
    (id: string) => {
      if (isPassiveAction(id) || usedRef.current[id]) return;
      if (isTargetedAction(id)) {
        setTargeting(id);
        sfx.play("click");
        return;
      }
      const a = ACTIONS.get(id);
      const params = a?.params ?? {};
      if (a?.effect === "boardPowerBuff") setBoardPowerAdd((b) => b + Number(params.power ?? 50));
      else if (a?.effect === "recycleDiscard") {
        // Straight back into your hand, without spending a draw on it.
        const st = gsRef.current;
        if (st.discard.length) {
          const discard = [...st.discard];
          const back = discard.pop()!;
          const held = st.hand;
          if (held) setExtraHand((e) => [held, ...e]);
          setGs({ ...st, hand: back, discard });
        }
      } else if (a?.effect === "freezeEnemy") {
        // Seconds are the currency of the build phase, so this buys you some.
        setTimeLeft((t) => t + Number(params.seconds ?? 3));
      } else if (a?.effect === "blockNextActionCard") {
        setShielded(true);
      } else if (a?.effect === "draw") {
        // Hold several at once instead of one, so you stop cycling the deck.
        const st = gsRef.current;
        const deck = [...st.deck];
        const want = Math.max(1, Number(params.count ?? 3));
        const drawn: string[] = [];
        while (drawn.length < want && deck.length) drawn.push(deck.shift()!);
        const hand = st.hand ?? drawn.shift() ?? null;
        if (drawn.length) setExtraHand((e) => [...e, ...drawn]);
        setGs({ ...st, deck, hand });
      } else if (a?.effect === "enableStacking") {
        setStackSlots((n) => n + Number(params.slots ?? GROUND_FLOOR_SLOTS));
      } else if (a?.effect === "autoStackCorners") {
        setStackCorners(true);
      }
      else if (a?.effect === "revealBoard") {
        setXrayActive(true);
        window.setTimeout(() => setXrayActive(false), XRAY_MS);
      } else if (a?.effect === "shuffleEnemyFrontRow") shuffleEnemyFront();
      setUsedActions((u) => ({ ...u, [id]: true }));
      sfx.play("draw");
    },
    [shuffleEnemyFront],
  );

  const applyTargetTo = useCallback((id: string, key: string) => {
    const effect = ACTIONS.get(id)?.effect;
    if (effect === "upgradeCardTemp") {
      setBoostedCells((bc) => ({ ...bc, [key]: true }));
    } else if (effect === "removeCard") {
      setGs((s) => {
        if (key === KING_KEY) return { ...s, king: null };
        const placements = { ...s.placements };
        const removed = placements[key];
        delete placements[key];
        return { ...s, placements, discard: removed ? [...s.discard, removed] : s.discard };
      });
    } else if (effect === "swapOwnCards") {
      // Two picks: remember the first, swap on the second.
      const first = firstPickRef.current;
      if (!first) {
        setFirstPick(key);
        sfx.play("click");
        return; // still targeting — do not spend the card yet
      }
      if (first !== key) {
        const s0 = gsRef.current;
        const placements = { ...s0.placements };
        const a = first === KING_KEY ? s0.king : (placements[first] ?? null);
        const b = key === KING_KEY ? s0.king : (placements[key] ?? null);
        // Both cells have to hold something; swapping with an empty slot is
        // just a move, and the card does not promise that.
        if (a !== null && b !== null) {
          let king = s0.king;
          if (first === KING_KEY) king = b;
          else placements[first] = b;
          if (key === KING_KEY) king = a;
          else placements[key] = a;
          setGs({ ...s0, placements, king });
        }
      }
      setFirstPick(null);
    } else if (effect === "eraseEnemyCard") {
      // Aimed at the opponent's board: the card is gone. A King cannot be
      // erased outright, so it takes a heavy wound instead.
      eraseEnemyAt(key, Number(ACTIONS.get(id)?.params?.kingFlatDamage ?? 2000));
    }
    setUsedActions((u) => ({ ...u, [id]: true }));
    setTargeting(null);
    setFirstPick(null);
    sfx.play("place");
  }, []);

  const applyTargetCell = useCallback(
    (x: number, y: number) => {
      const id = targetingRef.current;
      if (!id || !gsRef.current.placements[cellKey(x, y)]) return;
      applyTargetTo(id, cellKey(x, y));
    },
    [applyTargetTo],
  );
  const applyTargetKing = useCallback(() => {
    const id = targetingRef.current;
    if (!id || !gsRef.current.king) return;
    applyTargetTo(id, KING_KEY);
  }, [applyTargetTo]);
  const cancelTargeting = useCallback(() => setTargeting(null), []);

  const enterPrebattle = useCallback(() => {
    setTargeting(null);
    const filled = fillGs(gsRef.current, barRef.current);
    setGs(filled);
    sfx.play("crumbs");
    setPhase("prebattle");
    setTimeLeft(PREBATTLE_SECONDS);
    // In an online match, submit the locked board to the server now.
    if (onlineRef.current)
      netRef.current?.lock(buildPlayerBoard(filled, modsRef.current, stackedRef.current));
  }, []);

  const startBattle = useCallback(() => {
    const aiFull: BoardInput = { owner: "B", placements: fillCrumbs(aiPlanRef.current!) };
    const r = runBattle({
      seed: BATTLE_SEED,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: buildPlayerBoard(gsRef.current, modsRef.current, stackedRef.current),
      b: aiFull,
      recordFrames: true,
    });
    setResult(r);
    sfx.play("go");
    setPhase("battle");
  }, []);

  /** Tear the match down to a clean slate, without deciding where to go next. */
  const clearMatch = useCallback(() => {
    netRef.current?.close();
    netRef.current = null;
    aiPlanRef.current = generateAiPlan();
    setGs(initialGameState());
    setResult(null);
    setActionBar([]);
    setUsedActions({});
    setBoardPowerAdd(0);
    setBoostedCells({});
    setXrayActive(false);
    setTargeting(null);
    setOnline(false);
    setOppLeft(false);
    setNetError(false);
    setRoomCode(null);
    setRoomError(null);
    setStacked({});
    setStackSlots(0);
    setStackCorners(false);
    setShielded(false);
    setExtraHand([]);
    setFirstPick(null);
    setMySide("A");
    setNetOpp({ placements: {}, king: null });
    setTimeLeft(COUNTDOWN_SECONDS);
  }, []);

  const startMatch = useCallback(() => {
    sfx.unlock();
    sfx.play("click");
    // Start from a clean slate. This used to only set the phase, so anything
    // left over from a previous match came along — including `mySide`, which
    // an online match can set to "B". A single-player game is always side A,
    // and getting that wrong swaps the battle report's labels and inverts the
    // win check.
    clearMatch();
    setPhase("countdown");
  }, [clearMatch]);

  const startOnline = useCallback((intent: Intent = { kind: "quick" }) => {
    if (!ONLINE_AVAILABLE) return;
    sfx.unlock();
    sfx.play("click");
    setOnline(true);
    setOppLeft(false);
    setNetError(false);
    setRoomCode(null);
    setRoomError(null);
    matchStartedRef.current = false;
    setPhase("waiting");
    const net = new Net();
    netRef.current = net;
    net.connect(
      {
      onRoom: (code) => setRoomCode(code),
      onRoomError: (reason) => {
        // The code was wrong or the room is gone; stop waiting and say why.
        setRoomError(reason);
        netRef.current?.close();
        netRef.current = null;
      },
      onStart: (side) => {
        matchStartedRef.current = true;
        setMySide(side);
      },
      onPhase: (p, timeLeft) => {
        if (p === "locking") {
          enterPrebattle();
        } else {
          setPhase(p as Phase);
          setTimeLeft(timeLeft);
          if (p === "build") setGs((s) => drawIfEmpty(s));
        }
      },
      onOpp: (view) => setNetOpp(view),
      onResult: (r) => {
        const res = runBattle({
          seed: r.seed,
          catalog: CATALOG,
          synergies: SYNERGIES,
          a: r.boardA as BoardInput,
          b: r.boardB as BoardInput,
          recordFrames: true,
        });
        setResult(res);
        sfx.play("go");
        setPhase("battle");
      },
      onOppLeft: () => {
        setOppLeft(true);
        // If the match hadn't resolved, you win by forfeit.
        setPhase((prev) => (prev === "battle" || prev === "result" ? prev : "result"));
      },
      onClose: (connected) => {
        // A socket that dies before the match is paired leaves the player
        // staring at "searching…" with nothing to tell them it is over —
        // whether it never opened at all, or opened and then dropped while
        // queuing. Either way, say so.
        if (!connected || !matchStartedRef.current) setNetError(true);
        else setOppLeft(true);
      },
      },
      intent,
    );
  }, [enterPrebattle]);

  const hostRoom = useCallback(() => startOnline({ kind: "host" }), [startOnline]);
  const joinRoom = useCallback(
    (code: string) => startOnline({ kind: "join", code: code.toUpperCase().trim() }),
    [startOnline],
  );

  const finishBattle = useCallback(() => {
    const w = result?.winner;
    sfx.play(w === mySideRef.current ? "win" : "lose");
    setPhase("result");
  }, [result]);

  const reset = useCallback(() => {
    clearMatch();
    setPhase("intro");
  }, [clearMatch]);

  /**
   * "New game" means a new game — not a trip back to the menu. An online match
   * queues up another online match; a match against the computer starts another
   * one immediately.
   */
  const playAgain = useCallback(() => {
    const wasOnline = onlineRef.current;
    clearMatch();
    if (wasOnline && ONLINE_AVAILABLE) {
      startOnline();
      return;
    }
    sfx.play("click");
    setPhase("countdown");
  }, [clearMatch, startOnline]);

  useEffect(() => {
    if (!["countdown", "build", "panic", "prebattle"].includes(phase)) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (timeLeft > 0) return;
    // Online: the server drives phase changes; the local timer is display-only.
    if (online) return;
    if (phase === "countdown") {
      setPhase("build");
      setTimeLeft(PHASES.build.seconds);
      setGs((s) => drawIfEmpty(s));
    } else if (phase === "build") {
      setPhase("panic");
      setTimeLeft(PHASES.panic.seconds);
    } else if (phase === "panic") {
      enterPrebattle();
    } else if (phase === "prebattle") {
      startBattle();
    }
  }, [timeLeft, phase, online, enterPrebattle, startBattle]);

  // Online: send our board to the server for the opponent's fog-of-war view.
  useEffect(() => {
    if (online) netRef.current?.sendBoard({ placements: gs.placements, king: gs.king });
  }, [online, gs.placements, gs.king]);

  // Tidy up the socket if the component unmounts.
  useEffect(() => () => netRef.current?.close(), []);

  const revealOpponentCell = useCallback(
    (x: number, _y: number): boolean => {
      // Online: the server already fogs the opponent view, so show all it sent.
      if (online) return true;
      if (xrayActive) return true;
      if (phase === "build") return x === 3;
      if (phase === "panic" || phase === "prebattle") return x >= 1;
      return true;
    },
    [phase, xrayActive, online],
  );

  // Opponent board: online → server-sent fogged view; vs-AI → the AI plan built over time.
  let opponentView: BoardView;
  if (online) {
    opponentView = netOpp;
  } else {
    const plan = aiPlanRef.current;
    let visible = plan.length;
    if (phase === "build") {
      const frac = 1 - timeLeft / PHASES.build.seconds;
      visible = Math.max(0, Math.min(plan.length, Math.ceil(frac * plan.length)));
    } else if (phase === "intro" || phase === "countdown") {
      visible = 0;
    }
    opponentView = { placements: {}, king: null };
    for (const p of plan.slice(0, visible)) {
      if (p.king) opponentView.king = p.cardId;
      else opponentView.placements[cellKey(p.x, p.y)] = p.cardId;
    }
  }

  return {
    phase,
    timeLeft,
    hand: gs.hand,
    handIsAction: gs.hand !== null && isActionId(gs.hand),
    discardTop: gs.discard.length ? gs.discard[gs.discard.length - 1]! : null,
    deckLeft: gs.deck.length,
    discardCount: gs.discard.length,
    extraHand,
    stackSlots,
    stackCorners,
    stacked,
    shielded,
    firstPick,
    placements: gs.placements,
    king: gs.king,
    result,
    hasKing: gs.king !== null,
    opponent: opponentView,
    revealOpponentCell,
    revealOpponentKing: xrayActive || phase === "panic" || phase === "prebattle",
    actionBar: actionBar.map((id) => ({ id, used: !!usedActions[id], passive: isPassiveAction(id) })),
    barFull: actionBar.length >= ACTION_SLOTS,
    targeting,
    mods: { boardPowerAdd, boostedCells },
    online,
    onlineAvailable: ONLINE_AVAILABLE,
    netError,
    roomCode,
    roomError,
    mySide,
    oppLeft,
    iWon: result != null && result.winner === mySide,
    takeAction,
    activateAction,
    applyTargetCell,
    applyTargetKing,
    cancelTargeting,
    startMatch,
    startOnline: () => startOnline(),
    hostRoom,
    joinRoom,
    discardHand,
    takeDiscard,
    placeAt,
    placeKing,
    toBattle: enterPrebattle,
    finishBattle,
    reset,
    playAgain,
  };
}

/** Internals exposed for unit tests. */
export const __testing = {
  matchDeck, fillGs, cellKey, resolveKing, rotateFrontLanes, generateAiPlan };
