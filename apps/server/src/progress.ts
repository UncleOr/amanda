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
import { CATCHPHRASES, EMOJI_PACKS, TUNED, type Card } from "@amanda/shared";
import { CATALOG } from "./content.js";
import { refreshAlbumPowerSoon } from "./albumPower.js";
/*
 * One client for the whole process. This module used to build its own, which
 * is how the admin endpoints came back to life while every match carried on
 * saving nothing — see supabase.ts.
 */
import { CAN_SAVE, db } from "./supabase.js";

export const PROGRESS_ENABLED = CAN_SAVE;

/**
 * Trophies moved by a single match.
 *
 * Read through TUNED so the admin panel can turn them, and read at CALL time
 * rather than captured here — a value changed while the server is up should
 * apply to the next match, not to the next deploy.
 */
export const TROPHIES_PER_WIN = TUNED.trophiesPerWin;
export const TROPHIES_PER_LOSS = TUNED.trophiesPerLoss;

/** What each kind of chest holds. See docs/META.md. */
interface ChestKind {
  cards: number;
  diamonds: number;
  /** A rarity that is guaranteed to appear at least once. */
  guarantees?: Card["rarity"];
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

/**
 * The things a chest may hold that are not cards or diamonds.
 *
 * Deliberately the ids and not a database read: a chest is rolled inside a
 * match ending, and that must not wait on a query. The ids are the same ones
 * the shop sells (see the migration) and the same ones `ownedEmoji` and
 * `ownedCatchphrases` ask about — one name for one thing.
 *
 * A player who already holds one is not given it again; `treasureFor` checks.
 */
const TREASURES: readonly string[] = [
  ...EMOJI_PACKS.map((p) => p.id),
  ...CATCHPHRASES.filter((p) => p.item).map((p) => p.item!),
];

/**
 * Something from the shop, if this chest rolled one and there is anything
 * left to give. Null is the ordinary answer.
 */
function treasureFor(spec: ChestKind, owned?: ReadonlySet<string>): string | null {
  if (!spec.treasure || Math.random() >= spec.treasure) return null;
  // Never a duplicate: a pack you already own is worth nothing, and "you won
  // a thing you have" is a worse moment than winning no thing at all.
  const left = TREASURES.filter((id) => !owned?.has(id));
  return left.length ? left[Math.floor(Math.random() * left.length)]! : null;
}

/** Only real, collectable monsters — the filler that pads a board is not a prize. */
function collectableCards(): Card[] {
  return [...CATALOG.values()].filter((c) => c.id !== "crumb_demon" && Boolean(c.seriesId));
}

/**
 * How much more likely a card you ALREADY HAVE is than one you do not.
 *
 * Or, describing what should come out of a chest: *"diamonds, and every so
 * often cards as well — mostly more of the cards you already have, which is
 * what lets you upgrade them, since you need X copies of the same card to pay
 * diamonds and level it up. But rare ones too."*
 *
 * That is the whole economy in one sentence, and it is the opposite of how a
 * chest usually works. A chest that draws uniformly from the catalogue gives a
 * wide, shallow album: a hundred cards at one copy each and nothing to upgrade.
 * Weighting towards what you own makes a duplicate the NORMAL result and the
 * upgrade the thing it is for — while the draw still reaches the whole
 * catalogue, so a chest can always surprise you.
 *
 * Three is deliberately mild. At a 20-card album out of 60 it makes a
 * duplicate about half of every draw rather than a third; at a full album it
 * does nothing at all, because everything is a duplicate by then.
 */
const OWNED_WEIGHT = 3;

function weightOf(c: Card, owned?: ReadonlySet<string>): number {
  const base = RARITY_WEIGHT[c.rarity] ?? 1;
  return owned?.has(c.id) ? base * OWNED_WEIGHT : base;
}

function pickByRarity(pool: Card[], owned?: ReadonlySet<string>): Card | null {
  const total = pool.reduce((sum, c) => sum + weightOf(c, owned), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const c of pool) {
    roll -= weightOf(c, owned);
    if (roll <= 0) return c;
  }
  return pool[pool.length - 1] ?? null;
}

/**
 * Roll the contents of one chest: card ids, repeats allowed (copies matter).
 *
 * `owned` is the player's album, and it only ever tilts the draw — see
 * OWNED_WEIGHT. Left out, the draw is by rarity alone, which is what the
 * shop's grants and gifts do: those are not rewards for an album, they are
 * presents, and a present that is mostly things you already have is a worse
 * present.
 */
export function rollChest(
  kind: string,
  owned?: ReadonlySet<string>,
  /** Shop items this player holds, so a chest never gives one twice. */
  items?: ReadonlySet<string>,
): { cards: string[]; diamonds: number; items?: string[] } {
  const spec = CHESTS[kind] ?? CHESTS.wood!;
  const pool = collectableCards();
  const cards: string[] = [];
  if (spec.guarantees) {
    // The promised rarity is drawn WITHOUT the album tilt. It is the part of
    // the chest that is meant to be new; weighting it towards what you have
    // would turn the guarantee into another duplicate.
    const promised = pool.filter((c) => c.rarity === spec.guarantees);
    const one = pickByRarity(promised.length ? promised : pool);
    if (one) cards.push(one.id);
  }
  while (cards.length < spec.cards) {
    const c = pickByRarity(pool, owned);
    if (!c) break;
    cards.push(c.id);
  }
  const treasure = treasureFor(spec, items);
  return { cards, diamonds: spec.diamonds, ...(treasure ? { items: [treasure] } : {}) };
}

/**
 * Hand a chest's contents to a player: a copy of every card, and the diamonds.
 * Copies accumulate — a duplicate is the point, not a consolation.
 */
/**
 * Hand over what was inside. Called when a chest is OPENED, not when it is won.
 *
 * Exported because the opening now happens in the HTTP API, a minute or a week
 * after the match that earned it.
 */
export async function grantChest(
  sb: SupabaseClient,
  playerId: string,
  won: { cards: string[]; diamonds: number; items?: string[] },
) {
  return grant(sb, playerId, won as ReturnType<typeof rollChest>);
}

async function grant(sb: SupabaseClient, playerId: string, won: ReturnType<typeof rollChest>) {
  // Whatever else happens below, this album is about to be worth more.
  queueMicrotask(() => refreshAlbumPowerSoon(sb, playerId));
  /*
   * Anything from the shop that was in it.
   *
   * `ignoreDuplicates` rather than a check: opening a chest is one request and
   * a retried one must not fail on a row it already wrote. `source` says it
   * came from a chest, which is the question "what did we give away" that
   * player_items exists to answer.
   */
  if (won.items?.length)
    await sb.from("player_items").upsert(
      won.items.map((item_id) => ({ player_id: playerId, item_id, source: "chest" })),
      { onConflict: "player_id,item_id", ignoreDuplicates: true },
    );
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
      trophies_delta: winner ? TUNED.trophiesPerWin : 0,
    });

    if (winnerId) {
      const { data } = await sb
        .from("players")
        .select("trophies, best_trophies, diamonds")
        .eq("id", winnerId)
        .maybeSingle();
      const trophies = (data?.trophies ?? 0) + TUNED.trophiesPerWin;
      // Every third win is a better chest, so there is something to count towards.
      const kind = trophies % 90 === 0 ? "gold" : trophies % 30 === 0 ? "silver" : "wood";
      const won = rollChest(kind);
      await sb
        .from("players")
        .update({
          trophies,
          best_trophies: Math.max(data?.best_trophies ?? 0, trophies),
        })
        .eq("id", winnerId);
      /*
       * WON, NOT OPENED.
       *
       * Or asked for unopened chests on the home screen, and that cannot exist
       * if winning a chest also opens it — which is what used to happen, right
       * here, in the same breath as deciding it.
       *
       * What is INSIDE is still decided now, by this process, and written down.
       * That part is not negotiable: if the contents were rolled when the
       * player pressed "open", the client would be asking a server for a prize
       * at a moment the player controls. It is sealed at the moment it is won
       * and opening only breaks the seal.
       */
      await sb.from("chests").insert({
        player_id: winnerId,
        kind,
        opened_at: null,
        contents: won,
      });
    }

    if (loserId) {
      const { data } = await sb.from("players").select("trophies").eq("id", loserId).maybeSingle();
      // Losing costs less than winning pays, so an evening of play always
      // moves forward. Never below zero.
      await sb
        .from("players")
        .update({ trophies: Math.max(0, (data?.trophies ?? 0) - TUNED.trophiesPerLoss) })
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
