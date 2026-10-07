/**
 * The catchphrase: the one line that is yours, shown when a match begins.
 *
 * Or: *"let everyone choose a catchphrase, at first from 5 phrases — but
 * catchphrases (designed!) are another thing you can buy in the shop or win in
 * a chest. Then people will have a reason to buy from the shop, because it is
 * something you SEE."*
 *
 * That last sentence is the design. A card skin is seen by you; an avatar is
 * seen for a moment. A catchphrase is thrown across the screen at the one
 * instant both players are looking at each other and nothing else is
 * happening, which makes it the most visible thing in the game — and that is
 * exactly why it is worth owning.
 *
 * ═══ THE WORDS ARE OR'S, AND THE STYLES ARE NOT WORDS ═══
 *
 * Every line below was written by Or. "Designed" is handled by `style`, which
 * names a treatment the screen knows how to draw (see the `.phrase--*` rules).
 * Deliberately NOT generated artwork: a picture of a sentence cannot be
 * translated, cannot be read by a screen reader, and goes blurry on a phone.
 * Hebrew type that the game draws itself stays crisp and stays translatable.
 *
 * ═══ TWO THINGS FOR OR ═══
 *
 * HE ASKED FOR FIVE STARTERS AND WROTE FOUR. The fifth here is "no phrase",
 * which is not me writing in his voice — it is the opt-out, and a screen that
 * makes a seven-year-old pick a boast before he is allowed to play needs one
 * regardless. If he wants a fifth written line, it goes above it.
 *
 * SOME OF THEM ADDRESS A BOY. "בוא להילחם" and "ילד" are said TO the
 * opponent, so against a girl they are the wrong word. `heF` is here, unused
 * and empty, so a feminine variant is a string rather than a change: the
 * screen already knows the opponent's gender (players.gender).
 */

/**
 * What a line is FOR.
 *
 * Or: *"and for the phrases, have both nicely-taunting ones and encouraging
 * ones — good luck, good game, and so on."* Which is a kinder set than the
 * word "catchphrase" suggests, and the right one for a game two children in
 * the same house play against each other: not every player wants their one
 * line to be a boast, and a child who would rather wish you luck should be
 * able to.
 *
 * The picker groups by this, so the choice reads as "what kind of person am
 * I at the start of a match" rather than as a list of nine sentences.
 */
export type PhraseTone = "taunt" | "kind";

export interface Catchphrase {
  id: string;
  /** Teasing, or warm. See PhraseTone. */
  tone: PhraseTone;
  /** Or's line. Masculine where Hebrew forces a choice; see `heF`. */
  he: string;
  /** The same line said to a girl. Empty means "use `he`". */
  heF?: string;
  en?: string;
  /** Everybody has it from the first match. */
  free?: boolean;
  /** How it is drawn. One of the `.phrase--*` treatments. */
  style: PhraseStyle;
  /** The shop item that grants it. Absent on the free ones. */
  item?: string;
}

/**
 * The treatments, loudest last.
 *
 * The free ones get the two quiet styles on purpose: what is being sold is
 * not the sentence, it is how it ARRIVES, and that only reads as worth
 * something if the ones everybody has are plainer.
 */
export type PhraseStyle = "plain" | "chalk" | "ember" | "ice" | "gold" | "slime" | "shadow";

/** What a player has chosen to say, when they have chosen nothing. */
export const NO_PHRASE = "phrase.none";

/*
 * ═══ FIVE TO START WITH, AND THE REST ARE EARNED ═══
 *
 * Or: *"you have 5 phrases to start. And each time more and more are added…
 * eventually there will be hundreds. Some will arrive in the shop, some in
 * chests."* So `free` is exactly five — his four lines and the opt-out — and
 * everything else carries an `item`.
 *
 * That is also why the picker shows only what you OWN. Everywhere else in this
 * game a locked thing is drawn rather than hidden, because wanting it is the
 * point; a list of hundreds is the case where that stops being true and
 * becomes a wall of padlocks. The shop is where you meet the ones you do not
 * have.
 */
export const CATCHPHRASES: readonly Catchphrase[] = [
  /*
   * The opt-out, and the default. A child who does not want to shout anything
   * at a stranger should not have to, and the versus screen reads perfectly
   * well with a name and a face and no line under it.
   */
  { id: NO_PHRASE, tone: "kind", he: "", free: true, style: "plain" },

  // ── the four you start with. Or's words. ──
  { id: "phrase.fight", tone: "taunt", he: "ילד ילד ילד, בוא להילחם", free: true, style: "plain" },
  {
    id: "phrase.mighty",
    tone: "taunt",
    he: "אני אדיר, אני כביר, אני אדביק אותך לקיר",
    free: true,
    style: "chalk",
  },
  {
    id: "phrase.onlyamanda",
    tone: "taunt",
    he: "רק אמנדה יכולה לנצח אותי",
    free: true,
    style: "ember",
  },
  {
    id: "phrase.appetite",
    tone: "taunt",
    he: "בתיאבון, הארוחה מתחילה ילד",
    free: true,
    style: "ice",
  },

  // ── teasing, bought or found. Or's words. ──
  {
    id: "phrase.danger",
    tone: "taunt",
    he: "הופה, נהיה פה מסוכן",
    style: "ember",
    item: "phrase.danger",
  },
  { id: "phrase.clever", tone: "taunt", he: "חכם על חזקים", style: "slime", item: "phrase.clever" },
  {
    id: "phrase.winner",
    tone: "taunt",
    he: "המנצח בין השניים",
    style: "gold",
    item: "phrase.winner",
  },
  {
    id: "phrase.behindyou",
    tone: "taunt",
    he: "זהירות, אמנדה מאחוריך!",
    style: "shadow",
    item: "phrase.behindyou",
  },

  /*
   * ── the warm ones ──
   *
   * DRAFTS. Or asked for "encouraging ones — good luck, good game and so on"
   * and did not send the words, so these are mine and are expected to be
   * rewritten.
   *
   * None of them needs an `heF`, and that is not an accident of drafting: a
   * warm line is not aimed at anybody in particular, so there is no gendered
   * "you" in it to get wrong. That is what makes this the safe tone for a
   * child playing a stranger.
   */
  {
    id: "phrase.goodluck",
    tone: "kind",
    he: "בהצלחה לשנינו",
    style: "ice",
    item: "phrase.goodluck",
  },
  {
    id: "phrase.goodgame",
    tone: "kind",
    he: "שיהיה משחק טוב",
    style: "chalk",
    item: "phrase.goodgame",
  },
  {
    id: "phrase.friends",
    tone: "kind",
    he: "באתי לשחק, לא לריב",
    style: "slime",
    item: "phrase.friends",
  },
  { id: "phrase.learn", tone: "kind", he: "תלמד אותי משהו", style: "gold", item: "phrase.learn" },
];

/** The lines of one kind, for the picker to group them. */
export function phrasesOfTone(tone: PhraseTone): Catchphrase[] {
  return CATCHPHRASES.filter((p) => p.tone === tone && p.id !== NO_PHRASE);
}

const BY_ID = new Map(CATCHPHRASES.map((p) => [p.id, p]));

export function catchphraseById(id: string | null | undefined): Catchphrase | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** What this player may choose from: the free ones, plus whatever they hold. */
export function ownedCatchphrases(items: readonly string[]): Catchphrase[] {
  const has = new Set(items);
  return CATCHPHRASES.filter((p) => p.free || (p.item !== undefined && has.has(p.item)));
}

/**
 * The line to show, for an opponent of this gender.
 *
 * Null when there is nothing to say — either nothing was chosen, or the
 * chosen id is one this build does not have, which is what happens to
 * somebody on an older copy after a new phrase ships.
 */
export function phraseText(
  id: string | null | undefined,
  saidTo: "boy" | "girl" | null = null,
): string | null {
  const phrase = catchphraseById(id);
  if (!phrase || !phrase.he) return null;
  return saidTo === "girl" && phrase.heF ? phrase.heF : phrase.he;
}
