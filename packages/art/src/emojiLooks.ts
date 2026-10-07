/**
 * The emoji one player sends the other — the game's own characters, drawn.
 *
 * Or: *"and for the emoji, base them on iconic monster characters: Chuppy,
 * Amanda, the Crumb Demon, Fried Bread, Flame Dragon. But of course in cute
 * versions, and as relevant emoji — doing hearts, laughing, sticking their
 * tongues out."*
 *
 *   pnpm art:emoji [style] [id]
 *
 * ═══ WHY THE CHARACTERS AND NOT GENERIC FACES ═══
 *
 * The first set was a round monster face per feeling — a laughing blob, a
 * shocked blob. It read fine and it belonged to nobody. Or's note is the
 * better idea by a distance: a child who sends Chuppy sticking his tongue out
 * is sending a character he collects, and the emoji becomes another place the
 * album shows up. It also gives the paid packs a reason to exist that is not
 * "four more blobs".
 *
 * ═══ EACH ONE IS DRAWN FROM THE CHARACTER'S OWN ART ═══
 *
 * `from` names an image already in the repo — the card, or the portrait — and
 * the generator is handed it as a reference, so Chuppy is actually Chuppy and
 * not a yellow thing with Chuppy's description. Without that the five
 * characters drift apart across sixteen generations and none of them looks
 * like the card it came from.
 *
 * The brief then asks for a CUTE, SIMPLIFIED version, because the card art is
 * a full illustration and an emoji is read at 32 pixels in a speech bubble.
 *
 * ═══ FREE AND PAID ═══
 *
 * Not decided here. This file draws pictures;
 * packages/shared/src/emoji.ts decides who owns what, because that is a game
 * rule and this is an art brief.
 */

/** Where each character's likeness comes from, relative to the repo root. */
export const EMOJI_REFS: Record<string, string> = {
  chuppy: "apps/client/public/cards/furries_01_chuppy.webp",
  amanda: "assets/raw/brand/amanda_portrait.png",
  crumb: "apps/client/public/cards/crumb_demon.webp",
  dragon: "apps/client/public/cards/dragons_01_flame_dragon.webp",
  /*
   * Fried Bread DOES have a card.
   *
   * I said he did not, drew him from a description, and got a friendly slice
   * of toast twice. Or: *"Fried Bread has a card! In the card booklet I sent
   * you."* He does — #42, series המאכלים, in
   * assets/reference/monster-cards-with-bleed.pdf, and he is not friendly at
   * all: a furious craggy crouton with fangs and fists. The artwork is cropped
   * out of that page so he is drawn from himself like the other four.
   *
   * Worth knowing beyond this file: that booklet has 24 cards and only two of
   * them are in the game (docs/DECK-SOURCE.md). Reaching into it for a
   * character is reaching into a deck the game does not have.
   */
  bread: "assets/reference/fried-bread-card.png",
};

/** Shared rules. Same family as the icons, so the game looks like one game. */
const EMOJI_RULES = [
  "Redraw this character as a single flat EMOJI: cute, simplified, chibi,",
  "big head, tiny or no body, enormous expressive eyes. Keep the character's",
  "colours, markings and silhouette recognisable — it must be obviously the",
  "same creature — but friendlier and rounder than the original.",
  "Centred, filling about 75% of the frame with clear empty margin on every",
  "side. THICK black outline, flat cel-shaded colour, at most three or four",
  "colours plus the outline. The EXPRESSION is the point and must read first,",
  "shrunk to 32 pixels.",
  "NO text, NO letters, NO numbers, NO frame, NO border, NO background",
  "scenery, NO drop shadow, NO speech bubble, NO weapons, NO card layout.",
  "Background: one FLAT SOLID mid-grey filling the whole frame, no",
  "checkerboard pattern, no transparency grid.",
].join(" ");

/**
 * Every emoji: which character it is, and what they are doing.
 *
 * The ids are `<character>_<feeling>` so that both halves are obvious at the
 * call site — the pack a thing belongs to is about the character, and what a
 * player MEANT by sending it is the feeling.
 */
export const EMOJI_LOOK: Record<string, { from: string; doing: string }> = {
  // ── Chuppy: the friend you are handed on day one ──
  chuppy_hi: { from: "chuppy", doing: "waving hello with one paw, beaming, eyes closed happily" },
  chuppy_laugh: {
    from: "chuppy",
    doing: "laughing helplessly, head thrown back, eyes squeezed shut, mouth wide open",
  },
  chuppy_heart: {
    from: "chuppy",
    doing: "making a heart shape with both paws above its head, blushing, adoring",
  },
  chuppy_tongue: {
    from: "chuppy",
    doing: "sticking its tongue out cheekily and winking with one eye",
  },

  // ── the Crumb Demon: the thing that fills an empty slot ──
  crumb_cry: {
    from: "crumb",
    doing: "sobbing with two enormous teary eyes and a wobbling frown, pitiful and sweet",
  },
  crumb_shock: {
    from: "crumb",
    doing: "utterly astonished, enormous round eyes, tiny shocked mouth, stubby arms flung up",
  },
  crumb_tongue: {
    from: "crumb",
    doing:
      "pulling a silly face with its TONGUE STICKING RIGHT OUT of a wide open mouth and both " +
      "eyes crossed inwards, mischievous",
  },

  // ── Flame Dragon ──
  dragon_fire: {
    from: "dragon",
    doing: "puffing one small heart-shaped flame from its nostrils, proud and pleased",
  },
  dragon_laugh: {
    from: "dragon",
    doing: "roaring with laughter, little flames escaping the corners of its mouth",
  },
  dragon_wink: { from: "dragon", doing: "giving a big confident wink with a toothy grin" },

  /*
   * ── Fried Bread (#42) ──
   *
   * The card is FURIOUS: fangs, scowl, clenched fists. These say "cute" and
   * "angry" in the same breath on purpose, because a sweetened-down bread
   * with a smile is not the character — the joke is that a slice of fried
   * bread is this cross about something.
   */
  bread_hi: { from: "bread", doing: "waving hello, grumpily, one fist still clenched" },
  bread_tongue: {
    from: "bread",
    doing: "sticking its tongue out rudely between its fangs, one eye screwed up, cheeky",
  },
  bread_heart: {
    from: "bread",
    doing:
      "scowling furiously while holding one tiny red heart out in front of it, as though "
      + "offering it under protest",
  },

  // ── Amanda herself ──
  amanda_smirk: {
    from: "amanda",
    doing: "a sly one-sided smirk, one eyebrow raised, utterly unbothered",
  },
  amanda_laugh: { from: "amanda", doing: "laughing wickedly but warmly, eyes crinkled shut" },
  amanda_heart: {
    from: "amanda",
    doing: "blowing a kiss, one tiny heart floating away from her lips",
  },
};

export function buildEmojiPrompt(id: string, styleBrief: string): string {
  const look = EMOJI_LOOK[id];
  if (!look) throw new Error(`no such emoji: ${id}`);
  return [`The character is ${look.doing}.`, EMOJI_RULES, `Art style: ${styleBrief}`].join(" ");
}

/** The reference image for this emoji, or "" when it is drawn from scratch. */
export function emojiReference(id: string): string {
  return EMOJI_REFS[EMOJI_LOOK[id]?.from ?? ""] ?? "";
}
