import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * **The arenas reach this process, not only the browser.**
 *
 * The series rows are loaded here and ignored — `live.ts` says so, and it is
 * right: a shelf in an album is nothing to do with a match. The arenas are
 * the opposite case, and it is worth pinning why.
 *
 * `familyOpen` decides which families a chest may pay out of, and `groundFor`
 * decides which family fights 20% harder in a match. Both read ARENAS. So a
 * server still holding the shipped ladder while a browser holds Or's would
 * pay out a card the album refuses to show, and fight a match on ground the
 * two sides disagree about — and the result is the server's, so the child is
 * the one who is wrong.
 */
const LIVE = readFileSync(fileURLToPath(new URL("./live.ts", import.meta.url)), "utf8");
const API = readFileSync(fileURLToPath(new URL("./api.ts", import.meta.url)), "utf8");
const ADMIN = readFileSync(fileURLToPath(new URL("./admin.ts", import.meta.url)), "utf8");

/** The whole of the save handler, from its `case` to the next one. */
function saveCase(): string {
  const from = ADMIN.indexOf('case "/api/admin/arenas/save"');
  return ADMIN.slice(from, ADMIN.indexOf('case "/api/admin/arenas/revert"', from));
}

describe("loading the arenas", () => {
  it("reads the table", () => {
    expect(LIVE).toContain('sb.from("arena_overrides").select("id, data")');
  });

  it("applies them to this process's own ladder", () => {
    expect(LIVE).toContain("liveState.arenas = applyArenaOverrides(arenaRows);");
  });

  it("hands them to the browser in the same request as everything else", () => {
    // One fetch at boot, not a fifth endpoint. Same arrangement the phrases,
    // the shelves, the dials and the tutorial already have.
    expect(API).toContain("arenas: arenaOverrides(),");
  });

  it("reloads the moment the panel saves one", () => {
    expect(saveCase()).toContain("await refreshLive();");
  });
});

describe("the panel cannot put one family in two places", () => {
  /*
   * ⚠ THE CHECK THAT CANNOT LIVE ONLY IN THE BROWSER. The dropdown greys out
   * a family that is taken, which holds until somebody has two tabs open on
   * the panel — or until a request is made by hand. `familyOpen` takes the
   * FIRST arena that claims a family, so the loser of a clash silently
   * becomes a rung that says it introduces somebody and does not.
   */
  it("refuses a family another arena already has", () => {
    const body = saveCase();
    expect(body).toContain("const taken = ARENAS.find((a) => a.id !== id && a.introduces === to);");
    // Said in Hebrew somebody would actually say: the family's name rather
    // than its id, and the preposition through `atArena` so ב and ה collapse.
    expect(body).toContain("atArena(taken.name.he)");
    expect(body).toContain("SERIES_NAMES.get(to)?.he ?? to");
  });

  it("refuses a family that does not exist", () => {
    expect(saveCase().slice(0, saveCase().indexOf("upsert"))).toContain("!SERIES_NAMES.has(to)");
  });

  it("refuses an arena that does not exist", () => {
    expect(saveCase().slice(0, saveCase().indexOf("upsert"))).toContain(
      "const arena = ARENAS.find((a) => a.id === id);",
    );
  });

  it("reads the arena list without being an admin's write", () => {
    // GET-shaped routes are listed as read-only so they are not written into
    // the admin audit trail as actions somebody took.
    expect(ADMIN).toContain('"/api/admin/arenas",');
  });
});
