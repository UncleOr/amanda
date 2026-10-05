/**
 * Amanda herself.
 *
 * She is NOT invented here. Her design is canon and comes from the original
 * card deck — `assets/reference/monster-cards-with-bleed.pdf`, page 8, cropped
 * to `assets/reference/amanda-canon.png`. Her card reads:
 *
 *   אמנדה · #∞ · סדרה: האגדיים · כוח: תוהו · טורפת נשמות · ∞ hp · ∞ power
 *
 * A first attempt at this file guessed a smug purple horned brute from her
 * voice alone and got every single thing wrong. Anything generated from here
 * answers to the reference image, not to a description of her personality.
 *
 * One open question, flagged rather than decided: the reference is a soft
 * DIGITAL PAINTING, while every card in the game is `darkcomic` — heavy ink,
 * cel shading. These briefs keep her design and take the game's style so she
 * sits beside the cards. Matching the painting instead is a one-word change.
 */

/** Amanda's canon description — shared by every brand image so she stays one creature. */
export const AMANDA = [
  "AMANDA, a towering three-headed soul-devouring wraith.",
  "CENTRE HEAD: a gaunt spectral humanoid face of glowing teal-cyan spirit-fire,",
  "hollow cheeks, two blank white-hot glowing eyes, a crown-like halo of swirling",
  "ghost flame rising off her skull.",
  "LEFT HEAD: a translucent teal serpent-dragon head on a long neck, jaws parted.",
  "RIGHT HEAD: a burning orange lion head with a mane of living fire, snarling.",
  "BODY: tall and impossibly gaunt, deep navy-black, draped like smoke, dissolving",
  "into mist and embers at the bottom instead of legs. Enormously long skeletal",
  "arms ending in long curved claws.",
  "Golden glowing runes float in the air around her.",
  "Palette: icy teal and cyan against ember orange, over deep midnight blue.",
  "Ancient, vast and amused — a queen, not a beast. NO gore, NO blood.",
].join(" ");

/** One brief per brand image. */
export const BRAND_LOOK: Record<string, string> = {
  // The face. Everything else is cropped from this, so it is centred and
  // symmetrical with nothing important near the edges.
  amanda_portrait:
    `${AMANDA} Head-and-shoulders portrait of the CENTRE head, facing straight ahead, ` +
    "perfectly centred and symmetrical, the serpent head and the burning lion head " +
    "flanking her at the edges of the shoulders. Deep midnight-blue backdrop with a " +
    "faint rune glow. The subject fills the middle 70% with clear margin on all four " +
    "sides so it survives being cropped to a circle. Readable silhouette at tiny sizes.",

  // The logo lockup. No lettering is asked for — Hebrew is not something an
  // image model can spell, and the wordmark is set in the app over this.
  amanda_logo:
    `${AMANDA} An emblem: her three heads and clawed upper body inside a bold rounded ` +
    "badge with a thick outline, like a sticker-album crest. Monster cards fan out " +
    "behind her shoulders on both sides. Centred and symmetrical. " +
    // Asking for transparency once got a checkerboard PAINTED INTO the picture —
    // the pattern an editor draws to SHOW transparency. Ask for a flat colour and
    // cut it out afterwards instead (see cutBackdrop in process.ts).
    "Background: one FLAT SOLID dark midnight-blue colour filling the whole frame, " +
    "absolutely no checkerboard pattern, no grey squares, no transparency grid. " +
    "NO TEXT, NO LETTERS, NO WORDS of any kind.",

  // Wide art for the Amanda-mode screen, where she shares the frame with UI.
  amanda_banner:
    `${AMANDA} Wide horizontal banner. Amanda looms in from the RIGHT side of the ` +
    "frame at full height, arms spread wide, looking down at the viewer. The LEFT " +
    "HALF is near-empty midnight atmosphere with drifting runes and embers — " +
    "deliberate negative space for text. NO TEXT, NO LETTERS.",
};

/** Shape each brand image is generated at. */
export const BRAND_ASPECT: Record<string, "1:1" | "16:9"> = {
  amanda_portrait: "1:1",
  amanda_logo: "1:1",
  amanda_banner: "16:9",
};

export function buildBrandPrompt(id: string, styleBrief: string): string {
  return [
    BRAND_LOOK[id],
    "Single character, clean and uncluttered, poster-quality, no watermark, no signature.",
    `Art style: ${styleBrief}`,
  ].join(" ");
}
