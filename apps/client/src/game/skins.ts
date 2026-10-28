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

/**
 * Where a card's picture actually is, as a URL a browser can load.
 *
 * Two kinds of sprite now, and the whole point of this function is that
 * nothing drawing a card has to know which kind it is holding:
 *
 *   "cards/dragons_01_flame_dragon.webp"      shipped with the build, under
 *                                             BASE_URL like every other asset
 *   "https://…/card-art/giants_01-….webp"     uploaded from the admin panel,
 *                                             already a whole address
 *
 * ⚠ The second kind arrived with the "replace the picture" button, and this
 * is the line that keeps it from breaking everything else: a card whose art
 * Or has replaced is drawn in a battle, in the album, in the log and in the
 * detail modal, and every one of those used to write `BASE_URL + sprite` by
 * hand. Prefixing an absolute URL produces /amanda/https://… — a grey box,
 * in four places, with no error anywhere.
 */
export function artUrl(sprite: string): string {
  return /^(https?:)?\/\//.test(sprite) ? sprite : `${import.meta.env.BASE_URL}${sprite}`;
}
