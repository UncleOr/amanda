/**
 * What a match is worth: trophies, a chest, and the cards inside it.
 *
 * This lives on the server for one reason. Everything here is worth something,
 * so if the client decided any of it, a player could simply ask for a legendary
 * card and get one. The server already decides who won; it decides the rest too.
 *
 * The CATALOG is here as well, which is why chest contents are rolled in this
 * process rather than in a Postgres function: the database deliberately does
 * not know what a card is (see db/README.md), so it cannot weight a draw by
 * rarity. Here, that is one import.
 *
 * NONE OF THIS IS REQUIRED. Without SUPABASE_SERVICE_KEY the functions below
 * do nothing at all and matches play exactly as they do today. A missing
 * database must never stop a game.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "@amanda/shared";
import { CATALOG } from "./content.js";
/*
 * One client for the whole process. This module used to build its own, which
 * is how the admin endpoints came back to life while every match carried on
 * saving nothing — see supabase.ts.
 */
import { CAN_SAVE, db } from "./supabase.js";

export const PROGRESS_ENABLED = CAN_SAVE;

/** Trophies moved by a single match. */
export const TROPHIES_PER_WIN = 30;
export const TROPHIES_PER_LOSS = 20;

/** What each kind of chest holds. See docs/META.md. */
interface ChestKind {
  cards: number;
  diamonds: number;
  /** A rarity that is guaranteed to appear at least once. */
  guarantees?: Card["rarity"];
}
export const CHESTS: Record<string, ChestKind> = {
  wood: { cards: 3, diamonds: 5 },
  silver: { cards: 5, diamonds: 15, guarantees: "rare" },
  gold: { cards: 8, diamonds: 40, guarantees: "epic" },
};

/**
 * How often each rarity turns up in a draw.
 *
 * Deliberately not uniform and deliberately not brutal: this is a game two
 * people play together in an evening, not a machine for selling chests.
 */
const RARITY_WEIGHT: Record<string, number> = {
  common: 70,
  rare: 24,
  epic: 5,
  legendary: 1,
};

/** Only real, collectable monsters — the filler that pads a board is not a prize. */
function collectableCards(): Card[] {
  return [...CATALOG.values()].filter((c) => c.id !== "crumb_demon" && Boolean(c.seriesId));
}

function pickByRarity(pool: Card[]): Card | null {
  const total = pool.reduce((sum, c) => sum + (RARITY_WEIGHT[c.rarity] ?? 1), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const c of pool) {
    roll -= RARITY_WEIGHT[c.rarity] ?? 1;
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}

/** Roll the contents of one chest: card ids, repeats allowed (copies matter). */
export function rollChest(kind: string): { cards: string[]; diamonds: number } {
  const spec = CHESTS[kind] ?? CHESTS.wood!;
  const pool = collectableCards();
  const cards: string[] = [];
  if (spec.guarantees) {
    const promised = pool.filter((c) => c.rarity === spec.guarantees);
    const one = pickByRarity(promised.length ? promised : pool);
    if (one) cards.push(one.id);
  }
  while (cards.length < spec.cards) {
    const c = pickByRarity(pool);
    if (!c) break;
    cards.push(c.id);
  }
  return { cards, diamonds: spec.diamonds };
}

/**
 * Hand a chest's contents to a player: a copy of every card, and the diamonds.
 * Copies accumulate — a duplicate is the point, not a consolation.
 */
async function grant(sb: SupabaseClient, playerId: string, won: ReturnType<typeof rollChest>) {
  const counts = new Map<string, number>();
  for (const id of won.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [cardId, copies] of counts) {
    // Upsert-with-increment is not one call in PostgREST, so read then write.
    // A player opens one chest at a time, so there is nothing to race.
    const { data } = await sb
      .from("player_cards")
      .select("copies")
      .eq("player_id", playerId)
      .eq("card_id", cardId)
      .maybeSingle();
    await sb
      .from("player_cards")
      .upsert(
        { player_id: playerId, card_id: cardId, copies: (data?.copies ?? 0) + copies },
        { onConflict: "player_id,card_id" },
      );
  }
}

/**
 * Record a finished match: trophies for both sides, and a chest for the winner.
 * Players who are not signed in simply have no id, and are skipped.
 */
/*
 * What happened the last time we tried to save a match.
 *
 * The catch below logs and moves on, which is the right behaviour — a match
 * that finished matters more than a row that did not save — but it means the
 * only account of a failure is in a log that nobody debugging from outside can
 * read. Twice now a save has been quietly broken for days. These are reported
 * by /api/health so the question "is progress saving?" has an answer.
 */
export const saves = { attempted: 0, succeeded: 0, lastError: null as string | null };

export async function recordMatch(opts: {
  a: string | null;
  b: string | null;
  winner: "A" | "B" | null;
}): Promise<void> {
  const sb = db();
  if (!sb) return;
  saves.attempted++;
  const { a, b, winner } = opts;
  const winnerId = winner === "A" ? a : winner === "B" ? b : null;
  const loserId = winner === "A" ? b : winner === "B" ? a : null;

  try {
    await sb.from("matches").insert({
      player_a: a,
      player_b: b,
      winner: winnerId,
      trophies_delta: winner ? TROPHIES_PER_WIN : 0,
    });

    if (winnerId) {
      const { data } = await sb
        .from("players")
        .select("trophies, best_trophies, diamonds")
        .eq("id", winnerId)
        .maybeSingle();
      const trophies = (data?.trophies ?? 0) + TROPHIES_PER_WIN;
      // Every third win is a better chest, so there is something to count towards.
      const kind = trophies % 90 === 0 ? "gold" : trophies % 30 === 0 ? "silver" : "wood";
      const won = rollChest(kind);
      await sb
        .from("players")
        .update({
          trophies,
          best_trophies: Math.max(data?.best_trophies ?? 0, trophies),
          diamonds: (data?.diamonds ?? 0) + won.diamonds,
        })
        .eq("id", winnerId);
      await sb.from("chests").insert({
        player_id: winnerId,
        kind,
        opened_at: new Date().toISOString(),
        contents: won,
      });
      await grant(sb, winnerId, won);
    }

    if (loserId) {
      const { data } = await sb.from("players").select("trophies").eq("id", loserId).maybeSingle();
      // Losing costs less than winning pays, so an evening of play always
      // moves forward. Never below zero.
      await sb
        .from("players")
        .update({ trophies: Math.max(0, (data?.trophies ?? 0) - TROPHIES_PER_LOSS) })
        .eq("id", loserId);
    }
    saves.succeeded++;
    saves.lastError = null;
  } catch (err) {
    // A match that finished is more important than a row that did not save.
    saves.lastError = (err as Error).message.slice(0, 300);
    console.error("[progress] could not record match", err);
  }
}
