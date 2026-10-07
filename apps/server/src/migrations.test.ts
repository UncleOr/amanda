import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The migrations folder is the schema, and it has to stay shaped like one.
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * For the first sixteen migrations it did not. They were applied straight to
 * Supabase and never written down, so the only copy of the schema was in the
 * cloud — while db/README.md said the folder was the source of truth. They
 * have now been pulled back out of `supabase_migrations.schema_migrations`
 * and checked statement-for-statement against what actually ran.
 *
 * Four of them came back with a surprise: the files that DID exist were named
 * with timestamps I had invented rather than the `version` Supabase recorded.
 * That is not cosmetic. `supabase db push` decides what still needs running by
 * comparing that number, so a file named a few hours wrong looks like a
 * migration that has never run — and the push tries `create table` on a table
 * full of people's albums.
 *
 * None of that is checkable from here (these tests have no database). What IS
 * checkable is the shape, which is where every one of those problems showed
 * up first: a name that is not a version, two files claiming one version, or
 * an ordering that does not match the filenames.
 */
const DIR = fileURLToPath(new URL("../../../db/migrations", import.meta.url));

/** `20261005191701_players_collection_and_trophies.sql` */
const NAMED = /^(\d{14})_[a-z0-9_]+\.sql$/;
/** A one-off data fix that never went through the migration mechanism. */
const DATA = /^(\d{14})_[a-z0-9_]+\.data\.sql$/;

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql"));
const schema = files.filter((f) => !f.endsWith(".data.sql"));

describe("the migrations folder", () => {
  it("has migrations in it — if this is zero the rest of the file is lying", () => {
    expect(schema.length).toBeGreaterThan(15);
  });

  it("names every file after the version Supabase recorded", () => {
    for (const f of schema)
      expect(
        NAMED.test(f),
        `${f} is not <14-digit version>_<name>.sql. The version is what ` +
          `supabase db push compares against; a file named anything else looks to it ` +
          `like a migration that has never run.`,
      ).toBe(true);
    for (const f of files.filter((f) => f.endsWith(".data.sql")))
      expect(DATA.test(f), `${f} is not <version>_<name>.data.sql`).toBe(true);
  });

  it("gives each version to exactly one file", () => {
    const seen = new Map<string, string>();
    for (const f of files) {
      const version = f.slice(0, 14);
      expect(seen.has(version), `${f} and ${seen.get(version)} share a version`).toBe(false);
      seen.set(version, f);
    }
  });

  it("replays in filename order", () => {
    // `readdir` is not required to sort, and the order these run in is the
    // order the schema was built in — a table before the column added to it.
    const versions = schema.map((f) => f.slice(0, 14));
    expect([...versions].sort()).toEqual(versions.slice().sort());
    for (let i = 1; i < versions.length; i++)
      expect(Number(versions[i])).toBeGreaterThan(Number(versions[i - 1]!));
  });

  it("writes something in every one of them", () => {
    for (const f of files) {
      const body = readFileSync(`${DIR}/${f}`, "utf8");
      const statements = body
        .replace(/--[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      expect(statements.length, `${f} is all comment and no SQL`).toBeGreaterThan(0);
    }
  });

  /*
   * Not a style rule. Every table in this schema is read-own-rows-only and
   * written by the server alone, and the one time that was assumed rather
   * than written down, a signed-in player set their own trophies to 99999 —
   * because row-level security governs ROWS and a blanket update grant had
   * been left on the columns. A migration that creates a table and does not
   * mention security is a migration that forgot.
   */
  it("says something about security in every migration that creates a table", () => {
    for (const f of schema) {
      const body = readFileSync(`${DIR}/${f}`, "utf8");
      if (!/create table/i.test(body)) continue;
      expect(
        /row level security|revoke|grant|create policy/i.test(body),
        `${f} creates a table and never mentions RLS, a grant or a policy. ` +
          `Every table here is read-own-rows and server-written; saying so is the ` +
          `one thing that stops the next one being open by accident.`,
      ).toBe(true);
    }
  });
});
