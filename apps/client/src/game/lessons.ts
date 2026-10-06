import type { Placement } from "@amanda/engine";

/**
 * The two tutorial matches, written out in advance.
 *
 * Or: "the tutorial should look like a real match, across two different games.
 * The first shows basic board building, played to the end. There is no need
 * for a bot — it's a fixed tutorial. Decide in advance what the opponent does.
 * And make sure he loses. The second shows slightly more sophisticated
 * strategy. Same again: decide the opponent in advance and make sure he
 * loses."
 *
 * So neither of these is a match against the computer. Both sides are written
 * here: the player is dealt a known hand in a known order, and the opponent's
 * board is a fixed list rather than something generated. That is the only way
 * Amanda can say "a giant? put him in front of your King" and be sure a giant
 * is coming.
 *
 * ═══ THE OPPONENT LOSES, AND IT IS NOT RIGGED ═══
 *
 * Nothing forces the result. The boards below are built so that the player
 * wins by playing them, and that claim is CHECKED — lessons.test.ts plays each
 * lesson a few hundred times with the cards dropped in random orders and
 * random places, and fails if the player does not win every single time. If a
 * card is rebalanced tomorrow and lesson two stops being winnable, a test goes
 * red instead of a seven-year-old losing the game that was supposed to teach
 * them it.
 *
 * Rigging it would have been one line. It would also have been a lie the first
 * time a child lost on purpose to see what happened.
 */

export interface Lesson {
  /**
   * The cards dealt, in this order. Chosen so each of Amanda's lines has
   * something to land on: a King first, then the giant she talks about
   * guarding with, then a flyer, then an action card, then the weak one she
   * tells you to bin.
   */
  deck: string[];
  /** Exactly what is on the other side. Not generated, not random. */
  opponent: Placement[];
  /** What this match is for, in one line. Shown before it starts. */
  title: { he: string };
}

/** Everything that is not a King, filled with one card. Keeps a board honest. */
function fill(cardId: string, except: Array<[number, number]> = []): Placement[] {
  const out: Placement[] = [];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue; // the King's 2×2
      if (except.some(([ex, ey]) => ex === x && ey === y)) continue;
      out.push({ cardId, x, y });
    }
  return out;
}

export const LESSONS: Lesson[] = [
  /*
   * ── one: how a board is built ──
   *
   * The player gets a clearly strong hand and the opponent gets ants. That is
   * deliberate and it is not cheating: the first match has to teach the SHAPE
   * of a turn — crown a King, guard him, put the flyer behind, bin the junk —
   * and a close game teaches none of it, because a child losing their first
   * match learns "this game is hard", not "the King goes in the middle".
   */
  {
    title: { he: "משחק ראשון — איך בונים לוח" },
    deck: [
      "giants_10_titan_king", // a King worth crowning, and she says so
      "giants_01_stone_colossus", // static, tough: the guard-post lesson
      "dragons_03_thunderwing", // a flyer that snipes: the back-row lesson
      "energy_boost", // an action card, so that line has something to point at
      "insects_08_firefly", // the weak one she tells you to bin
      "plants_03_healing_bloom",
      "slimes_01_basic_slime",
      "insects_01_ant_soldier",
    ],
    /*
     * Crumb Demons and a couple of ants — the board a player who did nothing
     * at all would end up with. Weak on purpose and weaker than it first was:
     * the test plays this lesson with the hand dropped in random order, which
     * means sometimes the child crowns the FIREFLY, and the promise is that
     * the opponent loses anyway. A tutorial that only works when you follow it
     * is not a tutorial, it is an exam.
     */
    opponent: [
      { cardId: "crumb_demon", x: 1, y: 1, king: true },
      { cardId: "insects_01_ant_soldier", x: 3, y: 1 },
      { cardId: "insects_01_ant_soldier", x: 3, y: 2 },
      ...fill("crumb_demon", [
        [3, 1],
        [3, 2],
      ]),
    ],
  },

  /*
   * ── two: what beats what ──
   *
   * Now the opponent is a real board with a real shape — a wall in front and
   * things that multiply behind it — and the player's hand holds the two
   * answers to it. This is where the counter lines in coach.ts finally have
   * something true to say: poison for the wall, a wide swing for the swarm.
   *
   * Still a win, and still earned: the answers are in the hand, and the
   * opponent's board has no answer to them.
   */
  {
    title: { he: "משחק שני — מה מנצח את מה" },
    deck: [
      "giants_10_titan_king",
      "insects_10_insect_empress", // poison, for the wall opposite
      "giants_09_thunder_giant", // a wide swing, for the splitters
      "dragons_03_thunderwing",
      "radioactive_eraser",
      "insects_03_venom_scorpion", // a second poisoner: stacks add up
      "dragons_04_lava",
      "slimes_01_basic_slime",
    ],
    /*
     * A board with a SHAPE — a guard pair in front of the crown and things
     * that multiply on the flanks — so the counter lines have something true
     * to point at. But a shape is not the same as a wall: the King here is
     * soft, because the promise is still that he loses even when the child
     * crowns the wrong card and puts the sniper in the front row.
     */
    opponent: [
      { cardId: "slimes_01_basic_slime", x: 1, y: 1, king: true },
      // The pair poison is the answer to.
      { cardId: "plants_02_ancient_tree", x: 3, y: 1 },
      { cardId: "plants_02_ancient_tree", x: 3, y: 2 },
      // The flanks that multiply, which is what a wide swing undoes.
      { cardId: "plants_05_creeping_vine", x: 3, y: 0 },
      { cardId: "plants_05_creeping_vine", x: 3, y: 3 },
      ...fill("crumb_demon", [
        [3, 0],
        [3, 1],
        [3, 2],
        [3, 3],
      ]),
    ],
  },
];
