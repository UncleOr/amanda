/**
 * The things one player may say to the other.
 *
 * ═══ WHY A LIST AND NOT A TEXT BOX ═══
 *
 * Or asked for "emoji and ready-made sentences, in the theme of the game".
 * That is also the only shape of chat this game can have. It is played by
 * seven-year-olds; a free text field between two strangers is a thing that
 * needs moderating, reporting and an adult reading it, and none of those
 * exist. A closed list cannot say anything that was not written here on
 * purpose.
 *
 * It still counts as communication between players for the age rating (see
 * docs/TASKS.md, IARC questionnaire), so the list being closed and finished
 * BEFORE that form is filled in is the point.
 *
 * ═══ THE WORDS ARE OR'S ═══
 *
 * He is a copywriter; this is a first draft in the game's voice and he will
 * rewrite it. What matters structurally is that each line has an id, so
 * rewriting one never means touching the code that sends it — and so the copy
 * admin can reach them like any other string.
 *
 * Nothing here can be unkind. A taunt in a children's game is "you got me",
 * not "you are bad at this": the whole set is written so that receiving any
 * of them is fine, which is what makes the reporting flow a rare event rather
 * than a daily one.
 */

export interface Taunt {
  id: string;
  /** Shown big, on its own. */
  emoji: string;
  he: string;
  en: string;
  /**
   * `always` can be sent at any point in a match. `end` only once it is over,
   * because "good game" during the build phase is noise.
   */
  when: "always" | "end";
}

export const TAUNTS: readonly Taunt[] = [
  // ── while you are building, and while you are watching ──
  { id: "taunt.hi", emoji: "👋", he: "היי!", en: "Hi!", when: "always" },
  { id: "taunt.ready", emoji: "💪", he: "אני מוכן לזה", en: "I'm ready for this", when: "always" },
  { id: "taunt.wow", emoji: "😮", he: "ואו, הלוח הזה", en: "Whoa, that board", when: "always" },
  { id: "taunt.scary", emoji: "😱", he: "מפחיד אותי", en: "That scares me", when: "always" },
  { id: "taunt.nice", emoji: "👑", he: "מהלך יפה", en: "Nice move", when: "always" },
  { id: "taunt.hurry", emoji: "⏳", he: "נו כבר", en: "Come on already", when: "always" },
  { id: "taunt.laugh", emoji: "😂", he: "חחח", en: "Hahaha", when: "always" },
  { id: "taunt.think", emoji: "🤔", he: "רגע, אני חושב", en: "Hold on, thinking", when: "always" },
  { id: "taunt.luck", emoji: "🍀", he: "בהצלחה", en: "Good luck", when: "always" },
  { id: "taunt.crumbs", emoji: "🍪", he: "תאכל פירורים", en: "Eat crumbs", when: "always" },

  // ── once it is decided ──
  { id: "taunt.gg", emoji: "🤝", he: "משחק טוב", en: "Good game", when: "end" },
  { id: "taunt.gotme", emoji: "🎯", he: "תפסת אותי", en: "You got me", when: "end" },
  { id: "taunt.close", emoji: "😅", he: "זה היה צמוד", en: "That was close", when: "end" },
  { id: "taunt.again", emoji: "🔁", he: "עוד אחד?", en: "One more?", when: "end" },
];

const BY_ID = new Map(TAUNTS.map((t) => [t.id, t]));

/** Is this something a player is actually allowed to say, and right now? */
export function tauntById(id: string): Taunt | undefined {
  return BY_ID.get(id);
}

/**
 * How often one player may say something to the other.
 *
 * Enforced on the SERVER, not in the picker: a picker that greys itself out
 * stops an honest player and nobody else. Two numbers because they stop two
 * different things — the gap stops a child hammering one emoji, and the cap
 * stops a whole match of them.
 */
export const TAUNT_LIMITS = {
  /** Seconds between two messages from the same player. */
  gapSeconds: 2,
  /** Most one player may send in a single match. */
  perMatch: 25,
};
