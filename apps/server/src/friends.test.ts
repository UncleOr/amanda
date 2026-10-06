import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { acceptFriend, addableOpponents, askFriend, listFriends } from "./friends.js";
import * as reports from "./reports.js";

/**
 * The two rules that make a friends list safe for a seven-year-old.
 *
 *   YOU MAY ONLY ASK SOMEBODY YOU HAVE PLAYED — there is no search by name,
 *   in either direction.
 *   AND THEY HAVE TO SAY YES — otherwise "add" is a way to watch whether a
 *   particular child is online.
 *
 * Both are enforced in friends.ts and nowhere else: the table has no write
 * policy at all, so this module IS the gate. These tests are the gate's lock.
 *
 * The database is a stand-in. What is being checked is the decisions, not
 * Postgres — the constraints and row-level security were checked against the
 * live schema separately (see db/migrations).
 */

/** A very small stand-in for the parts of supabase-js this module touches. */
function fakeDb(tables: Record<string, unknown[]>) {
  const inserted: Array<{ table: string; rows: unknown }> = [];
  const query = (table: string) => {
    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const k of ["select", "eq", "or", "in", "order", "limit"]) self[k] = chain;
    self.maybeSingle = () => Promise.resolve({ data: (tables[table] ?? [])[0] ?? null });
    self.insert = (rows: unknown) => {
      inserted.push({ table, rows });
      return Promise.resolve({ error: null });
    };
    self.upsert = (rows: unknown) => {
      inserted.push({ table, rows });
      return Promise.resolve({ error: null });
    };
    self.delete = () => ({ or: () => Promise.resolve({ error: null }) });
    // Awaiting the chain yields the rows, which is how supabase-js behaves.
    self.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: tables[table] ?? [], count: (tables[table] ?? []).length, error: null });
    return self;
  };
  return { sb: { from: query } as unknown as SupabaseClient, inserted };
}

const ME = "11111111-1111-1111-1111-111111111111";
const PLAYED = "22222222-2222-2222-2222-222222222222";
const STRANGER = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(reports, "isRegistered").mockResolvedValue(true);
  vi.spyOn(reports, "recentOpponents").mockResolvedValue([
    { id: PLAYED, nickname: "מי ששיחקתי מולו", matchId: "m1", at: "2026-10-06T00:00:00Z" },
  ]);
});

describe("you may only ask somebody you have played", () => {
  it("refuses a stranger, and writes nothing", async () => {
    const { sb, inserted } = fakeDb({ friends: [] });
    const err = await askFriend(sb, ME, STRANGER);
    expect(err).toBe("אפשר להוסיף רק מישהו ששיחקת מולו.");
    expect(inserted).toHaveLength(0);
  });

  it("allows somebody you have played", async () => {
    const { sb, inserted } = fakeDb({ friends: [] });
    expect(await askFriend(sb, ME, PLAYED)).toBeNull();
    expect(inserted).toEqual([
      { table: "friends", rows: { player_id: ME, friend_id: PLAYED, status: "pending" } },
    ]);
  });

  it("refuses yourself before anything else", async () => {
    const { sb, inserted } = fakeDb({ friends: [] });
    expect(await askFriend(sb, ME, ME)).toBe("זה אתה.");
    expect(inserted).toHaveLength(0);
  });

  it("offers nobody when you have not played anybody", async () => {
    vi.spyOn(reports, "recentOpponents").mockResolvedValue([]);
    const { sb } = fakeDb({ friends: [] });
    expect(await addableOpponents(sb, ME)).toEqual([]);
  });

  it("offers only people who are not on the list already", async () => {
    const { sb } = fakeDb({ friends: [{ player_id: ME, friend_id: PLAYED, status: "pending" }] });
    expect(await addableOpponents(sb, ME)).toEqual([]);
  });
});

describe("an account at both ends", () => {
  it("refuses when you have no real account", async () => {
    vi.spyOn(reports, "isRegistered").mockResolvedValue(false);
    const { sb, inserted } = fakeDb({ friends: [] });
    expect(await askFriend(sb, ME, PLAYED)).toContain("צריך חשבון");
    expect(inserted).toHaveLength(0);
  });
});

describe("asking twice, and asking back", () => {
  it("says so rather than asking again", async () => {
    const { sb, inserted } = fakeDb({
      friends: [{ player_id: ME, friend_id: PLAYED, status: "pending" }],
    });
    expect(await askFriend(sb, ME, PLAYED)).toBe("כבר ביקשת. מחכים שיאשרו.");
    expect(inserted).toHaveLength(0);
  });

  it("asking somebody who already asked YOU accepts instead", async () => {
    const { sb, inserted } = fakeDb({
      friends: [{ player_id: PLAYED, friend_id: ME, status: "pending" }],
    });
    expect(await askFriend(sb, ME, PLAYED)).toBeNull();
    // Both rows, both accepted: "am I theirs" and "are they mine" can never
    // disagree, which is the only reason to write two.
    expect(inserted[0]?.rows).toEqual([
      { player_id: PLAYED, friend_id: ME, status: "accepted" },
      { player_id: ME, friend_id: PLAYED, status: "accepted" },
    ]);
  });

  it("already friends is not an error worth a second row", async () => {
    const { sb, inserted } = fakeDb({
      friends: [{ player_id: ME, friend_id: PLAYED, status: "accepted" }],
    });
    expect(await askFriend(sb, ME, PLAYED)).toBe("אתם כבר חברים.");
    expect(inserted).toHaveLength(0);
  });
});

describe("accepting", () => {
  it("refuses when nobody asked — you cannot accept your way in", async () => {
    const { sb, inserted } = fakeDb({ friends: [] });
    expect(await acceptFriend(sb, ME, STRANGER)).toBe("אין בקשה כזאת.");
    expect(inserted).toHaveLength(0);
  });
});

describe("the list", () => {
  it("separates my friends, who I asked, and who is asking me", async () => {
    const { sb } = fakeDb({
      friends: [
        { player_id: ME, friend_id: "a", status: "accepted" },
        { player_id: ME, friend_id: "b", status: "pending" },
        { player_id: "c", friend_id: ME, status: "pending" },
      ],
      players: [],
    });
    const list = await listFriends(sb, ME, (id) => id === "a");
    const by = Object.fromEntries(list.map((f) => [f.id, f.state]));
    expect(by).toEqual({ a: "friend", b: "asked", c: "asking" });
    expect(list.find((f) => f.id === "a")?.online).toBe(true);
    expect(list.find((f) => f.id === "b")?.online).toBe(false);
  });

  it("puts whoever is waiting for an answer at the top", async () => {
    const { sb } = fakeDb({
      friends: [
        { player_id: ME, friend_id: "a", status: "accepted" },
        { player_id: "c", friend_id: ME, status: "pending" },
      ],
      players: [],
    });
    const list = await listFriends(sb, ME, () => false);
    expect(list[0]?.state).toBe("asking");
  });
});
