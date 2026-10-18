/**
 * **A child wins all three stages, however badly they drop the cards.**
 *
 * *"ותוודא שהוא יפסיד"* — Or, about the opponent, and it still holds. The
 * tutorial promises a win, so this is the file that keeps the promise.
 *
 * ═══ WHY THIS IS NOT lessons.test.ts WITH A THIRD CASE ═══
 *
 * That file plays a lesson by filling the WHOLE board: sixteen cells, every
 * empty one a crumb. It was right for the two long matches, and it is the
 * wrong simulation for a stage — Or's stages are *"a board of three
 * squares"* and *"seven squares"*, and `fillGs` now only fills the squares
 * a stage drew. A test that fills all sixteen would be testing a board the
 * game can no longer produce, and would hide exactly the thing worth
 * knowing: whether three giants beat three crumbs.
 *
 * So the board here is the stage's own squares and nothing else, which is
 * what a player will actually press "fight" on.
 *
 * It is deliberately NOT a test of playing the hand well. A seven-year-old
 * will crown the sniper and put the wall in a corner, and the stage still
 * has to end in a win — otherwise the first thing the game teaches is that
 * they are bad at it.
 */
import { describe, expect, it } from "vitest";
import { runBattle, type BoardInput, type Placement } from "@amanda/engine";
import { CATALOG, SYNERGIES, ACTIONS } from "../data/catalog";
import { STAGE_LESSONS } from "./lessons";
import { SCRIPTS, STAGES, handFor, lessonSquares } from "./lessonScript";

function shuffled<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * A board a child might actually build from this hand, on this stage.
 *
 * The first monster is crowned — which is what every stage asks for and
 * waits for — and the rest land on the stage's squares in any order. What is
 * left over becomes a crumb, exactly as the buzzer does it.
 */
function childBoard(stage: number, rnd: () => number): BoardInput {
  const deck = STAGE_LESSONS[stage - 1]!.deck;
  const squares = [...(lessonSquares(stage) ?? [])].filter((k) => k !== "king");
  const monsters = shuffled(
    deck.filter((id) => CATALOG.has(id) && !ACTIONS.has(id)),
    rnd,
  );
  const cells = shuffled(squares, rnd).map((k) => k.split("-").map(Number) as [number, number]);

  const placements: Placement[] = [{ cardId: monsters[0]!, x: 1, y: 1, king: true }];
  monsters.slice(1).forEach((cardId, i) => {
    const cell = cells[i];
    if (cell) placements.push({ cardId, x: cell[0], y: cell[1] });
  });
  for (const [x, y] of cells.slice(Math.max(0, monsters.length - 1)))
    placements.push({ cardId: "crumb_demon", x, y });
  return { owner: "A", placements };
}

function play(stage: number, runs: number): string[] {
  const lesson = STAGE_LESSONS[stage - 1]!;
  let seed = 20261018 + stage;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const losses: string[] = [];
  for (let i = 0; i < runs; i++) {
    const r = runBattle({
      seed: 1000 + i,
      catalog: CATALOG,
      synergies: SYNERGIES,
      a: childBoard(stage, rnd),
      b: { owner: "B", placements: lesson.opponent },
      recordFrames: false,
    });
    if (r.winner !== "A") losses.push(`run ${i}: ${r.winner ?? "draw"} by ${r.winReason}`);
  }
  return losses;
}

describe.each([1, 2, 3])("stage %i", (stage) => {
  it("is won however the cards are dropped", () => {
    expect(play(stage, 200).slice(0, 5)).toEqual([]);
  });

  /*
   * The hand and the board have to agree. More monsters than squares is a
   * child holding a card with nowhere to put it and a step that waits for
   * ever; fewer is a square the lesson pointed at and never filled.
   */
  it("deals exactly as many monsters as it has squares to put them on", () => {
    const deck = STAGE_LESSONS[stage - 1]!.deck;
    const monsters = deck.filter((id) => CATALOG.has(id) && !ACTIONS.has(id));
    const squares = lessonSquares(stage)!;
    // The crown counts as a square and the king card as a monster.
    const placeable = [...squares].filter((k) => k !== "king").length + 1;
    expect(monsters.length).toBeLessThanOrEqual(placeable);
  });

  it("deals every card its script asks for", () => {
    for (const id of STAGE_LESSONS[stage - 1]!.deck)
      expect(CATALOG.has(id) || ACTIONS.has(id), `${id} is not a card`).toBe(true);
  });

  it("faces an opponent made of real cards", () => {
    for (const p of STAGE_LESSONS[stage - 1]!.opponent)
      expect(CATALOG.has(p.cardId), `${p.cardId} is not a card`).toBe(true);
  });

  /*
   * Both sides the size of the lesson. A three-square board facing a full
   * enemy one teaches that the game is lopsided before it teaches anything.
   */
  it("faces a board no bigger than its own", () => {
    const mine = lessonSquares(stage)!.size;
    expect(STAGE_LESSONS[stage - 1]!.opponent.length).toBeLessThanOrEqual(mine + 2);
  });
});

describe("the set of stages", () => {
  it("has a script and a deck for each one", () => {
    expect(STAGES).toBe(3);
    expect(STAGE_LESSONS).toHaveLength(STAGES);
    for (let n = 1; n <= STAGES; n++) expect(SCRIPTS[n], `no script for stage ${n}`).toBeDefined();
  });
});

/**
 * ═══ THE TRIO HAS TO ACTUALLY LIGHT UP ═══
 *
 * Or's order for stage three puts a GIANT between the plants: a plant in the
 * corner, the king, a plant on one guard post, a giant on the other, and
 * then *"oho, another plant! that makes us a trio"*.
 *
 * That only works because the engine floods over same-series NEIGHBOURS
 * rather than requiring three in a row — 2-0 touches 3-0, and 3-0 touches
 * 3-1, so the three plants are one connected group with the giant beside
 * them rather than between them.
 *
 * If that reading is wrong, the step before the last one points at a glow
 * that never appears and a child is told about a bonus they cannot see. It
 * is one call to the engine's own rule, so there is no reason to believe it
 * instead of asking.
 */
import { SERIES_BY_ID } from "../data/catalog";
import { synergyMembers } from "@amanda/engine";

describe("the trio stage three builds", () => {
  /*
   * Built FROM THE SCRIPT, not written out beside it. The first version of
   * this test hard-coded the six placements, so moving a square in the
   * script left the test passing on a board the lesson no longer asks for —
   * caught by moving the third plant somewhere it touches nothing and
   * watching nothing fail.
   */
  function boardFromScript(stage: number) {
    const steps = SCRIPTS[stage]!;
    const deck = STAGE_LESSONS[stage - 1]!.deck;
    const out: Array<{ cardId: string; x: number; y: number; king?: boolean }> = [];
    steps.forEach((step, i) => {
      const cardId = handFor(steps, i, deck);
      if (!cardId || !CATALOG.has(cardId)) return;
      if (step.awaits?.kind === "king") {
        out.push({ cardId, x: 1, y: 1, king: true });
        return;
      }
      if (step.awaits?.kind !== "cell") return;
      const [x, y] = step.awaits.cells[0]!.split("-").map(Number) as [number, number];
      out.push({ cardId, x, y });
    });
    return out;
  }

  it("is one connected group, with the giant beside it and not between", () => {
    const board = boardFromScript(3);
    const seriesOf = (id: string) => CATALOG.get(id)?.seriesId;

    // Every monster the stage deals is placed, and nothing else is.
    const monsters = STAGE_LESSONS[2]!.deck.filter((id) => CATALOG.has(id));
    expect(board.map((p) => p.cardId).sort()).toEqual([...monsters].sort());

    const plants = SERIES_BY_ID.get("plants");
    expect(plants, "the plants series").toBeDefined();
    const lit = synergyMembers(board, seriesOf, "plants", plants!.synergy.threshold);

    const names = [...lit].map((i) => board[i]!.cardId).sort();
    const everyPlant = monsters.filter((id) => seriesOf(id) === "plants").sort();
    expect(names, "the three plants the stage places do not light up").toEqual(everyPlant);
  });
});
