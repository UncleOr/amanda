/**
 * Card skins: the same card, drawn differently.
 *
 * Nothing uses this yet — Or asked for the ground to be prepared so that a
 * vintage Chuppy is a data change rather than a refactor. The shape is chosen
 * so that the rule which matters cannot be broken later:
 *
 *   A SKIN CHANGES HOW A CARD LOOKS AND NOTHING ELSE.
 *
 * Not its stats, not its abilities, not its rarity. A skin that altered any of
 * those would make two players holding "the same" card hold different cards,
 * and every balance measurement in this repo would stop meaning anything. That
 * is why this file deals only in image paths.
 */

/** A skin a player can own for a card. */
export interface Skin {
  /** Unique across all skins, e.g. "furries_01_chuppy:vintage". */
  id: string;
  /** The card it re-dresses. */
  cardId: string;
  /** Shown when choosing between skins. */
  name: { he: string; en: string };
  /** Where the artwork lives, relative to the public folder. */
  sprite: string;
  /** Optional frame treatment — purely decorative. */
  tone?: string;
}

/**
 * The skins that exist. Empty on purpose: the first one is a content decision,
 * not a code one, and the pipeline for drawing it already exists
 * (`pnpm art:card <id> <style>`).
 */
export const SKINS: Record<string, Skin> = {};

/** Every skin available for a card, for a future "change the look" screen. */
export function skinsFor(cardId: string): Skin[] {
  return Object.values(SKINS).filter((s) => s.cardId === cardId);
}

/**
 * The artwork to draw for a card, given what the player has equipped.
 *
 * Everything that renders a card should ask this rather than reading
 * `card.art.sprite` directly, so that the day a skin exists, it appears
 * everywhere at once instead of in the places somebody remembered.
 */
export function spriteFor(cardId: string, baseSprite: string, equipped?: string | null): string {
  if (!equipped) return baseSprite;
  const skin = SKINS[equipped];
  return skin && skin.cardId === cardId ? skin.sprite : baseSprite;
}
