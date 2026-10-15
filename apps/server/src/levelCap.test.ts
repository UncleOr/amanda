import { describe, expect, it } from "vitest";
import { topLevel } from "./progress.js";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Two friends fight at the same level.
 *
 * Or: *"if two friends play, normalise both albums' levels to the lower of
 * the two… no need to tell the users, just do it."*
 *
 * The matchmaker already keeps a deep album away from a thin one, but a
 * private room does not go through the matchmaker — that is what a private
 * room IS. So this is the only thing standing between two friends and a
 * month of upgrading.
 */

/** A database that answers with one row, or throws. */
const fake = (answer: { level: number } | null | "boom") =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => {
                if (answer === "boom") throw new Error("no database");
                return { data: answer };
              },
            }),
          }),
        }),
      }),
    }),
  }) as unknown as SupabaseClient;

describe("how high a player's cards go", () => {
  it("reads their best card", async () => {
    expect(await topLevel(fake({ level: 7 }), "someone")).toBe(7);
  });

  it("is 1 for somebody with no upgrades", async () => {
    expect(await topLevel(fake(null), "someone")).toBe(1);
  });

  it("is 1 for a guest, who has no album at all", async () => {
    expect(await topLevel(fake({ level: 9 }), null)).toBe(1);
  });

  /*
   * The failure direction matters. Unknown is not the same as low: a
   * database hiccup that returned 1 would quietly flatten somebody's album
   * and nobody would ever find out, because Or asked for this to be silent.
   * Returning the ceiling caps nothing.
   */
  it("caps nobody when the database cannot be reached", async () => {
    expect(await topLevel(fake("boom"), "someone")).toBe(10);
  });
});

describe("the cap the two of them share", () => {
  const cap = (a: number, b: number) => Math.min(a, b);

  it("is the lower of the two", () => {
    expect(cap(8, 1)).toBe(1);
    expect(cap(3, 5)).toBe(3);
  });

  it("changes nothing when they are level", () => {
    expect(cap(4, 4)).toBe(4);
  });
});
