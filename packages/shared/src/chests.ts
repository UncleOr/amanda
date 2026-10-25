/**
 * ═══ WHAT IS IN EACH KIND OF CHEST ═══
 *
 * Or: *"when you press a chest you should be able to see how many cards and
 * what range of diamonds you can get in it."*
 *
 * Which is a question the shop could not answer, because this table lived in
 * the server and the shop is drawn in the browser. It is one table now, read
 * by the thing that FILLS a chest (apps/server/src/progress.ts) and by the
 * thing that SELLS one — so a chest cannot promise eight cards and hand over
 * five.
 *
 * Nothing about where a chest comes from is here. Winning one, buying one and
 * being given one are three different questions; what is inside it is this
 * one, and it has one answer.
 */

/** A rarity name, kept loose so this file does not import the card schema. */
export type ChestRarity = "common" | "rare" | "epic" | "legendary";

export interface ChestKind {
  cards: number;
  diamonds: number;
  /** A rarity that is guaranteed to appear at least once. */
  guarantees?: ChestRarity;
  /**
   * The chance this chest also holds something from the shop — an emoji pack
   * or a catchphrase.
   *
   * Or asked for both: *"something you buy in the shop OR win in a chest."*
   * The wooden one never does, which is what makes a silver one worth
   * counting towards; see nachoChestKind for the rhythm those arrive on.
   */
  treasure?: number;
}

export const CHESTS: Record<string, ChestKind> = {
  wood: { cards: 3, diamonds: 5 },
  silver: { cards: 5, diamonds: 15, guarantees: "rare", treasure: 0.25 },
  gold: { cards: 8, diamonds: 40, guarantees: "epic", treasure: 0.6 },
};

/**
 * Which kind of chest a shop item hands over, if it hands over one at all.
 *
 * The shop's `grants` column is deliberately open — a new kind of thing to
 * sell should be a row, not a migration — and two shapes for a chest exist
 * in the wild: `{chest}`, which is what a gift gives, and `{kind}`, which is
 * what the admin panel used to write. Both mean the same thing.
 */
export function chestKindOf(grants: Record<string, unknown> | null | undefined): string | null {
  if (!grants) return null;
  const chest = grants.chest ?? grants.kind;
  return typeof chest === "string" && CHESTS[chest] ? chest : null;
}
