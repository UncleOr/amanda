/**
 * A match against the bot, re-run here so it can be worth something.
 *
 * ═══ WHY THIS EXISTS AT ALL ═══
 *
 * An online match is simulated by this process, so the server already knows
 * who won and how well. A match against the bot is simulated entirely in the
 * browser and the server never hears about it — which was fine for as long as
 * a bot match paid nothing. It is not fine now: nachos and challenges pay in
 * diamonds and cards, most of the playing in this game is against the bot, and
 * a guest can do nothing else.
 *
 * So the browser does not say what happened. It says what the two boards were
 * and which seed they were fought on, and this re-runs the battle with the
 * same deterministic engine. The same inputs give the same result on both
 * sides — that property is already the whole netcode — so the client's own
 * replay and this verdict cannot disagree.
 *
 * ═══ WHAT IT DOES NOT PROTECT AGAINST ═══
 *
 * Someone crafting requests by hand can send a weak opponent board and win
 * every time. There is no way around that while the bot's planner lives in the
 * client, and moving it here would make every solo match wait on a round trip
 * — which is the one thing a game you can play on a train must not do.
 *
 * What bounds the damage instead is in soloTrophies.ts: the setting the
 * browser claims is CAPPED BY THE BOARD it sent, so a weak opponent board is
 * paid as the easy bot whatever it was called — and the easy bot pays nothing.
 * A day of beating the computer is capped as well, so the ladder cannot be
 * climbed by grinding it.
 */
import { runBattle, type BattleResult, type Placement, type PlacementBuff } from "@amanda/engine";
import { ARENAS, BOARD, LEVELS, levelMultiplier, payableLevel, type BotLevel } from "@amanda/shared";
import { CATALOG, SYNERGIES } from "./content.js";

/** The most placements one side can send: a 4x4 board, both halves in co-op. */
const MAX_PLACEMENTS = BOARD.width * BOARD.height * 2;

/** The auto-filler dropped into empty slots. Not a card anybody chose. */
const FILLER = "crumb_demon";

/**
 * How many cards somebody actually chose to put on this board.
 *
 * The filler does not count: it is dropped into every empty slot when a board
 * locks, so counting it would make a half-empty board look full — which is the
 * exact thing this number is here to detect. See REAL_BOARD_CARDS for why the
 * count is the test and the board's WEIGHT turned out not to be.
 */
function realCards(placements: Placement[]): number {
  return placements.filter((p) => p.cardId !== FILLER && CATALOG.has(p.cardId)).length;
}

/**
 * ═══ WHAT A PLACEMENT CARRIES BESIDES A CARD AND A SQUARE ═══
 *
 * Or, with a photograph of a result screen reading "ניצחת": *"I won but I
 * lost trophies."*
 *
 * This file took the board apart and kept four things: the card, x, y and
 * whether it is the King. It dropped `buff` — and `buff` is not a detail.
 * It is where a card's LEVEL lives (levels ride the same multipliers an
 * action card uses, so the engine needs to know nothing about albums, see
 * cellBuff in useMatch.ts) and where every action card's effect lands.
 *
 * So the player fought with a levelled, boosted board and the server
 * replayed the same match with every card at level 1 and no action cards at
 * all. Measured over 600 random matches: with half the board at level 2 —
 * which is Or's album today — and one Energy Boost played, the replay
 * disagrees with the screen in 9.8% of matches. One game in ten said "you
 * won" and was paid as a loss.
 *
 * `below` was dropped the same way: a card stacked under another by Ground
 * Floor was simply not there in the replay.
 *
 * ═══ AND IT IS CLAMPED, BECAUSE IT COMES FROM THE BROWSER ═══
 *
 * Every number here is the client's word. The ceiling is what the GAME can
 * produce: the best a card can be is level 10 (LEVELS.max) with a boosted
 * cell on top of it, and the most flat power is a whole action deck of
 * Energy Boosts. Past that it is not a buff, it is a request.
 *
 * It does not make this file trusting — the header above says what it
 * already is. It stops the server and the browser fighting different
 * battles, which is the one thing it was written to prevent.
 */
const MAX_MULT = levelMultiplier(LEVELS.max) * 1.5;
/** Five action cards reach a match (ACTION_DECK_COUNT), +50 power each. */
const MAX_POWER_ADD = 5 * 50;

/** A positive number, no bigger than the game can make it. */
function capped(raw: unknown, max: number): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(n, max);
}

function buffOf(raw: unknown): PlacementBuff | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Record<string, unknown>;
  const out: PlacementBuff = {};
  const add = capped(b.powerAdd, MAX_POWER_ADD);
  if (add !== undefined) out.powerAdd = add;
  const power = capped(b.powerMult, MAX_MULT);
  if (power !== undefined) out.powerMult = power;
  // A King wounded by the eraser arrives as an hpMult BELOW one, which is a
  // reduction and needs no ceiling — only the same floor as everything else.
  const hp = capped(b.hpMult, MAX_MULT);
  if (hp !== undefined) out.hpMult = hp;
  return Object.keys(out).length ? out : undefined;
}

/** One placement, taken apart rather than trusted. */
function placement(raw: unknown): Placement | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const cardId = typeof p.cardId === "string" ? p.cardId : "";
  // A card that is not in the catalogue would throw inside the engine, which
  // is a 500 for a request that is simply wrong.
  if (!CATALOG.has(cardId)) return null;
  const x = Number(p.x);
  const y = Number(p.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || x >= BOARD.width || y < 0 || y >= BOARD.height * 2) return null;
  const buff = buffOf(p.buff);
  // Stacked underneath by Ground Floor, and revealed when the top one dies.
  const below = typeof p.below === "string" && CATALOG.has(p.below) ? p.below : null;
  return {
    cardId,
    x,
    y,
    ...(p.king === true ? { king: true } : {}),
    ...(below ? { below } : {}),
    ...(buff ? { buff } : {}),
  };
}

function board(raw: unknown): Placement[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PLACEMENTS) return null;
  const out: Placement[] = [];
  for (const one of raw) {
    const p = placement(one);
    if (!p) return null;
    out.push(p);
  }
  return out;
}

export interface SoloOutcome {
  result: BattleResult;
  /** The player's own board, for reading which row a card was put in. */
  mine: Placement[];
  /**
   * The setting to PAY for: what the browser claimed, capped by what the
   * opponent board can support. See payableLevel.
   */
  level: BotLevel;
  /**
   * Who the BROWSER says won — what the player is looking at right now.
   *
   * Not believed and never paid on. It is here so the caller can compare it
   * with the battle this file just replayed, and refuse to pay anything at
   * all when the two disagree. Null from a client too old to send it.
   */
  claimedWon: boolean | null;
}

/**
 * Validate a reported solo match and play it out.
 *
 * Everything is checked before the engine sees it, because the engine is
 * written for boards this server built and will happily throw on a board
 * nobody would build.
 */
export function soloResult(raw: unknown): SoloOutcome | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "no body" };
  const body = raw as Record<string, unknown>;
  const seed = Number(body.seed);
  if (!Number.isFinite(seed)) return { error: "no seed" };
  const mine = board(body.mine);
  const theirs = board(body.theirs);
  if (!mine || !theirs) return { error: "bad board" };
  // Anything that is not one of the three words is the easy bot, which pays
  // nothing — an unrecognised setting must never be the generous one.
  const claimed: BotLevel =
    body.level === "hard" || body.level === "normal" ? body.level : "easy";
  const level = payableLevel(claimed, realCards(theirs));
  /*
   * ═══ WHERE IT WAS FOUGHT, AS THE BROWSER SAYS ═══
   *
   * The ground decides which family fights 20% harder (arenas.ts), so it is
   * an INPUT to the battle, and this file exists because the same inputs
   * must give the same answer on both sides. Working it out here from the
   * player's row instead would read a number that may have moved since the
   * match started — and then the browser's replay and this one would be two
   * different battles, with the screen saying one thing and the payout
   * saying another.
   *
   * Taking it from the request costs nothing that was not already given
   * away: this whole file is handed both BOARDS by the browser (see the
   * header), the bonus applies to both of them equally, and what bounds the
   * payout is the difficulty cap in soloTrophies.ts, which is unaffected.
   * An id that is not an arena is simply not ground.
   */
  const arena = ARENAS.find((a) => a.id === body.arenaId);

  try {
    const result = runBattle({
      seed,
      catalog: CATALOG,
      synergies: SYNERGIES,
      ...(arena ? { ground: arena.family } : {}),
      a: { owner: "A", placements: mine },
      b: { owner: "B", placements: theirs },
      recordFrames: false,
    });
    return {
      result,
      mine,
      level,
      claimedWon: typeof body.won === "boolean" ? body.won : null,
    };
  } catch (err) {
    console.error("[solo] could not replay the match", err);
    return { error: "could not replay" };
  }
}
