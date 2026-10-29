import { z } from "zod";

/**
 * ═══ WHO A CARD GOES AFTER ═══
 *
 * Or: *"open me up more options in the cards' preferred target: cards that
 * shoot straight, cards that shoot whoever attacks them, cards that shoot
 * the strongest card at any given moment, cards that shoot snipers, cards
 * that shoot static cards, cards that shoot cards that crossed the line and
 * are attacking. Give each one a catchy name."*
 *
 * Two of these existed and five are new. What they have in common is the
 * thing that makes them worth having at all: a board is not a queue, and
 * until now the only decision a card could make about WHAT to hit was
 * "whatever is in front of me" or "the crown". Every one of the five below
 * is an answer to a SITUATION rather than to a position — which is what
 * makes building a deck a choice instead of an ordering.
 *
 * ⚠ EVERY ONE OF THEM FALLS BACK TO `lane`. A targeting mode that finds
 * nothing must not leave a unit standing still: that bug has happened here
 * before, in exactly this function, and Or found it — *"all the attackers in
 * a straight line reaching the end and attacking nothing"*. So a sniper
 * hunter on a board with no snipers is simply a card, and the hunt resumes
 * the moment one is placed.
 */
export const TARGETINGS = [
  /** The nearest enemy straight ahead, in its own lane. The ordinary soldier. */
  "lane",
  /** Hunts the enemy King across lanes; works through the guards in the way. */
  "king",
  /**
   * Whoever hit it last, for as long as that card is alive and in front.
   *
   * It is a REPLY, so it does nothing until something starts on it — which
   * makes it a card that is placed and then forgotten about, and then turns
   * out to have been pointed at the thing that mattered all along.
   */
  "avenger",
  /**
   * The strongest monster on the board, recomputed every tick.
   *
   * ⚠ Not the King. The King is three times the power of whatever is in its
   * slot, so counting it would make this a King-hunter that skips the guard
   * rules — the same card twice, one of them worse.
   */
  "champion",
  /** The enemy's snipers: the cards that shoot from where you cannot reach. */
  "sniperHunter",
  /** The ones that never move — the walls, the towers, the things parked. */
  "wallbreaker",
  /**
   * Anything that has reached your line AND has started fighting.
   *
   * "Reached" rather than "crossed": a melee attacker stops ON the boundary
   * because contact is edge to edge, so the strict reading would almost
   * never fire. See `hasCrossed` in the engine, which has the measurement.
   */
  "invader",
] as const;
export const TargetingSchema = z.enum(TARGETINGS);
export type Targeting = z.infer<typeof TargetingSchema>;
