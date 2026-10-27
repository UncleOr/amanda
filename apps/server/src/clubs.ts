/**
 * Clubs.
 *
 * Or: *"card swapping — not such a big deal. Make another button on the home
 * board for 'Club'. Opens a popup. Anyone can found a club and send an
 * invitation to friends, or join an existing club by a 6-digit code…"*
 *
 * Every rule lives here, because the tables have no write policy at all —
 * same as `friends` and `reports`. There is no second path to any of them.
 *
 * ═══ THE THREE THAT ARE ABOUT CHILDREN AND NOT ABOUT CLUBS ═══
 *
 *   A MESSAGE THAT BREAKS THE RULES NEVER LANDS. The filter runs before the
 *   insert, so there is nothing to delete and nothing for anybody else to
 *   have seen in between. What IS written is a row in `reports`, which a
 *   human reads — the list is the fast half, the report is the half that is
 *   actually right. See shared/clubs.ts.
 *
 *   A DONATION CANNOT COST THE GIVER A CARD. `copies` is the spare change
 *   above the level a card is already at, so moving one can never reach the
 *   card. `level` is never read here and never written.
 *
 *   A CLUB IS NOT A PLACE STRANGERS ARE. The only way in is a code somebody
 *   gave you, and the only list of members is of a club you are already in.
 *   There is no search, exactly as there is no search for friends.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLUB_CHALLENGES,
  CLUB_CHAT_KEEP,
  CLUB_CODE_LENGTH,
  DEFAULT_EMBLEM,
  DONATIONS_PER_REQUEST,
  MAX_CLUB_MEMBERS,
  REQUEST_EVERY_HOURS,
  WARNINGS_BEFORE_REMOVAL,
  canSpare,
  checkClubName,
  checkMessage,
  isFreeEmblem,
  periodKey,
  shownAvatar,
  shownName,
  type ClubChallenge,
} from "@amanda/shared";

/* ───────────────────────── what the popup shows ───────────────────────── */

export interface ClubMemberRow {
  id: string;
  /*
   * Never null. `shownName` and `shownAvatar` return null only when they are
   * given no player id to fall back on, and here there is always one — these
   * are the automatic handle and face the versus screen uses, because nine
   * players in ten have never chosen either and a club of blanks is the same
   * bug as an opponent called "somebody".
   */
  nickname: string;
  avatar: string;
  trophies: number;
  online: boolean;
  owner: boolean;
}

export interface ClubMessageRow {
  id: number;
  playerId: string;
  nickname: string;
  avatar: string;
  body: string;
  at: string;
}

export interface ClubRequestRow {
  id: number;
  playerId: string;
  nickname: string;
  cardId: string;
  filled: number;
  of: number;
  /** Have I already given to this one? Then there is no button. */
  mine: boolean;
  gave: boolean;
}

export interface ClubChallengeRow extends ClubChallenge {
  amount: number;
  /** My own share, which is what decides whether I am paid. */
  contributed: number;
  done: boolean;
  claimed: boolean;
}

export interface ClubView {
  id: string;
  code: string;
  name: string;
  emblem: string;
  owner: boolean;
  members: ClubMemberRow[];
  messages: ClubMessageRow[];
  requests: ClubRequestRow[];
  challenges: ClubChallengeRow[];
  /** Emblems this club may wear: the free ones plus anything bought. */
  emblems: string[];
}

/* ───────────────────────── membership ───────────────────────── */

interface Membership {
  clubId: string;
  warnings: number;
  seenAt: string;
}

/** Which club is this player in, if any? */
export async function membershipOf(
  sb: SupabaseClient,
  playerId: string,
): Promise<Membership | null> {
  const { data } = await sb
    .from("club_members")
    .select("club_id, warnings, seen_at")
    .eq("player_id", playerId)
    .maybeSingle();
  return data
    ? { clubId: data.club_id as string, warnings: data.warnings as number, seenAt: data.seen_at as string }
    : null;
}

/**
 * Are these two in the same club?
 *
 * Used by the match server before a one-click battle, exactly as `areFriends`
 * is used before an invitation — Or: *"club members can have a battle in one
 * click if both are connected."* The relationship is checked against the
 * database rather than trusted from the message, for the same reason: without
 * it, this is a way to make any child's screen light up on demand.
 */
export async function sameClub(
  sb: SupabaseClient,
  playerId: string,
  otherId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("club_members")
    .select("player_id, club_id")
    .in("player_id", [playerId, otherId]);
  if ((data?.length ?? 0) !== 2) return false;
  return data![0]!.club_id === data![1]!.club_id;
}

/** Does this player own a club? The shop asks, before showing emblems. */
export async function ownsAClub(sb: SupabaseClient, playerId: string): Promise<boolean> {
  const { data } = await sb.from("clubs").select("id").eq("owner_id", playerId).maybeSingle();
  return !!data;
}

/* ───────────────────────── founding and joining ───────────────────────── */

/**
 * Six digits nobody has.
 *
 * Tried rather than computed: a million codes against a handful of clubs
 * means the first pick is almost always free, and the loop is the honest way
 * to say "almost".
 */
async function freeCode(sb: SupabaseClient): Promise<string | null> {
  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(Math.random() * 10 ** CLUB_CODE_LENGTH)).padStart(
      CLUB_CODE_LENGTH,
      "0",
    );
    const { data } = await sb.from("clubs").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return null;
}

export async function createClub(
  sb: SupabaseClient,
  playerId: string,
  name: string,
): Promise<string | null> {
  if (await membershipOf(sb, playerId)) return "club.no";
  const check = checkClubName(name);
  if (!check.ok) return "club.name";

  const code = await freeCode(sb);
  if (!code) return "retry";

  const { data, error } = await sb
    .from("clubs")
    .insert({ code, name: name.trim(), emblem: DEFAULT_EMBLEM, owner_id: playerId })
    .select("id")
    .maybeSingle();
  if (error || !data) return "retry";

  const joined = await sb
    .from("club_members")
    .insert({ player_id: playerId, club_id: data.id });
  if (joined.error) {
    // Do not leave a club with nobody in it standing about.
    await sb.from("clubs").delete().eq("id", data.id);
    return "retry";
  }
  return null;
}

export async function joinClub(
  sb: SupabaseClient,
  playerId: string,
  code: string,
): Promise<string | null> {
  if (await membershipOf(sb, playerId)) return "club.no";
  const clean = code.replace(/\D/g, "");
  if (clean.length !== CLUB_CODE_LENGTH) return "club.code";

  const { data: club } = await sb.from("clubs").select("id").eq("code", clean).maybeSingle();
  // Deliberately the same answer as a wrong code: a club that exists and a
  // club that does not must be indistinguishable, or this is a way to walk
  // the space and learn which codes are real.
  if (!club) return "club.code";

  const { count } = await sb
    .from("club_members")
    .select("player_id", { count: "exact", head: true })
    .eq("club_id", club.id);
  if ((count ?? 0) >= MAX_CLUB_MEMBERS) return "club.full";

  const { error } = await sb
    .from("club_members")
    .insert({ player_id: playerId, club_id: club.id });
  return error ? "retry" : null;
}

/**
 * Leaving, and what happens to a club whose owner walks out.
 *
 * Or: *"the manager can also close the club and then all the members go back
 * to the state of having no club. The manager can also decide to bequeath
 * the club to somebody of his choosing. If he chooses to leave and not to
 * delete, and also did not choose anybody — it will pass to the club member
 * with the highest number of trophies."*
 *
 * So an owner leaving never destroys a club by accident. Closing it is its
 * own button.
 */
export async function leaveClub(sb: SupabaseClient, playerId: string): Promise<string | null> {
  const me = await membershipOf(sb, playerId);
  if (!me) return "club.no";

  const { data: club } = await sb
    .from("clubs")
    .select("id, owner_id")
    .eq("id", me.clubId)
    .maybeSingle();

  if (club && club.owner_id === playerId) {
    const heir = await highestTrophies(sb, me.clubId, playerId);
    if (heir) await sb.from("clubs").update({ owner_id: heir }).eq("id", me.clubId);
    else {
      // The last person out turns the lights off. A club with no members is
      // not a club, and leaving one behind would hold its code for ever.
      await sb.from("clubs").delete().eq("id", me.clubId);
      return null;
    }
  }
  await sb.from("club_members").delete().eq("player_id", playerId);
  return null;
}

/** The member with the most trophies, not counting the one on their way out. */
async function highestTrophies(
  sb: SupabaseClient,
  clubId: string,
  except: string,
): Promise<string | null> {
  const { data: members } = await sb
    .from("club_members")
    .select("player_id")
    .eq("club_id", clubId);
  const ids = (members ?? []).map((m) => m.player_id as string).filter((id) => id !== except);
  if (!ids.length) return null;
  const { data } = await sb
    .from("players")
    .select("id, trophies")
    .in("id", ids)
    .order("trophies", { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

/** Hand it over on purpose. Owner only, and only to somebody already in it. */
export async function bequeathClub(
  sb: SupabaseClient,
  playerId: string,
  heirId: string,
): Promise<string | null> {
  const club = await ownedClub(sb, playerId);
  if (!club) return "club.no";
  if (heirId === playerId) return "club.no";
  const theirs = await membershipOf(sb, heirId);
  if (!theirs || theirs.clubId !== club.id) return "club.no";
  const { error } = await sb.from("clubs").update({ owner_id: heirId }).eq("id", club.id);
  return error ? "retry" : null;
}

/** Shut it. Everybody goes back to having no club — the cascade does it. */
export async function closeClub(sb: SupabaseClient, playerId: string): Promise<string | null> {
  const club = await ownedClub(sb, playerId);
  if (!club) return "club.no";
  const { error } = await sb.from("clubs").delete().eq("id", club.id);
  return error ? "retry" : null;
}

async function ownedClub(
  sb: SupabaseClient,
  playerId: string,
): Promise<{ id: string } | null> {
  const me = await membershipOf(sb, playerId);
  if (!me) return null;
  const { data } = await sb
    .from("clubs")
    .select("id, owner_id")
    .eq("id", me.clubId)
    .maybeSingle();
  return data && data.owner_id === playerId ? { id: data.id as string } : null;
}

/** The two things an owner may change. */
export async function dressClub(
  sb: SupabaseClient,
  playerId: string,
  patch: { name?: string; emblem?: string },
): Promise<string | null> {
  const club = await ownedClub(sb, playerId);
  if (!club) return "club.no";

  const update: Record<string, string> = {};
  if (typeof patch.name === "string") {
    const check = checkClubName(patch.name);
    if (!check.ok) return "club.name";
    update.name = patch.name.trim();
  }
  if (typeof patch.emblem === "string") {
    // A bought emblem is a row in player_items; a free one needs nothing.
    if (!isFreeEmblem(patch.emblem) && !(await ownsEmblem(sb, playerId, patch.emblem))) {
      return "club.no";
    }
    update.emblem = patch.emblem;
  }
  if (!Object.keys(update).length) return null;
  const { error } = await sb.from("clubs").update(update).eq("id", club.id);
  return error ? "retry" : null;
}

async function ownsEmblem(sb: SupabaseClient, playerId: string, emblem: string): Promise<boolean> {
  const { data } = await sb
    .from("player_items")
    .select("item_id")
    .eq("player_id", playerId)
    .eq("item_id", `emblem.${emblem}`)
    .maybeSingle();
  return !!data;
}

/** Every emblem this player may put on their club. */
async function emblemsFor(sb: SupabaseClient, playerId: string): Promise<string[]> {
  const { data } = await sb
    .from("player_items")
    .select("item_id")
    .eq("player_id", playerId)
    .like("item_id", "emblem.%");
  return (data ?? []).map((r) => (r.item_id as string).slice("emblem.".length));
}

/* ───────────────────────── the chat ───────────────────────── */

/**
 * Say something, or be told why not.
 *
 * Or: *"swear words and curses and sensitive words are deleted immediately,
 * a second warning throws the person out of the club. In any case a report
 * is received by the game's admins."*
 *
 * The returned string is what the player is shown — and it is the ONLY
 * message this whole feature writes, because he also said: *"do not write
 * all these explanations to the user. The user sees only buttons. Give
 * messages only for critical things."*
 */
export async function postMessage(
  sb: SupabaseClient,
  playerId: string,
  body: string,
): Promise<{ error: string | null; removed?: boolean }> {
  const me = await membershipOf(sb, playerId);
  if (!me) return { error: "club.no" };

  const check = checkMessage(body);
  if (check.ok) {
    const { error } = await sb
      .from("club_messages")
      .insert({ club_id: me.clubId, player_id: playerId, body: body.trim() });
    return { error: error ? "retry" : null };
  }
  if (check.reason === "empty" || check.reason === "long") return { error: "club.no" };

  /*
   * A human sees every one of these. The list is a fast guess and it will
   * be wrong sometimes in both directions, which is exactly why a catch is
   * a warning with the reason said out loud rather than a ban.
   */
  await sb.from("reports").insert({
    kind: "chat",
    reporter_id: playerId,
    reported_id: playerId,
    message: `[club ${me.clubId}] ${check.reason}: ${body.slice(0, 200)}`,
  });

  const warnings = me.warnings + 1;
  if (warnings >= WARNINGS_BEFORE_REMOVAL) {
    await leaveClub(sb, playerId);
    return { error: "club.removed", removed: true };
  }
  await sb.from("club_members").update({ warnings }).eq("player_id", playerId);
  return { error: "club.warned" };
}

/** Report a member to the grown-ups. The same table the rest of the game uses. */
export async function reportMember(
  sb: SupabaseClient,
  playerId: string,
  aboutId: string,
  note: string,
): Promise<string | null> {
  const me = await membershipOf(sb, playerId);
  const them = await membershipOf(sb, aboutId);
  if (!me || !them || me.clubId !== them.clubId) return "club.no";
  const { error } = await sb.from("reports").insert({
    kind: "player",
    reporter_id: playerId,
    reported_id: aboutId,
    message: `[club ${me.clubId}] ${note.slice(0, 200)}`,
  });
  return error ? "retry" : null;
}

/* ───────────────────────── asking, and giving ───────────────────────── */

export async function askForCard(
  sb: SupabaseClient,
  playerId: string,
  cardId: string,
): Promise<string | null> {
  const me = await membershipOf(sb, playerId);
  if (!me) return "club.no";
  if (!cardId) return "club.no";

  // One open request each, and not more often than every few hours — a
  // request everybody has already answered is not worth looking at.
  const since = new Date(Date.now() - REQUEST_EVERY_HOURS * 3600_000).toISOString();
  const { data: recent } = await sb
    .from("club_requests")
    .select("id, closed_at")
    .eq("player_id", playerId)
    .gte("created_at", since)
    .limit(1);
  if (recent?.length) return "club.asked";

  const { error } = await sb
    .from("club_requests")
    .insert({ club_id: me.clubId, player_id: playerId, card_id: cardId });
  return error ? "retry" : null;
}

/**
 * Give one copy.
 *
 * Or: *"you donate a card only if you already have it — this slows down your
 * next upgrade but a card will never be taken from you and never
 * downgraded."*
 *
 * `copies` is the spare change above the level the card is already at, so
 * spending one cannot reach the card. `level` is not read in this function
 * and not written by it, which is the strongest way to say that.
 */
export async function donateCard(
  sb: SupabaseClient,
  playerId: string,
  requestId: number,
): Promise<string | null> {
  const me = await membershipOf(sb, playerId);
  if (!me) return "club.no";

  const { data: request } = await sb
    .from("club_requests")
    .select("id, club_id, player_id, card_id, filled, closed_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.club_id !== me.clubId) return "club.no";
  if (request.closed_at) return "club.no";
  if (request.player_id === playerId) return "club.no";

  const { data: mine } = await sb
    .from("player_cards")
    .select("copies")
    .eq("player_id", playerId)
    .eq("card_id", request.card_id)
    .maybeSingle();
  if (!canSpare(mine as { copies: number } | undefined)) return "club.noSpare";

  /*
   * The donation row FIRST, because its primary key is (request, donor) —
   * so two presses race into one insert and the loser is told it already
   * gave rather than giving twice. Writing the cards first would make that
   * race cost somebody a copy.
   */
  const claimed = await sb
    .from("club_donations")
    .insert({ request_id: requestId, donor_id: playerId });
  if (claimed.error) return "club.gave";

  await sb
    .from("player_cards")
    .update({ copies: (mine as { copies: number }).copies - 1 })
    .eq("player_id", playerId)
    .eq("card_id", request.card_id);

  const { data: theirs } = await sb
    .from("player_cards")
    .select("copies")
    .eq("player_id", request.player_id)
    .eq("card_id", request.card_id)
    .maybeSingle();
  if (theirs) {
    await sb
      .from("player_cards")
      .update({ copies: (theirs.copies as number) + 1 })
      .eq("player_id", request.player_id)
      .eq("card_id", request.card_id);
  } else {
    await sb
      .from("player_cards")
      .insert({ player_id: request.player_id, card_id: request.card_id, copies: 1, level: 1 });
  }

  const filled = (request.filled as number) + 1;
  await sb
    .from("club_requests")
    .update({
      filled,
      closed_at: filled >= DONATIONS_PER_REQUEST ? new Date().toISOString() : null,
    })
    .eq("id", requestId);
  return null;
}

/* ───────────────────────── the club's challenges ───────────────────────── */

/**
 * Count something towards the club, for one member.
 *
 * Called from progress.ts when a match ends. Two rows: the club's total and
 * this member's share — and the share is the one that matters, because it is
 * what decides who gets paid. See the note in shared/clubs.ts.
 */
export async function creditClub(
  sb: SupabaseClient,
  playerId: string,
  kind: ClubChallenge["kind"],
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const me = await membershipOf(sb, playerId);
  if (!me) return;

  for (const ch of CLUB_CHALLENGES) {
    if (ch.kind !== kind) continue;
    const period = periodKey(ch.period);
    await bump(sb, "club_progress", { club_id: me.clubId, challenge_id: ch.id, period }, amount);
    await bump(
      sb,
      "club_contributions",
      { club_id: me.clubId, challenge_id: ch.id, period, player_id: playerId },
      amount,
    );
  }
}

/**
 * Add to a counter that may not exist yet.
 *
 * Read-then-write rather than an upsert with an expression, because
 * PostgREST cannot do `amount = amount + n`. The race costs at most one
 * match's worth of progress on a shared counter, which is a fair price for
 * not adding a stored procedure to a schema nobody else has to read.
 */
async function bump(
  sb: SupabaseClient,
  table: string,
  key: Record<string, string>,
  amount: number,
): Promise<void> {
  let q = sb.from(table).select("amount");
  for (const [k, v] of Object.entries(key)) q = q.eq(k, v);
  const { data } = await q.maybeSingle();
  await sb.from(table).upsert({ ...key, amount: (data?.amount ?? 0) + amount });
}

/**
 * Take the chest a finished club challenge owes you.
 *
 * Paid to CONTRIBUTORS only, once each per period. Both halves are the
 * answer to Or's *"we need to decide how to do this cleverly so there are
 * not too many prizes"*: the claim row makes it once, and the contribution
 * check makes it the people who played rather than everybody wearing the
 * badge.
 */
export async function claimClubChest(
  sb: SupabaseClient,
  playerId: string,
  challengeId: string,
  grant: (kind: "wood" | "silver" | "gold") => Promise<void>,
): Promise<string | null> {
  const me = await membershipOf(sb, playerId);
  if (!me) return "club.no";
  const ch = CLUB_CHALLENGES.find((c) => c.id === challengeId);
  if (!ch) return "club.no";
  const period = periodKey(ch.period);

  const { data: progress } = await sb
    .from("club_progress")
    .select("amount")
    .eq("club_id", me.clubId)
    .eq("challenge_id", ch.id)
    .eq("period", period)
    .maybeSingle();
  if ((progress?.amount ?? 0) < ch.target) return "club.no";

  const { data: share } = await sb
    .from("club_contributions")
    .select("amount")
    .eq("club_id", me.clubId)
    .eq("challenge_id", ch.id)
    .eq("period", period)
    .eq("player_id", playerId)
    .maybeSingle();
  if ((share?.amount ?? 0) <= 0) return "club.no";

  // The ledger first, for the same reason the donation row goes first.
  const { error } = await sb
    .from("club_claims")
    .insert({ club_id: me.clubId, challenge_id: ch.id, period, player_id: playerId });
  if (error) return "club.no";

  await grant(ch.chest);
  return null;
}

/**
 * The automatic handle and face for somebody whose player row did not come
 * back — a race against a delete, almost always.
 *
 * `shownName` and `shownAvatar` return null only when given no id to fall
 * back on, and there is always one here, so the `?? ""` never fires. It is
 * there because the signature allows null and a cast would be a lie.
 */
function named(id: string): { nickname: string; avatar: string; trophies: number } {
  return {
    nickname: shownName(null, id) ?? "",
    avatar: shownAvatar(null, id) ?? "",
    trophies: 0,
  };
}

/* ───────────────────────── the whole popup, in one read ───────────────────────── */

export async function clubView(
  sb: SupabaseClient,
  playerId: string,
  isOnline: (id: string) => boolean,
): Promise<ClubView | null> {
  const me = await membershipOf(sb, playerId);
  if (!me) return null;

  const { data: club } = await sb
    .from("clubs")
    .select("id, code, name, emblem, owner_id")
    .eq("id", me.clubId)
    .maybeSingle();
  if (!club) return null;

  const [{ data: members }, { data: messages }, { data: requests }] = await Promise.all([
    sb.from("club_members").select("player_id, joined_at").eq("club_id", club.id),
    sb
      .from("club_messages")
      .select("id, player_id, body, created_at")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false })
      .limit(CLUB_CHAT_KEEP),
    sb
      .from("club_requests")
      .select("id, player_id, card_id, filled")
      .eq("club_id", club.id)
      .is("closed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const ids = (members ?? []).map((m) => m.player_id as string);
  const { data: people } = await sb
    .from("players")
    .select("id, nickname, avatar, trophies")
    .in("id", ids.length ? ids : ["-"]);
  const by = new Map(
    (people ?? []).map((p) => [
      p.id as string,
      {
        nickname: shownName(p.nickname as string | null, p.id as string) ?? "",
        avatar: shownAvatar(p.avatar as string | null, p.id as string) ?? "",
        trophies: (p.trophies as number) ?? 0,
      },
    ]),
  );
  const who = (id: string) => by.get(id) ?? named(id);

  // Which open requests have I already answered?
  const { data: gave } = await sb
    .from("club_donations")
    .select("request_id")
    .eq("donor_id", playerId)
    .in("request_id", (requests ?? []).map((r) => r.id as number).concat([-1]));
  const given = new Set((gave ?? []).map((g) => g.request_id as number));

  return {
    id: club.id as string,
    code: club.code as string,
    name: club.name as string,
    emblem: club.emblem as string,
    owner: club.owner_id === playerId,
    members: ids
      .map((id) => ({
        id,
        ...who(id),
        online: isOnline(id),
        owner: id === club.owner_id,
      }))
      .sort((a, b) => Number(b.online) - Number(a.online) || b.trophies - a.trophies),
    messages: (messages ?? [])
      .map((m) => ({
        id: m.id as number,
        playerId: m.player_id as string,
        nickname: who(m.player_id as string).nickname,
        avatar: who(m.player_id as string).avatar,
        body: m.body as string,
        at: m.created_at as string,
      }))
      .reverse(),
    requests: (requests ?? []).map((r) => ({
      id: r.id as number,
      playerId: r.player_id as string,
      nickname: who(r.player_id as string).nickname,
      cardId: r.card_id as string,
      filled: r.filled as number,
      of: DONATIONS_PER_REQUEST,
      mine: r.player_id === playerId,
      gave: given.has(r.id as number),
    })),
    challenges: await challengeRows(sb, club.id as string, playerId),
    emblems: await emblemsFor(sb, playerId),
  };
}

async function challengeRows(
  sb: SupabaseClient,
  clubId: string,
  playerId: string,
): Promise<ClubChallengeRow[]> {
  const periods = CLUB_CHALLENGES.map((c) => periodKey(c.period));
  const [{ data: progress }, { data: shares }, { data: claims }] = await Promise.all([
    sb.from("club_progress").select("challenge_id, period, amount").eq("club_id", clubId),
    sb
      .from("club_contributions")
      .select("challenge_id, period, amount")
      .eq("club_id", clubId)
      .eq("player_id", playerId),
    sb
      .from("club_claims")
      .select("challenge_id, period")
      .eq("club_id", clubId)
      .eq("player_id", playerId),
  ]);
  const key = (c: string, p: string) => `${c}|${p}`;
  const total = new Map(
    (progress ?? []).map((r) => [key(r.challenge_id as string, r.period as string), r.amount as number]),
  );
  const mine = new Map(
    (shares ?? []).map((r) => [key(r.challenge_id as string, r.period as string), r.amount as number]),
  );
  const took = new Set(
    (claims ?? []).map((r) => key(r.challenge_id as string, r.period as string)),
  );

  return CLUB_CHALLENGES.map((c, i) => {
    const k = key(c.id, periods[i]!);
    const amount = total.get(k) ?? 0;
    return {
      ...c,
      amount,
      contributed: mine.get(k) ?? 0,
      done: amount >= c.target,
      claimed: took.has(k),
    };
  });
}

/**
 * Is there anything in there I have not seen?
 *
 * Or: *"if there is a message or a challenge or something new in the club —
 * there is a green dot next to it on the home screen."*
 *
 * One cheap question, asked every time the home screen draws: a message
 * newer than my last look, or a club challenge finished and unclaimed. Open
 * the popup and `seen_at` moves, which is what puts the dot out.
 */
export async function clubHasNews(sb: SupabaseClient, playerId: string): Promise<boolean> {
  const me = await membershipOf(sb, playerId);
  if (!me) return false;

  const { count } = await sb
    .from("club_messages")
    .select("id", { count: "exact", head: true })
    .eq("club_id", me.clubId)
    .gt("created_at", me.seenAt);
  if ((count ?? 0) > 0) return true;

  const rows = await challengeRows(sb, me.clubId, playerId);
  return rows.some((r) => r.done && !r.claimed && r.contributed > 0);
}

/** The popup was opened, so nothing in it is new any more. */
export async function markClubSeen(sb: SupabaseClient, playerId: string): Promise<void> {
  await sb
    .from("club_members")
    .update({ seen_at: new Date().toISOString() })
    .eq("player_id", playerId);
}
