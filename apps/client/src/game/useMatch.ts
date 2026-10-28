import { useCallback, useEffect, useRef, useState } from "react";
import {
  DECK_RULES,
  KING,
  arenaFor,
  groundFor,
  LEVELS,
  PHASES,
  COOP_LANES,
  buildAmandaBoard,
  levelMultiplier,
  emojiFromSayId,
  shownAvatar,
  shownName,
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
import { track } from "./track";
import {
  albumToPool,
  loadAccount,
  loadDecks,
  onAccountChange,
  type Account,
  type OwnedCard,
} from "./account";
import { reportSolo, type Award } from "./meta";
import { STAGE_LESSONS } from "./lessons";
import { lessonSquares } from "./lessonScript";
import { Net, ONLINE_AVAILABLE, type Intent } from "./net";
import { line as t } from "./copy";

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
function monsterPool(album?: Map<string, OwnedCard> | null, best?: number): string[] {
  if (album && album.size) return albumToPool(album);
  // No album is a guest, or a phone with no signal. The ladder still applies:
  // a first evening with no account should look like a first evening.
  return cardPool(best);
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
function matchDeck(
  album?: Map<string, OwnedCard> | null,
  seed?: number,
  /*
   * The sixteen this player chose, if they have ever opened the builder.
   *
   * Or: *"you pick X cards from the ones you have and ONLY THEY will be in
   * the deck."* So this replaces the draw from the album rather than biasing
   * it — a built deck is a promise about what you will see, and a deck that
   * sometimes deals something else is not one.
   *
   * Ignored in mirror mode for the same reason the album is: both sides get
   * the same cards there, and the entire point is that nobody can blame
   * their collection — or now, their deck.
   */
  built?: readonly string[] | null,
  /** How far this player has climbed — see cardPool. */
  best?: number,
): string[] {
  const rng = seed === undefined ? null : createRng(seed);
  const rnd = rng ? () => rng.next() : Math.random;
  // An album smaller than a full deck is not padded. Running thin IS the game:
  // the gaps become Crumb Demons, and that is the reason to collect.
  const chosen = seed === undefined && built?.length ? built : null;
  const pool = seed === undefined ? monsterPool(album, best) : cardPool(best);
  /*
   * ═══ NOT ALL OF IT ARRIVES ═══
   *
   * Or: *"there needs to be some number of cards that are in your deck and
   * don't actually reach the match — so that if you put in only Mother Tree
   * and she's your one card with a lot of health, there's a chance she
   * doesn't arrive at all and you're stuck with some cactus as King."*
   *
   * A built deck used to be dealt WHOLE: sixteen chosen, sixteen shuffled,
   * every one of them turning up if the clock allowed. Which made one great
   * card worth more than a plan, because you could always count on seeing
   * it.
   *
   * Eighteen chosen and fifteen dealt. The shuffle decides which three stay
   * home, so a deck is a promise about what you MIGHT see and not about what
   * you will — and the answer to "what if my one tank never comes" is a
   * second tank.
   */
  const monsters = shuffle(chosen ? [...chosen] : pool, rnd).slice(0, DECK_RULES.dealt);
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
  /**
   * ═══ WHAT LEVEL ITS CARDS ARE AT ═══
   *
   * Or, after a fortnight of beating the hard bot: *"we're doing loads of
   * games against the hard bot. We're just in the playground, with 40 cards
   * some of which we upgraded to level 2, and we're taking it apart."*
   *
   * Every bot fielded level-1 cards, because nothing had ever given them a
   * level. A player who has been collecting for two weeks has not: ten per
   * cent a level is small on one card and it is on every card, in every
   * battle, and it was the whole difference between the measurement and
   * what Or was seeing on the sofa.
   *
   * It is also the honest kind of hard — the same way a human opponent gets
   * stronger. Nothing here changes what a card IS; it is the multiplier the
   * player's own cards already get (levelMultiplier in shared).
   */
  level: number;
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
    nickname: t("sadfc854", "בוט קליל"),
    avatar: "versus_robot",
    trophies: 40,
    catchphrase: null,
    gender: null,
    // A back each, and not the same one: the versus screen now shows both
    // decks, and three identical fogs would have said the three bots are
    // one bot. These are free backs, so none of them is showing off
    // something a player cannot have.
    back: "web",
  },
  normal: {
    nickname: t("s69fcaa6", "הבוט"),
    avatar: "versus_robot",
    trophies: 900,
    catchphrase: "phrase.fight",
    gender: null,
    back: "slime",
  },
  hard: {
    nickname: t("s38e97db", "בוט קשה"),
    avatar: "versus_robot",
    trophies: 2600,
    catchphrase: "phrase.onlyamanda",
    gender: null,
    back: "scales",
  },
};

/**
 * ═══ THE BOT GETS A HANDLE, NOT A JOB TITLE ═══
 *
 * Or: *"give the bot one of ten robotic options — CyberDeath365,
 * stupidMonster13, that sort of thing."* The first two are his.
 *
 * It was called "Light bot", "The bot" and "Hard bot", which is a label for
 * a difficulty setting rather than a name for somebody you are about to
 * fight — and the versus screen exists precisely to make the opponent a
 * somebody. A child playing the computer is not fooled, and that is not the
 * point: the point is that the screen reads the same whoever is on the other
 * side of it, so beating one of these feels like beating a player.
 *
 * NOT translated, in either direction. These are gamer tags, and a gamer tag
 * is the same string in every language — transliterating "CyberDeath365" into
 * Hebrew would make it a word rather than a handle. The trophy count beside
 * it still says which bot this is, so nothing is lost by dropping the label.
 */
const BOT_NAMES = [
  "CyberDeath365",
  "stupidMonster13",
  "xX_SlimeLord_Xx",
  "BeepBoop_2000",
  "GigaChomp99",
  "pixel_goblin",
  "RoboBurp42",
  "NotAHuman77",
  "TinCanTerror",
  "lol_i_am_a_bot",
] as const;

/** A handle for this match. A new match is a new opponent. */
function botName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]!;
}

const SKILL: Record<BotLevel, Skill> = {
  /*
   * Beatable by a child, without being a pushover that teaches nothing.
   * It fields real cards in roughly sensible places — it just fields the
   * wrong ones, leaves holes, and sometimes puts a shooter where a wall
   * should be. Which is what a beginner's board looks like, and makes it a
   * fair thing to learn against.
   */
  easy: { window: 8, fromWorst: true, sloppiness: 0.55, gaps: 4, draw: DECK_RULES.dealt, level: 1 },
  normal: { window: 3, fromWorst: false, sloppiness: 0.1, gaps: 0, draw: 24, level: 2 },
  /** Every choice the planner knows how to make, made correctly. */
  hard: { window: 1, fromWorst: false, sloppiness: 0, gaps: 0, draw: 0, level: 6 },
};

/**
 * A board for the computer to play.
 *
 * `best` is how far this player has climbed, and it is not optional in
 * spirit. Or: *"the bots' decks have to match mine. If I am playing at the
 * train station now, I should not be seeing Machines or Sea Dwellers on the
 * other side."* Every board built from the pool rather than from a given
 * deck goes through it — see cardPool.
 *
 * A `deck` skips it, because then the cards were already decided by
 * something that knew what it was doing: the draft handed over the cards you
 * passed on, and the mirror deals one deck to both sides.
 */
function generateAiPlan(deck?: string[], level: BotLevel = "normal", best?: number): Placement[] {
  const skill = SKILL[level] ?? SKILL.normal;
  const ids = deck
    ? deck.filter((id) => CATALOG.has(id))
    : shuffle(cardPool(best)).slice(0, skill.draw || undefined);
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

  /*
   * The level, as the multiplier the engine already understands. A mirror
   * match is excluded on purpose: "חפיסה זהה" promises the same cards on
   * both sides, and the same cards at different levels are not the same
   * cards.
   */
  const mult = deck ? 1 : levelMultiplier(skill.level);
  const buff = mult > 1 ? { hpMult: mult, powerMult: mult } : undefined;
  const at = (p: Placement): Placement => (buff ? { ...p, buff } : p);

  const placements: Placement[] = [at({ cardId: kingCard.id, x: 1, y: 1, king: true })];
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
    placements.push(at({ cardId: take(ranked).id, x: cell.x, y: cell.y }));
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
 * Can the last thrown card still be fetched back?
 *
 * ═══ THE LAST ONE, AND ONLY IT — BUT EVERY TIME ═══
 *
 * Or: *"you can take back the last card that was thrown, and only it. But
 * not just once."* And the example, which is the whole rule: *"I threw an
 * obsidian egg. I threw Thunderwing — I can pull Thunderwing back. I cannot
 * also pull the egg. I carried on. I threw a healing bloom — I can pull the
 * healing bloom back."*
 *
 * This used to be ONE take-back for the whole match, which came from his
 * earlier complaint about the opposite failure: *"if I already pulled a
 * card I should not be pulling the ones after it out of the recycling."*
 * That is still true and still prevented — you can never dig DOWN the pile.
 * What is gone is the match-long budget, which punished the second change
 * of mind as though it were the same mistake as rummaging.
 *
 * So the flag is not "spent this match" any more; it is "this throw has
 * already been undone", and a new throw clears it.
 *
 * Pure and exported so the rule can be tested as the rule, rather than as a
 * sentence in a test file that happens to agree with the code.
 */
export function canTakeFromBin(alreadyTookItBack: boolean, binSize: number): boolean {
  return !alreadyTookItBack && binSize > 0;
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
  levelCap: number = LEVELS.max,
): BoardInput {
  /*
   * Capped, not just read. In a private room both friends fight at the lower
   * of their two albums (levelCapRef) — a card below the cap still plays at
   * its own level, and nobody is ever handed one they have not earned.
   */
  const levelOf = (id: string) => Math.min(album?.get(id)?.level ?? 1, levelCap);
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

/**
 * ═══ A LESSON'S BOARD IS THE BOARD THAT FIGHTS ═══
 *
 * `only` is the set of squares a lesson has drawn (lessonScript.squaresBy).
 * Without it the buzzer fills every empty perimeter cell with a crumb, so a
 * child who built on the three squares of lesson one would press "fight" and
 * watch thirteen monsters appear — nine of them on squares that were never
 * on the screen.
 *
 * Or: *"stage one — meeting the board. A board of three squares."* Three
 * squares has to mean three squares all the way through, or the lesson says
 * one thing and the battle shows another. Null everywhere outside a lesson,
 * which is the whole game.
 */
function fillGs(s: GameState, bar: string[], only?: ReadonlySet<string> | null): GameState {
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
  /*
   * ═══ THE CROWN IS NEVER EMPTY ═══
   *
   * Or: *"I started a match without placing a King and saw I had no Crumb
   * Demon in the King slot — there has to be a King, otherwise it's
   * strange."*
   *
   * He is right and this overrules an earlier decision of mine. `resolveKing`
   * promotes the best card on the board, and if the player placed nothing at
   * all it returns nobody, on the reasoning that a King you did not choose is
   * not a King. That reads as a bug on the screen: every other empty cell
   * fills with a crumb at the buzzer, and the one in the middle — the one
   * with a crown drawn around it — stayed a hole.
   *
   * The King slot is a slot. It fills like the rest.
   */
  if (!king && (!only || only.has("king"))) king = "crumb_demon";

  const empties = shuffle(
    perimeterCells().filter(
      (c) => !placements[cellKey(c.x, c.y)] && (!only || only.has(cellKey(c.x, c.y))),
    ),
  );
  let idx = 0;
  for (; idx < empties.length && fillQueue.length > 0; idx++)
    placements[cellKey(empties[idx]!.x, empties[idx]!.y)] = fillQueue.shift()!;
  for (; idx < empties.length; idx++)
    placements[cellKey(empties[idx]!.x, empties[idx]!.y)] = "crumb_demon";

  return { ...s, king, placements, hand: null };
}

function initialGameState(
  album?: Map<string, OwnedCard> | null,
  built?: readonly string[] | null,
  best?: number,
): GameState {
  return {
    deck: matchDeck(album, undefined, built, best),
    hand: null,
    discard: [],
    placements: {},
    king: null,
  };
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
  /** Can the LAST thrown card still be fetched back? See takeDiscard. */
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
   * 2v2 rather than Amanda.
   *
   * ⚠ Both are `coop` — one eight-lane side, a partner's half drawn under
   * yours — and the screen had three places where `coop` was read as "this
   * is Amanda": the opponent was labelled with her name, and the countdown
   * said "together" over a card showing you against the enemy. One flag more
   * is cheaper than three conditions that are nearly right.
   */
  duo: boolean;
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
  /** The sixteen this player built, or null while the game deals its own. */
  builtDeck: string[] | null;
  /** Read the shelf again — the builder saved, deleted or switched deck. */
  reloadDecks: () => void;
  onlineAvailable: boolean;
  mySide: Side;
  oppLeft: boolean;
  /** Set when the server could not be reached, so "searching" never hangs. */
  netError: boolean;
  /** When this account's suspension lifts, or null when it is not suspended. */
  suspendedUntil: string | null;
  /** Code of the private room you opened, once the server has given one. */
  roomCode: string | null;
  /**
   * This match is against somebody you chose, not somebody the queue found.
   *
   * Host, join and invite are the three ways into a private room and all
   * three are it. Amanda mode is deliberately not: that pairs you WITH a
   * partner against her, which is a different thing from playing a friend.
   */
  vsFriend: boolean;
  /** Why joining a room failed, if it did. */
  roomError: RoomError | null;
  iWon: boolean;
  /** Mirror mode: the same deck on both sides. Null when it is off. */
  mirrorSeed: number | null;
  /** Start a mirror match against the computer. */
  startMirror: () => void;
  /** Draft: play the cards you took against the cards you passed on. */
  startDraft: (result: { mine: string[]; theirs: string[] }) => void;
  /** 2 against 2: eight lanes a side, with a computer partner. */
  startDuo: () => void;
  /**
   * Which tutorial match is running (1 or 2), or 0 for an ordinary game.
   *
   * A lesson is not a match against the computer: both sides are written down
   * in lessons.ts, because Amanda cannot say "a giant? guard your King with
   * him" unless a giant is actually coming.
   */
  lesson: number;
  startLesson: (n: number) => void;
  /**
   * Put the card a tutorial step is about back into the player's hand.
   *
   * Or: *"at any moment the tutorial has to allow exactly one action, and
   * make sure it was really carried out."* This is the second half — the
   * tutorial stops ASSUMING the hand matches what it is talking about and
   * makes it so. Does nothing outside a lesson, and nothing when the hand
   * is already right, which is almost always.
   */
  expectCard: (cardId: string | null) => void;
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
  /**
   * `onSide` is the playground only: a drop knows which board it landed on,
   * so it says so rather than relying on which side happens to be selected.
   * See the note in placeAt.
   */
  placeAt: (x: number, y: number, onSide?: EditSide) => void;
  placeKing: (onSide?: EditSide) => void;
  toBattle: () => void;
  /**
   * Bring on the last phase, because a lesson has no clock to do it.
   *
   * Only a step that is ABOUT the panic phase asks for this — see
   * `advance: "panic"` in lessonScript.ts. Outside a lesson the clock runs
   * the phases and nothing calls it.
   */
  toPanic: () => void;
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
  /** This throw has already been undone. Cleared by the next throw. */
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
  const [vsFriend, setVsFriend] = useState(false);
  /*
   * The highest level this board may fight at.
   *
   * Sent by the server for a private room only — two friends play at the
   * same level, see topLevel() in the server's progress.ts. A ref rather
   * than state because the only thing that reads it is buildPlayerBoard,
   * which is called from a callback and not from a render.
   */
  // Typed, because LEVELS.max is the literal 10 and this holds any level.
  const levelCapRef = useRef<number>(LEVELS.max);
  /*
   * The sixteen this player built, or null for "deal me one".
   *
   * A ref and a piece of state: the ref is what deals a match (from a
   * callback, not a render), and the state is what the home screen draws. It
   * is reloaded whenever the deck shelf changes — see `reloadDecks`.
   */
  const [builtDeck, setBuiltDeck] = useState<string[] | null>(null);
  const builtRef = useRef<string[] | null>(null);
  builtRef.current = builtDeck;
  /*
   * The back on that deck, which is the only part of it the OTHER player
   * ever sees — and until the versus screen drew it, the only part nobody
   * saw at all. Loaded from the same read as the cards, so the deck you are
   * dealt and the back you are shown holding cannot disagree.
   */
  const [myBack, setMyBack] = useState<string | null>(null);
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
  const [duo, setDuo] = useState(false);
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
  /** True in 2v2: eight lanes a side, and three of the four boards are the computer's. */
  const duoRef = useRef(false);
  /** 2v2: the partner's and the two enemy halves, decided before the countdown. */
  const duoBoardsRef = useRef<{ mate: Placement[]; foes: Placement[] } | null>(null);
  /** The two boards of the match just fought, for reporting it. See startBattle. */
  const soloBoardsRef = useRef<{ mine: Placement[]; theirs: Placement[] } | null>(null);
  /**
   * Which arena this bot match is being fought in — the ground, and so which
   * family fights 20% harder in it (arenas.ts).
   *
   * Kept from the moment the battle starts and sent with the report, because
   * the server REPLAYS the match: a replay on different ground is a different
   * battle, and the one thing solo.ts relies on is that both runs of the same
   * inputs give the same answer. It is read from trophies once, here, rather
   * than worked out again on the server from a row that may have moved in
   * between.
   */
  const soloArenaRef = useRef<string>(arenaFor(0).id);
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
  /**
   * How far this player has ever climbed.
   *
   * BEST trophies and not the current count, the same rule `familyOpen` is
   * written to: trophies fall after a loss, and a family you have met does
   * not become unmet. Asked at the moment a board is built rather than held,
   * because the account arrives after the first render.
   */
  const met = useCallback(
    () => accountRef.current?.bestTrophies ?? accountRef.current?.trophies ?? 0,
    [],
  );
  /**
   * A real match has been played and the account on screen is older than it.
   *
   * Cleared by whichever reload gets there first — the one chained off the
   * solo report, or the one that runs on arriving home. See finishBattle.
   */
  const playedRef = useRef(false);
  /**
   * ═══ ONE MATCH IS PAID ONCE ═══
   *
   * Or: *"I have some strange bug on my account — every match I get TWO
   * chests, and they have the same things in them, but they don't really
   * add up."*
   *
   * Two chests and a nacho count that moved once is the signature of the
   * same match being reported twice, in parallel. `addNachos` on the server
   * reads the count, works out what is owed and writes it back — so two
   * reports that arrive together both read the old count, both decide a
   * chest is owed, both mint one, and both write the same new total. Two
   * chests; the nachos added once. Exactly what he is looking at.
   *
   * Anything that mounts the battle screen a second time does it: a remount
   * gives Arena a fresh "have I finished" ref, and the second playback ends
   * like the first.
   *
   * So the report is guarded HERE rather than hunting the second caller,
   * because paying a match twice should be impossible by construction and
   * not by nobody happening to call it twice. Cleared when a match is
   * cleared — see clearMatch — which is the only way into another one.
   *
   * The server half of this is a read-modify-write that two requests can
   * interleave, and it is still open: it wants an atomic increment rather
   * than a read and a write. Written down in the reply, not fixed here.
   */
  const reportedRef = useRef(false);
  /**
   * The squares a running lesson has drawn, or null outside one.
   *
   * Read by every fillGs call, so the board that fights is the board the
   * child built. Cleared by clearMatch, which every other way into a match
   * goes through.
   */
  const lessonCellsRef = useRef<ReadonlySet<string> | null>(null);

  /**
   * Read the account again, because something changed it on the server.
   *
   * ═══ THE FLAG IS CLEARED ON ASKING, NOT ON ANSWERING ═══
   *
   * It was cleared inside the `.then`, after the null check, and that put
   * two requests on the wire for one match — measured, 40 seconds apart: the
   * reload at the result screen, then the one on arriving home, because a
   * guest's `loadAccount` answers null and the early return skipped past the
   * line that says "already asked".
   *
   * Nothing was wrong on the screen; there is no account to be stale. But
   * "the account on screen is older than the match" stops being true the
   * moment somebody goes and looks, whatever they find — so that is where it
   * is written down.
   */
  const refreshAccount = useCallback(() => {
    playedRef.current = false;
    void loadAccount().then((a) => {
      if (!a) return;
      accountRef.current = a;
      setAccount(a);
    });
  }, []);

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
    /*
     * Which deck they play with, alongside who they are. Still not awaited
     * together — a slow deck read must not hold up the account — but each
     * one now writes its ref before it deals, so the order cannot matter.
     * See dealAgain.
     */
    void loadDecks().then(({ decks, activeId }) => {
      if (!alive) return;
      const active = decks.find((d) => d.id === activeId);
      const cards = active?.cards.length ? active.cards : null;
      // The ref first, and by hand: render is what normally assigns it, and
      // render has not happened yet when the account's callback runs next.
      builtRef.current = cards;
      setBuiltDeck(cards);
      setMyBack(active?.back ?? null);
      dealAgain();
    });
    void loadAccount().then((a) => {
      if (!alive || !a) return;
      accountRef.current = a;
      setAccount(a);
      dealAgain();
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
  /**
   * Deal the opening deck again, if nobody has touched it yet.
   *
   * ═══ WHO YOU ARE AND WHAT YOU BUILT ARRIVE SEPARATELY ═══
   *
   * Or: *"are you sure the deck I picked is the one being used?"*
   *
   * He was right to ask. The album and the deck shelf are two reads that
   * race, and only the account's callback dealt a deck — so when it won, it
   * dealt from the ALBUM with `builtRef.current` still null, and the shelf
   * landing a moment later changed nothing. Worse, `builtRef.current` is
   * assigned during render, so even "the decks read finished first" did not
   * make it true: React had to have rendered in between.
   *
   * A solo match hid all of this, because startMatch clears the round and
   * deals again by then. An online match does not: the server says
   * "countdown" down a socket that was already open, and whatever deck was
   * sitting in state is the deck you play. So the one place it bit is the
   * one place where somebody is watching.
   *
   * The fix is not to win the race but to stop having one: each read writes
   * its own ref the moment it lands and then calls this, so the second one
   * home deals with both halves in hand, whichever order they come in.
   *
   * The guard is the same one the account path always had — an untouched
   * board, no mirror seed, no lesson — because a deck dealt on purpose must
   * never be replaced by one dealt on arrival.
   */
  const dealAgain = useCallback(() => {
    setGs((cur) =>
      mirrorRef.current === null &&
      lessonRef.current === 0 &&
      cur.hand === null &&
      cur.king === null &&
      Object.keys(cur.placements).length === 0
        ? initialGameState(accountRef.current?.album, builtRef.current, met())
        : cur,
    );
  }, []);

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
  if (!aiPlanRef.current) aiPlanRef.current = generateAiPlan(undefined, botLevelRef.current, met());

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

  /**
   * A card landing.
   *
   * For one afternoon this also played the card's own voice ninety
   * milliseconds behind the thud. Or: *"take them off the placing, let the
   * placing be only the gentle sound."* Which is the same judgement that
   * made `place` gentle in the first place — a build phase has twelve
   * placements in it, so this is a rhythm rather than a moment, and a
   * creature announcing itself twelve times is noise.
   *
   * The character is in the DRAG now, where the gesture lasts long enough
   * to hear it and happens once per card.
   */
  const landed = useCallback(() => {
    sfx.play("place");
  }, []);

  const placeAt = useCallback(
    (x: number, y: number, onSide?: EditSide) => {
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
        /*
         * === THE BOARD YOU DROPPED ON IS THE BOARD YOU MEANT ===
         *
         * Or: *"I need to be able to drag straight onto the board, whatever
         * side I have 'picked' right now. Just drag and stick."*
         *
         * The playground used to have a selected side and everything wrote
         * into it, so the other board was a picture — you had to press a
         * label before you could touch it. That is a mode, and a mode is
         * the thing a seven-year-old loses track of.
         *
         * The side comes from the gesture now. `editSideRef` is written
         * directly as well as through setState because this call places on
         * the very next line: a `setEditSide` alone would not land until
         * the next render and the card would go on the wrong board.
         */
        if (onSide && onSide !== editSideRef.current) {
          editSideRef.current = onSide;
          setEditSide(onSide);
        }
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
        if (held) landed();
        else sfx.play("discard");
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
        landed();
        return;
      }
      setGs(refill({ ...s, placements: { ...s.placements, [key]: s.hand }, hand: null }));
      landed();
    },
    [refill, landed],
  );

  const placeKing = useCallback((onSide?: EditSide) => {
    if (frozenRef.current > 0) return;

    // Playground: the crown is editable too, and re-crowning replaces rather
    // than refusing — there is no "you already chose" when you are testing.
    if (playgroundRef.current) {
      // Whichever crown was dropped on. See placeAt.
      if (onSide && onSide !== editSideRef.current) {
        editSideRef.current = onSide;
        setEditSide(onSide);
      }
      const held = gsRef.current.hand;
      const monster = held !== null && isMonsterId(held) ? held : null;
      const enemy = editSideRef.current === "enemy";
      const current = enemy ? foeRef.current.king : gsRef.current.king;
      if (!monster && !current) return;
      if (enemy) setFoe((f) => ({ ...f, king: monster }));
      else setGs((s) => ({ ...s, king: monster }));
      if (monster) landed();
      else sfx.play("discard");
      return;
    }

    /*
     * The crowned card is read off the ref rather than out of the updater.
     * React runs an updater during RENDER and may run it twice in strict
     * mode; `ok` survives that because it is only ever set true, and a
     * CARD ID assigned there would be assigned twice. The same lesson as
     * discardHand above, which has the long version of it.
     */
    let ok = false;
    const crowning = gsRef.current.hand;
    setGs((s) => {
      if (s.hand === null || !isMonsterId(s.hand) || s.king !== null) return s;
      ok = true;
      return drawIfEmpty({ ...s, king: s.hand, hand: null });
    });
    if (ok) landed();
  }, [landed]);

  const discardHand = useCallback(() => {
    /*
     * ═══ ASKED OF THE REF, NOT OF THE UPDATER ═══
     *
     * This set a local `ok` inside the `setGs` updater and read it on the
     * next line. React runs that updater during RENDER, not during the
     * call, so the next line read `false` — the throw happened and
     * everything hanging off it did not.
     *
     * It cost nothing while the only thing hanging off it was a sound
     * effect nobody missed. Then Or's rule arrived — *"you can take back
     * the last card that was thrown... but not just once"* — and clearing
     * the flag went in beside the sound, where it also never ran. Measured
     * in the browser: throw, fetch, throw again, and the button stayed
     * grey.
     *
     * `gsRef` is assigned on every render and is the same answer the rest
     * of this file asks for the current board.
     */
    if (gsRef.current.hand === null) return;
    setGs((s) => (s.hand === null ? s : refill({ ...s, discard: [...s.discard, s.hand], hand: null })));
    // A new throw is a new chance to change your mind about it: the flag
    // means "this throw has already been undone", not "spent for the
    // match". See canTakeFromBin.
    binUsedRef.current = false;
    setBinUsed(false);
    sfx.play("discard");
  }, [refill]);

  /**
   * Take the last thrown card back out of the bin.
   *
   * ═══ THE BIN IS A CHANGE OF HEART, NOT A SECOND DECK ═══
   *
   * It began as a swap, which made throwing free: whatever you had just
   * thrown was always one tap from returning. Burying the card you traded
   * fixed that one hole and left the bigger one open — you could still keep
   * taking, down through everything you had thrown all match, which turned
   * a 20-card deck into a 20-card deck you could search.
   *
   * Or, then: *"I need to be able to pull only ONE card back and no more.
   * If I already pulled a card I should not be pulling the ones after it
   * out of the recycling."* That became one take-back for the whole match,
   * which fixed the rummaging by also forbidding the second honest change
   * of mind.
   *
   * Or, now: *"you can take back the last card that was thrown, and only
   * it. But not just once."*
   *
   * Both rules at once, and they do not conflict: the LAST throw can always
   * be undone, and the ones beneath it never can. The flag means "this
   * throw has already been undone" and a new throw clears it (discardHand).
   *
   * Burying the card you were holding still matters, and it is what makes
   * the second half true: after an undo the pile's top is the card you just
   * gave up, so a second undo would hand it straight back — which is why
   * the flag is what stops it rather than the pile's shape.
   *
   * It lives beside the board state rather than inside it because it
   * describes the PLAYER's turn, not the pile — clearRound resets it with
   * everything else that is about one round.
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
    /*
     * ═══ THE HALF OF THIS THAT ONLINE EVER REACHED ═══
     *
     * Or: *"none of the action cards that touch the enemy work. I cannot
     * erase..."*
     *
     * Everything below this line edits `aiPlanRef` — the computer's plan —
     * and against a person there is no plan: it is null, the function
     * returned on the next line, and the screen of the player who spent the
     * card did not change by one pixel. The card DID land; the other client
     * carried it out and the board came back without it a moment later. But
     * a card that appears to do nothing when you play it is a card that does
     * not work, and he is right.
     *
     * So the picture goes first, for both kinds of opponent, and the plan is
     * edited afterwards if there is one.
     */
    if (key !== KING_KEY)
      setNetOpp((v) => {
        if (!v.placements[key]) return v;
        const placements = { ...v.placements };
        delete placements[key];
        return { ...v, placements };
      });
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
        /*
         * ═══ ONLINE THE SERVER HAS TO BE ASKED ═══
         *
         * Or: *"I cannot see the opponent with the x-ray. Against a
         * friend."*
         *
         * Against the computer this flag is the whole card: the enemy
         * board is in memory and the flag stops hiding it. Online this
         * client is not holding that board — it is holding what the server
         * already fogged — so the flag lifted a fog applied somewhere
         * else, and nothing happened. The card could never have worked
         * against a person.
         *
         * The flag still goes up, for the King and for anything else that
         * reads it, and the request goes out for the part only the server
         * can answer.
         */
        if (onlineRef.current) netRef.current?.hex(id);
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
          buildPlayerBoard(
            fillGs(gsRef.current, barRef.current, lessonCellsRef.current),
            modsRef.current,
            stackedRef.current,
            accountRef.current?.album,
            levelCapRef.current,
          ),
        );
      else netRef.current?.unready();
      sfx.play("click");
      return now;
    });
  }, []);

  const enterPrebattle = useCallback(() => {
    setTargeting(null);
    const filled = fillGs(gsRef.current, barRef.current, lessonCellsRef.current);
    setGs(filled);
    sfx.play("crumbs");
    setPhase("prebattle");
    setTimeLeft(PREBATTLE_SECONDS);
    // In an online match, submit the locked board to the server now.
    if (onlineRef.current)
      netRef.current?.lock(
        buildPlayerBoard(
          filled,
          modsRef.current,
          stackedRef.current,
          accountRef.current?.album,
          levelCapRef.current,
        ),
      );
  }, []);

  /**
   * The fight button, during a lesson.
   *
   * With the clock stopped in build and panic, nothing advances on its own,
   * so the button walks the phases rather than jumping to the end: build
   * takes you to panic — where Amanda says the fog has lifted and points at
   * the opponent's board — and panic takes you to the battle.
   *
   * Without this, stopping the clock would have skipped panic entirely and
   * silently dropped the last two things she says.
   *
   * Outside a lesson it is not reachable and nothing changes: the clock runs
   * the phases, and the button means "I am ready, skip the rest".
   */
  /**
   * ═══ THE BUTTON MEANS THE BUTTON ═══
   *
   * Or: *"in all the tutorials you have to press 'start battle' twice and it
   * is strange. Once is enough."*
   *
   * This used to step a lesson through the phases: build -> panic on the
   * first press, the battle on the second. It was how the old lesson two
   * reached the panic phase at all, since a lesson has no clock to run the
   * phases for it — and it meant Amanda said "press start battle", the
   * player pressed, and the button was still there.
   *
   * Reaching panic is a thing a STEP asks for now (`advance: "panic"`, and
   * toPanic below), which is where that intention belongs: stage three
   * teaches the panic phase, stages one and two do not, and neither should
   * pay a press for it.
   */
  const toPanic = useCallback(() => {
    if (phaseRef.current !== "build") return;
    setPhase("panic");
    setTimeLeft(PHASES.panic.seconds);
  }, []);

  const startBattle = useCallback(() => {
    const aiFull: BoardInput = soloAmandaRef.current
      ? { owner: "B", placements: buildAmandaBoard(CATALOG.values()) as Placement[] }
      : duoRef.current
        ? // Two opposing boards, one above the other, across eight lanes.
          { owner: "B", placements: duoBoardsRef.current!.foes }
        : { owner: "B", placements: fillCrumbs(aiPlanRef.current!) };

    let mine = buildPlayerBoard(
      gsRef.current,
      modsRef.current,
      stackedRef.current,
      accountRef.current?.album,
      levelCapRef.current,
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
      const partner = fillCrumbs(generateAiPlan(undefined, "normal", met())).map((p) => ({
        ...p,
        y: (p.y ?? 0) + BOARD_SIZE,
      }));
      mine = { ...mine, placements: [...mine.placements, ...partner] };
    }

    /*
     * 2v2: your partner's four lanes, decided before the countdown.
     *
     * Taken from `duoBoardsRef` rather than generated here, because the half
     * you looked at all through the build has to be the half that fights.
     * Amanda mode had exactly that bug the other way round — Or: *"when the
     * fog lifted, Amanda's King was the Insect Empress, and then in the
     * battle itself it changed to Amanda."*
     */
    if (duoRef.current && duoBoardsRef.current) {
      mine = {
        ...mine,
        placements: [...mine.placements, ...duoBoardsRef.current.mate],
      };
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
    // Where this is being fought, and so which family fights harder in it.
    soloArenaRef.current = arenaFor(accountRef.current?.trophies ?? 0).id;

    const r = runBattle({
      seed: BATTLE_SEED,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: mine,
      b: aiFull,
      recordFrames: true,
      ground: groundFor(accountRef.current?.trophies ?? 0),
      ...(soloAmandaRef.current || duoRef.current ? { lanes: COOP_LANES } : {}),
    });
    setResult(r);
    sfx.play("go");
    setPhase("battle");
    /*
     * Or asked *"how many playground games"*. It is counted HERE — when two
     * boards actually fight — rather than when the playground opens, because
     * opening it and putting one card down is not a game and would make the
     * number flattering and useless.
     *
     * No winner is reported and there is none to report: the playground has
     * no reward, which is also why this is the one event the browser is
     * allowed to send (see api.ts).
     */
    track("playground", {
      cards: Object.keys(mine.placements).length,
      theirs: Object.keys(foeRef.current.placements).length,
      ticks: r.ticks,
    });
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
    aiPlanRef.current = generateAiPlan(undefined, botLevelRef.current, met());
    setGs(initialGameState(accountRef.current?.album, builtRef.current, met()));
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
  }, [met]);

  const clearMatch = useCallback(() => {
    netRef.current?.close();
    netRef.current = null;
    /*
     * A lesson's small board belongs to that lesson. Every way into a match
     * comes through here, and startLesson sets it again straight afterwards —
     * so forgetting this would mean a real match quietly fought on three
     * squares, which is the kind of bug that only shows up two screens later.
     */
    lessonCellsRef.current = null;
    // A new match has not been paid for yet. See reportedRef.
    reportedRef.current = false;
    clearRound();
    setOnline(false);
    setOppLeft(false);
    setNetError(false);
    setRoomCode(null);
    setRoomError(null);
    setVsFriend(false);
    levelCapRef.current = LEVELS.max;
    setCoop(false);
    setMyLane(0);
    soloAmandaRef.current = false;
    duoRef.current = false;
    duoBoardsRef.current = null;
    setDuo(false);
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
    // The handle is drawn here rather than held in BOT_CARDS, so that the
    // next match is somebody else. See BOT_NAMES.
    setRival({ ...BOT_CARDS[botLevelRef.current], nickname: botName() });
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
    setVsFriend(intent.kind === "host" || intent.kind === "join" || intent.kind === "invite");
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
      onLevelCap: (cap) => {
        levelCapRef.current = Math.max(1, Math.min(LEVELS.max, cap));
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
        /*
         * ═══ A FOUGHT MATCH DOES NOT GO BACK TO BUILDING ═══
         *
         * Or: *"the clock got stuck and the battle never started"* — and
         * for both of them.
         *
         * The server was still running the clock it had started when the
         * match began, even after both players pressed ready and the battle
         * was computed early. Half a minute into watching that battle, a
         * "panic" arrived and this handler obeyed it: the fight vanished and
         * the board came back. Then "locking" arrived and put them into the
         * pre-battle countdown — which online is only ever ended by a result
         * message, and that had already been sent and will not come twice.
         *
         * The server no longer talks after the result (see computeResult in
         * match.ts). This is the other half of the same lock, because the
         * one thing a client must never do with a message from the past is
         * act on it: once a round has been fought, the only phase worth
         * hearing is a new countdown, which is a new round.
         */
        if (p !== "countdown" && (phaseRef.current === "battle" || phaseRef.current === "result"))
          return;
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
          /*
           * The ground comes down the wire with the boards, for the same
           * reason `lanes` does: the server has already fought this battle
           * and paid for it, and a replay on different ground would not
           * merely look wrong — it would disagree about who won. Which arena
           * two players meet in is the server's to decide (match.ts), not
           * each client's own rung.
           */
          ...(r.ground ? { ground: r.ground } : {}),
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
  /**
   * ═══ THE TUTORIAL AND THE GAME HOLD THE SAME CARD ═══
   *
   * Or: *"there is no synchronisation between the tutorial and what the
   * player actually does. It is enough for the player to draw another card
   * from the deck — the tutorial does not know about it and everything is
   * out of step from there on."*
   *
   * The drift is silent, which is why it survived three rewrites. A step
   * waits for a card on a named square; it goes one square over; the gate is
   * never met; the hand empties; the next card is dealt — and the step waits
   * for a card that has left the game. Nothing fails; Amanda just talks
   * about something the player is not holding.
   *
   * So each step says what it needs and this puts it there. Whatever was
   * wrongly in hand goes back on top of the deck rather than being
   * destroyed, because a tutorial that eats a card is a worse bug than the
   * one it is fixing.
   *
   * A card already ON THE BOARD is left alone: the step is simply behind,
   * and dealing a second copy of a monster that is standing there would be
   * visible, strange, and ours.
   */
  const expectCard = useCallback((cardId: string | null) => {
    if (!cardId) return;
    setGs((s) => {
      if (s.hand === cardId) return s;
      if (s.king === cardId) return s;
      if (Object.values(s.placements).includes(cardId)) return s;
      const fromDeck = s.deck.filter((id) => id !== cardId);
      const fromBin = s.discard.filter((id) => id !== cardId);
      const held = s.hand && s.hand !== cardId ? [s.hand, ...fromDeck] : fromDeck;
      return { ...s, hand: cardId, deck: held, discard: fromBin };
    });
  }, []);

  const startLesson = useCallback(
    (n: number) => {
      const spec = STAGE_LESSONS[n - 1];
      if (!spec) return;
      sfx.unlock();
      sfx.play("click");
      clearMatch();
      /*
       * The squares this stage ever draws, kept for the buzzer.
       *
       * Or: *"stage one — a board of three squares."* Without this, pressing
       * "fight" fills every empty perimeter cell with a crumb and thirteen
       * monsters appear on squares that were never on the screen. See fillGs.
       *
       * AFTER clearMatch, which nulls it. Written above that line first, and
       * the symptom would have been the small board quietly coming back full.
       */
      lessonCellsRef.current = lessonSquares(n);
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
  /**
   * Draft: the fifteen cards you took, against the fifteen you passed on.
   *
   * Or: *"what you don't take goes to the opponent."* Which the engine takes
   * literally — the bot's board is planned from `theirs`, so every monster
   * you refused is one you now have to beat. The action cards are dealt the
   * usual way to both sides; see shared/draft.ts for why they are not
   * drafted.
   *
   * No seed, unlike mirror mode: the two decks are deliberately DIFFERENT
   * here, and the thing that makes them different is the fifteen choices
   * somebody just made.
   */
  /**
   * 2 against 2: eight lanes a side, and you fill four of them.
   *
   * Or: *"2v2 — two build one board."* Which the board already knew how to
   * be: Amanda mode is two players arranging one eight-lane side, and every
   * piece of that — the split view, the partner's half drawn unfogged under
   * yours, COOP_LANES in the engine — has been in the game since it shipped.
   * This is that side with an ordinary pair of boards facing it instead of
   * her, and winnable.
   *
   * ⚠ YOUR PARTNER IS THE COMPUTER, AND SO ARE BOTH OPPONENTS. A 2v2 with a
   * real friend needs the server's Match to hold four sockets rather than
   * two (apps/server/src/match.ts holds `a` and `b`, and co-op puts both of
   * them on side A against Amanda). That is a real change and it is not this
   * one. Flagged to Or rather than quietly shipped as "2v2".
   *
   * The three boards are decided HERE, before the countdown, so that the
   * half you look at all through the build is the half that fights — the
   * bug Amanda mode had the other way round.
   */
  const startDuo = useCallback(() => {
    sfx.unlock();
    sfx.play("click");
    clearMatch();
    faceTheBot();
    setCoop(true);
    setDuo(true);
    duoRef.current = true;
    setMyLane(0);

    const level = botLevelRef.current;
    const lower = (ps: Placement[]) => ps.map((p) => ({ ...p, y: (p.y ?? 0) + BOARD_SIZE }));
    const climbed = met();
    const mate = fillCrumbs(generateAiPlan(undefined, level, climbed));
    const foes = [
      ...fillCrumbs(generateAiPlan(undefined, level, climbed)),
      ...lower(fillCrumbs(generateAiPlan(undefined, level, climbed))),
    ];
    duoBoardsRef.current = { mate: lower(mate), foes };

    /*
     * What the partner's half looks like while you build. The engine takes
     * Placements; the screen takes a cell map, so this is the same board
     * said the other way.
     */
    const view: Record<string, string> = {};
    let mateKing: string | null = null;
    for (const p of mate) {
      if (p.king) mateKing = p.cardId;
      else view[cellKey(p.x ?? 0, p.y ?? 0)] = p.cardId;
    }
    setMate({ placements: view, king: mateKing });

    // Your own album and your own chosen deck, exactly as an ordinary match.
    setGs(initialGameState(accountRef.current?.album, builtRef.current, climbed));
    setPhase("countdown");
  }, [clearMatch, faceTheBot, met]);

  const startDraft = useCallback(
    (result: { mine: string[]; theirs: string[] }) => {
      sfx.unlock();
      sfx.play("click");
      clearMatch();
      faceTheBot();
      const actions = matchDeck(null, 1 + Math.floor(Math.random() * 2_000_000_000)).filter(
        (id) => !CATALOG.has(id),
      );
      const deck = shuffle([...result.mine, ...actions]);
      setGs({ deck, hand: null, discard: [], placements: {}, king: null });
      // The cards you passed on, planned at the level you chose to play at.
      aiPlanRef.current = generateAiPlan(result.theirs, botLevelRef.current);
      setPhase("countdown");
    },
    [clearMatch, faceTheBot],
  );

  const startMirror = useCallback(() => {
    sfx.unlock();
    sfx.play("click");
    clearMatch();
    faceTheBot();
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    setMirrorSeed(seed);
    // One deal, both sides — and still only the families this player has met.
    const deck = matchDeck(null, seed, null, met());
    setGs({ deck, hand: null, discard: [], placements: {}, king: null });
    aiPlanRef.current = generateAiPlan(deck, botLevelRef.current);
    setPhase("countdown");
  }, [clearMatch, met]);

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
    const mine = fillGs(gsRef.current, barRef.current, lessonCellsRef.current);
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
    /*
     * Practice, in all three of its shapes. Pulled out of the guard below
     * because it is now asked twice and the two questions are different: this
     * one is "did anything about the account change", and the guard under it
     * is "is this a match THIS client has to report".
     */
    const practice = playgroundRef.current || lessonRef.current || soloAmandaRef.current;
    // A real match changes the account on the server, whichever side of the
    // wire recorded it. See the effect below for the online half.
    if (!practice) playedRef.current = true;
    if (!boards || onlineRef.current || practice) return;
    if (reportedRef.current) return;
    reportedRef.current = true;
    void reportSolo({
      seed: BATTLE_SEED,
      ...boards,
      level: botLevelRef.current,
      arenaId: soloArenaRef.current,
      /*
       * What this screen is SHOWING, so the server can tell whether its own
       * replay agrees with it. It is not asked to believe this — see
       * api.ts — only to stop paying when the two disagree.
       */
      won: w === mySideRef.current,
    }).then((won) => {
      if (won.nachos || won.chests.length || won.moved.length) setAward(won);
      /*
       * ═══ THE NACHOS WERE PAID AND THE BAR NEVER MOVED ═══
       *
       * Or: *"I won a match and it showed 2 nachos, but I don't see them
       * filling the chest."*
       *
       * Both halves were working. The server adds them and writes the new
       * total (`addNachos` in meta.ts); the payout screen prints `+2` from
       * what it sent back. What nothing did was tell THIS hook, and the
       * home screen's bar is `m.account.nachos` — a copy loaded once when
       * the game started and, until now, never read again.
       *
       * So the pips were drawing the count from before the match, correctly,
       * for as long as the app stayed open. On a phone that is days.
       *
       * Reloaded here rather than patched from `won.total`, because the
       * match moved three things — nachos, trophies, and sometimes a chest
       * into the shelf — and a local edit would have to know about all three
       * and stay right as a fourth is added. The round trip happens behind
       * the result screen, where nobody is waiting for it.
       */
      refreshAccount();
    });
  }, [result]);

  /*
   * ═══ AND THE SAME THING, FOR A MATCH THIS HOOK IS NOT TOLD ABOUT ═══
   *
   * An ONLINE match returns above without reporting anything, because the
   * server that simulated it has already recorded it — `awardMeta` in
   * match.ts, fired and not awaited, so there is no moment the client could
   * chain off even if it were listening.
   *
   * The account is just as stale afterwards, and the player cannot see a
   * payout screen for it either. The second half of that is a real gap and
   * it is not this fix; what IS fixed is that the numbers on the home screen
   * are true by the time they are looked at.
   *
   * On arriving home, and only when a match was actually played — not on
   * every trip back to the menu, which is most of what this phase does.
   */
  useEffect(() => {
    if (phase !== "intro" || !playedRef.current) return;
    refreshAccount();
  }, [phase, refreshAccount]);

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
    /*
     * ═══ NOR DURING A LESSON ═══
     *
     * Or: *"and in the tutorial the clock shouldn't run."*
     *
     * He is right, and it is worse than untidy. Amanda stops between lines
     * and waits for the child to do the thing she just described — and
     * reading a sentence, finding the card and placing it takes a seven-
     * year-old longer than it takes me. Meanwhile 45 seconds run out
     * underneath, the build ends mid-explanation, and the empty slots fill
     * with Crumb Demons while she is still talking about where to put the
     * giant.
     *
     * A lesson is not a match with a tutor over it; it is a lesson. It ends
     * when she runs out of things to say, not when a clock does.
     *
     * Only the two phases she TEACHES in, though. `prebattle` is three
     * seconds of crumbs dropping into the empty slots and `countdown` is
     * three of "get ready", and both advance by this very timer — stopping
     * it there does not remove the pressure, it removes the next phase. The
     * way out of build and panic is the fight button, which `toBattle` now
     * walks one step at a time during a lesson.
     */
    /*
     * ═══ EXCEPT THE PANIC CLOCK, WHICH IS A THING SHE TEACHES ═══
     *
     * Or, writing out the end of stage three: *"and then... the panic
     * phase. Until now you only saw my front row, now you see almost the
     * whole board, time to put your last cards down. LET THE TIME RUN OUT.
     * And then tell him: time is up, no more changes to the board, now it
     * is the boards' turn to fight."*
     *
     * The clock running out IS the lesson there, so it has to actually run.
     * Build stays frozen — that is the phase where she talks longest and a
     * clock underneath would end it mid-sentence.
     *
     * Nothing happens when it reaches zero in a lesson; see the advance
     * effect below. The way on is still the fight button, which is the
     * other half of what he asked for: *"let him press start battle, even
     * though in a real game it goes by itself."*
     */
    if (lesson > 0 && phase === "build") return;
    if (!["countdown", "build", "panic", "prebattle"].includes(phase)) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100);
    return () => clearInterval(id);
  }, [phase, playground, lesson]);

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
      // In a lesson the clock reaching zero is something to SAY, not
      // something to do: she tells him the time is up and he presses.
      if (lesson > 0) return;
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
      buildPlayerBoard(
        fillGs(gs, barRef.current, lessonCellsRef.current),
        modsRef.current,
        stackedRef.current,
        accountRef.current?.album,
        levelCapRef.current,
      ),
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
    /*
     * ═══ A LESSON HAS NO CLOCK, SO NOTHING WAS EVER REVEALED ═══
     *
     * Or: *"after I activate it, the opponent board should light up — and
     * there should already be cards there!"*
     *
     * There were none. This reveals the opponent one card at a time as the
     * build clock runs down, and a lesson has no clock: `timeLeft` never
     * moves, so `frac` is 0, `visible` is 0, and the enemy side is an empty
     * grid for the whole lesson. Which makes the x-ray — a card whose
     * entire job is to show you that board — reveal nothing at all.
     *
     * A scripted opponent is not building anyway. The board in lessons.ts
     * is written down in full before the lesson starts, same as Amanda's:
     * it is already standing there, and the fog is what hides it until the
     * x-ray lifts it.
     */
    if (phase === "build" && !soloAmandaRef.current && lesson === 0) {
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
    // The same read the match uses — one way to go and look at the account,
    // so a shop purchase and a finished match cannot drift apart.
    reloadAccount: refreshAccount,
    expectCard,
    builtDeck,
    /*
     * Changing which deck is active changes the deck you are about to be
     * dealt — so this deals again too, under the same untouched-board guard.
     * Picking a deck on the home screen and then being handed the old one is
     * the same bug one screen later.
     */
    reloadDecks: () =>
      void loadDecks().then(({ decks, activeId }) => {
        const active = decks.find((d) => d.id === activeId);
        const cards = active?.cards.length ? active.cards : null;
        builtRef.current = cards;
        setBuiltDeck(cards);
        setMyBack(active?.back ?? null);
        dealAgain();
      }),
    onlineAvailable: ONLINE_AVAILABLE,
    netError,
    suspendedUntil,
    roomCode,
    vsFriend,
    roomError,
    mySide,
    oppLeft,
    iWon: result != null && result.winner === mySide,
    award,
    rival,
    me: {
      /*
       * The same automatic handle the other player sees for you — the server
       * fills it from the same function (shared/identity.ts), so the versus
       * screen shows both of you the name you are actually known by rather
       * than showing you a blank and them a handle.
       */
      nickname: shownName(account?.nickname, account?.playerId),
      avatar: shownAvatar(account?.avatar, account?.playerId),
      trophies: account?.trophies ?? 0,
      catchphrase: account?.catchphrase ?? null,
      gender: account?.gender ?? null,
      back: myBack,
    },
    mirrorSeed,
    startMirror,
    startDraft,
    startDuo,
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
    duo,
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
    toPanic,
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
