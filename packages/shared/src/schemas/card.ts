import { z } from "zod";
import { LocalizedStringSchema, ArtSchema } from "./common.js";
import { ElementsSchema } from "./elements.js";
import { AbilitySchema } from "./ability.js";
import { DragChoiceSchema } from "./drag.js";
import { TargetingSchema } from "./targeting.js";

/** Attack range archetypes (from GDD §11). */
export const RANGES = ["melee", "ranged", "sniper"] as const;
export const RangeSchema = z.enum(RANGES);
export type Range = z.infer<typeof RangeSchema>;

/** Rarity tiers, shared with the envelope/drop system later. */
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export const RaritySchema = z.enum(RARITIES);
export type Rarity = z.infer<typeof RaritySchema>;

/**
 * The core numeric stats the battle engine reads. These scale with upgrade
 * level (+~10% HP/Power per level per GDD §7) — the values here are the base
 * (level 1) stats.
 */
export const StatsSchema = z.object({
  /** Hit points before destruction. */
  hp: z.number().int().positive(),
  /** Base damage dealt per successful hit. */
  power: z.number().int().nonnegative(),
  /** Seconds between attacks. Lower = faster. */
  attackSpeed: z.number().nonnegative(),
  /** Slots advanced per second. 0 = static. */
  moveSpeed: z.number().nonnegative(),
  /** Targeting archetype. */
  range: RangeSchema,
});
export type Stats = z.infer<typeof StatsSchema>;

export const CardSchema = z.object({
  /** Globally unique id, e.g. "dragons_01_flame_dragon". */
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** Owning series id (must match a SeriesDefinition.id). */
  seriesId: z.string(),
  /**
   * Position within the series.
   *
   * ⚠ THE CEILING IS A SANITY BOUND, NOT THE DESIGN. The GDD's shape is ten
   * cards a family, and almost every family has exactly ten — but the Furries
   * have one and the Legends have one, so this was never an invariant.
   *
   * It was raised from 10 the day Or kept one card out of a family he was
   * dropping: *"leave the Thing in the Bin (slimes)"* — and the Slimes
   * already held 1 through 10. The alternative was deleting a slime nobody
   * asked me to delete, which is a worse answer than a family of eleven.
   */
  numberInSeries: z.number().int().min(1).max(12),
  name: LocalizedStringSchema,
  elements: ElementsSchema,
  rarity: RaritySchema.default("common"),
  stats: StatsSchema,
  /** Aerial/hovering units can pass over ground obstacles. */
  flying: z.boolean().default(false),
  /**
   * Who this card goes after. The whole list, and what each one means, is in
   * schemas/targeting.ts — seven of them since Or asked for more than
   * "forwards" and "the crown".
   *
   * A ranged card shoots its pick over the lanes from where it stands; a
   * walker crosses toward it only when its way is clear; a flyer crosses
   * regardless. And every mode falls back to `lane` when what it is looking
   * for is not on the board.
   */
  targeting: TargetingSchema.default("lane"),
  /** Designed as a mid-boss for the 2×2 King slot (informational; any card is legal there). */
  midBoss: z.boolean().default(false),
  /**
   * In the curated launch roster. Cards outside it stay in the data (balanced
   * and ready) but are held back for a later content update.
   */
  launch: z.boolean().default(false),
  /** Data-driven behaviors interpreted by the engine. */
  abilities: z.array(AbilitySchema).default([]),
  /** Design/tooltip text describing the card's role. Not read by the engine. */
  role: LocalizedStringSchema.optional(),
  /*
   * One line about who this monster IS, shown under its name on the card.
   *
   * Or: *"add me an option to give every monster a 'story' too. Not all of
   * them will have one, but some — mainly the ones with the name. The story
   * appears in the card details under the name. Chuppy, for example: 'the
   * loyal friend who is always with you'."*
   *
   * ⚠ NOT `role`, and the difference is who it is written for. `role` is a
   * designer's note — the Obsidian Egg's reads like a strategy memo — and it
   * was printed on cards once and taken straight back off (see
   * CardDetailModal.tsx). This is the opposite: it is for the child holding
   * the card, it says nothing about how to play it, and it is optional
   * because a monster with nothing to say should say nothing rather than
   * have a sentence invented for it.
   */
  story: LocalizedStringSchema.optional(),
  /*
   * What this card costs in a deck, 1 to 5.
   *
   * Left out of almost every card on purpose: cardCost.ts works it out from
   * the stats, which means a card Or rebalances in the admin panel re-prices
   * itself. This is the override for when the formula is wrong about a
   * particular card — Or: *"Chuppy should cost 4, not 5."*
   */
  cost: z.number().int().min(1).max(5).optional(),
  /*
   * How it moves, sounds and looks WHILE IT IS IN YOUR HAND — and only when
   * somebody overruled the derivation. See schemas/drag.ts; absent is the
   * normal state and the game ships with it absent everywhere.
   */
  drag: DragChoiceSchema.optional(),
  art: ArtSchema,
});
export type Card = z.infer<typeof CardSchema>;
