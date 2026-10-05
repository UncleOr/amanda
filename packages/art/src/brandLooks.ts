/**
 * Amanda herself.
 *
 * She had no face until now. The only picture of her in the game is the
 * "Amanda's Awakening" card, where she is a silhouette tearing its way out of
 * a rift above an abandoned train platform — an absence, not a character. The
 * brief below turns Or's description of her voice into a body:
 *
 *   cynical · a food lover, mainly of tasty children · enormously pleased with
 *   herself · happy to teach you how to win, because she will eat you anyway.
 *
 * So: not a horror monster. A monster who finds you delicious and finds you
 * funny, and cannot decide which she enjoys more. She has to carry a card game
 * for children, which means she reads at 32 pixels and never stops smirking.
 */

/** What Amanda looks like, used by every brand image so she stays one creature. */
export const AMANDA = [
  "AMANDA: a huge grinning monster matriarch, violet-black fur or hide with deep purple shadows",
  "and hot-magenta rim light, a broad knowing smirk showing neat white fangs (amused, never",
  "savage), heavy-lidded half-closed eyes that say she has already won, two curling dark horns,",
  "a thick expressive brow, plush rounded shoulders — imposing but never gaunt or gory.",
  "Charismatic and smug, the villain children quote. Absolutely NOT scary-realistic, NO blood,",
  "NO gore, NO human remains.",
].join(" ");

/** One brief per brand image. */
export const BRAND_LOOK: Record<string, string> = {
  // The face. Everything else is cropped from this one, so it is centred and
  // symmetrical, with nothing important near the edges.
  amanda_portrait:
    `${AMANDA} Head-and-shoulders portrait, facing straight ahead, perfectly centred, ` +
    "symmetrical composition, chin slightly lowered so she looks down at the viewer, " +
    "one eyebrow raised. Simple deep-violet radial backdrop with a faint rift glow behind " +
    "her head. The subject fills the middle 70% with clear empty margin on all four sides, " +
    "so the image survives being cropped to a circle. Crisp readable silhouette at tiny sizes.",

  // The logo lockup. No text — Hebrew lettering is not something an image model
  // can be trusted with, so the wordmark is drawn in the app over this.
  amanda_logo:
    `${AMANDA} An emblem: Amanda's grinning head and shoulders emerging through a jagged ` +
    "torn rift of purple-black energy, framed inside a bold rounded badge shape with a thick " +
    "ink outline, like a sticker-album crest. Playing cards fan out behind her shoulders on " +
    "both sides. Centred, symmetrical. " +
    // Asking for transparency got a checkerboard PAINTED INTO the picture —
    // the model drew the pattern an editor uses to SHOW transparency. So ask
    // for a flat colour instead and let the badge sit on it.
    "Background: one FLAT SOLID dark violet colour filling the whole frame, " +
    "absolutely no checkerboard pattern, no grey squares, no transparency grid. " +
    "Strong silhouette, poster-weight shapes.",

  // Wide art for the menu, where she shares the frame with the UI.
  amanda_banner:
    `${AMANDA} Wide horizontal banner composition. Amanda leans in from the RIGHT side of ` +
    "the frame, elbow resting on a stack of oversized monster cards, chin propped on one " +
    "clawed hand, smirking at the viewer. The LEFT HALF of the image is near-empty dark " +
    "violet atmosphere with drifting rift embers — deliberate negative space for text to sit " +
    "over. NO TEXT, NO LETTERS.",
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
