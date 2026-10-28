import { afterEach, describe, expect, it } from "vitest";
import { ARENAS, applyArenaOverrides, familyOpen, type Arena } from "@amanda/shared";

/**
 * **The arena editor, and the one rule Or put in brackets.**
 *
 * He: *"give me an arena editor in the admin panel too — which pack opens in
 * them (packs that are already in another arena are blocked), and a name and
 * text in Hebrew and English."*
 *
 * The words are the easy half. The parenthesis is the half with teeth:
 * `introduces` decides when a family first appears in the album, whether a
 * chest may contain one of its cards at all, and where its shelf sits — so a
 * clash is not a muddle on a screen, it is a child being given a card the
 * album refuses to show.
 *
 * ARENAS is mutated in place by design (the browser and the server both apply
 * rows onto the shipped ladder), so every test here puts it back.
 */
const SHIPPED = JSON.parse(JSON.stringify(ARENAS)) as Arena[];
afterEach(() => {
  ARENAS.length = 0;
  ARENAS.push(...(JSON.parse(JSON.stringify(SHIPPED)) as Arena[]));
});

const at = (id: string) => ARENAS.find((a) => a.id === id)!;

describe("the words", () => {
  it("takes a name in both languages", () => {
    applyArenaOverrides([
      { id: "station", data: { name: { he: "התחנה המרכזית", en: "Central Station" } } },
    ]);
    expect(at("station").name).toEqual({ he: "התחנה המרכזית", en: "Central Station" });
  });

  it("keeps the language a row did not mention", () => {
    const was = at("pool").name.en;
    applyArenaOverrides([{ id: "pool", data: { name: { he: "הבריכה הנטושה" } } }]);
    expect(at("pool").name).toEqual({ he: "הבריכה הנטושה", en: was });
  });

  /*
   * An empty box is somebody midway through typing, or a draft that never got
   * written — not an instruction to delete the arena's name. There is nothing
   * on the screen that a blank name would improve, and an arena with no name
   * is a padlock with no caption.
   */
  it("treats an empty box as 'leave it', not as 'erase it'", () => {
    const was = { ...at("garage").story };
    applyArenaOverrides([{ id: "garage", data: { story: { he: "   ", en: "" } } }]);
    expect(at("garage").story).toEqual(was);
  });

  it("ignores an arena the build does not have", () => {
    expect(applyArenaOverrides([{ id: "moon", data: { name: { he: "הירח" } } }])).toBe(0);
  });

  it("counts only what actually changed", () => {
    const now = at("court");
    expect(applyArenaOverrides([{ id: "court", data: { name: { ...now.name } } }])).toBe(0);
  });
});

describe("one family, one arena", () => {
  it("moves a family from one rung to another", () => {
    applyArenaOverrides([
      { id: "court", data: { introduces: "" } },
      { id: "station", data: { introduces: "slimes" } },
    ]);
    expect(at("court").introduces).toBeUndefined();
    expect(at("station").introduces).toBe("slimes");
  });

  /*
   * ⚠ THE ONE THAT ROW-BY-ROW CANNOT DO. Swapping two arenas' families is two
   * rows, and the second of them always looks like a clash with the first
   * while the first has not moved yet. Resolving the whole set at once is the
   * only reason this works — and a child who had met one family and not the
   * other is exactly who would have paid for it.
   */
  it("lets two arenas swap families in one save", () => {
    const [a, b] = [at("garage").introduces!, at("pool").introduces!];
    applyArenaOverrides([
      { id: "garage", data: { introduces: b } },
      { id: "pool", data: { introduces: a } },
    ]);
    expect(at("garage").introduces).toBe(b);
    expect(at("pool").introduces).toBe(a);
  });

  it("never lets two arenas claim the same family", () => {
    applyArenaOverrides([{ id: "pool", data: { introduces: "slimes" } }]);
    const claimed = ARENAS.filter((x) => x.introduces === "slimes");
    expect(claimed).toHaveLength(1);
  });

  it("gives it to the lower rung, so a family is never met twice", () => {
    // The Court is below the Pool, and the Court already has the Slimes.
    applyArenaOverrides([{ id: "pool", data: { introduces: "slimes" } }]);
    expect(at("court").introduces).toBe("slimes");
    expect(at("pool").introduces).toBeUndefined();
  });

  it("clears a family when the box is emptied, and only then", () => {
    applyArenaOverrides([{ id: "station", data: { name: { he: "התחנה" } } }]);
    expect(at("station").introduces).toBeTruthy();
    applyArenaOverrides([{ id: "station", data: { introduces: "" } }]);
    expect(at("station").introduces).toBeUndefined();
  });
});

describe("what moving a family actually does", () => {
  /*
   * The reason this is not a cosmetic field. `familyOpen` is what the chest
   * pool asks before it may pay out a card, so moving a family up the ladder
   * takes it out of the reach of everybody below the new rung — tonight,
   * without a deploy, which is the whole point and also the whole danger.
   */
  it("changes who may own one of that family's cards", () => {
    expect(familyOpen("slimes", 200)).toBe(true);
    applyArenaOverrides([
      { id: "court", data: { introduces: "" } },
      { id: "fuel", data: { introduces: "slimes" } },
    ]);
    expect(familyOpen("slimes", 200)).toBe(false);
    expect(familyOpen("slimes", at("fuel").from)).toBe(true);
  });

  it("opens a family to everybody when no arena introduces it", () => {
    applyArenaOverrides([{ id: "court", data: { introduces: "" } }]);
    expect(familyOpen("slimes", 0)).toBe(true);
  });
});
