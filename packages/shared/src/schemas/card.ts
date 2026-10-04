import { z } from "zod";
import { LocalizedStringSchema, ArtSchema } from "./common.js";
import { ElementsSchema } from "./elements.js";
import { AbilitySchema } from "./ability.js";

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
  /** 1–10 position within the series. */
  numberInSeries: z.number().int().min(1).max(10),
  name: LocalizedStringSchema,
  elements: ElementsSchema,
  rarity: RaritySchema.default("common"),
  stats: StatsSchema,
  /** Aerial/hovering units can pass over ground obstacles. */
  flying: z.boolean().default(false),
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
  art: ArtSchema,
});
export type Card = z.infer<typeof CardSchema>;
