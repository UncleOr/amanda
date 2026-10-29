import { z } from "zod";

/**
 * ═══ WHAT A CARD DOES WHEN YOU PICK IT UP ═══
 *
 * Or: *"let me choose, for every monster: a drag movement out of a list of
 * movements, a drag sound out of a list of sounds, a drag animation out of a
 * list of animations."*
 *
 * All three already existed and all three were DERIVED — a slime wobbles
 * because it is a slime, a dragon's wings beat slowly because it weighs
 * something, and what it sounds like is mixed from what it is made of. That
 * stays, and it has to: fifty-three cards and more coming cannot each be
 * animated by hand, and a card invented in the panel tomorrow must behave
 * like something without anybody choosing for it.
 *
 * So this is the OVERRIDE, in the same shape and for the same reason as
 * `cost` (see card.ts): empty means "work it out from the card", and a value
 * means Or looked at this one and disagreed. The game ships with every one of
 * these absent and plays exactly as it does today.
 *
 * ⚠ THE THREE ARE SEPARATE AND THEY WERE NOT. Until now one field — the
 * carry style — decided both how a card moved in the hand and what it threw
 * off while it moved, so "heavy" and "stones falling off it" were the same
 * word. They are two of Or's three questions, so they are two fields; a card
 * can now be hauled like a giant and shed nothing, or drift like a feather
 * and crackle.
 */

/** How the card follows your finger: the spring, the tilt and the lean. */
export const CARRY_STYLES = [
  "steady",
  "heavy",
  "flutter",
  "soar",
  "spark",
  "ooze",
  "root",
] as const;
export const CarryStyleSchema = z.enum(CARRY_STYLES);
export type CarryStyle = z.infer<typeof CarryStyleSchema>;

/** What comes off the card while it is in the air. */
export const DRAG_FX = [
  "none",
  "wings",
  "wingsBig",
  "lightning",
  "drips",
  "soil",
  "rubble",
] as const;
export const DragFxSchema = z.enum(DRAG_FX);
export type DragFx = z.infer<typeof DragFxSchema>;

/**
 * What it sounds like while it is carried.
 *
 * One ingredient rather than a mix, and that is the whole difference between
 * this and the default: the mixer layers wings over flame over size (see
 * cardSound.ts), and a card listed here plays the one sound Or picked for it.
 * `none` is a real answer — a card that is silent in the hand on purpose.
 */
export const DRAG_SOUNDS = [
  "none",
  "flame",
  "ice",
  "stone",
  "slime",
  "spark",
  "skitter",
  "dragonWings",
  "insectWings",
  "egg",
] as const;
export const DragSoundSchema = z.enum(DRAG_SOUNDS);
export type DragSound = z.infer<typeof DragSoundSchema>;

/**
 * One card's three choices. Every field optional, the whole object optional:
 * a card with nothing here is a card nobody has overruled.
 */
export const DragChoiceSchema = z.object({
  move: CarryStyleSchema.optional(),
  fx: DragFxSchema.optional(),
  sound: DragSoundSchema.optional(),
});
export type DragChoice = z.infer<typeof DragChoiceSchema>;
