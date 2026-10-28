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
  /**
   * ═══ THE FAMILY THAT LIVES HERE ═══
   *
   * Or: *"add a caption at the bottom — cards from the Slime series get +20%
   * power in the Court! (and of course implement it too)."*
   *
   * So an arena is no longer only a backdrop and a trophy range: it is
   * GROUND, and the family that lives on it fights 20% harder there. That is
   * the first thing in the game that makes WHERE you are change how a match
   * goes, and it gives the ladder a second reason to be climbed — you meet
   * a new family at every rung, and on its own ground it is dangerous.
   *
   * The pairing is thematic and nothing is derived from it, so any one of
   * them is a one-line change if Or wants it elsewhere:
   *
   *   the playroom   Chuppy, the friend you are handed — and a playroom is
   *                  exactly where a furry toy lives
   *   the court      HIS: *"the Slimes. Yum."* is in his own story text
   *   the station    weeds through the platform; nobody stops here
   *   the alley      the crickets in his story ARE this family
   *   the fuel stop  *"don't strike a match"*, which is his joke
   *
   * ═══ AND THE GIANTS ARE NOBODY'S GROUND ═══
   *
   * Or: *"the arenas need sorting — you already have Giants from the start
   * (they turn up in the tutorial), so it needs other series."*
   *
   * He is right and the Giants are the clearest case: Amanda fields one in
   * the tutorial, so by the time anybody reaches the station the family is
   * an old acquaintance rather than the thing that lives there.
   *
   * Worth writing down, because it is bigger than the Giants: every family
   * that existed when this was written was in the starter album (one card
   * each, see STARTER_ALBUM), so no arena could honestly promise a family
   * nobody had met. What an arena's family meant was only "the one that
   * fights harder on its own ground".
   *
   * ⚠ THAT IS NO LONGER THE WHOLE STORY. The starter album was thinned to
   * the games room's four, and then the Machines and the Sea Dwellers were
   * built — two families in nobody's album, each with a rung of its own. So
   * the Garage and the Pool below are the first arenas where `family` and
   * `introduces` are both true of a family you really have not met.
   */
  family: string;
  /**
   * === THE FAMILY YOU FIRST MEET HERE ===
   *
   * Or, laying the whole ladder out in one message: *"at the start of the
   * game we are in the games room. We have Chuppy, giants, dragons and
   * plants. Plants get +20% power. At the court we meet the Slimes. Only
   * somebody who has reached the court for the first time can get a slime
   * card at all. At the station we meet the Insects - only somebody who has
   * reached the station can meet an insect."*
   *
   * Which turns the ladder from a backdrop into the way the game GROWS. It
   * also answers the bug he found in the same message: *"and how can I have
   * cards from the Strays series if I have not reached the alley yet? That
   * is a bug you need to deal with."* He could, because a chest drew from
   * the whole catalogue - every family at once, from the first wood chest
   * on the first evening - so there was nothing left for an arena to
   * introduce and nothing a new family could be FOR.
   *
   * `family` and `introduces` are deliberately not one field. `family` is
   * the ground bonus, which is about this place; `introduces` is about the
   * player's history, and the Fuel Stop's dragons are the case that proves
   * they differ - dragons fight harder at the Fuel Stop and have been in
   * your album since the first day.
   */
  introduces?: string;
  /**
   * === SHUT, AND NOT BECAUSE OF TROPHIES ===
   *
   * Or: *"lock the alley and the petrol station for now. There is no user
   * advanced enough to get there anyway. When we are happy with what we
   * have we will work on new series and new modes."*
   *
   * So a locked arena is not a trophy wall that a good fortnight could
   * climb: it is shut. Nothing promotes anybody into it, nothing promises a
   * number of trophies to reach it, and the family it introduces is in
   * nobody's album - see isCollectable.
   *
   * They stay VISIBLE, because that was Or's rule for the locked ones from
   * the start: *"you should be able to see what arenas there are - dark and
   * locked - so there is something to aim for."*
   *
   * ⚠ AND NOTHING IS LOCKED TODAY. He asked why the two were still shut, and
   * when the reasons were laid out none of them survived:
   *
   *   "no user advanced enough" is now the OPPOSITE of true. The reason they
   *     were shut was that a fortnight's play reached them; on the ladder he
   *     has just chosen they are 4,500 and 8,000, which is about a year.
   *
   *   The alley's family was the Strays, which was the real reason - an
   *     unfinished family of mine. It is the Demons now, which is what his
   *     own design document always said lives there.
   *
   *   And the Fuel Stop being shut made Amanda mode unreachable, which
   *     directly contradicts the instruction that arrived the same hour:
   *     *"Amanda is simply locked, with a small caption under the padlock
   *     (opens at the Fuel Stop)."* A door that opens at a place nobody can
   *     ever stand is a door that never opens.
   *
   * The flag stays, because the next unfinished thing will want it.
   */
  locked?: boolean;
}

/**
 * How much harder the local family fights, as a fraction of its power.
 *
 * Or's number: *"+20% power"*. Power only, and not health — a bonus that
 * raises both is the series synergy (see setup.ts), and two bonuses that do
 * the same thing are two things nobody can tell apart on the board.
 *
 * It applies to BOTH sides. The ground is the ground; a slime is harder to
 * kill in the Court whoever brought it, which is also what stops this being
 * a reward for having climbed rather than a property of the place.
 */
export const ARENA_POWER_BONUS = 0.2;

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
 *
 * ═══ AND THEN HE SLOWED THE WHOLE THING DOWN ON PURPOSE ═══
 *
 * Or, a month in and standing at 551: *"notice that I reached the train
 * station within a month of playing, which is good — it shows you progress
 * and you get cards and it is fun. But in the next arenas and the next
 * cards the progress needs to be much slower. The user is already in."*
 *
 * Which is the whole argument for a ladder in four sentences, and it is his.
 * The first month is left exactly as it is, because it worked; everything
 * above the Station roughly doubled.
 *
 *   0 · 150 · 450 · 1,200 · 2,400 · 4,500 · 8,000
 *   gaps 150 · 300 · 750 · 1,200 · 2,100 · 3,500
 *
 * Measured against trophies.ts rather than guessed. His own month to the
 * Station is about 110 trophies a week, and at that rate the climb from the
 * Station up is 7 weeks, then 11, then 19, then 32 — about sixteen months to
 * Amanda. In practice less: a win over a person is +30 where a win over the
 * hard bot is +12, so the rate climbs as he plays more people.
 *
 * ⚠ THE SHAPE IS THE PART THAT IS PINNED, NOT THE NUMBERS. ladder.test.ts
 * requires every gap to be wider than the one below it — the first promotion
 * should arrive in an evening and the last should be an ambition — and that
 * is the only constraint these four numbers have to satisfy. They are his to
 * move again.
 */
export const ARENAS: Arena[] = [
  {
    id: "playroom",
    /*
     * Or: *"plants get +20% power"* in the games room. It used to be the
     * furries, on the reasoning that a playroom is where a furry toy lives
     * - which is a nice sentence about a picture and not a decision about a
     * game. The Furries are one card, Chuppy, who is handed to everybody;
     * a +20% ground bonus for a family of one is a bonus for nobody.
     */
    family: "plants",
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
    family: "slimes",
    introduces: "slimes",
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
    /*
     * Or: *"I saw that at the moment I get the plants. But that makes no
     * sense, because the tutorial already has plants. Put insects there
     * instead (and make sure there are no insects in the tutorial)."*
     *
     * Counted, by distinct cards in the tutorial: plants 6, giants 3,
     * dragons 2, slimes 2, furries 1, insects 1. The plants were the most
     * familiar family in the game by a factor of two, standing on the rung
     * that was meant to introduce somebody new. The insects were the least
     * familiar — one card, the Ant Soldier — and that one card is gone from
     * the tutorial now, so this rung introduces a family nobody has met.
     */
    family: "insects",
    introduces: "insects",
    name: { he: "תחנת הרכבת", en: "The Station" },
    from: 450,
    tease: { he: "אף אחד לא עוצר פה. חוץ ממך.", en: "Nobody stops here. Except you." },
    story: {
      he: "קניתם כרטיס, עברתם את המחסום וזהו - אתם כבר רחוקים מאוד מהבית. אתם רעבים, אין לכם קליטה והאיש הזה שם בספסל מסתכל עליכם מוזר. אין מה לעשות. החלטתם להיות אמיצים. מזל שיש לצדכם סדרת מפלצות חדשה: החרקים.",
      en: "You bought a ticket, went through the barrier, and that is that — you are a long way from home. You are hungry, there is no signal, and that man on the bench is looking at you oddly. Nothing for it. You decided to be brave. Lucky you have a new family of monsters beside you: the Insects.",
    },
  },
  /*
   * ═══ THE TWO RUNGS IN THE MIDDLE OF THE LADDER ═══
   *
   * Or: *"go on, start with the Machines and the Sea Dwellers."*
   *
   * They are here rather than at the top because of where he actually is.
   * The open ladder was 0 · 150 · 450 and then nothing — the Alley is shut —
   * so a new arena above the Fuel Stop would have been a rung nobody can see
   * the bottom of. Measured against trophies.ts, where an evening of even
   * matches is about +50: the Garage is six evenings past the Station and
   * the Pool is six past the Garage.
   *
   * AND THEY ARE WHY THE SERIES EXIST. Until today every collectable family
   * was in the starter album, so no arena could honestly promise one — see
   * the note on `introduces` above, and Or parking it: *"later we will add
   * more series and more arenas, and then we will work on it together."*
   * These two families are in nobody's starter album, so these two rungs are
   * the first in the game where "this is where you meet them" is true.
   *
   * The places are the journey carrying on. A garage with the shutter half
   * down is where machines live, and the one body of water a child in a city
   * actually stands beside at night is a municipal pool nobody is swimming
   * in. Or's to rename, like every other name here.
   */
  {
    id: "garage",
    family: "machines",
    introduces: "machines",
    name: { he: "המוסך", en: "The Garage" },
    from: 1200,
    tease: { he: "מישהו שכח לכבות את האור.", en: "Somebody left the light on." },
    story: {
      he: "ירדתם מהרכבת והמשכתם ברגל. מוסך, שתיים בלילה, התריס חצי סגור ובפנים עוד דולק אור. או שמישהו שכח לכבות, או שמישהו עוד עובד. הרצפה דביקה משמן והברגים מתגלגלים לכם מתחת לרגליים. ואז אחד הברגים קם. המכונות.",
      en: "You got off the train and kept walking. A garage, two in the morning, the shutter half down and a light still on inside. Either somebody forgot to turn it off, or somebody is still working. The floor is sticky with oil and the bolts roll under your feet. And then one of the bolts stands up. The Machines.",
    },
  },
  {
    id: "pool",
    family: "sea",
    introduces: "sea",
    name: { he: "הבריכה", en: "The Pool" },
    from: 2400,
    tease: { he: "אל תיכנסו למים.", en: "Do not get in the water." },
    story: {
      he: "בריכה עירונית בלילה, בלי מציל ובלי אף אחד. את המים לא החליפו כבר הרבה זמן והריח מגיע עד הגדר. אתם אומרים לעצמכם שזה רק עלים. שזאת רק הרוח. ואז משהו זז מתחת לפני המים, וזה לא עלה וזאת לא הרוח. שוכני הים.",
      en: "A municipal pool at night, no lifeguard and nobody about. The water has not been changed in a long time and you can smell it from the fence. You tell yourself it is only leaves. Only the wind. And then something moves under the surface, and it is not a leaf and it is not the wind. The Sea Dwellers.",
    },
  },
  {
    id: "alley",
    /*
     * ═══ THIS RUNG HAS HAD TWO FAMILIES, AND THE FIRST ONE WAS MINE ═══
     *
     * Or once said *"for the alley let's invent a new series that doesn't
     * exist yet"*, and I built the Strays for it out of his own alley story
     * — jackals, a flickering lamp, a bin you should not look in, "oh, it is
     * only a cat".
     *
     * He looked at them and said: *"that is something you invented and I did
     * not like it much, sorry."* Which is the correct way round, and the
     * reason this note stays rather than being tidied away: the lesson is
     * not that the family was bad, it is that I invented a family for a
     * place instead of asking what lives there.
     *
     * What lives there is the Demons, which is what his own design document
     * said from the first day — number 6, *"mind control, blindness and
     * assassination"*. One card so far: the Alley King, who survived the cull
     * and moved in. The arena is locked, so the family is sealed and he is
     * in nobody's album until it opens.
     */
    family: "demons",
    introduces: "demons",
    name: { he: "סמטת האימה", en: "Fright Alley" },
    from: 4500,
    tease: { he: "אל תסתכל מה יש בפח.", en: "Don't look in the bin." },
    story: {
      he: "הצרצרים מצרצרים, התנים מייללים, הפנסים מהבהבים - ואתם פה לבד. כמה רחוק אתם מוכנים ללכת בשביל להשיג את אמנדה? מסתבר שלא מעט. אמאל'ה, מה זה הרעש הזה? אה, זה רק חתול.",
      en: "The crickets are going, the jackals are howling, the lamps are flickering — and you are here on your own. How far will you go to get Amanda? Quite far, it turns out. Blimey, what was that noise? Oh. Only a cat.",
    },
  },
  {
    id: "fuel",
    family: "dragons",
    name: { he: "תחנת הדלק", en: "The Fuel Stop" },
    from: 8000,
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
  return prefixed(name, "ל");
}

/**
 * "in <arena>", with the same collapse: המגרש becomes במגרש, not בהמגרש.
 *
 * The ground caption needs it — Or's line is *"cards from the Slime series
 * get +20% power IN THE COURT"* — and it is the identical piece of grammar
 * as toArena, which is why they are now one function with two prefixes
 * rather than two functions with one rule written twice.
 */
export function atArena(name: string): string {
  return prefixed(name, "ב");
}

/** ל, ב and ה: the article is swallowed by the preposition. */
function prefixed(name: string, letter: string): string {
  return name.startsWith("ה") ? `${letter}${name.slice(1)}` : `${letter}${name}`;
}

/**
 * Where a family sits in the order you MEET them.
 *
 * Or: *"in the album, sort the series by default in order of appearance."*
 *
 * Which is not the catalogue number and never was. The album was ordered by
 * the number on the file — dragons, machines, furries, sea, giants, demons,
 * insects, plants, slimes — so the second shelf a child opened held a family
 * they cannot meet for four months, and the one they were handed on day one
 * was third. The order of appearance is the trophies at which the arena that
 * introduces them opens; a family nobody introduces was there from the start.
 *
 * Returns -1 for the starter families, so they lead, and they keep their
 * catalogue order among themselves.
 */
export function metAt(seriesId: string): number {
  const at = ARENAS.find((a) => a.introduces === seriesId);
  return at ? at.from : -1;
}

/** The rungs that are actually on the ladder today. */
export function openArenas(): Arena[] {
  return ARENAS.filter((a) => !a.locked);
}

/**
 * Which arena a player with this many trophies is fighting in.
 *
 * A locked arena is never the answer, however many trophies somebody has:
 * the climb stops at the last open rung. Which is also what stops a locked
 * arena from quietly handing out its ground bonus and its family to anybody
 * who got there before it was shut.
 */
export function arenaFor(trophies: number): Arena {
  const open = openArenas();
  let found = open[0] ?? ARENAS[0]!;
  for (const a of open) if (trophies >= a.from) found = a;
  return found;
}

/**
 * Has this player met this family yet?
 *
 * `best` is BEST trophies, never current ones. Or's rule is about having
 * ARRIVED - *"only somebody who has reached the court for the first time
 * can get a slime card at all"* - and trophies fall on a loss, so a player
 * sitting on the Court's doorstep would meet the Slimes and unmeet them
 * every other match.
 *
 * A family nobody introduces (the Furries, the Giants, the Dragons, the
 * Plants) is open from the first evening. That is the games room, and it is
 * the four families Or listed for it.
 */
export function familyOpen(seriesId: string, best: number): boolean {
  const at = ARENAS.find((a) => a.introduces === seriesId);
  if (!at) return true;
  return !at.locked && best >= at.from;
}

/**
 * Families that are not in the game at all yet, because the arena that
 * introduces them is shut. Asked by isCollectable, which is why their cards
 * are in no album, no chest and no achievement.
 */
export function sealedFamilies(): ReadonlySet<string> {
  return new Set(ARENAS.filter((a) => a.locked && a.introduces).map((a) => a.introduces!));
}

/**
 * The family that fights 20% harder where this many trophies puts you.
 *
 * The one function every battle asks, so that "which ground is this" has a
 * single answer: the server asks it for an online match and for a replayed
 * bot match, and the browser asks it for the bot match it is running. Two
 * places working it out from trophies by hand is two places that can
 * disagree about a boundary, and a battle whose two replays disagree is a
 * player who is told they won and paid for a loss.
 */
export function groundFor(trophies: number): string {
  return arenaFor(trophies).family;
}

/** How far into the current arena they are, 0–1, for a progress bar. */
export function arenaProgress(trophies: number): number {
  const here = arenaFor(trophies);
  const open = openArenas();
  const next = open[open.indexOf(here) + 1];
  if (!next) return 1;
  const span = next.from - here.from;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (trophies - here.from) / span));
}
