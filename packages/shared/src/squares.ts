/**
 * ═══ THE SPECIAL SQUARES ═══
 *
 * Or, 11 November 2026: *"and I feel like adding special positions from
 * arena 2 or 3 as well — 1-3 random ones on every board (ours and the
 * opponent's) with a unique colour and icon. Possible for any card except
 * the King. The opponent sees your positions and you see his according to
 * the reveal stage."*
 *
 * ═══ WHY THIS IS THE BIGGEST THING THE BOARD HAS HAD ═══
 *
 * Until now every square was the same square. Where you put a card mattered
 * only through its neighbours — the guard posts, the back row, a family
 * touching — which is real, and is also a rule about the CARDS rather than
 * about the ground. These are the first thing on the board that is about the
 * ground, and they change the question from "what shall I play" to "what
 * shall I play HERE".
 *
 * They also make the two boards different from each other for the first
 * time, which is why the reveal rule is his and not mine: a board you cannot
 * see the shape of is a board you cannot plan against.
 *
 * ⚠ NEVER THE KING'S 2×2. His rule, and it is the right one twice over: the
 * crown is already the most consequential square on the board, and a mirror
 * maze or a pancake house under it would decide a match before a card had
 * been placed.
 */
import { TUNED } from "./tunables.js";

export const SQUARE_KINDS = [
  "hospital",
  "mirror",
  "asylum",
  "charger",
  "pancake",
  "bunker",
  "blackhole",
  "minefield",
] as const;

export type SquareKind = (typeof SQUARE_KINDS)[number];

/** Which square is on which cell, keyed "x-y" exactly as placements are. */
export type Squares = Readonly<Record<string, SquareKind>>;

export interface SquareDef {
  /** Or's own name for it. */
  he: string;
  /** What it does, in one sentence, for the panel a tap opens. */
  note: string;
  /** An id in the game's own icon set (apps/client/src/components/Icon.tsx). */
  icon: string;
  /** The colour it paints the cell. One per kind, so the board reads at a glance. */
  colour: string;
}

/**
 * ⚠ THE WORDS ARE OR'S, FROM THE MESSAGE THAT ASKED FOR THEM. He is the
 * copywriter; these are his descriptions turned into sentences and nothing
 * more, and the day he wants them sharper they are eight strings in one
 * place rather than eight strings in eight components.
 */
export const SQUARES: Readonly<Record<SquareKind, SquareDef>> = {
  hospital: {
    he: "בית חולים",
    note: "הקלף שעומד כאן מתרפא בלי הפסקה.",
    icon: "hp",
    colour: "#4ade80",
  },
  mirror: {
    he: "מבוך מראות",
    note: "הקלף כאן מקבל את הזהות, הכוחות והעוצמה של אחד הקלפים שלידו.",
    icon: "joker",
    colour: "#c084fc",
  },
  asylum: {
    he: "בית משוגעים",
    note: "הקלף כאן תוקף את החברים שלו במקום את האויב. הם לא יכולים לתקוף אותו בחזרה.",
    icon: "warning",
    colour: "#fb923c",
  },
  charger: {
    he: "תחנת טעינה",
    note: "הקלף כאן מקבל פי 2 כוח ופי 2 חיים.",
    icon: "electric",
    colour: "#facc15",
  },
  pancake: {
    he: "בית הפנקייק",
    note: "כל קלף כאן הופך למפלץ פירורים — עם הכוח והחיים שלו, בלי היכולות.",
    icon: "monster",
    colour: "#f472b6",
  },
  bunker: {
    he: "הבונקר",
    note: "אפשר להניח כאן עד שלושה קלפים אחד על השני. כשהעליון נופל, הבא מתגלה.",
    icon: "stacked",
    colour: "#94a3b8",
  },
  blackhole: {
    he: "חור שחור",
    note: "אל תשים כאן כלום — וכל שאר הקלפים שלך יקבלו פי 1.3 כוח ופי 1.3 חיים.",
    icon: "dark",
    colour: "#818cf8",
  },
  minefield: {
    he: "שדה מוקשים",
    note: "אם הריבוע ריק והאויב דורך עליו — הוא מתפוצץ. פעם אחת, על הראשון שמגיע.",
    icon: "explode",
    colour: "#ef4444",
  },
};

/** Every cell of a 4×4 board that is not part of the King's 2×2. */
export function placeableCells(): string[] {
  const out: string[] = [];
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++) {
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue; // the crown
      out.push(`${x}-${y}`);
    }
  return out;
}

/**
 * Is this board big enough in the ladder to have special squares on it?
 *
 * Or: *"from arena 2 or 3"*. The second arena opens at 150 trophies, which
 * is a few evenings in — long enough that the first board a child ever
 * builds is the plain one, and early enough that it is not a thing they
 * hear about and never see. One tunable, so it can move without a deploy.
 */
export function squaresOpen(bestTrophies: number): boolean {
  return bestTrophies >= TUNED.squaresFromTrophies;
}

/**
 * Roll the squares for ONE board.
 *
 * `rnd` is passed in rather than taken from Math.random, because the two
 * boards of an online match are rolled by the server and have to arrive the
 * same on both screens — and because a test that cannot fix the dice is a
 * test of the dice.
 *
 * ⚠ AT MOST ONE OF EACH KIND, and that is not tidiness. Two black holes on
 * one board is 1.69× on everything for leaving two squares empty, and two
 * pancake houses is a board that cannot be built on. One of each also means
 * the icon on a cell is enough to know what is there.
 */
export function rollSquares(rnd: () => number, howMany?: number): Squares {
  const n = howMany ?? 1 + Math.floor(rnd() * TUNED.squaresPerBoard);
  const cells = placeableCells();
  const kinds = [...SQUARE_KINDS];
  const out: Record<string, SquareKind> = {};
  for (let i = 0; i < n && cells.length && kinds.length; i++) {
    const cell = cells.splice(Math.floor(rnd() * cells.length), 1)[0]!;
    const kind = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0]!;
    out[cell] = kind;
  }
  return out;
}

/** How many cards may stand on one cell. Three in a bunker, one anywhere else. */
export function cellCapacity(squares: Squares | undefined, cell: string): number {
  return squares?.[cell] === "bunker" ? TUNED.bunkerDepth : 1;
}

/**
 * Which of the enemy's squares you may see, by the phase.
 *
 * Or: *"the opponent sees your positions and you see his according to the
 * reveal stage."* So this is the SAME rule the cards follow (see `fog` in
 * apps/server/src/match.ts): the front column while you are building, three
 * columns once panic starts, everything after that — and an x-ray lifts it
 * exactly as it lifts the cards, by not calling this at all.
 *
 * ⚠ THE SQUARES ARE ROLLED BEFORE THE MATCH AND NEVER MOVE, so hiding them
 * is the only thing stopping a player from reading the whole enemy board's
 * SHAPE at second zero — which is most of what there is to know about it
 * once these exist.
 */
export function fogSquares(squares: Squares, phase: string): Squares {
  const keep = (cell: string, from: number) => Number(cell.split("-")[0]) >= from;
  if (phase === "build") return filterCells(squares, (c) => keep(c, 3));
  if (phase === "panic" || phase === "locking") return filterCells(squares, (c) => keep(c, 1));
  return squares;
}

function filterCells(squares: Squares, ok: (cell: string) => boolean): Squares {
  const out: Record<string, SquareKind> = {};
  for (const [cell, kind] of Object.entries(squares)) if (ok(cell)) out[cell] = kind;
  return out;
}
