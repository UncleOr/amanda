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
  /**
   * ═══ THE STORY, AND YOU ONLY GET IT ONCE YOU HAVE BEEN ═══
   *
   * Or: *"after you open the arena — tapping any arena should tell the
   * story of the arena. The story of each arena can only be seen after you
   * have reached it once."*
   *
   * So it is not a tease and it is not a description of the picture: it is
   * where you are, told to somebody who has got there. He wrote all five.
   *
   * Only the Hebrew is his. The English is a draft like every other English
   * string in this game and is his to replace.
   */
  story: { he: string; en: string };
}

/**
 * The ladder, lowest first.
 *
 * The gaps widen as you climb, which is the usual shape and the right one: the
 * first promotion should arrive in an evening, the last should be an ambition.
 *
 * ═══ AND THE TOP TWO WERE NOT AN AMBITION ═══
 *
 * Or, a fortnight in: *"we've been playing all of two weeks and we're
 * already at the train station. The distance to Fright Alley needs to be
 * bigger, and to the Fuel Stop really big."*
 *
 * The first three are right — he reached the station in two weeks and the
 * station is the third rung, which is what "the first promotion arrives in
 * an evening" should feel like by the end of a fortnight. It is the top of
 * the ladder that was short: Fright Alley was 450 trophies past the station
 * and the Fuel Stop another 700, so the whole climb was over inside a month
 * and then there was nothing above it.
 *
 * Measured against the payouts in trophies.ts rather than guessed: a win
 * over a person is +30 and a loss −20, so an evening of even matches is
 * about +50. The old gaps were nine and fourteen such evenings. The new ones
 * are nineteen and forty-four, and the top of the ladder is a season rather
 * than a fortnight.
 */
export const ARENAS: Arena[] = [
  {
    id: "playroom",
    name: { he: "חדר המשחקים", en: "The Playroom" },
    from: 0,
    tease: { he: "כאן כולם מתחילים. על השטיח.", en: "Everyone starts here. On the rug." },
    story: {
      he: "כאן הכל מתחיל. המקום שבו ילדים יושבים ומחליפים קלפי מפלצות, אבל עדיין יודעים שתכף הכל ייגמר ואמא תכין לכם חביתה לארוחת ערב. יש לכם עוד לאן לשאוף.",
      en: "Where it all starts. Children swapping monster cards on the rug, and still knowing that soon it ends and mum makes an omelette for dinner. You have somewhere to get to.",
    },
  },
  {
    id: "court",
    name: { he: "המגרש", en: "The Court" },
    from: 150,
    tease: { he: "בחוץ, על האספלט, מול כולם.", en: "Outside, on the asphalt, in front of everyone." },
    story: {
      he: "הופה, יצאתם למסע. זהו, אין כבר דרך חזרה. אתם עדיין על האספלט בשכונה, פוגשים פרצופים מוכרים אבל היי - מה זה שם על הרצפה? מפלצות חדשות שלא ראיתם מעולם. סדרת הריריים. יאמי.",
      en: "Off you go, then. No way back now. Still on the asphalt down the road, still familiar faces — but hey, what is that on the ground? Monsters you have never seen. The Slimes. Yum.",
    },
  },
  {
    id: "station",
    name: { he: "תחנת הרכבת", en: "The Station" },
    from: 450,
    tease: { he: "אף אחד לא עוצר פה. חוץ ממך.", en: "Nobody stops here. Except you." },
    story: {
      he: "קניתם כרטיס, עברתם את המחסום וזהו - אתם כבר רחוקים מאוד מהבית. אתם רעבים, אין לכם קליטה והאיש הזה שם בספסל מסתכל עליכם מוזר. אין מה לעשות. החלטתם להיות אמיצים.",
      en: "You bought a ticket, went through the barrier, and that is that — you are a long way from home. You are hungry, there is no signal, and that man on the bench is looking at you oddly. Nothing for it. You decided to be brave.",
    },
  },
  {
    id: "alley",
    name: { he: "סמטת האימה", en: "Fright Alley" },
    from: 1400,
    tease: { he: "אל תסתכל מה יש בפח.", en: "Don't look in the bin." },
    story: {
      he: "הצרצרים מצרצרים, התנים מייללים, הפנסים מהבהבים - ואתם פה לבד. כמה רחוק אתם מוכנים ללכת בשביל להשיג את אמנדה? מסתבר שלא מעט. אמאל'ה, מה זה הרעש הזה? אה, זה רק חתול.",
      en: "The crickets are going, the jackals are howling, the lamps are flickering — and you are here on your own. How far will you go to get Amanda? Quite far, it turns out. Blimey, what was that noise? Oh. Only a cat.",
    },
  },
  {
    id: "fuel",
    name: { he: "תחנת הדלק", en: "The Fuel Stop" },
    from: 3600,
    tease: { he: "הסוף. אל תדליק כאן גפרור.", en: "The end of the road. Don't strike a match." },
    story: {
      he: "זוהי התחנה הסופית. חשבתם למצוא פה מתדלק חייכן וחנות עם אייס קפה? תחשבו שוב. נראה שרגל אדם לא דרכה פה כבר שנים. רגע, אבל אם כן - מה זו טביעת הרגל הזאת פה? אה כן. זאת הרגל של אמנדה. מזל טוב. מצאתם אותה. או יותר נכון - היא מצאה אתכם. מקווים שלא תסיימו בצלחת שלה.",
      en: "The last stop. Expecting a cheerful pump attendant and a shop with iced coffee? Think again. Nobody has set foot here in years. Although — then whose footprint is that? Ah. Amanda's. Congratulations, you found her. Or rather, she found you. Hope you do not end up on her plate.",
    },
  },
];

/**
 * "to <arena>", with the Hebrew the preposition actually needs.
 *
 * ל and ה collapse into one another: המגרש becomes למגרש, not להמגרש. Or
 * caught "עוד 150 להמגרש" on the home screen, which is the kind of thing that
 * reads as broken to every single Hebrew speaker and as fine to a string
 * concatenation.
 *
 * A name that does not start with the article just takes the prefix:
 * חדר המשחקים → לחדר המשחקים.
 */
export function toArena(name: string): string {
  return name.startsWith("ה") ? `ל${name.slice(1)}` : `ל${name}`;
}

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
