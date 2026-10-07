import { useCallback, useEffect, useRef, useState } from "react";
import {
  DECK,
  KING,
  PHASES,
  COOP_LANES,
  buildAmandaBoard,
  levelMultiplier,
  emojiFromSayId,
  tauntById,
  type BotLevel,
  type Card,
  type PlayerCard,
  type RoomError,
  type Side,
} from "@amanda/shared";
import {
  createRng,
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
  isEnemyTargeted,
  isPassiveAction,
  isTargetedAction,
} from "../data/catalog";
import { sfx } from "./sfx";
import {
  albumToPool,
  loadAccount,
  onAccountChange,
  type Account,
  type OwnedCard,
} from "./account";
import { reportSolo, type Award } from "./meta";
import { LESSONS } from "./lessons";
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

/**
 * Shuffle, optionally from a seed.
 *
 * The seed is what makes "חפיסה זהה" possible: both sides deal the same deck
 * in the same order from the same number, and neither has to be told what the
 * cards are. Without one it behaves exactly as it always did.
 */
function shuffle<T>(items: T[], rnd: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 18 monster cards + 4 action cards (GDD), all shuffled together. */
/**
 * The monsters a match deck is drawn from.
 *
 * With an album, it is YOUR album, duplicates and all — holding three of
 * something means three of them can reach the board. Without one (no account,
 * no network, no keys) it stays what it always was: the whole catalog. The
 * game has to start either way.
 */
function monsterPool(album?: Map<string, OwnedCard> | null): string[] {
  if (album && album.size) return albumToPool(album);
  return cardPool();
}

/**
 * The deck for one match.
 *
 * With a `seed` the album is ignored and the deck is dealt from the whole
 * launch pool — that is the mirror mode, "חפיסה זהה": the same cards, in the
 * same order, for both sides. It has to ignore the album, because a deck built
 * from what you own is by definition not the same deck as your opponent's,
 * and the entire point of the mode is that nobody can blame their collection.
 */
function matchDeck(album?: Map<string, OwnedCard> | null, seed?: number): string[] {
  const rng = seed === undefined ? null : createRng(seed);
  const rnd = rng ? () => rng.next() : Math.random;
  // An album smaller than a full deck is not padded. Running thin IS the game:
  // the gaps become Crumb Demons, and that is the reason to collect.
  const pool = seed === undefined ? monsterPool(album) : cardPool();
  const monsters = shuffle(pool, rnd).slice(0, DECK.size);
  // Fill cards are the dramatic ones — at most one per deck, and not every
  // deck. The rest of the action slots go to the active cards.
  const fills =
    rnd() < FILL_CARD_CHANCE ? shuffle([...PASSIVE_ACTIONS], rnd).slice(0, FILL_CARDS_PER_DECK) : [];
  const actives = shuffle([...ACTIVE_ACTIONS], rnd).slice(0, ACTION_DECK_COUNT - fills.length);
  return shuffle([...monsters, ...actives, ...fills], rnd);
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
/** Rough worth of a card, for deciding which placements a freeze costs the AI. */
function power(cardId: string): number {
  const c = CATALOG.get(cardId);
  if (!c) return 0;
  return c.stats.hp + c.stats.power * 4;
}

/**
 * The computer's board.
 *
 * `deck` is the mirror mode: given one, the computer builds out of exactly the
 * cards you were dealt instead of drawing its own. That is the whole claim of
 * "חפיסה זהה" — same cards, both sides, so the only thing left to be better at
 * is where you put them.
 */
/**
 * How hard the computer tries.
 *
 * ═══ WHY A DIAL AND NOT A CLEVERER BOT ═══
 *
 * Measured first (`apps/client/scripts/bot-report.ts`): the bot already wins
 * 52-55% against a board built the way a person builds one, and two honest
 * attempts to improve its placement BOTH made it worse. The reason is that
 * the planner only chooses where cards go — who they attack is decided by the
 * engine, at the time, from the board in front of them. There is very little
 * cleverness left to add.
 *
 * What the game was actually missing is the opposite: something a
 * seven-year-old can beat. So this is one knob with three settings, and each
 * one is MEASURED rather than hoped at — the numbers below were tuned until
 * the win rates came out where they should.
 */
/*
 * Defined in @amanda/shared and re-exported here, where everything already
 * imports it from. The server needs the same three words — it decides what
 * beating each setting is worth — and two copies of a three-word union is
 * exactly the kind of thing that drifts by one word and breaks a payout.
 */
export type { BotLevel };

interface Skill {
  /** How many of the ranked list to choose from. 1 means always the best. */
  window: number;
  /** Choose from the BOTTOM of the ranking instead of the top. */
  fromWorst: boolean;
  /** Chance per cell of ignoring the role rules and putting anything there. */
  sloppiness: number;
  /** Cells left empty. A thin board is the most readable kind of weak. */
  gaps: number;
  /**
   * How many cards it gets to choose its thirteen from.
   *
   * A person draws thirteen at random, so the normal bot does too. Measured,
   * choosing PERFECTLY from a random thirteen only buys six points of win
   * rate — the planner's rules are the ceiling, not the picking. A wider
   * draw is what actually makes a hard opponent, and it is the honest kind of
   * hard: somebody with more of the collection, which is what a better player
   * has.
   *
   * Tuned by measurement, not by feel. The whole pool came out at 92%, which
   * is not a hard opponent but a wall; 20 gave 56%, 30 gave 58%, 40 gives
   * 61%. Sixty-one is the shape wanted — clearly against you, clearly
   * winnable.
   */
  draw: number;
}

/**
 * The bot, as somebody to fight.
 *
 * Or asked for the versus beat "against a friend AND against the bot too",
 * which means the computer needs a name, a face and a number like anybody
 * else. Its trophies are its measured win rate against a human-shaped board
 * (apps/client/scripts/bot-report.ts) turned into a figure on the same scale
 * the arenas use — not a real count, because the bot has no account, but not
 * a made-up one either: the hard bot IS harder and the card should say so.
 */
export const BOT_CARDS: Record<BotLevel, PlayerCard> = {
  easy: {
    nickname: "בוט קליל",
    avatar: "versus_robot",
    trophies: 40,
    catchphrase: null,
    gender: null,
  },
  normal: {
    nickname: "הבוט",
    avatar: "versus_robot",
    trophies: 300,
    catchphrase: "phrase.fight",
    gender: null,
  },
  hard: {
    nickname: "בוט קשה",
    avatar: "versus_robot",
    trophies: 700,
    catchphrase: "phrase.onlyamanda",
    gender: null,
  },
};

const SKILL: Record<BotLevel, Skill> = {
  /*
   * Beatable by a child, without being a pushover that teaches nothing.
   * It fields real cards in roughly sensible places — it just fields the
   * wrong ones, leaves holes, and sometimes puts a shooter where a wall
   * should be. Which is what a beginner's board looks like, and makes it a
   * fair thing to learn against.
   */
  easy: { window: 6, fromWorst: true, sloppiness: 0.45, gaps: 3, draw: DECK.size },
  normal: { window: 4, fromWorst: false, sloppiness: 0, gaps: 0, draw: DECK.size },
  /** Every choice the planner knows how to make, made correctly. */
  hard: { window: 1, fromWorst: false, sloppiness: 0, gaps: 0, draw: 40 },
};

function generateAiPlan(deck?: string[], level: BotLevel = "normal"): Placement[] {
  const skill = SKILL[level] ?? SKILL.normal;
  const ids = deck
    ? deck.filter((id) => CATALOG.has(id))
    : shuffle(cardPool()).slice(0, skill.draw);
  const pool = ids.map((id) => CATALOG.get(id)!).filter(Boolean);
  if (pool.length === 0) return [];

  const pick = <T,>(xs: T[], fallback: T): T => {
    if (!xs.length) return fallback;
    const n = Math.min(skill.window, xs.length);
    const i = Math.floor(Math.random() * n);
    // From the worst end for the easy bot: the same ranking, read backwards.
    return (skill.fromWorst ? xs[xs.length - 1 - i] : xs[i]) ?? fallback;
  };
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
  // Which cells to leave empty, chosen at random rather than always the same
  // ones — a board with the same three holes every game is a board you learn
  // the shape of instead of learning the game.
  const cells = perimeterCells();
  const empty = new Set(
    shuffle(cells.map((_, i) => i)).slice(0, Math.min(skill.gaps, cells.length - 1)),
  );
  for (const [i, cell] of cells.entries()) {
    if (empty.has(i)) continue;
    // Sloppiness: the role rules exist for a reason, so ignoring them puts a
    // shooter on a guard post or a wall in the back row. Wrong in the way a
    // beginner is wrong, rather than wrong at random.
    const sloppy = Math.random() < skill.sloppiness;
    const ranked = sloppy
      ? hitters
      : isGuardPost(cell.x, cell.y)
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

/**
 * Who wears the crown when the player never chose.
 *
 * The best card they placed gets promoted. If they placed NOTHING, the answer
 * is nobody — and that line is the whole point of this comment.
 *
 * It used to return a crumb demon: the 1 HP filler, wearing the crown. A King
 * dying ends the battle instantly, so a player who built nothing was killed on
 * the first tick. In a one-on-one that merely looks like a harsh forfeit. In
 * Amanda mode the two players share a side, so one crumb King took the OTHER
 * player down with it — Or and Hod hit exactly this: "Hod immediately saw that
 * he lost", a battle the server recorded as one tick long.
 *
 * With no King at all the side simply fights without one and is judged on
 * damage at the end (measured: a full-length battle, lost on kingHp, instead
 * of 0.0 seconds). Losing because you built nothing is fair. Losing before the
 * first second, and taking your partner with you, is not.
 */
function resolveKing(
  king: string | null,
  placements: Record<string, string>,
): { king: string | null; placements: Record<string, string> } {
  if (king) return { king, placements };
  let bestKey: string | null = null;
  let bestScore = -1;
  for (const [k, id] of Object.entries(placements)) {
    // A crumb is never a candidate. By the time this runs the empty cells have
    // already been filled with them, so "the best card on the board" was a
    // crumb demon whenever the player built nothing — and the board is never
    // empty by then, so the no-King case below could not be reached.
    if (id === "crumb_demon") continue;
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
  return { king: null, placements };
}

export interface BattleMods {
  /** Flat +power added to every non-crumb card you placed (Energy Boost). */
  boardPowerAdd: number;
  /** Cells (cellKey or "king") upgraded ×1.5 by Full Refuel. */
  boostedCells: Record<string, true>;
  /**
   * Flat health the enemy's radioactive eraser took off your King, aimed at
   * the one thing it is not allowed to delete. Carried as a cut rather than
   * a removal because a board with no King is not a board.
   */
  kingWound?: number;
}

/** Combine the board buff + a per-cell ×1.5 boost into an engine PlacementBuff. */
export function cellBuff(
  mods: BattleMods,
  key: string,
  isCrumb: boolean,
  /** The level of the card in this cell, from the player's album. */
  level = 1,
): PlacementBuff | undefined {
  const buff: PlacementBuff = {};
  if (mods.boardPowerAdd > 0 && !isCrumb) buff.powerAdd = mods.boardPowerAdd;
  // Levels ride the same multipliers an action card uses, so the engine needs
  // to know nothing about albums — a levelled card is simply a buffed one.
  const lvl = isCrumb ? 1 : levelMultiplier(level);
  let powerMult = lvl;
  let hpMult = lvl;
  if (mods.boostedCells[key]) {
    powerMult *= 1.5;
    hpMult *= 1.5;
  }
  if (powerMult !== 1) buff.powerMult = powerMult;
  if (hpMult !== 1) buff.hpMult = hpMult;
  return Object.keys(buff).length ? buff : undefined;
}

/**
 * The King's health after an eraser has been aimed at it.
 *
 * The engine takes a MULTIPLIER, and the card promises a flat number, so the
 * conversion has to happen somewhere and the King's full health is only known
 * here. Never below 1: a King erased by arithmetic is the deletion the card
 * is not allowed to do.
 */
export function woundedKingMult(cardId: string, wound: number): number | null {
  if (wound <= 0) return null;
  const full = (CATALOG.get(cardId)?.stats.hp ?? 0) * KING.hpMultiplier;
  if (full <= 0) return null;
  return Math.max(1, full - wound) / full;
}

/**
 * Is the one take-back still there to be spent? See takeDiscard for the rule.
 *
 * Pure and exported so the rule can be tested as the rule, rather than as a
 * sentence in a test file that happens to agree with the code.
 */
export function canTakeFromBin(binUsed: boolean, binSize: number): boolean {
  return !binUsed && binSize > 0;
}

/**
 * Spend it: the top card comes back and what you were holding is buried.
 *
 * Buried rather than swapped because a swap puts the card you just gave up
 * on top, one tap from returning — and with only one take-back a match that
 * no longer matters for taking, but it still decides what the PILE looks
 * like for anything that reads it.
 */
export function takeFromBin<T extends { hand: string | null; discard: string[] }>(s: T): T {
  if (s.discard.length === 0) return s;
  const top = s.discard[s.discard.length - 1]!;
  const rest = s.discard.slice(0, -1);
  return { ...s, hand: top, discard: s.hand !== null ? [s.hand, ...rest] : rest };
}

function buildPlayerBoard(
  state: GameState,
  mods: BattleMods,
  stacked: Record<string, string> = {},
  album?: Map<string, OwnedCard> | null,
): BoardInput {
  const levelOf = (id: string) => album?.get(id)?.level ?? 1;
  const resolved = resolveKing(state.king, state.placements);
  const ps: Placement[] = [];
  // No King is a real state — see resolveKing. Never crown a crumb.
  if (resolved.king !== null)
    ps.push({
      cardId: resolved.king,
      x: 1,
      y: 1,
      king: true,
      buff: (() => {
        const buff = cellBuff(mods, KING_KEY, false, levelOf(resolved.king));
        const hurt = woundedKingMult(resolved.king, mods.kingWound ?? 0);
        if (hurt === null) return buff;
        return { ...(buff ?? {}), hpMult: (buff?.hpMult ?? 1) * hurt };
      })(),
    });
  for (const [key, cardId] of Object.entries(resolved.placements)) {
    const [x, y] = key.split("-").map(Number) as [number, number];
    ps.push({
      cardId,
      x,
      y,
      buff: cellBuff(mods, key, cardId === "crumb_demon", levelOf(cardId)),
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
 * Sandstorm: swap the opponent's front row WITHIN its pairs.
 *
 * It used to rotate all four lanes by a random offset, and Or caught what that
 * really did: it took whatever was guarding the King and dumped it on the
 * outside, so a bodyguard meant nothing against one epic card. His fix, and
 * this is it — the two guard posts trade with each other, the two outer lanes
 * trade with each other, and nothing crosses between them.
 *
 *   lane 0  ⟷  lane 3     the outside
 *   lane 1  ⟷  lane 2     the King's guard
 *
 * So the card still does what it is for — it wrecks the matchups you lined up,
 * your sniper now faces the wrong thing — without undoing the one decision the
 * whole board is built around. Returns how many cards actually moved.
 */
export const SANDSTORM_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], // the two guard posts, in front of the King
  [0, 3], // the two outer lanes
];

export function rotateFrontLanes(plan: Placement[]): number {
  const fronts = plan.filter((p) => !p.king && p.x === 3);
  if (fronts.length < 2) return 0;
  const at = (y: number) => fronts.find((p) => p.y === y);
  let moved = 0;
  for (const [a, b] of SANDSTORM_PAIRS) {
    const first = at(a);
    const second = at(b);
    // Nothing in either lane is nothing to swap. One card alone still slides
    // across to its partner lane — it stays a guard, or stays on the outside.
    if (!first && !second) continue;
    if (first) first.y = b;
    if (second) second.y = a;
    moved += (first ? 1 : 0) + (second ? 1 : 0);
  }
  return moved;
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

function initialGameState(album?: Map<string, OwnedCard> | null): GameState {
  return { deck: matchDeck(album), hand: null, discard: [], placements: {}, king: null };
}

function drawIfEmpty(s: GameState): GameState {
  if (s.hand !== null || s.deck.length === 0) return s;
  return { ...s, hand: s.deck[0]!, deck: s.deck.slice(1) };
}

export interface BoardView {
  placements: Record<string, string>;
  king: string | null;
}

/** Which of the two boards the playground is currently writing into. */
export type EditSide = "me" | "enemy";

/**
 * Turn a hand-built board into something the engine can fight with.
 *
 * Deliberately given no album: in the playground both sides are level 1, so a
 * comparison measures the cards and not whose copy happens to be upgraded.
 */
function buildBenchBoard(view: BoardView, owner: Side): BoardInput {
  const state: GameState = {
    deck: [],
    hand: null,
    discard: [],
    placements: view.placements,
    king: view.king,
  };
  return {
    ...buildPlayerBoard(state, { boardPowerAdd: 0, boostedCells: {} }),
    owner,
  };
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
  /** Cards in the discard pile. */
  discardCount: number;
  /** Is the one take-back still available? See takeDiscard. */
  canTakeDiscard: boolean;
  /** Cards already drawn ahead, waiting behind the one in your hand. */
  extraHand: string[];
  /** Cells you may still stack a second card onto. */
  /** Seconds left on a freeze the opponent put on you, 0 when you are free. */
  frozenFor: number;
  /** True while an action card cannot be played right now (and why, in the UI). */
  canPlayAction: (id: string) => boolean;
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
  /** Amanda mode: you share a side with the other player against her. */
  coop: boolean;
  /**
   * Amanda mode: your partner's half of your shared side, as it stands.
   *
   * Null until they place something. Not fogged — they are on your team, and
   * the entire mode is two people arranging one eight-lane side together.
   */
  mate: BoardView | null;
  /**
   * Which half of that side is YOURS: 0 for the top four lanes, 4 for the
   * bottom four. The server decides, and the two halves must be drawn in that
   * order or the screen disagrees with the battle about who is where.
   */
  myLane: number;
  /**
   * The last thing the other player said, or null.
   *
   * One at a time on purpose: this is a bubble over their board, not a chat
   * log. A new one replaces the old, and it clears itself after a few seconds.
   */
  heard: { id: string; at: number } | null;
  /** The last thing YOU said, shown over your own board so you can see it landed. */
  spoke: { id: string; at: number } | null;
  /** Say one of the ready-made lines to the other player. */
  say: (id: string) => void;
  /** You have asked the person you just played for another match. */
  rematchAsked: boolean;
  /** They have asked you. */
  rematchOffered: boolean;
  askRematch: () => void;
  /**
   * Call a friend into a game: opens a private room and sends them its code.
   * Null while nothing is connected — the invitation has to come from a
   * socket, and from the home screen rather than mid-match.
   */
  inviteFriend: (playerId: string) => void;
  /** A friend is calling you into their room, or null. */
  invitation: { id: string; nickname: string | null; code: string } | null;
  acceptInvitation: () => void;
  declineInvitation: () => void;
  /** Whether the other player's messages are shown at all. Per browser. */
  hearing: boolean;
  toggleHearing: () => void;
  startAmanda: () => void;
  /** Developer preview of Amanda mode, alone and unwinnable. */
  startAmandaSolo: () => void;
  /** How hard the computer tries. Remembered per browser. */
  botLevel: BotLevel;
  setBotLevel: (level: BotLevel) => void;
  /** The player's account, or null when playing without one. */
  account: Account | null;
  /** Re-read it, after the player changes something about themselves. */
  reloadAccount: () => void;
  onlineAvailable: boolean;
  mySide: Side;
  oppLeft: boolean;
  /** Set when the server could not be reached, so "searching" never hangs. */
  netError: boolean;
  /** When this account's suspension lifts, or null when it is not suspended. */
  suspendedUntil: string | null;
  /** Code of the private room you opened, once the server has given one. */
  roomCode: string | null;
  /** Why joining a room failed, if it did. */
  roomError: RoomError | null;
  iWon: boolean;
  /** Mirror mode: the same deck on both sides. Null when it is off. */
  mirrorSeed: number | null;
  /** Start a mirror match against the computer. */
  startMirror: () => void;
  /**
   * Which tutorial match is running (1 or 2), or 0 for an ordinary game.
   *
   * A lesson is not a match against the computer: both sides are written down
   * in lessons.ts, because Amanda cannot say "a giant? guard your King with
   * him" unless a giant is actually coming.
   */
  lesson: number;
  startLesson: (n: number) => void;
  /** The sandbox: no clock, both boards yours, every card available. */
  playground: boolean;
  /** Which board the picker is writing into. */
  editSide: EditSide;
  setEditSide: (side: EditSide) => void;
  startPlayground: () => void;
  /** Put any card straight into your hand, or null for the eraser. */
  pickCard: (cardId: string | null) => void;
  /** Empty one of the two boards. */
  clearSide: (side: EditSide) => void;
  /** Back from a playground battle to the boards that fought it, to tweak. */
  backToPlayground: () => void;
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
  /** Online: "I am ready" — a toggle that does NOT stop you building. */
  ready: boolean;
  oppReady: boolean;
  toggleReady: () => void;
  finishBattle: () => void;
  /**
   * WHO is on the other side — name, face, trophies, catchphrase.
   *
   * Deliberately not called `opponent`: that name is taken, by the opponent's
   * BOARD. Two things about the same person, one of them a grid of monsters
   * and one of them a face, and the compiler caught them sharing a name.
   *
   * From the server in an online match, and made up locally for the bot,
   * which has no account to read. Null while a match is being found, and null
   * for the playground, where the other side is also you.
   */
  rival: PlayerCard | null;
  /** The same card for the player themselves, built from their account. */
  me: PlayerCard;
  /**
   * What the last match paid: nachos, any chest the bar filled, and which
   * challenges moved. Null until the server has answered, and null for every
   * match that is not worth anything (see finishBattle).
   */
  award: Award | null;
  /** Back to the main menu, abandoning whatever is in progress. */
  reset: () => void;
  /** Straight into another match of the same kind, skipping the menu. */
  playAgain: () => void;
}

export function useMatch(): MatchApi {
  const [phase, setPhase] = useState<Phase>("intro");
  const [timeLeft, setTimeLeft] = useState<number>(COUNTDOWN_SECONDS);
  const [gs, setGs] = useState<GameState>(() => initialGameState(null));
  /** Loaded once, in the background; the game never waits for it. */
  const [account, setAccount] = useState<Account | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  /** What the server said the last match was worth. See finishBattle. */
  const [award, setAward] = useState<Award | null>(null);
  /** Who is on the other side. See the `opponent` message in net.ts. */
  const [rival, setRival] = useState<PlayerCard | null>(null);
  const [actionBar, setActionBar] = useState<string[]>([]);
  const [usedActions, setUsedActions] = useState<Record<string, boolean>>({});
  /** The one take-back has been spent this match. See takeDiscard. */
  const [binUsed, setBinUsed] = useState(false);
  const binUsedRef = useRef(false);
  /** Flat health an enemy eraser took off YOUR King. See receiveHex. */
  const [kingWound, setKingWound] = useState(0);
  const [boardPowerAdd, setBoardPowerAdd] = useState(0);
  const [boostedCells, setBoostedCells] = useState<Record<string, true>>({});
  const [xrayActive, setXrayActive] = useState(false);
  const [targeting, setTargeting] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [netError, setNetError] = useState(false);
  /** Set when the server refuses to start a match for this account. */
  const [suspendedUntil, setSuspendedUntil] = useState<string | null>(null);
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
  /**
   * Seconds left on "frozen hands". While this is above zero you may draw,
   * discard and play action cards, but not put a card on the board.
   */
  const [frozenFor, setFrozenFor] = useState(0);
  /** Online: we have told the server we are ready. Still free to keep building. */
  const [ready, setReady] = useState(false);
  const [oppReady, setOppReady] = useState(false);
  /** Amanda mode: you and the other player share a side against her. */
  /*
   * Which bot you are playing. Remembered, because a child who has found the
   * easy one should not have to find it again every time.
   */
  const [botLevel, setBotLevelState] = useState<BotLevel>(() => {
    try {
      const saved = localStorage.getItem("amanda.bot");
      return saved === "easy" || saved === "hard" ? saved : "normal";
    } catch {
      return "normal";
    }
  });
  const botLevelRef = useRef(botLevel);
  botLevelRef.current = botLevel;
  const setBotLevel = useCallback((level: BotLevel) => {
    setBotLevelState(level);
    try {
      localStorage.setItem("amanda.bot", level);
    } catch {
      /* not remembering it is not worth failing over */
    }
  }, []);

  const [coop, setCoop] = useState(false);
  const [mate, setMate] = useState<BoardView | null>(null);
  const [heard, setHeard] = useState<{ id: string; at: number } | null>(null);
  const [rematchAsked, setRematchAsked] = useState(false);
  const [rematchOffered, setRematchOffered] = useState(false);
  const [invitation, setInvitation] = useState<{
    id: string;
    nickname: string | null;
    code: string;
  } | null>(null);
  const [spoke, setSpoke] = useState<{ id: string; at: number } | null>(null);
  /*
   * Being able to switch the other player off entirely.
   *
   * The lines are a closed, friendly list, so this should rarely be needed —
   * but "I do not want to see it" must not require reporting somebody, and a
   * child who is upset needs the thing to stop NOW, not after an adult has
   * looked at a form.
   */
  const [hearing, setHearing] = useState(() => {
    try {
      return localStorage.getItem("amanda.hearing") !== "off";
    } catch {
      return true;
    }
  });
  const [myLane, setMyLane] = useState(0);
  /** True for the developer's solo Amanda preview (see startAmandaSolo). */
  const soloAmandaRef = useRef(false);
  /** The two boards of the match just fought, for reporting it. See startBattle. */
  const soloBoardsRef = useRef<{ mine: Placement[]; theirs: Placement[] } | null>(null);
  /**
   * The playground: no clock, both boards yours, every card in the game on tap.
   * It is a workbench, not a match — nothing here is saved, rated or rewarded.
   */
  /**
   * Mirror mode ("חפיסה זהה"): both sides are dealt the same deck, in the same
   * order, from this seed. Null in every other mode.
   */
  const [mirrorSeed, setMirrorSeed] = useState<number | null>(null);
  /** 1 or 2 while a tutorial match is running, 0 otherwise. */
  const [lesson, setLesson] = useState(0);
  const [playground, setPlayground] = useState(false);
  const [editSide, setEditSide] = useState<EditSide>("me");
  /** The board on the other half, built by hand instead of by the AI. */
  const [foe, setFoe] = useState<BoardView>({ placements: {}, king: null });
  /** Cards drawn ahead by "triple draw", offered before the deck is touched. */
  const [extraHand, setExtraHand] = useState<string[]>([]);
  /** First cell picked by a two-step action, waiting for its partner. */
  const [firstPick, setFirstPick] = useState<string | null>(null);
  /** True once the server has paired us with an opponent. */
  const matchStartedRef = useRef(false);
  const [mySide, setMySide] = useState<Side>("A");
  const [oppLeft, setOppLeft] = useState(false);
  const [netOpp, setNetOpp] = useState<BoardView>({ placements: {}, king: null });

  const accountRef = useRef(account);
  accountRef.current = account;

  /*
   * The account is fetched in the background and the game does not wait for
   * it. If it arrives before a match starts, the next deal uses the album; if
   * it never arrives, every deal stays as it is today. Nothing blocks on a
   * network call between a child and a game.
   */
  useEffect(() => {
    let alive = true;
    /*
     * And look again whenever the signed-in person changes.
     *
     * Coming back from Google, the session is created asynchronously — if it
     * lands after the one read below, the game would otherwise sit there
     * holding the old anonymous account while the library knows better. See
     * onAccountChange.
     */
    const stop = onAccountChange(() => {
      void loadAccount().then((a) => {
        if (alive && a) setAccount(a);
      });
    });
    void loadAccount().then((a) => {
      if (!alive || !a) return;
      setAccount(a);
      setGs((cur) =>
        /*
         * Only re-deal an untouched deck, and never one that was dealt on
         * purpose.
         *
         * A mirror deck comes from the shared seed and a lesson deck is
         * written down in lessons.ts — and "untouched" is true of both of
         * them during the countdown, so without this the account arriving a
         * second later quietly replaced them with a deck drawn from the
         * player's album. The tutorial's first card stopped being the King
         * that Amanda's first line talks about.
         */
        mirrorRef.current === null &&
        lessonRef.current === 0 &&
        cur.hand === null &&
        cur.king === null &&
        Object.keys(cur.placements).length === 0
          ? initialGameState(a.album)
          : cur,
      );
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

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
  const frozenRef = useRef(frozenFor);
  frozenRef.current = frozenFor;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const shieldedRef = useRef(shielded);
  shieldedRef.current = shielded;
  const stackedRef = useRef(stacked);
  stackedRef.current = stacked;
  const mySideRef = useRef(mySide);
  mySideRef.current = mySide;
  const playgroundRef = useRef(playground);
  playgroundRef.current = playground;
  const mirrorRef = useRef(mirrorSeed);
  mirrorRef.current = mirrorSeed;
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  const editSideRef = useRef(editSide);
  editSideRef.current = editSide;
  const foeRef = useRef(foe);
  foeRef.current = foe;
  /**
   * The two boards as they were before the battle filled their holes.
   * Coming back from a playground battle has to return the boards you BUILT,
   * not the boards that fought — otherwise every run leaves another layer of
   * Crumb Demons behind and the next test measures something else.
   */
  const benchRef = useRef<{ mine: GameState; foe: BoardView } | null>(null);
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
  modsRef.current = { boardPowerAdd, boostedCells, kingWound };
  const aiPlanRef = useRef<Placement[] | null>(null);
  if (!aiPlanRef.current) aiPlanRef.current = generateAiPlan(undefined, botLevelRef.current);

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
      if (frozenRef.current > 0) return; // frozen hands: hold it, do not place it
      const key = cellKey(x, y);
      const s = gsRef.current;

      /*
       * In the playground a cell is a slot you edit, not a card you spend.
       * The picked card STAYS in hand so a board can be filled by tapping,
       * and tapping a filled cell with nothing picked clears it — which is
       * the only sensible "undo" when there is no deck to put it back into.
       */
      if (playgroundRef.current) {
        const enemy = editSideRef.current === "enemy";
        const held = s.hand !== null && isMonsterId(s.hand) ? s.hand : null;
        const occupied = enemy ? foeRef.current.placements[key] : s.placements[key];
        if (!held && !occupied) return;
        const write = (places: Record<string, string>) => {
          const next = { ...places };
          if (held) next[key] = held;
          else delete next[key];
          return next;
        };
        if (enemy) setFoe((f) => ({ ...f, placements: write(f.placements) }));
        else setGs((cur) => ({ ...cur, placements: write(cur.placements) }));
        sfx.play(held ? "place" : "discard");
        return;
      }

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
    if (frozenRef.current > 0) return;

    // Playground: the crown is editable too, and re-crowning replaces rather
    // than refusing — there is no "you already chose" when you are testing.
    if (playgroundRef.current) {
      const held = gsRef.current.hand;
      const monster = held !== null && isMonsterId(held) ? held : null;
      const enemy = editSideRef.current === "enemy";
      const current = enemy ? foeRef.current.king : gsRef.current.king;
      if (!monster && !current) return;
      if (enemy) setFoe((f) => ({ ...f, king: monster }));
      else setGs((s) => ({ ...s, king: monster }));
      sfx.play(monster ? "place" : "discard");
      return;
    }

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

  /**
   * Take the top card out of the bin — ONCE a match.
   *
   * ═══ THE BIN IS A CHANGE OF HEART, NOT A SECOND DECK ═══
   *
   * It began as a swap, which made throwing free: whatever you had just
   * thrown was always one tap from returning. Burying the card you traded
   * fixed that one hole and left the bigger one open — you could still keep
   * taking, down through everything you had thrown all match, which turned
   * a 20-card deck into a 20-card deck you could search.
   *
   * Or, after playing it: *"I need to be able to pull only ONE card back and
   * no more. If I already pulled a card I should not be pulling the ones
   * after it out of the recycling."*
   *
   * So it is one, for the whole match. That is what makes throwing a
   * decision: you get a single undo, you choose when to spend it, and after
   * that the bin is a bin.
   *
   * The spent flag lives beside the board state rather than inside it
   * because it describes the PLAYER's match, not the pile — clearRound
   * resets it with everything else that is about one round.
   */
  const takeDiscard = useCallback(() => {
    if (!canTakeFromBin(binUsedRef.current, gsRef.current.discard.length)) return;
    setGs(takeFromBin);
    binUsedRef.current = true;
    setBinUsed(true);
    sfx.play("draw");
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
   * How much building time is left in the match, across both build phases —
   * what "the last seconds" actually means to a player.
   */
  const buildSecondsLeft = useCallback((): number => {
    if (phaseRef.current === "build") return timeLeftRef.current + PHASES.panic.seconds;
    if (phaseRef.current === "panic") return timeLeftRef.current;
    return 0;
  }, []);

  /**
   * Whether an action card can be played at this moment. Only "frozen hands"
   * has anything to say here: freezing someone at the buzzer would take the
   * end of their build away entirely with nothing they could do about it, so
   * the card goes dead while less than its own window plus the freeze remains.
   */
  const canPlayAction = useCallback(
    (id: string): boolean => {
      const a = ACTIONS.get(id);
      if (a?.effect !== "freezeOpponentPlacing") return true;
      return buildSecondsLeft() >= Number(a.params?.minBuildSecondsLeft ?? 10);
    },
    [buildSecondsLeft],
  );

  /**
   * "Frozen hands", aimed at whoever you are playing.
   *
   * Online it is sent across and applied by the other client. Against the
   * computer there is no clock to steal — it builds its whole board up front —
   * so it loses the cards those seconds were worth instead, weakest first.
   */
  const freezeOpponent = useCallback((id: string) => {
    const params = ACTIONS.get(id)?.params ?? {};
    if (onlineRef.current) {
      netRef.current?.hex(id);
      return;
    }
    const plan = aiPlanRef.current;
    if (!plan) return;
    const lose = Math.max(0, Number(params.aiCardsLost ?? 2));
    const weakest = plan
      .map((p, i) => ({ i, p }))
      .filter(({ p }) => !p.king)
      .sort((x, y) => power(x.p.cardId) - power(y.p.cardId))
      .slice(0, lose)
      .map(({ i }) => i);
    aiPlanRef.current = plan.filter((_, i) => !weakest.includes(i));
  }, []);

  /** An action card the opponent played at us. */
  /*
   * The socket handler is created once, so it cannot read `hearing` from
   * state — it would close over whatever the value was when the match started.
   */
  const hearingRef = useRef(hearing);
  hearingRef.current = hearing;

  const toggleHearing = useCallback(() => {
    setHearing((on) => {
      const next = !on;
      try {
        localStorage.setItem("amanda.hearing", next ? "on" : "off");
      } catch {
        /* not being able to remember it is not worth failing over */
      }
      if (!next) setHeard(null);
      return next;
    });
  }, []);

  /**
   * Say one of the ready-made lines.
   *
   * Shown over your own board straight away rather than waiting for the
   * server to confirm: you pressed it, you should see it. The server is still
   * the one that decides whether the other player gets it (rate limits live
   * there — see match.ts), so the worst case is that you see your own line and
   * they do not, which is the right way round for a limit nobody should be
   * hitting in the first place.
   */
  const say = useCallback((id: string) => {
    if (!tauntById(id)) return;
    setSpoke({ id, at: Date.now() });
    sfx.play("click");
    netRef.current?.say(id);
  }, []);

  /**
   * "Again?" — only means anything once the match is over, which is also the
   * only time the server will accept it.
   */
  const askRematch = useCallback(() => {
    if (!netRef.current) return;
    setRematchAsked(true);
    sfx.play("click");
    netRef.current.rematch();
  }, []);

  const receiveHex = useCallback((id: string, cell?: string) => {
    // This is what the steel wall was always for.
    if (shieldedRef.current) {
      setShielded(false);
      return;
    }
    const a = ACTIONS.get(id);
    if (a?.effect === "freezeOpponentPlacing") {
      setFrozenFor(Number(a.params?.seconds ?? 5));
      sfx.play("discard");
      return;
    }
    /*
     * The radioactive eraser, landing on YOUR board.
     *
     * Only this client can carry it out: the sender was looking at a fogged
     * copy, and deleting a card there would have erased a picture while the
     * real board — the one that goes into the battle — kept the card. That
     * is what "the eraser does not work" looked like from the other side.
     *
     * The King cannot be erased outright, because a board with no King is not
     * a board. It takes the wound instead, carried into the fight as a cut to
     * its health, which is what the card already promised in words.
     */
    if (a?.effect === "eraseEnemyCard" && cell) {
      if (cell === KING_KEY) {
        setKingWound(Number(a.params?.kingFlatDamage ?? 2000));
      } else {
        setGs((s) => {
          if (!s.placements[cell]) return s;
          const placements = { ...s.placements };
          delete placements[cell];
          return { ...s, placements };
        });
      }
      sfx.play("discard");
    }
  }, []);

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
      if (!canPlayAction(id)) return;
      if (isTargetedAction(id)) {
        setTargeting(id);
        sfx.play("click");
        return;
      }
      const a = ACTIONS.get(id);
      const params = a?.params ?? {};
      if (a?.effect === "boardPowerBuff") setBoardPowerAdd((b) => b + Number(params.power ?? 50));
      else if (a?.effect === "freezeEnemy") {
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
      } else if (a?.effect === "freezeOpponentPlacing") {
        freezeOpponent(id);
      }
      else if (a?.effect === "revealBoard") {
        setXrayActive(true);
        window.setTimeout(() => setXrayActive(false), XRAY_MS);
      } else if (a?.effect === "shuffleEnemyFrontRow") shuffleEnemyFront();
      setUsedActions((u) => ({ ...u, [id]: true }));
      sfx.play("draw");
    },
    [shuffleEnemyFront, freezeOpponent, canPlayAction],
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
      // Against a person the board being erased is THEIRS, so only their
      // client can really do it — all this side can do is say where.
      netRef.current?.hex(id, key);
    }
    setUsedActions((u) => ({ ...u, [id]: true }));
    setTargeting(null);
    setFirstPick(null);
    sfx.play("place");
  }, []);

  /*
   * ═══ WHOSE BOARD THE GUARD CHECKS ═══
   *
   * Both halves of the screen call these two, and they looked at
   * `gsRef.current` — YOUR board — whichever half had been clicked. For the
   * radioactive eraser, which is aimed at the opponent, that meant the click
   * landed on a cell you had nothing in and the function returned before it
   * did anything. Or: *"the radioactive eraser action card does not work."*
   * It never had.
   *
   * An enemy-targeted card needs no guard here at all: BoardGrid only calls
   * `onTarget` for a cell it is DRAWING something in, so the board it
   * rendered has already vouched for the target — and it is the only one of
   * the two that knows which board that was.
   */
  const applyTargetCell = useCallback(
    (x: number, y: number) => {
      const id = targetingRef.current;
      if (!id) return;
      if (!isEnemyTargeted(id) && !gsRef.current.placements[cellKey(x, y)]) return;
      applyTargetTo(id, cellKey(x, y));
    },
    [applyTargetTo],
  );
  const applyTargetKing = useCallback(() => {
    const id = targetingRef.current;
    if (!id) return;
    if (!isEnemyTargeted(id) && !gsRef.current.king) return;
    applyTargetTo(id, KING_KEY);
  }, [applyTargetTo]);
  const cancelTargeting = useCallback(() => setTargeting(null), []);

  const readyRef = useRef(ready);
  readyRef.current = ready;

  /**
   * Declaring yourself ready used to end your build: it locked the board and
   * dropped you on a waiting screen you could look at and not touch, for as
   * long as the opponent took. Now it is a flag. You keep your hand, you keep
   * placing, and the board you have when the other player is ready too is the
   * board that fights. Pressing it again takes it back.
   */
  const toggleReady = useCallback(() => {
    if (!onlineRef.current) return;
    setReady((was) => {
      const now = !was;
      if (now)
        netRef.current?.lock(
          buildPlayerBoard(fillGs(gsRef.current, barRef.current), modsRef.current, stackedRef.current, accountRef.current?.album),
        );
      else netRef.current?.unready();
      sfx.play("click");
      return now;
    });
  }, []);

  const enterPrebattle = useCallback(() => {
    setTargeting(null);
    const filled = fillGs(gsRef.current, barRef.current);
    setGs(filled);
    sfx.play("crumbs");
    setPhase("prebattle");
    setTimeLeft(PREBATTLE_SECONDS);
    // In an online match, submit the locked board to the server now.
    if (onlineRef.current)
      netRef.current?.lock(buildPlayerBoard(filled, modsRef.current, stackedRef.current, accountRef.current?.album));
  }, []);

  const startBattle = useCallback(() => {
    const aiFull: BoardInput = soloAmandaRef.current
      ? { owner: "B", placements: buildAmandaBoard(CATALOG.values()) as Placement[] }
      : { owner: "B", placements: fillCrumbs(aiPlanRef.current!) };

    let mine = buildPlayerBoard(
      gsRef.current,
      modsRef.current,
      stackedRef.current,
      accountRef.current?.album,
    );
    /*
     * In the solo preview, somebody stands in the other half.
     *
     * Or, after playing it: "the Amanda fight was a bit rubbish. There was no
     * other player with me. We weren't lined up with each other." Both true —
     * the mode is four lanes each of an eight-lane side, and with one player
     * the bottom four were simply empty, which looks like a broken screen
     * rather than like a missing partner.
     *
     * The preview now fills the partner's half with a board the computer
     * builds, so it SHOWS the mode. It is still unwinnable and still not the
     * real thing; it is a picture of the real thing, which is what a preview
     * is for.
     */
    if (soloAmandaRef.current) {
      const partner = fillCrumbs(generateAiPlan()).map((p) => ({
        ...p,
        y: (p.y ?? 0) + BOARD_SIZE,
      }));
      mine = { ...mine, placements: [...mine.placements, ...partner] };
    }

    /*
     * The two boards, kept for the server.
     *
     * A match against the bot is fought entirely in here and the server never
     * hears about it — which was fine while it was worth nothing. Now it pays
     * nachos and moves challenges along, so it has to be reported, and the
     * server re-runs it rather than believing the outcome (apps/server/src/
     * solo.ts). These are what it re-runs, so they are kept as they were
     * handed to the engine, after the filling and before anything else.
     */
    soloBoardsRef.current = { mine: mine.placements, theirs: aiFull.placements };

    const r = runBattle({
      seed: BATTLE_SEED,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: mine,
      b: aiFull,
      recordFrames: true,
      ...(soloAmandaRef.current ? { lanes: COOP_LANES } : {}),
    });
    setResult(r);
    sfx.play("go");
    setPhase("battle");
  }, []);

  /** Tear the match down to a clean slate, without deciding where to go next. */
  /**
   * Everything about the ROUND just played — and nothing about the connection.
   *
   * Split out of clearMatch for the rematch, which starts a second round down
   * the same socket: closing it and opening a new one would put both players
   * back in the queue to be paired with strangers. Anything that describes the
   * board, the hand, the result or what was said belongs here; anything that
   * describes who you are connected to belongs in clearMatch below.
   */
  const clearRound = useCallback(() => {
    aiPlanRef.current = generateAiPlan(undefined, botLevelRef.current);
    setGs(initialGameState(accountRef.current?.album));
    setResult(null);
    setAward(null);
    setRival(null);
    soloBoardsRef.current = null;
    setActionBar([]);
    setUsedActions({});
    binUsedRef.current = false;
    setBinUsed(false);
    setKingWound(0);
    setBoardPowerAdd(0);
    setBoostedCells({});
    setXrayActive(false);
    setTargeting(null);
    setStacked({});
    setStackSlots(0);
    setStackCorners(false);
    setFrozenFor(0);
    setMate(null);
    setHeard(null);
    setSpoke(null);
    setEditSide("me");
    setFoe({ placements: {}, king: null });
    benchRef.current = null;
    setReady(false);
    setOppReady(false);
    setShielded(false);
    setExtraHand([]);
    setFirstPick(null);
    setNetOpp({ placements: {}, king: null });
    setRematchAsked(false);
    setRematchOffered(false);
    setTimeLeft(COUNTDOWN_SECONDS);
  }, []);

  const clearMatch = useCallback(() => {
    netRef.current?.close();
    netRef.current = null;
    clearRound();
    setOnline(false);
    setOppLeft(false);
    setNetError(false);
    setRoomCode(null);
    setRoomError(null);
    setCoop(false);
    setMyLane(0);
    soloAmandaRef.current = false;
    setPlayground(false);
    setMirrorSeed(null);
    setLesson(0);
    setMySide("A");
  }, [clearRound]);

  /**
   * Put the computer on the other side of the versus screen.
   *
   * The bot has no account to read, so its card is made up here — see
   * BOT_CARDS. Called wherever a match against it begins, which is three
   * places, because "again" after a solo match starts one without going
   * through startMatch.
   */
  const faceTheBot = useCallback(() => {
    setRival(BOT_CARDS[botLevelRef.current]);
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
    // AFTER the clear, not before: clearRound empties the versus card along
    // with everything else, so setting it first set it and then threw it away.
    // The screen showed "היריב" with no face for every solo match.
    faceTheBot();
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
      onStart: (side, isCoop, lane) => {
        matchStartedRef.current = true;
        setMySide(side);
        setCoop(isCoop);
        // Which half of the shared side is yours. It was being dropped on the
        // floor here, which is why both players were drawn as the top half.
        setMyLane(lane);
      },
      onPhase: (p, timeLeft) => {
        if (p === "countdown" && phaseRef.current === "result") {
          /*
           * A rematch. The server has started a second round down this same
           * socket, and the screen is still showing the last one — board,
           * result and all. Clear the ROUND (not the connection: closing the
           * socket here would send both players back to the queue).
           */
          clearRound();
        }
        if (p === "locking") {
          enterPrebattle();
        } else {
          setPhase(p as Phase);
          setTimeLeft(timeLeft);
          if (p === "build") setGs((s) => drawIfEmpty(s));
        }
      },
      onOpp: (view) => setNetOpp(view),
      onMate: (view) => setMate(view),
      onHexed: (id, cell) => receiveHex(id, cell),
      onOppReady: (r) => setOppReady(r),
      onInvited: (from) => {
        setInvitation(from);
        sfx.play("beep");
      },
      onRematchWanted: () => {
        setRematchOffered(true);
        sfx.play("beep");
      },
      onOpponent: (who) => setRival(who),
      onSaid: (id) => {
        // Dropped on the floor when the player has switched them off — and
        // dropped HERE rather than at the bubble, so nothing is stored.
        if (!hearingRef.current) return;
        // Either a sentence from the closed list or one of the drawn emoji.
        // Anything else is somebody poking at the socket.
        if (!tauntById(id) && !emojiFromSayId(id)) return;
        setHeard({ id, at: Date.now() });
        sfx.play("beep");
      },
      onResult: (r) => {
        const res = runBattle({
          seed: r.seed,
          catalog: CATALOG,
          synergies: SYNERGIES,
          a: r.boardA as BoardInput,
          b: r.boardB as BoardInput,
          recordFrames: true,
          // Amanda mode is eight lanes. Replaying it in four would not merely
          // look wrong, it would disagree with the server about who won.
          ...(r.lanes ? { lanes: r.lanes } : {}),
        });
        setResult(res);
        sfx.play("go");
        setPhase("battle");
      },
      onSuspended: (until) => {
        /*
         * Told, not merely refused. A game that silently will not start is a
         * broken game; a game that says "you are suspended until Tuesday" is
         * a consequence, which is the entire point of having one.
         */
        setSuspendedUntil(until);
        netRef.current?.close();
        netRef.current = null;
        setPhase("intro");
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
      accountRef.current?.playerId ?? null,
    );
  }, [enterPrebattle, clearRound]);

  const hostRoom = useCallback(() => startOnline({ kind: "host" }), [startOnline]);
  /** Queue to face Amanda with a partner. It needs two — one board cannot win. */
  const startAmanda = useCallback(() => startOnline({ kind: "amanda" }), [startOnline]);

  /**
   * Amanda mode on your own, for development.
   *
   * No server and no partner: your 4×4 sits in the top half of the eight-lane
   * side, the bottom half is empty, and she holds the other side. It is NOT
   * winnable — one board against her measures 0% — and that is the point: it
   * exists so the mode can be looked at without waiting for a second person.
   */
  const startAmandaSolo = useCallback(() => {
    clearMatch();
    setCoop(true);
    sfx.play("click");
    /*
     * HER board, not a generated one.
     *
     * Or, after playing it: "when the fog lifted, Amanda's King was the Insect
     * Empress or something — and then in the battle itself it changed to
     * Amanda." Exactly right, and a real bug: the battle used buildAmandaBoard
     * while the board you LOOKED AT during the build was still the ordinary AI
     * plan from clearMatch. Two different opponents, one match.
     */
    aiPlanRef.current = buildAmandaBoard(CATALOG.values()) as Placement[];
    setPhase("countdown");
    setTimeLeft(COUNTDOWN_SECONDS);
    soloAmandaRef.current = true;
  }, [clearMatch]);
  const joinRoom = useCallback(
    (code: string) => startOnline({ kind: "join", code: code.toUpperCase().trim() }),
    [startOnline],
  );

  /**
   * Call a friend in.
   *
   * This opens a private room the ordinary way — the server does it when the
   * invitation is sent, after checking they really are your friend — so the
   * person invited joins by code like anybody else. One way into a match, not
   * two.
   */
  const inviteFriend = useCallback(
    (playerId: string) => startOnline({ kind: "invite", to: playerId }),
    [startOnline],
  );

  const acceptInvitation = useCallback(() => {
    setInvitation((inv) => {
      if (inv) joinRoom(inv.code);
      return null;
    });
  }, [joinRoom]);

  const declineInvitation = useCallback(() => setInvitation(null), []);

  /**
   * A tutorial match, with both sides written down in advance.
   *
   * Or: "there is no need for a bot. It's a fixed tutorial. Decide in advance
   * what the opponent does. And make sure he loses." So the opponent is a
   * list, not a plan, and the deck is dealt in a known order — which is what
   * lets Amanda talk about the card you are holding instead of hoping.
   *
   * That he loses is not forced here. The boards in lessons.ts are built so
   * the player wins by playing them, and lessons.test.ts plays each one three
   * hundred times with the cards dropped in random places to keep it true.
   */
  const startLesson = useCallback(
    (n: number) => {
      const spec = LESSONS[n - 1];
      if (!spec) return;
      sfx.unlock();
      sfx.play("click");
      clearMatch();
      setLesson(n);
      setGs({ deck: [...spec.deck], hand: null, discard: [], placements: {}, king: null });
      // A copy: the engine writes positions onto placements during a battle,
      // and a lesson has to be the same lesson the second time it is played.
      aiPlanRef.current = spec.opponent.map((p) => ({ ...p }));
      setPhase("countdown");
    },
    [clearMatch],
  );

  /**
   * Mirror mode: the same deck for both sides.
   *
   * Or's line for it: "אותם קלפים בדיוק לשני הצדדים. אין תירוצים." So the
   * album is deliberately not used — a deck built from what you own cannot be
   * the same deck as anyone else's, and then the excuse is back.
   *
   * The computer is handed the very cards you were dealt, so the only thing
   * left to be better at is where you put them.
   */
  const startMirror = useCallback(() => {
    sfx.unlock();
    sfx.play("click");
    clearMatch();
    faceTheBot();
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    setMirrorSeed(seed);
    const deck = matchDeck(null, seed);
    setGs({ deck, hand: null, discard: [], placements: {}, king: null });
    aiPlanRef.current = generateAiPlan(deck, botLevelRef.current);
    setPhase("countdown");
  }, [clearMatch]);

  /**
   * The playground.
   *
   * Or's ask, plainly: a game with no clock where you build BOTH sides out of
   * the whole catalogue and watch what it does. So there is no countdown, no
   * panic, no fog and no opponent — the second board is simply the one you are
   * not editing right now. Straight into "build", because waiting three
   * seconds to start a sandbox is three seconds of nothing.
   */
  const startPlayground = useCallback(() => {
    sfx.unlock();
    sfx.play("click");
    clearMatch();
    setPlayground(true);
    setEditSide("me");
    setFoe({ placements: {}, king: null });
    benchRef.current = null;
    setPhase("build");
  }, [clearMatch]);

  /** Any card, straight into the hand. It stays there until it is swapped. */
  const pickCard = useCallback((cardId: string | null) => {
    if (!playgroundRef.current) return;
    // null is the eraser: an empty hand is what makes a tap remove a card.
    if (cardId !== null && !isMonsterId(cardId) && !isActionId(cardId)) return;
    setGs((s) => ({ ...s, hand: cardId }));
    sfx.play(cardId === null ? "click" : "draw");
  }, []);

  const clearSide = useCallback((side: EditSide) => {
    if (side === "enemy") setFoe({ placements: {}, king: null });
    else setGs((s) => ({ ...s, placements: {}, king: null }));
    sfx.play("discard");
  }, []);

  /**
   * Fight the two boards as built.
   *
   * Both halves go through the same filling the real game does — empty slots
   * become Crumb Demons, a board with no crown promotes its best card — so
   * what you see here is what those cards would really do to each other.
   */
  const startBenchBattle = useCallback(() => {
    const mine = fillGs(gsRef.current, barRef.current);
    benchRef.current = { mine: gsRef.current, foe: foeRef.current };
    setGs(mine);
    setTargeting(null);
    const r = runBattle({
      seed: BATTLE_SEED,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: buildPlayerBoard(mine, modsRef.current, stackedRef.current),
      b: buildBenchBoard(foeRef.current, "B"),
      recordFrames: true,
    });
    setResult(r);
    sfx.play("go");
    setPhase("battle");
  }, []);

  /** Back to the bench, with the boards you built — not the ones that fought. */
  const backToPlayground = useCallback(() => {
    const kept = benchRef.current;
    if (kept) {
      setGs(kept.mine);
      setFoe(kept.foe);
    }
    setResult(null);
    sfx.play("click");
    setPhase("build");
  }, []);

  const finishBattle = useCallback(() => {
    const w = result?.winner;
    sfx.play(w === mySideRef.current ? "win" : "lose");
    setPhase("result");
    /*
     * Tell the server what was played, and show what it paid.
     *
     * Only a REAL match against the bot. The playground has two boards that
     * are both yours, a tutorial lesson is a scripted board, and the Amanda
     * preview is deliberately unwinnable — none of the three is a performance,
     * and paying out on them would make the fastest way to a chest the one
     * that is not the game. An online match is already recorded by the server
     * that simulated it.
     */
    const boards = soloBoardsRef.current;
    if (
      !boards ||
      onlineRef.current ||
      playgroundRef.current ||
      lessonRef.current ||
      soloAmandaRef.current
    )
      return;
    void reportSolo({ seed: BATTLE_SEED, ...boards, level: botLevelRef.current }).then((won) => {
      if (won.nachos || won.chests.length || won.moved.length) setAward(won);
    });
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
    const wasMirror = mirrorRef.current !== null;
    const wasLesson = lessonRef.current;
    if (wasLesson) {
      // "Again" inside the tutorial means that lesson again, not a free match.
      startLesson(wasLesson);
      return;
    }
    if (wasMirror) {
      // A fresh mirror deck, not a repeat of the same one — otherwise "again"
      // is the same puzzle twice.
      startMirror();
      return;
    }
    clearMatch();
    if (wasOnline && ONLINE_AVAILABLE) {
      startOnline();
      return;
    }
    // Another one against the computer, without going through startMatch —
    // so the versus card has to be set here too.
    faceTheBot();
    sfx.play("click");
    setPhase("countdown");
  }, [clearMatch, startOnline, startMirror, startLesson, faceTheBot]);

  useEffect(() => {
    // "בלי הגבלת זמן" means the clock does not run at all, not that it runs
    // and is hidden — a timer ticking to zero would end the sandbox.
    if (playground) return;
    if (!["countdown", "build", "panic", "prebattle"].includes(phase)) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100);
    return () => clearInterval(id);
  }, [phase, playground]);

  /** Tick the freeze down on its own clock, so it lasts five real seconds. */
  useEffect(() => {
    if (frozenFor <= 0) return;
    const id = setInterval(() => setFrozenFor((f) => Math.max(0, +(f - 0.1).toFixed(1))), 100);
    return () => clearInterval(id);
  }, [frozenFor > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A freeze cannot outlive the building it interrupts. */
  useEffect(() => {
    if (!["build", "panic"].includes(phase)) setFrozenFor(0);
  }, [phase]);

  useEffect(() => {
    if (timeLeft > 0) return;
    // Online: the server drives phase changes; the local timer is display-only.
    if (online || playground) return;
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
  }, [timeLeft, phase, online, playground, enterPrebattle, startBattle]);

  /*
   * A ready player who carries on building must not fight with the board they
   * had when they pressed the button, so every change is sent again.
   */
  useEffect(() => {
    if (!online || !ready) return;
    netRef.current?.lock(
      buildPlayerBoard(fillGs(gs, barRef.current), modsRef.current, stackedRef.current, accountRef.current?.album),
    );
  }, [online, ready, gs, boardPowerAdd, boostedCells, stacked]);

  // Online: send our board to the server for the opponent's fog-of-war view.
  useEffect(() => {
    if (online) netRef.current?.sendBoard({ placements: gs.placements, king: gs.king });
  }, [online, gs.placements, gs.king]);

  // Tidy up the socket if the component unmounts.
  useEffect(() => () => netRef.current?.close(), []);

  const revealOpponentCell = useCallback(
    (x: number, _y: number): boolean => {
      // Online: the server already fogs the opponent view, so show all it sent.
      // Playground: you built that board, so hiding it from you is absurd.
      if (online || playgroundRef.current) return true;
      if (xrayActive) return true;
      if (phase === "build") return x === 3;
      if (phase === "panic" || phase === "prebattle") return x >= 1;
      return true;
    },
    [phase, xrayActive, online],
  );

  // Opponent board: online → server-sent fogged view; vs-AI → the AI plan built
  // over time; playground → the board you built yourself on the other half.
  let opponentView: BoardView;
  if (playground) {
    opponentView = foe;
  } else if (online) {
    opponentView = netOpp;
  } else {
    const plan = aiPlanRef.current;
    let visible = plan.length;
    // Amanda does not "build" — she is already standing there. Revealing her
    // board card by card over ninety seconds would be a lie about what she is.
    if (phase === "build" && !soloAmandaRef.current) {
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
    canTakeDiscard: !binUsed && gs.discard.length > 0,
    extraHand,
    frozenFor,
    canPlayAction,
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
    revealOpponentKing: playground || xrayActive || phase === "panic" || phase === "prebattle",
    actionBar: actionBar.map((id) => ({ id, used: !!usedActions[id], passive: isPassiveAction(id) })),
    barFull: actionBar.length >= ACTION_SLOTS,
    targeting,
    mods: { boardPowerAdd, boostedCells, kingWound },
    online,
    account,
    reloadAccount: () => void loadAccount().then((a) => a && setAccount(a)),
    onlineAvailable: ONLINE_AVAILABLE,
    netError,
    suspendedUntil,
    roomCode,
    roomError,
    mySide,
    oppLeft,
    iWon: result != null && result.winner === mySide,
    award,
    rival,
    me: {
      nickname: account?.nickname ?? null,
      avatar: account?.avatar ?? null,
      trophies: account?.trophies ?? 0,
      catchphrase: account?.catchphrase ?? null,
      gender: account?.gender ?? null,
    },
    mirrorSeed,
    startMirror,
    lesson,
    startLesson,
    playground,
    editSide,
    setEditSide,
    startPlayground,
    pickCard,
    clearSide,
    backToPlayground,
    takeAction,
    activateAction,
    applyTargetCell,
    applyTargetKing,
    cancelTargeting,
    startMatch,
    startOnline: () => startOnline(),
    startAmanda,
    startAmandaSolo,
    botLevel,
    setBotLevel,
    coop,
    mate,
    myLane,
    heard,
    spoke,
    say,
    rematchAsked,
    rematchOffered,
    askRematch,
    inviteFriend,
    invitation,
    acceptInvitation,
    declineInvitation,
    hearing,
    toggleHearing,
    hostRoom,
    joinRoom,
    discardHand,
    takeDiscard,
    placeAt,
    placeKing,
    // The playground skips the lock-and-count-down ceremony: you press fight,
    // it fights, and you can stop it again a second later.
    toBattle: playground ? startBenchBattle : enterPrebattle,
    ready,
    oppReady,
    toggleReady,
    finishBattle,
    reset,
    playAgain,
  };
}

/** Internals exposed for unit tests. */
export const __testing = {
  matchDeck, fillGs, cellKey, resolveKing, rotateFrontLanes, generateAiPlan };
