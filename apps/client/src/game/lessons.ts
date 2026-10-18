import type { Placement } from "@amanda/engine";
import { line as t } from "./copy";

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
    title: { he: t("s24e4af8", "משחק ראשון — איך בונים לוח") },
    /*
     * ═══ OR'S CAST, IN OR'S ORDER ═══
     *
     * He wrote this match out card by card. The hand is no longer "a clearly
     * strong hand" that the rules react to — it is the script's cast, dealt
     * in the order the script talks about it, so every line has the card it
     * names already in hand.
     *
     * The order is the lesson: a tank for the guard post, a FLYER for the
     * back row, an action card to take to the bar, a weak one to bin and
     * then take back, a King, and a second tank for the second guard post.
     */
    deck: [
      "giants_01_stone_colossus", // "a card with a lot of absorbing power"
      "dragons_01_flame_dragon", // flies, so the cube in front cannot block it
      "energy_boost", // the action card: taken, not placed
      "slimes_02_gelatinous_cube", // "a card, erm... not great" — binned, then recovered
      "giants_10_titan_king", // the crown
      "giants_04_rock_troll", // heals itself: the second guard post
      "plants_03_healing_bloom",
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
    title: { he: t("s078dd87", "משחק שני — מה מנצח את מה") },
    /*
     * ═══ DEALT IN THE ORDER SHE TALKS ABOUT IT ═══
     *
     * Or wrote this match out card by card and approved it, so the deck is
     * no longer "a hand with the right answers in it somewhere" — it is the
     * script's cast, in order. Every line in lessonScript.ts names the card
     * that is in your hand when it is said, and this is what puts it there.
     *
     * Three plants in a row, because the trio has to be buildable: the first
     * two take the guard posts and the third completes a touching group,
     * which is the engine's actual rule (edges, not corners — synergy.ts).
     */
    deck: [
      "xray", // look first: the fog, and the one card that lifts it
      "plants_02_ancient_tree", // 2000hp, regenerates: the guard post
      "plants_08_cactus", // reflects damage: the second guard post
      "plants_09_sunflower", // the third plant — פוטוסינתזה lights up
      "furries_01_chuppy", // 1100 power, 610 health: where NOT to put it
      "giants_10_titan_king", // the crown
      "energy_boost", // and now, with the board full, the timing lesson
      "sandstorm", // panic only — so it arrives when panic does
      "plants_01_thorn_sprout",
      "dragons_01_flame_dragon",
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

/*
 * ═══ AND THE THREE STAGES ═══
 *
 * Or: *"let us do the tutorial in three stages."* The two long matches above
 * are left in place and are no longer reachable; these are what STAGES points
 * at now.
 *
 * Each deck is dealt in the order its script talks about it, so every line
 * has the card it names already in hand. And each one is SHORT: three cards,
 * five, four. A lesson board is three squares or seven, and a hand with more
 * cards than squares is a child holding something they have nowhere to put.
 *
 * The opponent is small for the same reason. A three-square lesson facing a
 * full enemy board would teach that the game is lopsided before it taught
 * anything else — so both sides are the size of the lesson.
 */
export const STAGE_LESSONS: Lesson[] = [
  /*
   * ── one: a king and two guards ──
   *
   * The whole of it is where the crown goes and why the two squares in front
   * of it matter. Titan King for the crown, and two giants who can stand in
   * front of one: the Colossus absorbs and the Troll heals itself.
   */
  {
    title: { he: t("s4d3f100", "שלב ראשון — הלוח והמטרה") },
    deck: ["giants_10_titan_king", "giants_01_stone_colossus", "giants_04_rock_troll"],
    opponent: [
      { cardId: "crumb_demon", x: 1, y: 1, king: true },
      { cardId: "crumb_demon", x: 3, y: 1 },
      { cardId: "crumb_demon", x: 3, y: 2 },
    ],
  },

  /*
   * ── two: the two ways to reach the other side ──
   *
   * Flame Dragon walks in — moveSpeed 1.5, and its own role text says
   * *"advances into enemy territory"*. Thunderwing is the catalogue's only
   * `range: "sniper"`: it never moves and shoots the last enemy card in its
   * lane. Those are the two ideas, and they are the two cards.
   *
   * The opponent gets ant soldiers in front so the dragon has something to
   * walk through and the sniper something to pick off behind them.
   */
  {
    title: { he: t("sfd50f02", "שלב שני — איך תוקפים") },
    deck: [
      "giants_10_titan_king",
      "giants_01_stone_colossus",
      "giants_04_rock_troll",
      "dragons_01_flame_dragon",
      "dragons_03_thunderwing",
      // The one that gets thrown away and fetched back. Or called it
      // *"a card, erm... not great"* when he wrote this lesson the first time.
      "slimes_02_gelatinous_cube",
    ],
    opponent: [
      { cardId: "crumb_demon", x: 1, y: 1, king: true },
      { cardId: "insects_01_ant_soldier", x: 3, y: 1 },
      { cardId: "insects_01_ant_soldier", x: 3, y: 2 },
      { cardId: "crumb_demon", x: 3, y: 0 },
      { cardId: "crumb_demon", x: 3, y: 3 },
      { cardId: "crumb_demon", x: 0, y: 1 },
      { cardId: "crumb_demon", x: 0, y: 2 },
    ],
  },

  /*
   * ── three: abilities, a series, and an action card ──
   *
   * Three plants, which is two things at once: the Ancient Tree heals itself
   * and the Cactus hurts whoever hits it — two abilities a child can watch
   * happen — and all three share a series, so the third one beside them
   * lights the bonus. Then RÖNTGEN, because an action card is the last
   * mechanic there is.
   */
  {
    title: { he: t("s889ccf0", "שלב שלישי — לשחק באמת") },
    /*
     * Dealt in the order Or wrote the stage: a dragon, a plant, and only
     * THEN the king — *"it is not always king first"*. The deck is the only
     * thing that decides what is in hand when a step speaks, so this list is
     * his sentence in the order he said it.
     */
    deck: [
      "dragons_01_flame_dragon", // "what have we got? a dragon. put it at the back"
      "plants_09_sunflower", // one plant
      "giants_10_titan_king", // "oho — a king! I said one would come"
      "plants_02_ancient_tree", // a guard that heals itself
      "giants_04_rock_troll", // and a guard that is a giant
      "plants_08_cactus", // "oho, another plant!" — and that is the trio
      "xray",
      "energy_boost",
      // Last out of the hand, and placed between taking the boost and
      // playing it — Or wanted the sniper shown, and this is where it fits.
      "dragons_03_thunderwing",
    ],
    opponent: [
      { cardId: "crumb_demon", x: 1, y: 1, king: true },
      { cardId: "insects_01_ant_soldier", x: 3, y: 1 },
      { cardId: "insects_01_ant_soldier", x: 3, y: 2 },
      { cardId: "crumb_demon", x: 3, y: 0 },
    ],
  },
];
