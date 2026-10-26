/**
 * **In the playground you drag onto whichever board you dropped on.**
 *
 * Or: *"the animations and the sounds and the whole drag thing need to work
 * in the playground as well. I need to be able to drag straight onto the
 * board, whatever side I have 'picked' right now. Just drag and stick."*
 *
 * Two things were wrong and they were separate. The playground's held card
 * was a picture with an onClick — the one screen in the game whose entire
 * purpose is to look at cards and try them out was the one screen where a
 * card never said its name, made its noise or grew its wings. And the board
 * you were not editing was inert, so placing on it meant finding a label and
 * pressing it first. That is a MODE, and a mode is the thing a seven-year-old
 * loses track of.
 *
 * The side travels with the gesture now: a drop key carries the board it
 * landed on ("enemy:2-1"), and `placeAt` takes it. Four joins across three
 * files, which is the shape of thing that rots quietly — any one of them
 * going missing leaves a drag that silently writes to the wrong board.
 *
 * Read out of the source, because there is no DOM here to drag in.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const APP = read("../App.tsx");
const GRID = read("../components/BoardGrid.tsx");
const MATCH = read("./useMatch.ts");

describe("the playground's held card", () => {
  it("is picked up, not just looked at", () => {
    const lab = APP.slice(APP.indexOf('className={`lab__held'), APP.indexOf("lab__eraser"));
    expect(lab, "a press starts a drag").toContain("startDrag(m.hand!, e)");
  });

  it("says its name on the way, like the hand in a match does", () => {
    const lab = APP.slice(APP.indexOf('className={`lab__held'), APP.indexOf("lab__eraser"));
    expect(lab).toContain("sfx.voice(voiceFor(m.hand!).name)");
  });

  it("uses the same drag the match does, not a second one", () => {
    // One `useDrag` in the file. A playground-only copy is how the two
    // would drift apart, and the sounds and the ghost hang off this one.
    expect(APP.match(/useDrag\(/g) ?? []).toHaveLength(1);
  });
});

describe("a drop key in the playground", () => {
  it("carries the board it landed on", () => {
    expect(GRID).toContain("dropSide ? `${dropSide}:${key}` : key");
    expect(GRID, "and the highlight compares the same key").toContain("dragOver === dropKey(key)");
  });

  it("is plain again in a real match, where there is only one board", () => {
    // `dropSide` is passed only when m.playground, so a match's keys stay
    // "2-1" and nothing downstream has to know about the lab.
    expect(APP).toContain('dropSide={m.playground ? "me" : undefined}');
    expect(APP).toContain('dropSide={m.playground ? "enemy" : undefined}');
  });

  it("is split back apart at the drop", () => {
    const drop = APP.slice(APP.indexOf("useDrag((_cardId, target)"), APP.indexOf("const devRef"));
    expect(drop).toContain('target.indexOf(":")');
    expect(drop).toContain("m.placeAt(x, y, side)");
    expect(drop).toContain("m.placeKing(side)");
  });
});

describe("placing on a named side", () => {
  it("writes the ref, not only the state", () => {
    /*
     * The whole reason this test exists. `setEditSide` alone would not land
     * until the next render, and the place happens on the very next line —
     * so the card would go on the board you were NOT pointing at, which is
     * the exact bug this change was meant to remove.
     */
    const at = MATCH.indexOf("const placeAt = useCallback");
    const body = MATCH.slice(at, at + 2600);
    expect(body).toContain("editSideRef.current = onSide");
    expect(body).toContain("setEditSide(onSide)");
  });

  it("does the same for the crown", () => {
    const at = MATCH.indexOf("const placeKing = useCallback");
    const body = MATCH.slice(at, at + 1200);
    expect(body).toContain("editSideRef.current = onSide");
  });

  it("leaves a real match alone", () => {
    // `onSide` is read only inside the playground branch: a match has one
    // board you can place on and nothing may move that.
    const at = MATCH.indexOf("const placeAt = useCallback");
    const body = MATCH.slice(at, at + 2600);
    const lab = body.indexOf("if (playgroundRef.current)");
    const ends = body.indexOf("if (s.hand === null", lab);
    expect(body.slice(ends).includes("onSide"), "no onSide after the lab branch").toBe(false);
  });
});

describe("both halves are live at once", () => {
  it("so neither board waits to be chosen", () => {
    expect(APP, "your own half").toContain("interactive={interactive}\n                editing={m.playground}");
    expect(APP, "and the other one").toContain(
      "m.playground || (m.targeting !== null && isEnemyTargeted(m.targeting))",
    );
  });
});
