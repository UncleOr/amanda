import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ARENAS } from "@amanda/shared";

/**
 * **Every extra mode belongs to a place on the ladder.**
 *
 * Or named all four in one message: *"Amanda is not a peek, she is simply
 * locked, with a small caption under the padlock (opens at the Fuel Stop).
 * 2v2 we will open at the train station. Mirror deck at the alley. The draft
 * at the court."* Then he moved one: *"and fine, let mirror deck open at the
 * garage."*
 *
 * Which is the thing worth pinning, because it is the only reason the shelf
 * is not a list of promises: a mode is not "coming soon", it is somewhere you
 * have not been yet. Read out of the source as text, the way every other
 * component rule in this project is — there is no jsdom here.
 */
const SRC = readFileSync(
  fileURLToPath(new URL("../components/MoreModes.tsx", import.meta.url)),
  "utf8",
);

/** `id: "duo"` … `opensAt: "station"` — the pairing, straight out of the file. */
function gates(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of SRC.split(/\n\s*\{\n/)) {
    const id = block.match(/id: "([a-z]+)"/);
    const at = block.match(/opensAt: "([a-z]+)"/);
    if (id && at) out[id[1]!] = at[1]!;
  }
  return out;
}

describe("the shelf of extra modes", () => {
  it("opens each mode where Or said it opens", () => {
    expect(gates()).toEqual({
      amanda: "fuel",
      mirror: "garage",
      duo: "station",
      draft: "court",
    });
  });

  it("lists them in the order they open, like the album", () => {
    // Or: *"and sort the modes by order of appearance."* The same rule the
    // album got an hour earlier, and for the same reason: a shelf ordered by
    // nothing in particular puts the one you can almost reach at the bottom.
    const order = [...SRC.matchAll(/opensAt: "([a-z]+)"/g)].map((m) => m[1]!);
    const at = (id: string) => ARENAS.find((a) => a.id === id)!.from;
    for (let i = 1; i < order.length; i++)
      expect(at(order[i]!), `${order[i]} should not come after ${order[i - 1]}`)
        .toBeGreaterThanOrEqual(at(order[i - 1]!));
  });

  it("names only arenas that exist", () => {
    const known = new Set(ARENAS.map((a) => a.id));
    for (const [mode, arena] of Object.entries(gates()))
      expect(known.has(arena), `${mode} opens at "${arena}", which is not an arena`).toBe(true);
  });

  /*
   * ⚠ THE ONE THAT WOULD BE A SILENT BUG. A mode whose arena is locked can
   * never open, however much anybody plays — and Amanda's gate is the Fuel
   * Stop, which was locked until the hour he asked about it. Her mode would
   * have been a padlock pointing at another padlock.
   */
  it("never hangs a mode on an arena nobody can reach", () => {
    for (const [mode, id] of Object.entries(gates())) {
      const arena = ARENAS.find((a) => a.id === id)!;
      expect(arena.locked, `${mode} opens at ${id}, which is shut`).toBeFalsy();
    }
  });

  it("draws the padlock the rest of the game draws", () => {
    // Not an icon of its own: a second lock glyph is a second visual language
    // for one idea.
    expect(SRC).toContain('import { Lock } from "./SignedInOnly"');
    expect(SRC).toContain("<Lock />");
  });

  it("says where, and does not conjugate a verb for four different nouns", () => {
    // `atArena` collapses the preposition into the article — בתחנת הדלק, not
    // בהתחנת הדלק — and carries no gender, which "נפתח/נפתחת" cannot.
    expect(SRC).toContain("atArena(say(gate.name))");
  });

  it("leaves no mode with neither a gate nor a reason", () => {
    // Every row is either placed on the ladder or honestly marked "soon".
    const rows = SRC.split(/\n\s*\{\n/).filter((b) => /id: "[a-z]+"/.test(b) && /blurb:/.test(b));
    expect(rows.length).toBe(4);
    for (const row of rows)
      expect(/opensAt:/.test(row) || /soon: true/.test(row), row.slice(0, 60)).toBe(true);
  });
});
