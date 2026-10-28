import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INVITE_SECONDS } from "@amanda/shared";
import { answerAtDoor, donateCard, joinClub, makeInvite, postMessage } from "./clubs.js";

/**
 * **The club rules that would be worth a bug report each.**
 *
 * Every one of them is enforced in clubs.ts and nowhere else: none of the
 * eight club tables has a write policy, so this module IS the gate. These
 * tests are the gate's lock.
 *
 * The database is a stand-in, as it is in friends.test.ts. What is being
 * checked is the decisions, not Postgres — the constraints and the row-level
 * security were checked against the schema separately (db/migrations).
 */

interface Call {
  table: string;
  op: "insert" | "update" | "upsert" | "delete";
  rows: unknown;
}

/** A small stand-in for the parts of supabase-js this module touches. */
function fakeDb(tables: Record<string, unknown[]>, failing: string[] = []) {
  const calls: Call[] = [];
  const query = (table: string) => {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const k of ["select", "eq", "or", "in", "is", "gte", "gt", "like", "order", "limit"])
      self[k] = chain;
    self.maybeSingle = () => Promise.resolve({ data: (tables[table] ?? [])[0] ?? null });
    /*
     * A write in supabase-js is still a builder: `.update({...}).eq(...)`.
     * So this returns something that is both awaitable and chainable, which
     * is what the first version of this fake got wrong.
     */
    const write = (op: Call["op"]) => (rows: unknown) => {
      calls.push({ table, op, rows });
      const error = failing.includes(table) ? { message: "duplicate key" } : null;
      const out = { error, data: null };
      const after: Record<string, unknown> = {};
      for (const k of ["eq", "in", "or", "is", "match"]) after[k] = () => after;
      /*
       * `.select()` after a write is both awaitable and single-able, because
       * both are used: an insert reads back its new id, and a delete reads
       * back the rows it actually removed — which is how "one-time" is
       * decided, so the harness has to be able to say "none".
       */
      after.select = () => {
        const rows = failing.includes(table) ? [] : [{ id: "new" }];
        const out: Record<string, unknown> = {
          maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error }),
        };
        for (const k of ["eq", "in", "or", "is", "match"]) out[k] = () => out;
        out.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error });
        return out;
      };
      after.then = (resolve: (v: unknown) => unknown) => resolve(out);
      return after;
    };
    self.insert = write("insert");
    self.update = write("update");
    self.upsert = write("upsert");
    self.delete = write("delete");
    self.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: tables[table] ?? [], count: (tables[table] ?? []).length, error: null });
    return self;
  };
  return { sb: { from: query } as unknown as SupabaseClient, calls };
}

const IN_A_CLUB = [{ club_id: "c1", warnings: 0, seen_at: "2026-10-01T00:00:00Z" }];

/* ───────────────────────── the chat ───────────────────────── */

describe("a message that breaks the rules", () => {
  /*
   * It never lands. The filter runs BEFORE the insert, so there is nothing
   * to delete afterwards and nothing for anybody else to have seen in
   * between — which is a stronger promise than "deleted immediately", and
   * it is the one Or actually wants.
   */
  it("is never written down", async () => {
    const { sb, calls } = fakeDb({ club_members: IN_A_CLUB });
    await postMessage(sb, "p1", "you are a bitch");
    expect(calls.some((c) => c.table === "club_messages")).toBe(false);
  });

  it("reaches a human instead", async () => {
    // Or: "in any case a report is received by the game's admins."
    const { sb, calls } = fakeDb({ club_members: IN_A_CLUB });
    await postMessage(sb, "p1", "you are a bitch");
    expect(calls.find((c) => c.table === "reports")).toBeTruthy();
  });

  it("warns the first time", async () => {
    const { sb, calls } = fakeDb({ club_members: IN_A_CLUB });
    const said = await postMessage(sb, "p1", "חרא");
    expect(said.error).toBe("club.warned");
    expect(calls.find((c) => c.table === "club_members" && c.op === "update")).toBeTruthy();
  });

  it("removes the second time", async () => {
    // Or: "a second warning throws the person out of the club."
    const { sb } = fakeDb({
      club_members: [{ club_id: "c1", warnings: 1, seen_at: "2026-10-01T00:00:00Z" }],
      clubs: [{ id: "c1", owner_id: "someone-else" }],
    });
    const said = await postMessage(sb, "p1", "חרא");
    expect(said.error).toBe("club.removed");
    expect(said.removed).toBe(true);
  });

  it("lets an ordinary message through", async () => {
    const { sb, calls } = fakeDb({ club_members: IN_A_CLUB });
    const said = await postMessage(sb, "p1", "בואו נשחק");
    expect(said.error).toBe(null);
    expect(calls.find((c) => c.table === "club_messages")).toBeTruthy();
  });
});

/* ───────────────────────── giving a card ───────────────────────── */

describe("donating a card", () => {
  const REQUEST = [
    { id: 7, club_id: "c1", player_id: "p2", card_id: "dragons_01_flame_dragon", filled: 0, closed_at: null },
  ];

  it("is refused when the giver has no spare copy", async () => {
    /*
     * Or: *"you only donate a card if you already have it — this slows down
     * your next upgrade but a card will never be taken from you and never
     * downgraded."* A player at level 3 with 0 spare copies has the card
     * and cannot give it, which is the distinction that matters.
     */
    const { sb, calls } = fakeDb({
      club_members: IN_A_CLUB,
      club_requests: REQUEST,
      player_cards: [{ copies: 0, level: 3 }],
    });
    expect(await donateCard(sb, "p1", 7)).toBe("club.noSpare");
    expect(calls.some((c) => c.table === "player_cards")).toBe(false);
  });

  it("never touches the giver's level", async () => {
    const { sb, calls } = fakeDb({
      club_members: IN_A_CLUB,
      club_requests: REQUEST,
      player_cards: [{ copies: 2, level: 3 }],
    });
    await donateCard(sb, "p1", 7);
    const writes = calls.filter((c) => c.table === "player_cards");
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      const row = w.rows as Record<string, unknown>;
      // An insert for somebody who had none at all carries level: 1, which
      // is them getting the card rather than a level being changed.
      if (w.op === "update") expect(row).not.toHaveProperty("level");
    }
  });

  /*
   * ⚠ Two presses must give once. The donation row goes in FIRST, and its
   * primary key is (request, donor) — so the loser of the race is told it
   * already gave rather than being charged a second copy. Writing the cards
   * first would make that race cost somebody a card.
   */
  it("claims the donation before it moves any card", async () => {
    const { sb, calls } = fakeDb({
      club_members: IN_A_CLUB,
      club_requests: REQUEST,
      player_cards: [{ copies: 2, level: 1 }],
    });
    await donateCard(sb, "p1", 7);
    const donation = calls.findIndex((c) => c.table === "club_donations");
    const cards = calls.findIndex((c) => c.table === "player_cards");
    expect(donation).toBeGreaterThanOrEqual(0);
    expect(donation, "the claim comes first").toBeLessThan(cards);
  });

  it("gives nothing when the claim is already taken", async () => {
    const { sb, calls } = fakeDb(
      {
        club_members: IN_A_CLUB,
        club_requests: REQUEST,
        player_cards: [{ copies: 2, level: 1 }],
      },
      ["club_donations"],
    );
    expect(await donateCard(sb, "p1", 7)).toBe("club.gave");
    expect(calls.some((c) => c.table === "player_cards")).toBe(false);
  });

  it("is refused from outside the club", async () => {
    const { sb } = fakeDb({
      club_members: [{ club_id: "OTHER", warnings: 0, seen_at: "2026-10-01T00:00:00Z" }],
      club_requests: REQUEST,
    });
    // Collapsed into the one refusal the popup never offers a button for.
    expect(await donateCard(sb, "p1", 7)).toBe("club.no");
  });
});

/* ───────────────────────── getting in ───────────────────────── */

describe("the only way through the door", () => {
  const LIVE = [{ code: "123456", club_id: "c1" }];

  it("refuses six digits that no live invitation matches", async () => {
    // Nothing in club_invites: a wrong code, an expired one and one that was
    // spent a second ago all arrive here, and all get the same answer.
    const { sb, calls } = fakeDb({ club_invites: [] });
    expect(await joinClub(sb, "p9", "123456")).toBe("club.code");
    expect(calls.some((c) => c.table === "club_members")).toBe(false);
  });

  /*
   * ⚠ The ordering IS the one-time promise. The invitation is deleted before
   * the row that uses it exists, so two children typing the same six digits
   * in the same second cannot both get in — the loser's delete removes
   * nothing and is turned away. The same shape as a donation's claim.
   */
  it("spends the invitation before it seats anybody", async () => {
    const { sb, calls } = fakeDb({ club_invites: LIVE });
    expect(await joinClub(sb, "p9", "123456")).toBe(null);
    const spent = calls.findIndex((c) => c.table === "club_invites" && c.op === "delete");
    const seated = calls.findIndex((c) => c.table === "club_members");
    expect(spent).toBeGreaterThanOrEqual(0);
    expect(spent, "the invitation is spent first").toBeLessThan(seated);
  });

  it("seats them in the queue, not in the club", async () => {
    // Or: "and the manager will also have to approve their entry."
    const { sb, calls } = fakeDb({ club_invites: LIVE });
    await joinClub(sb, "p9", "123456");
    const row = calls.find((c) => c.table === "club_members")?.rows as Record<string, unknown>;
    expect(row.state).toBe("pending");
  });

  it("turns away the loser of a race for the same code", async () => {
    // The delete removed nothing, so somebody else had it.
    const { sb, calls } = fakeDb({ club_invites: LIVE }, ["club_invites"]);
    expect(await joinClub(sb, "p9", "123456")).toBe("club.code");
    expect(calls.some((c) => c.table === "club_members")).toBe(false);
  });

  it("makes one code at a time, and kills the club's others first", async () => {
    const { sb, calls } = fakeDb({ club_members: IN_A_CLUB, club_invites: [] });
    const made = await makeInvite(sb, "p1");
    expect(made.error).toBe(null);
    expect(made.code).toMatch(/^\d{6}$/);
    const killed = calls.findIndex((c) => c.table === "club_invites" && c.op === "delete");
    const made_ = calls.findIndex((c) => c.table === "club_invites" && c.op === "insert");
    expect(killed).toBeGreaterThanOrEqual(0);
    expect(killed, "the old ones go before the new one arrives").toBeLessThan(made_);
  });

  it("gives it thirty seconds and not a day", async () => {
    const { sb } = fakeDb({ club_members: IN_A_CLUB, club_invites: [] });
    const made = await makeInvite(sb, "p1");
    const left = new Date(made.until!).getTime() - Date.now();
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(INVITE_SECONDS * 1000 + 1000);
  });

  it("is refused to somebody with no club", async () => {
    const { sb, calls } = fakeDb({ club_members: [] });
    expect((await makeInvite(sb, "nobody")).error).toBe("club.no");
    expect(calls.some((c) => c.table === "club_invites")).toBe(false);
  });

  it("lets the owner say yes", async () => {
    const { sb, calls } = fakeDb({
      club_members: IN_A_CLUB,
      clubs: [{ id: "c1", owner_id: "p1" }],
    });
    expect(await answerAtDoor(sb, "p1", "p9", true)).toBe(null);
    const seat = calls.find((c) => c.table === "club_members" && c.op === "update");
    expect((seat?.rows as Record<string, unknown>).state).toBe("member");
  });

  it("and say no, which removes the row rather than keeping a refusal", async () => {
    const { sb, calls } = fakeDb({
      club_members: IN_A_CLUB,
      clubs: [{ id: "c1", owner_id: "p1" }],
    });
    expect(await answerAtDoor(sb, "p1", "p9", false)).toBe(null);
    expect(calls.some((c) => c.table === "club_members" && c.op === "delete")).toBe(true);
  });

  it("is nobody else's answer to give", async () => {
    const { sb, calls } = fakeDb({
      club_members: IN_A_CLUB,
      clubs: [{ id: "c1", owner_id: "somebody-else" }],
    });
    expect(await answerAtDoor(sb, "p1", "p9", true)).toBe("club.no");
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });
});

/* ───────────────────────── the shape of the module ───────────────────────── */

const SRC = readFileSync(fileURLToPath(new URL("./clubs.ts", import.meta.url)), "utf8");

describe("what the module refuses to know", () => {
  /*
   * The two filters a stand-in database cannot check, because the stand-in
   * ignores every `.eq`. They are read out of the source instead, which is
   * weaker than a behaviour and much stronger than nothing — both are one
   * deleted line away from a club anybody can walk into.
   */
  it("only ever counts a live invitation", () => {
    const join = SRC.slice(SRC.indexOf("export async function joinClub"));
    const lookup = join.slice(join.indexOf('from("club_invites")'));
    expect(lookup.slice(0, lookup.indexOf("maybeSingle"))).toContain('gt("expires_at"');
  });

  it("only ever counts a member as being in a club", () => {
    const of = SRC.slice(SRC.indexOf("export async function membershipOf"));
    expect(of.slice(0, of.indexOf("return data"))).toContain('eq("state", "member")');
  });

  it("never reads or writes a card's level except to create one", () => {
    /*
     * The strongest way to say "a card is never downgraded" is that the
     * word does not appear anywhere that could do it. Comments are stripped
     * first, because three of the five mentions in this file are the
     * sentences PROMISING that — counting those was this test's own first
     * failure.
     */
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const levels = [...code.matchAll(/level/g)].length;
    expect(levels, "one mention: the insert that creates a card at level 1").toBe(1);
    expect(code).toContain("copies: 1, level: 1");
  });

  it("answers a wrong code and a club-that-exists identically", () => {
    /*
     * Otherwise this is a way to walk a million codes and learn which ones
     * are real, which is the same hole the friends list closes by having no
     * search at all.
     */
    const join = SRC.slice(SRC.indexOf("export async function joinClub"));
    expect(join.slice(0, join.indexOf("const { count }"))).toContain('return "club.code"');
  });
});
