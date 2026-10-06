/**
 * Keeping `players.album_power` true.
 *
 * The column has existed since the first migration and nothing had ever
 * written to it — forty-two players, every one of them at zero. So the number
 * matchmaking was designed around (docs/META.md) did not exist, and matching
 * was "whoever waited longest", which is what Or was complaining about.
 *
 * ═══ RECOMPUTED, NOT INCREMENTED ═══
 *
 * Every call reads the album and adds it up from scratch rather than adjusting
 * a running total. Adding a delta is faster and wrong by one the first time
 * anything is missed — a failed write, a card granted down a path that forgot
 * to call this, a levelling rule that changes. A number that drifts is worse
 * than no number, because it looks right.
 *
 * It is also fire-and-forget. A player whose total is a few seconds stale gets
 * a slightly imperfect match; a player whose card grant failed because the
 * total could not be written gets nothing, which is much worse.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { albumPower, type OwnedCardRow } from "@amanda/shared";
import { CATALOG } from "./content.js";

/** Work out one player's album power and store it. Returns what it stored. */
export async function refreshAlbumPower(
  sb: SupabaseClient,
  playerId: string,
): Promise<number | null> {
  const { data, error } = await sb
    .from("player_cards")
    .select("card_id, copies, level")
    .eq("player_id", playerId);
  if (error) return null;

  const rows: OwnedCardRow[] = [];
  for (const r of data ?? []) {
    const card = CATALOG.get(r.card_id as string);
    // A card id with no card behind it is an album entry for something that
    // has been deleted from the catalogue. Counting it would be counting a
    // card nobody can play.
    if (!card || card.id === "crumb_demon") continue;
    rows.push({
      rarity: card.rarity,
      level: (r.level as number) ?? 1,
      copies: (r.copies as number) ?? 1,
    });
  }

  const power = albumPower(rows);
  const { error: wrote } = await sb
    .from("players")
    .update({ album_power: power })
    .eq("id", playerId);
  return wrote ? null : power;
}

/**
 * Do it without making the caller wait or care.
 *
 * Used from the places that hand cards over, where the cards arriving matters
 * and this number being a second behind does not.
 */
export function refreshAlbumPowerSoon(sb: SupabaseClient, playerId: string): void {
  void refreshAlbumPower(sb, playerId).catch(() => {
    /* a stale total costs a slightly worse match; a thrown one costs the card */
  });
}
