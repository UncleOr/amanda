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
import { runBattle, type BattleResult, type Placement } from "@amanda/engine";
import { BOARD, payableLevel, type BotLevel } from "@amanda/shared";
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
  return { cardId, x, y, ...(p.king === true ? { king: true } : {}) };
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
}

/**
 * Validate a reported solo match and play it out.
 *
 * Everything is checked before the engine sees it, because the engine is
 * written for boards this server built and will happily throw on a board
 * nobody would build.
 */
export function soloResult(raw: unknown): SoloOutcome | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "מה?" };
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

  try {
    const result = runBattle({
      seed,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: { owner: "A", placements: mine },
      b: { owner: "B", placements: theirs },
      recordFrames: false,
    });
    return { result, mine, level };
  } catch (err) {
    console.error("[solo] could not replay the match", err);
    return { error: "could not replay" };
  }
}
