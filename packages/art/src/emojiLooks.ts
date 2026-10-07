/**
 * The emoji one player sends the other — drawn, not borrowed.
 *
 * Or: *"the emoji (illustrated, in the theme!) — these beautiful ones are also
 * something you buy in the shop or win in a chest, so that encourages you
 * too."* Which is the whole argument for drawing them. A unicode 😂 is drawn
 * by whoever made the phone: it looks different on every device, it belongs to
 * nobody, and — the part that matters here — **it cannot be sold or won,**
 * because the player already has it.
 *
 *   pnpm art:emoji [style] [id]
 *
 * ═══ THE BRIEF IS THE ICONS' BRIEF, PLUS A FACE ═══
 *
 * These are read at about 40px in a speech bubble, so the same rules apply:
 * one subject, a bold silhouette, flat colour, nothing touching the edges.
 * The difference is that an icon labels a thing and an emoji carries a
 * FEELING, so every one of these has an expression that is readable before
 * the drawing is — you should know it is a laugh before you know it is a
 * monster laughing.
 *
 * ═══ FREE AND PAID ═══
 *
 * Which of these a player starts with is NOT decided here. This file draws
 * pictures; packages/shared/src/emoji.ts decides who owns what, because that
 * is a game rule and this is an art brief. Keeping them apart means Or can
 * move one from the paid pack to the free set without regenerating anything.
 */

/** Shared rules. Same family as the icons, so the game looks like one game. */
const EMOJI_RULES = [
  "A single flat EMOJI, centred, filling about 75% of the frame with clear",
  "empty margin on every side. ONE bold subject with an instantly readable",
  "silhouette and a STRONG, OBVIOUS EXPRESSION. THICK black outline, flat",
  "cel-shaded colour, at most three or four colours plus the outline.",
  "Chunky and solid — the feeling must still read shrunk to 32 pixels.",
  "NO text, NO letters, NO numbers, NO frame, NO border, NO background",
  "scenery, NO drop shadow, NO speech bubble.",
  "Background: one FLAT SOLID mid-grey filling the whole frame, no",
  "checkerboard pattern, no transparency grid.",
].join(" ");

/**
 * Every emoji, by the id the game sends over the wire.
 *
 * The ids are deliberately about the FEELING and not the creature — `laugh`
 * rather than `grinning_slime` — because the drawing may be redone and the
 * thing a player meant by sending it may not.
 */
export const EMOJI_LOOK: Record<string, string> = {
  // ── the starter set: hello, and the ordinary reactions ──
  wave: "a friendly cartoon monster paw with three claws raised in a wave, teal and cream",
  // Came back once with "POW!" lettering baked into it, which the rules above
  // forbid for a reason: a drawing with a word in it cannot be translated.
  flex:
    "a chunky cartoon monster arm flexing a big round bicep, violet with a cream claw, " +
    "absolutely no text or lettering anywhere in the image",
  shock:
    "a round cartoon monster face with enormous round white eyes and a tiny open mouth, " +
    "utterly astonished, pale blue",
  laugh:
    "a round cartoon monster face thrown back laughing with its eyes squeezed shut and a " +
    "wide open mouth, warm yellow-green",
  think:
    "a round cartoon monster face looking up with one claw under its chin and a raised brow, " +
    "pondering, dusty violet",
  scared:
    "a round cartoon monster face with wide worried eyes and a wobbling frown, sweat drop at " +
    "the temple, pale mint",
  crown: "a fat golden crown with three points and a red gem in the middle, bold and shiny",
  crumb:
    "a round golden biscuit with one bite taken out of it and three crumbs falling, warm brown " +
    "and cream",

  // ── the monsters pack ──
  fireskull: "a cartoon skull with bright orange flames pouring out of the top, bone white and fire orange",
  monsterheart:
    "a plump cartoon heart with a stitched seam down the middle and two tiny fangs at the bottom, " +
    "deep crimson",
  wink:
    "a round cartoon monster face giving a big cheeky wink with its tongue out, lime green",
  babydragon:
    "a tiny round cartoon dragon head with two small horns and a puff of smoke from one nostril, " +
    "emerald and gold",

  // ── the Amanda pack ──
  smirk:
    "a stylised ghostly cartoon witch face with flowing flame hair and a sly one-sided smirk, " +
    "glowing cyan and pale blue",
  firelion:
    "a roaring cartoon lion head with a mane of orange flames, bold and fierce, hot orange and gold",
  slimeblob:
    "a cheerful cartoon slime blob with two dot eyes and a wide grin, a drip running down one " +
    "side, translucent lime green",
  crumbdemon:
    "a tiny grumpy cartoon crumb creature made of biscuit with two cross eyes and stubby arms, " +
    "warm brown and grey",
};

export function buildEmojiPrompt(id: string, styleBrief: string): string {
  return [EMOJI_LOOK[id], EMOJI_RULES, `Art style: ${styleBrief}`].join(" ");
}
