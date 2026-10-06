import { describe, expect, it } from "vitest";
import { runBattle, type BoardInput, type Placement } from "@amanda/engine";
import { CATALOG, SYNERGIES, ACTIONS } from "../data/catalog";
import { LESSONS } from "./lessons";

/*
 * "ותוודא שהוא יפסיד" — Or, 2026-10-06.
 *
 * The tutorial promises a win, so this is the file that keeps the promise. It
 * plays each lesson a few hundred times with the dealt cards dropped in random
 * places, including badly, and fails if the player ever loses.
 *
 * It is deliberately NOT a test of the best way to play the hand. A
 * seven-year-old will put the sniper in the front row and the wall in the
 * corner, and the lesson still has to end with them winning — otherwise the
 * first thing the game teaches is that they are bad at it.
 *
 * If a card is rebalanced tomorrow and a lesson stops being winnable, this
 * goes red. That is the entire point: better a red test than a child losing
 * the match that was supposed to teach them the game.
 */

const KING_CELLS = new Set(["1-1", "1-2", "2-1", "2-2"]);

/** Every cell a card may be placed in. */
const CELLS: Array<[number, number]> = [];
for (let x = 0; x < 4; x++)
  for (let y = 0; y < 4; y++) if (!KING_CELLS.has(`${x}-${y}`)) CELLS.push([x, y]);

function shuffled<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * A board a child might actually build from this hand.
 *
 * The first monster becomes the King — which is what the tutorial tells them
 * to do and waits for — and the rest land wherever, in whatever order. Action
 * cards are skipped: they are not placed on the board.
 */
function childBoard(deck: string[], rnd: () => number): BoardInput {
  const monsters = shuffled(
    deck.filter((id) => CATALOG.has(id) && !ACTIONS.has(id)),
    rnd,
  );
  const cells = shuffled(CELLS, rnd);
  const placements: Placement[] = [
    { cardId: monsters[0]!, x: 1, y: 1, king: true },
  ];
  monsters.slice(1).forEach((cardId, i) => {
    const cell = cells[i];
    if (cell) placements.push({ cardId, x: cell[0], y: cell[1] });
  });
  // Empty slots become Crumb Demons in the real game; so here.
  for (const [x, y] of cells.slice(monsters.length - 1))
    placements.push({ cardId: "crumb_demon", x, y });
  return { owner: "A", placements };
}

function playLesson(index: number, runs: number) {
  const lesson = LESSONS[index]!;
  let seed = 20261006 + index;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const losses: string[] = [];
  for (let i = 0; i < runs; i++) {
    const r = runBattle({
      seed: 1000 + i,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: childBoard(lesson.deck, rnd),
      b: { owner: "B", placements: lesson.opponent },
      recordFrames: false,
    });
    if (r.winner !== "A") losses.push(`run ${i}: ${r.winner ?? "draw"} by ${r.winReason}`);
  }
  return losses;
}

describe("the tutorial matches are won", () => {
  it("lesson one: the opponent loses however the cards are dropped", () => {
    const losses = playLesson(0, 300);
    expect(losses.slice(0, 5)).toEqual([]);
  });

  it("lesson two: the same, against a board with a real shape", () => {
    const losses = playLesson(1, 300);
    expect(losses.slice(0, 5)).toEqual([]);
  });

  it("every card a lesson deals actually exists", () => {
    for (const lesson of LESSONS)
      for (const id of lesson.deck)
        expect(CATALOG.has(id) || ACTIONS.has(id), `${id} is not a card`).toBe(true);
  });

  it("every card the opponent plays actually exists", () => {
    for (const lesson of LESSONS)
      for (const p of lesson.opponent)
        expect(CATALOG.has(p.cardId), `${p.cardId} is not a card`).toBe(true);
  });

  it("each lesson deals enough monsters to fill a board decision", () => {
    for (const lesson of LESSONS) {
      const monsters = lesson.deck.filter((id) => CATALOG.has(id) && !ACTIONS.has(id));
      expect(monsters.length).toBeGreaterThanOrEqual(5);
    }
  });
});
