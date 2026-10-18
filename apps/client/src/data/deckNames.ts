/**
 * **A name every new deck is born with.**
 *
 * Or: *"when you make a new deck and don't give it a name, it won't let you
 * save. Give some indication — 'before saving you have to name the deck' —
 * and also give every deck a random name when you open it: Cool Deck, Crazy
 * Deck and so on."*
 *
 * ═══ WHY A NAME RATHER THAN A BETTER ERROR ═══
 *
 * Both, in the end, but this is the half that matters. A new deck opened
 * with an empty name and a save button that was merely DISABLED — no
 * message, no reason, nothing to read. A child who has just spent five
 * minutes choosing sixteen cards presses the only orange button on the
 * screen and nothing happens at all.
 *
 * The message is the smaller fix. Starting with a name means the empty case
 * is something you have to do on purpose, and a deck called "דק מטורף" is
 * also just a nicer thing to find than an empty box.
 *
 * ═══ THEY ARE DRAFTS ═══
 *
 * Or is the copywriter and writes the words a player reads; these are in
 * roughly the right voice so the thing can be built and looked at. Rewrite
 * freely. His two examples were in English — the game leads in Hebrew, so
 * the Hebrew is the source here and the English is the pair, same rule as
 * every other string.
 *
 * Kept under DECK_RULES.nameMax (18) so none of them arrives already
 * truncated in the field it lands in; the test holds that.
 */
import { line as t } from "../game/copy";

/**
 * Deferred, like every other list of labels, so the names follow a language
 * change rather than being fixed at import.
 */
export const DECK_NAMES: Array<() => string> = [
  () => t("sf612dde", "דק מטורף"),
  () => t("s919090a", "דק מפלצתי"),
  () => t("s2510797", "דק רעב"),
  () => t("sb2e4117", "דק קוצני"),
  () => t("sf6a4bd7", "דק רועם"),
  () => t("s4cb7401", "דק חלקלק"),
  () => t("s8494a17", "דק נוצץ"),
  () => t("se602c97", "דק מאובק"),
];

/**
 * One of them, at random.
 *
 * Not "the next unused one": two decks with the same name is a thing a child
 * might do on purpose, and refusing it would be a rule nobody asked for.
 */
export function newDeckName(): string {
  const pick = DECK_NAMES[Math.floor(Math.random() * DECK_NAMES.length)];
  // The list is never empty, and the fallback costs one character rather
  // than an assertion that could be wrong at runtime.
  // Its own id, because this is the second time the same words appear in
  // this file and that is what the inventory derives. See copy-slots.ts.
  return pick ? pick() : t("s09a2e9f", "דק מטורף");
}
