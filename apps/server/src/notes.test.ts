import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * **The box Or leaves fixes in, and the history behind it.**
 *
 * Or: *"leave me a free box to leave you fixes in, in free language. I will
 * tell you here in this chat to go over all the fixes I left you in the
 * arenas and the cards, and you will go over them, fix them, report what was
 * done, put it into the card's fix history in the admin interface, and clear
 * the box for me."*
 *
 * ═══ WHY THIS TABLE IS THE ONE THAT MUST NOT LEAK ═══
 *
 * Every other table beside it is content the game reads, and every one of
 * them grants `select` to anon on purpose — the arena names are on the home
 * screen before anybody signs in. This one holds unsent correspondence about
 * unfinished work, the game never reads a word of it, and the repository is
 * public. Copying the neighbouring migration's policy block would have been
 * the natural thing to do and would have published it.
 */
const ADMIN = readFileSync(fileURLToPath(new URL("./admin.ts", import.meta.url)), "utf8");
const DIR = fileURLToPath(new URL("../../../db/migrations", import.meta.url));
const SQL = readFileSync(
  `${DIR}/${readdirSync(DIR).find((f) => f.includes("fix_notes"))!}`,
  "utf8",
);

/** One endpoint's handler, from its `case` to the next one. */
function handler(path: string): string {
  const from = ADMIN.indexOf(`case "${path}"`);
  expect(from, `no handler for ${path}`).toBeGreaterThan(-1);
  const next = ADMIN.indexOf("\n    case \"", from + 10);
  return ADMIN.slice(from, next === -1 ? undefined : next);
}

describe("the table", () => {
  it("is not readable from a browser at all", () => {
    expect(SQL).toContain("alter table public.fix_notes enable row level security");
    expect(SQL).toContain("revoke all on public.fix_notes from anon, authenticated");
    // ⚠ The failure mode: a policy copied from arena_overrides, which grants
    // select to anon because the GAME needs the arena names.
    expect(SQL, "a read policy would publish it").not.toMatch(/create policy[\s\S]*fix_notes/);
  });

  it("allows one open note per thing, and a history behind it", () => {
    expect(SQL).toContain("create unique index if not exists fix_notes_one_open");
    expect(SQL).toContain("where status = 'open'");
    // Resolving must not delete: the report is the half worth keeping.
    expect(SQL).toContain("done_note text");
    expect(SQL).toContain("done_at timestamptz");
  });

  it("covers both of the things Or said he would leave notes on", () => {
    expect(SQL).toContain("check (scope in ('card', 'arena'))");
  });

  it("does not make the target a foreign key", () => {
    // Cards live in data/series/*.json and arenas in arenas.ts; the database
    // deliberately does not know what either is (db/README.md).
    const target = SQL.slice(SQL.indexOf("target text not null"), SQL.indexOf("note text"));
    expect(target).not.toContain("references");
  });
});

describe("the endpoints", () => {
  it("reads every note in one request", () => {
    expect(handler("/api/admin/notes")).toContain('.from("fix_notes")');
    // Reads are not written into the admin audit trail.
    expect(ADMIN.slice(ADMIN.indexOf("const READ_ONLY"), ADMIN.indexOf("if (!READ_ONLY"))).toContain(
      '"/api/admin/notes",',
    );
  });

  /*
   * ⚠ AN EMPTY BOX IS NOT AN EMPTY NOTE. Clearing the text means "never
   * mind", and storing a blank open row instead of deleting it would show a
   * card as having something waiting and then say nothing when it is opened
   * — a dot that leads to a blank, forever.
   */
  it("deletes the open note when the box is cleared", () => {
    const body = handler("/api/admin/notes/save");
    expect(body).toContain("if (!note) {");
    expect(body).toContain('await sb.from("fix_notes").delete().eq("id", open.data.id)');
  });

  it("updates the open note rather than starting a second one", () => {
    const body = handler("/api/admin/notes/save");
    expect(body).toContain('.eq("status", "open")');
    expect(body).toContain('.update({ note })');
  });

  /*
   * A note that moves to "done" with nothing written against it is the same
   * as a note that was deleted — and the history is the half of this feature
   * that is worth having.
   */
  it("refuses to resolve a note without saying what was done", () => {
    const body = handler("/api/admin/notes/resolve");
    expect(body).toContain("if (!id || !doneNote)");
    expect(body).toContain('.eq("status", "open")');
  });

  it("keeps the note itself when it resolves one", () => {
    const body = handler("/api/admin/notes/resolve");
    expect(body).not.toContain(".delete()");
    expect(body).toContain('status: "done"');
  });
});
