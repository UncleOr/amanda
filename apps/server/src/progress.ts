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
import {
  ARENAS,
  CATCHPHRASES,
  EMOJI_PACKS,
  LEVELS,
  arenaFor,
  familyOpen,
  mainsOf,
  TUNED,
  collectableCards as pickCollectable,
  type Card,
} from "@amanda/shared";
import { CATALOG } from "./content.js";
import { refreshAlbumPowerSoon } from "./albumPower.js";
import { notify } from "./notify.js";
/*
 * One client for the whole process. This module used to build its own, which
 * is how the admin endpoints came back to life while every match carried on
 * saving nothing — see supabase.ts.
 */
import { CAN_SAVE, db } from "./supabase.js";
import { creditClub, sameClub } from "./clubs.js";

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

/*
 * What each kind of chest holds moved to packages/shared/src/chests.ts, so
 * that the shop can say what is in one before you buy it — Or: *"when you
 * press a chest you should be able to see how many cards and what range of
 * diamonds you can get in it."* Re-exported here because this is where the
 * rest of the server has always asked.
 */
import { CHESTS, type ChestKind } from "@amanda/shared";
export { CHESTS, type ChestKind };

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

/**
 * Only real, collectable monsters.
 *
 * The rule moved to @amanda/shared, because this was one of three places
 * that each had their own version of it — and between them Amanda's card,
 * which is the opponent and not a prize, was being handed out in chests.
 * See collectable.ts.
 */
function collectableCards(): Card[] {
  return pickCollectable(CATALOG.values());
}

/**
 * === WHAT THIS PLAYER COULD BE GIVEN, WHICH IS NOT THE CATALOGUE ===
 *
 * Or: *"how can I have cards from the Strays series if I have not reached
 * the alley yet? That is a bug you need to deal with."*
 *
 * He could because this pool was the whole catalogue. Every family was in
 * every chest from the first evening, which quietly emptied the ladder of
 * the one thing it was for: *"at the court we meet the Slimes. Only
 * somebody who has reached the court for the first time can get a slime
 * card at all."*
 *
 * `best` is BEST trophies and never the current count - see familyOpen. A
 * player who climbs to the Court and then loses four matches has still met
 * the Slimes.
 */
function poolFor(best: number): Card[] {
  const open = collectableCards().filter((c) => familyOpen(c.seriesId, best));
  // A pool that has somehow emptied gives a chest with nothing in it, which
  // is worse than a chest from a family you have not been introduced to.
  return open.length ? open : collectableCards();
}

/** The high-water mark this player's chests are drawn against. */
export async function bestTrophiesOf(sb: SupabaseClient, playerId: string): Promise<number> {
  const { data } = await sb
    .from("players")
    .select("best_trophies, trophies")
    .eq("id", playerId)
    .maybeSingle();
  return Math.max(data?.best_trophies ?? 0, data?.trophies ?? 0);
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
  /** BEST trophies: which families this player has been introduced to. */
  best: number,
  kind: string,
  owned?: ReadonlySet<string>,
  /** Shop items this player holds, so a chest never gives one twice. */
  items?: ReadonlySet<string>,
): { cards: string[]; diamonds: number; items?: string[] } {
  const spec = CHESTS[kind] ?? CHESTS.wood!;
  const pool = poolFor(best);
  const cards: string[] = [];
  const has = new Set(owned ?? []);
  const met = new Set<string>();
  for (const id of has) {
    const c = CATALOG.get(id);
    if (c) met.add(c.seriesId);
  }

  /**
   * The card you MEET a family with.
   *
   * Or: *"the 2 main ones from each series, which are the first ones you
   * get."* Reaching a new arena is the one moment in this game that is
   * supposed to feel like an introduction, and a draw by rarity introduced
   * the Sea Dwellers with whichever of ten fish the dice found — usually not
   * one of the two that say their own name, and sometimes the Rock Clam,
   * which does not move.
   *
   * So a draw that lands on a family this album has nothing from is handed
   * back as one of that family's mains instead. It is a SWAP and not an
   * extra card: the chest still holds what it says on the lid, and the
   * rarity tilt is untouched for every family already met. By the third card
   * out of a family the draw is ordinary again.
   *
   * Only when `owned` is given — a shop grant or a gift has no album to
   * compare against and is not a reward for one (see the note on `owned`).
   */
  const introduce = (c: Card): Card => {
    if (!owned || met.has(c.seriesId)) return c;
    const next = mainsOf(c.seriesId).find((id) => !has.has(id));
    return (next && pool.find((p) => p.id === next)) || c;
  };

  if (spec.guarantees) {
    /*
     * The promised rarity is drawn WITHOUT the album tilt. It is the part of
     * the chest that is meant to be new; weighting it towards what you have
     * would turn the guarantee into another duplicate.
     *
     * ⚠ And it is drawn from the families you HAVE met, where that is
     * possible — the one case where `introduce` cannot help. Swapping a
     * guaranteed epic for a common main would break the promise on the lid;
     * leaving it alone would let an epic be the first card you ever see from
     * a family. Narrowing the pool keeps both: the guarantee is still a
     * guarantee, and a family is still introduced by its own mains.
     */
    const promised = pool.filter((c) => c.rarity === spec.guarantees);
    const known = promised.filter((c) => met.has(c.seriesId));
    const one = pickByRarity(known.length ? known : promised.length ? promised : pool);
    if (one) cards.push(one.id);
  }
  while (cards.length < spec.cards) {
    const c = pickByRarity(pool, owned);
    if (!c) break;
    const got = introduce(c);
    cards.push(got.id);
    has.add(got.id);
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
/**
 * Hand over a chest's contents, and say which cards had never been seen.
 *
 * Or: *"when I get a NEW card, make a bit of a celebration out of it. Pop up
 * a popup, some fireworks, announce a new card."*
 *
 * ═══ WHY THE SERVER ANSWERS THIS AND NOT THE BROWSER ═══
 *
 * The browser could compare the chest against the album it is holding, and it
 * would be wrong about it. The album in the browser was loaded at some earlier
 * moment, the server put these cards into the real one before the reveal ever
 * ran, and a reload anywhere in between turns "new" into "I already had it" or
 * the reverse. The only moment anybody can truthfully answer it is the one
 * below, where the row is read immediately before it is written — so that is
 * where it is answered.
 */
export async function grantChest(
  sb: SupabaseClient,
  playerId: string,
  won: { cards: string[]; diamonds: number; items?: string[] },
): Promise<string[]> {
  return grant(sb, playerId, won as ReturnType<typeof rollChest>);
}

async function grant(
  sb: SupabaseClient,
  playerId: string,
  won: ReturnType<typeof rollChest>,
): Promise<string[]> {
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
  /** Cards that had no row at all a moment ago. See grantChest. */
  const fresh: string[] = [];
  for (const [cardId, copies] of counts) {
    // Upsert-with-increment is not one call in PostgREST, so read then write.
    // A player opens one chest at a time, so there is nothing to race.
    const { data } = await sb
      .from("player_cards")
      .select("copies")
      .eq("player_id", playerId)
      .eq("card_id", cardId)
      .maybeSingle();
    if (!data) fresh.push(cardId);
    await sb
      .from("player_cards")
      .upsert(
        { player_id: playerId, card_id: cardId, copies: (data?.copies ?? 0) + copies },
        { onConflict: "player_id,card_id" },
      );
  }
  return fresh;
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

/**
 * What a finished match is worth to the two players' clubs.
 *
 * `wins` to the winner, `battles` to both when they are in the SAME club
 * (Or's *"there will also be challenges connected to that"*), and trophies
 * are not counted here: the pile is moved by awardMeta, which knows the
 * score and the opponent, and two places paying for one match is the bug
 * recordMatch was already cleaned up to avoid.
 */
async function creditForClub(opts: {
  a: string | null;
  b: string | null;
  winner: "A" | "B" | null;
}): Promise<void> {
  const sb = db();
  if (!sb) return;
  const { a, b, winner } = opts;
  const winnerId = winner === "A" ? a : winner === "B" ? b : null;
  try {
    if (winnerId) await creditClub(sb, winnerId, "wins", 1);
    if (a && b && (await sameClub(sb, a, b))) {
      await creditClub(sb, a, "battles", 1);
      await creditClub(sb, b, "battles", 1);
    }
  } catch {
    /* a counter is never worth failing a match over */
  }
}

export async function recordMatch(opts: {
  a: string | null;
  b: string | null;
  winner: "A" | "B" | null;
}): Promise<void> {
  const sb = db();
  if (!sb) return;
  /*
   * ═══ AND THE CLUB'S COUNTERS ═══
   *
   * Or: *"inside the club you also have the club's own challenges — reach
   * X trophies, get X cards — weekly, daily, monthly."*
   *
   * Credited per MEMBER as well as per club, because the member's share is
   * what decides who gets paid: a club of forty where six played pays six
   * chests. That is the whole answer to his *"we need to decide how to do
   * this cleverly so there are not too many prizes"*, and it lives in
   * shared/clubs.ts beside the targets.
   *
   * Fired and not awaited — a slow counter must never hold up the result
   * screen, and a club challenge that misses one match is a club challenge
   * that finishes a match later.
   */
  void creditForClub(opts);
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
      /*
       * ═══ THIS NO LONGER PAYS TROPHIES; IT READS THEM ═══
       *
       * It used to add a flat +30 here and take a flat −20 off the loser
       * below, which made it a second authority on a question that now has
       * one: `awardMeta` in meta.ts moved the pile before this ran, from a
       * rule that knows the score and the opponent (trophies.ts). Two
       * places paying for the same match is how a win against a person came
       * to be worth the same whether it was a rout or a coin toss — and,
       * once both existed, how it would have been paid twice.
       *
       * What stays here is everything that is ABOUT the win rather than
       * about the ladder: the chest, and the arena celebration, both of
       * which need to know where the pile landed.
       */
      const { data } = await sb
        .from("players")
        .select("trophies, best_trophies, diamonds")
        .eq("id", winnerId)
        .maybeSingle();
      const trophies = data?.trophies ?? 0;
      // Every third win is a better chest, so there is something to count towards.
      const kind = trophies % 90 === 0 ? "gold" : trophies % 30 === 0 ? "silver" : "wood";
      const bestNow = Math.max(data?.best_trophies ?? 0, trophies);
      const won = rollChest(bestNow, kind);
      /*
       * ═══ CLIMBING AN ARENA IS AN EVENT, AND IT PAYS ═══
       *
       * Or: *"I noticed I moved up an arena without any message on the
       * screen, a celebration, fireworks, a huge chest with loads of
       * presents I got for the occasion."*
       *
       * He is right that nothing happened, and he is right that something
       * should: the five arenas are the game's whole ladder and reaching one
       * was, until now, a number quietly changing in the corner.
       *
       * Measured against BEST trophies, not current ones. Trophies go DOWN on
       * a loss, so a player sitting on 150 would cross the Court's threshold
       * every other match and be paid for it every time. `best_trophies`
       * only ever goes up, so each arena pays exactly once in a lifetime.
       *
       * The prize grows with the rung — a gold chest either way, because
       * that is the "huge chest" he asked for, and diamonds that are worth
       * noticeably more at the top than at the bottom.
       */
      const bestBefore = data?.best_trophies ?? 0;
      const bestAfter = Math.max(bestBefore, trophies);
      const climbed =
        arenaFor(bestAfter).id !== arenaFor(bestBefore).id ? arenaFor(bestAfter) : null;
      const rung = climbed ? ARENAS.findIndex((a) => a.id === climbed.id) : 0;
      const prizeDiamonds = climbed ? 40 * rung : 0;

      await sb
        .from("players")
        .update({
          trophies,
          best_trophies: bestAfter,
          ...(prizeDiamonds ? { diamonds: (data?.diamonds ?? 0) + prizeDiamonds } : {}),
        })
        .eq("id", winnerId);

      if (climbed) {
        /*
         * The chest is sealed here like every other one — see below. It is a
         * SECOND chest on top of the match's own, which is the point: the
         * occasion is the thing being rewarded, not the win that happened to
         * carry you over the line.
         */
        await sb.from("chests").insert({
          player_id: winnerId,
          kind: "gold",
          opened_at: null,
          contents: rollChest(bestAfter, "gold"),
        });
        await notify(
          sb,
          winnerId,
          "gift",
          {
            he: `עלית ל${climbed.name.he}!`,
            en: `You have reached ${climbed.name.en}!`,
          },
          {
            he: `תיבת זהב ו-${prizeDiamonds} יהלומים מחכים לך.`,
            en: `A gold chest and ${prizeDiamonds} diamonds are waiting.`,
          },
        );
      }
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

    /*
     * The loser's trophies are not touched here either, for the same reason
     * — see the note above. `trophiesFor` takes them off, with the same
     * "never below zero" and the same single source of the number.
     */
    saves.succeeded++;
    saves.lastError = null;
  } catch (err) {
    // A match that finished is more important than a row that did not save.
    saves.lastError = (err as Error).message.slice(0, 300);
    console.error("[progress] could not record match", err);
  }
}

/*
 * ═══ TWO FRIENDS PLAY AT THE SAME LEVEL ═══
 *
 * Or: *"if two friends play, both albums' levels should be normalised to the
 * lower of the two. Whoever got cards will have rare cards, but the level
 * will be the same. No need to tell the users, just do it."*
 *
 * The matchmaker already stops a deep album meeting a thin one (albumPower,
 * matchmaking.ts) — but a private room does not go through the matchmaker.
 * That is the whole point of a private room: you play the person you chose.
 * So the one thing that makes two friends unplayable together, one of them
 * having spent a month upgrading, has to be handled here instead.
 *
 * The CAP is the lower player's highest card. Capping rather than setting:
 * nobody is ever handed a level they have not earned, and a card below the
 * cap still plays at its own level. When the gap is the one Or is worried
 * about — level 8 against level 1 — the cap is 1 and both boards fight at
 * their base stats, which is exactly the match he wants them to have.
 */
export async function topLevel(
  sb: SupabaseClient,
  playerId: string | null,
): Promise<number> {
  // A guest has no upgrades at all, so they are the floor.
  if (!playerId) return 1;
  try {
    const { data } = await sb
      .from("player_cards")
      .select("level")
      .eq("player_id", playerId)
      .order("level", { ascending: false })
      .limit(1)
      .maybeSingle();
    return Math.max(1, (data?.level as number) ?? 1);
  } catch {
    // Unknown is not the same as low: a database hiccup must not quietly
    // flatten somebody's album. 10 is the ceiling, so this caps nothing.
    return LEVELS.max;
  }
}
