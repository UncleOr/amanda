/**
 * ═══ THE PRIZE TUNNEL, FROM THE SIDE THAT PAYS ═══
 *
 * Or: *"it works by trophies. It adds little prize stations between the
 * arenas: cards, new cards, chests, a pile of diamonds, avatars, and anything
 * you can get in the shop."*
 *
 * Everything about WHAT is on the track is in packages/shared/src/tunnel.ts,
 * read by both sides so the picture a child is looking at and the thing that
 * is handed over cannot disagree. This file is the three questions only a
 * server may answer:
 *
 *   HOW FAR UP is this player        — best_trophies, which only goes up
 *   WHAT HAS BEEN TAKEN already      — tunnel_claims
 *   MAY THEY HAVE THIS ONE           — and if so, hand it over exactly once
 *
 * ⚠ THE LAST ONE IS AN INSERT, NOT A CHECK. "Read whether it is claimed, then
 * claim it" is two statements with a gap in the middle, and a child tapping a
 * button on a slow phone is a machine for finding that gap. The primary key
 * on (player_id, stop, lane) is the lock: the second insert loses, and the
 * loser is told it was already claimed rather than being paid again.
 */
import {
  TUNNEL,
  canClaim,
  stopsReached,
  tunnelGives,
  type TunnelLane,
} from "@amanda/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bestTrophiesOf, rollChest } from "./progress.js";
import { deliver } from "./shop.js";

export interface TunnelState {
  /** The high-water mark the track is measured against. */
  best: number;
  /** How many stops are open. */
  reached: number;
  /** Which stops have been taken, by lane. */
  claimed: Array<{ stop: number; lane: TunnelLane }>;
}

export async function tunnelState(sb: SupabaseClient, playerId: string): Promise<TunnelState> {
  const best = await bestTrophiesOf(sb, playerId);
  const { data } = await sb
    .from("tunnel_claims")
    .select("stop, lane")
    .eq("player_id", playerId);
  return {
    best,
    reached: stopsReached(best),
    claimed: (data ?? []).map((r) => ({ stop: r.stop as number, lane: r.lane as TunnelLane })),
  };
}

export type TunnelClaim =
  | { ok: true; stop: number; lane: TunnelLane }
  | { ok: false; why: "noSuchStop" | "locked" | "claimed" | "notForSale" };

/**
 * Take one prize.
 *
 * `why` is deliberately a short list of names rather than sentences: the
 * words a child reads are the client's, and this is a server that does not
 * speak Hebrew.
 */
export async function claimStop(
  sb: SupabaseClient,
  playerId: string,
  stop: number,
  lane: TunnelLane,
): Promise<TunnelClaim> {
  const gives = tunnelGives(stop, lane);
  if (!gives || !TUNNEL[stop]) return { ok: false, why: "noSuchStop" };
  // The Legendary Pass is not for sale, so nothing may be taken from its lane
  // — however the request got here. See PASS_FOR_SALE.
  if (!canClaim(lane)) return { ok: false, why: "notForSale" };

  const best = await bestTrophiesOf(sb, playerId);
  if (best < TUNNEL[stop]!.at) return { ok: false, why: "locked" };

  /*
   * The insert IS the check. `ignoreDuplicates` turns the race into a row
   * count: whoever wrote the row pays out, and anybody else is told it has
   * already been taken.
   */
  const { data: won, error } = await sb
    .from("tunnel_claims")
    .upsert({ player_id: playerId, stop, lane }, { onConflict: "player_id,stop,lane", ignoreDuplicates: true })
    .select("stop");
  if (error) return { ok: false, why: "claimed" };
  if (!won?.length) return { ok: false, why: "claimed" };

  /*
   * ═══ AND ONLY NOW IS ANYTHING HANDED OVER ═══
   *
   * Through the same one door as a purchase, a gift and a promotion
   * (shop.ts), so "what did we give away" has one answer and the album total
   * is refreshed the same way.
   *
   * ⚠ EXCEPT A CHEST, WHICH ARRIVES SHUT. `deliver` rolls a chest and hands
   * over what was inside it, which is right for a gift — the inbox has
   * already said what it is — and wrong here for the same reason it is wrong
   * for a bought chest: the lid, and the cards coming out one at a time, is
   * the prize. So it is sealed onto the shelf exactly the way a chest won in
   * a match is, and the rest of the station's gift goes through the door.
   */
  if (gives.chest) {
    await sb.from("chests").insert({
      player_id: playerId,
      kind: gives.chest,
      opened_at: null,
      contents: rollChest(best, gives.chest),
    });
    await deliver(sb, playerId, { ...gives, chest: undefined }, `tunnel:${lane}`);
  } else {
    await deliver(sb, playerId, gives, `tunnel:${lane}`);
  }
  return { ok: true, stop, lane };
}
