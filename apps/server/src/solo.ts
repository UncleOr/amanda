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
 * What bounds the damage instead: solo play pays nachos and challenge progress
 * but NO trophies, so nothing a liar can reach moves them up the ladder past
 * real players. The worst outcome is a faster chest, in a game where chests
 * are not sold for money.
 */
import { runBattle, type BattleResult, type Placement } from "@amanda/engine";
import { BOARD } from "@amanda/shared";
import { CATALOG, SYNERGIES } from "./content.js";

/** The most placements one side can send: a 4×4 board, both halves in co-op. */
const MAX_PLACEMENTS = BOARD.width * BOARD.height * 2;

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

  try {
    const result = runBattle({
      seed,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: { owner: "A", placements: mine },
      b: { owner: "B", placements: theirs },
      recordFrames: false,
    });
    return { result, mine };
  } catch (err) {
    console.error("[solo] could not replay the match", err);
    return { error: "could not replay" };
  }
}
