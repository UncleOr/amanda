/**
 * Where you fight, and what you are climbing towards.
 *
 * Or named these and the order is his. The names are HIS names — the longer
 * ones I had ("a neighbourhood basketball court") were descriptions of the
 * look he asked for, not what the place is called. It is just "המגרש".
 *
 * The order: a games room on the carpet at the
 * start, a petrol station at the top. Every one is somewhere a child actually
 * goes — the monsters are fighting on your floor, in your street, at the
 * station you pass on the way to your grandmother.
 *
 * AN ARENA IS A TROPHY RANGE. That is the whole mechanic (docs/META.md §5):
 * winning moves you up, losing moves you down, and the backdrop changes under
 * you. It is also what gives the art a target instead of being "more polish".
 *
 * THE LOCKED ONES ARE VISIBLE ON PURPOSE. Or: "you should be able to see what
 * arenas there are — dark and locked — so there is something to aim for." A
 * ladder you cannot see the top of is not a ladder.
 */

export interface Arena {
  id: string;
  name: { he: string; en: string };
  /** You fight here from this many trophies up, until the next one begins. */
  from: number;
  /** A line of flavour for the locked card. Or's to rewrite. */
  tease: { he: string; en: string };
}

/**
 * The ladder, lowest first.
 *
 * The gaps widen as you climb, which is the usual shape and the right one: the
 * first promotion should arrive in an evening, the last should be an ambition.
 */
export const ARENAS: Arena[] = [
  {
    id: "playroom",
    name: { he: "חדר המשחקים", en: "The Playroom" },
    from: 0,
    tease: { he: "כאן כולם מתחילים. על השטיח.", en: "Everyone starts here. On the rug." },
  },
  {
    id: "court",
    name: { he: "המגרש", en: "The Court" },
    from: 150,
    tease: { he: "בחוץ, על האספלט, מול כולם.", en: "Outside, on the asphalt, in front of everyone." },
  },
  {
    id: "station",
    name: { he: "תחנת הרכבת", en: "The Station" },
    from: 450,
    tease: { he: "אף אחד לא עוצר פה. חוץ ממך.", en: "Nobody stops here. Except you." },
  },
  {
    id: "alley",
    name: { he: "סמטת האימה", en: "Fright Alley" },
    from: 900,
    tease: { he: "אל תסתכל מה יש בפח.", en: "Don't look in the bin." },
  },
  {
    id: "fuel",
    name: { he: "תחנת הדלק", en: "The Fuel Stop" },
    from: 1600,
    tease: { he: "הסוף. אל תדליק כאן גפרור.", en: "The end of the road. Don't strike a match." },
  },
];

/** Which arena a player with this many trophies is fighting in. */
export function arenaFor(trophies: number): Arena {
  let found = ARENAS[0]!;
  for (const a of ARENAS) if (trophies >= a.from) found = a;
  return found;
}

/** How far into the current arena they are, 0–1, for a progress bar. */
export function arenaProgress(trophies: number): number {
  const here = arenaFor(trophies);
  const next = ARENAS[ARENAS.indexOf(here) + 1];
  if (!next) return 1;
  const span = next.from - here.from;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (trophies - here.from) / span));
}
