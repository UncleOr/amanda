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

export interface Catchphrase {
  id: string;
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

export const CATCHPHRASES: readonly Catchphrase[] = [
  // ── everybody starts with these ──
  { id: "phrase.fight", he: "ילד ילד ילד, בוא להילחם", free: true, style: "plain" },
  {
    id: "phrase.mighty",
    he: "אני אדיר, אני כביר, אני אדביק אותך לקיר",
    free: true,
    style: "chalk",
  },
  { id: "phrase.onlyamanda", he: "רק אמנדה יכולה לנצח אותי", free: true, style: "ember" },
  { id: "phrase.appetite", he: "בתיאבון, הארוחה מתחילה ילד", free: true, style: "ice" },
  /*
   * The opt-out, and it is the default. A child who does not want to shout
   * anything at a stranger should not have to, and the versus screen reads
   * perfectly well with a name and a face and no line under it.
   */
  { id: NO_PHRASE, he: "", free: true, style: "plain" },

  // ── bought, or found in a chest ──
  { id: "phrase.danger", he: "הופה, נהיה פה מסוכן", style: "ember", item: "phrase.danger" },
  { id: "phrase.clever", he: "חכם על חזקים", style: "slime", item: "phrase.clever" },
  { id: "phrase.winner", he: "המנצח בין השניים", style: "gold", item: "phrase.winner" },
  {
    id: "phrase.behindyou",
    he: "זהירות, אמנדה מאחוריך!",
    style: "shadow",
    item: "phrase.behindyou",
  },
];

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
