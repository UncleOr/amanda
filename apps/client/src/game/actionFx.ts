/**
 * ═══ WHAT THE CARD DID, NOT THAT A CARD WAS PLAYED ═══
 *
 * Or: *"and on every card you activate there should be a vibration and a
 * fitting sound."*
 *
 * There are ten action cards a player can press, and until this file they
 * shared one sound (`draw` — the sound of being HANDED a card) and one buzz
 * (`action`). So the card that deletes an enemy monster and the card that
 * shows you their board were the same event as far as the hand and the ear
 * were concerned, which is how a game teaches a child that nothing in
 * particular just happened. It is the same mistake the win and the new-card
 * fanfares made before they were split, and it was costing more here: those
 * two are a second apart at the end of a match, these ten are the only
 * decisions in a build phase.
 *
 * ═══ TEN CARDS, NOT TEN FEELINGS ═══
 *
 * A phone has one motor with no volume, and the thing holding it is seven.
 * Ten rhythms that have to be told apart through a case is ten rhythms that
 * are told apart from none of them, so the BUZZ has two values, because an
 * action card can only ever mean two things:
 *
 *   boost  it made your board better — three pulses, each longer than the
 *          last: something growing.
 *   hex    it was done to them — the same shape backwards: one heavy hit
 *          and then two stabs falling away.
 *
 * And `aim` stays on the two that only move your own cards around, because
 * that is what `aim` has always meant: the card is spent, nothing is better
 * or worse than it was.
 *
 * The SOUND can afford to be per-card, because an ear has range where a
 * motor does not — so each one below names a sound the game already owns
 * and the reason it fits, with one exception that had to be built: Or asked
 * for a happier sound for the three buffs, and the game had nothing happy
 * that was not already a prize (`newcard`) or a result (`win`). See `boost`
 * in fanfare.ts.
 */
import type { SoundName } from "./sfx";
import type { Buzz } from "./haptics";
import { CORNER_KEYS } from "../data/catalog";

export interface ActionFx {
  sound: SoundName;
  buzz: Buzz;
}

/**
 * One entry per card in ACTIVE_ACTIONS. The passive four (`fill_*`) are not
 * here on purpose: nobody presses them — they act by sitting in the bar, and
 * the board filling up is already the thing you see and hear.
 */
export const ACTION_FX: Record<string, ActionFx> = {
  /* ── it made your board better ─────────────────────────────────────── */
  /** +50 power to everything you have placed. */
  energy_boost: { sound: "boost", buzz: "boost" },
  /** One card you point at, upgraded for the match. */
  full_refuel: { sound: "boost", buzz: "boost" },
  /** The four corners take a second card each. */
  dark_corners: { sound: "boost", buzz: "boost" },
  /**
   * Four slots anywhere, rather than the four corners.
   *
   * It gets the boost even though no card on the board changes — what it
   * buys is the same thing dark corners buys, and a player who learns that
   * this sound means "my side just got bigger" is learning something true.
   * It is the glow it does not get: see `improvedBy`.
   */
  ground_floor: { sound: "boost", buzz: "boost" },

  /* ── it was done to them ───────────────────────────────────────────── */
  /**
   * A card of theirs is gone. `explode` is the sound the arena plays when a
   * King comes apart — there is no better description of a card being
   * deleted, and it is the one moment in a build phase that deserves it.
   */
  radioactive_eraser: { sound: "explode", buzz: "hex" },
  /**
   * Their front row is shuffled. `shoot` is 200ms of band-passed noise
   * sweeping from 2.4kHz down to 650 with a swell on the front — which was
   * built to be something passing your ear, and is therefore already wind.
   */
  sandstorm: { sound: "shoot", buzz: "hex" },
  /**
   * The clock stops being theirs. `crumbs` is four square blips climbing —
   * the most mechanical thing in the library, which is what a freezer is.
   */
  time_freeze: { sound: "crumbs", buzz: "hex" },
  /**
   * Their whole board, for five seconds. `beep` was rebuilt as a ting —
   * *"not related, needs more 'ting'"* — and a ting means LOOK HERE, which
   * is the entire card.
   */
  xray: { sound: "beep", buzz: "hex" },

  /* ── it only moved your own cards ──────────────────────────────────── */
  /** Two of yours change places. A whoosh, and the thud of a card spent. */
  swap_places: { sound: "draw", buzz: "aim" },
  /** One of yours goes back to the bin, which is what `discard` is. */
  recall_card: { sound: "discard", buzz: "aim" },
};

/**
 * Which cells just got better, and should therefore light up for a moment.
 *
 * Or: *"and the card or cards that improved should glow for a moment."*
 *
 * Only the three cards he named return anything, and each returns exactly
 * what it changed — which is the point of the glow. A card that lights the
 * whole board when it touched one square is a card that lied about what it
 * did, and this is a game where a seven-year-old is learning what the cards
 * do by watching them.
 *
 * `ground_floor` returns nothing although it is a boost: it hands out four
 * slots that could go anywhere, so there is no card it improved yet. The
 * glow is for cards, and nothing here is a card.
 */
export function improvedBy(
  id: string,
  board: { placements: Record<string, string>; king: string | null },
  /** The cell that was pointed at, for the one card that asks. */
  target?: string,
): string[] {
  switch (id) {
    /*
     * Everything you have placed, and the crown with it — the buff reaches
     * the King on the board (see `buffFor` in BoardGrid), so leaving it dark
     * would say the one card that matters most was left out.
     *
     * Crumb Demons are not here because they are not here yet: the empties
     * fill at the end of the panic, and the buff explicitly skips them.
     */
    case "energy_boost":
      return [...Object.keys(board.placements), ...(board.king ? ["king"] : [])];
    // The four corners, whether or not they are holding anything — what the
    // card changed is the SQUARES, and an empty corner that lights up is
    // telling you where to put the next card.
    case "dark_corners":
      return [...CORNER_KEYS];
    // The one you pointed at.
    case "full_refuel":
      return target ? [target] : [];
    default:
      return [];
  }
}

/** How long the glow runs. Kept here so the CSS and the timer cannot drift. */
export const LIT_MS = 900;
