/**
 * The eighteen achievement icons, for Google Play Games.
 *
 * Or approved the list in docs/ACHIEVEMENTS.md; this is what each one looks
 * like. 512×512, which is what Play asks for.
 *
 * ═══ THE CONSTRAINT NOBODY MENTIONS ═══
 *
 * Play renders a LOCKED achievement by desaturating its icon. Most players
 * meet most of these locked — that is the whole point of a list you work
 * through — so the version seen most often is the grey one.
 *
 * Which means colour cannot be doing the work. Every brief below is written
 * so the SHAPE carries it: one subject, one silhouette, strong light-to-dark
 * contrast rather than hue contrast. An icon that is only legible because
 * the dragon is red is an icon that is illegible until it is earned.
 *
 * ═══ AND SIX OF THEM ARE NOT DRAWN AT ALL ═══
 *
 * The four arenas, Amanda and Chuppy already exist as painted artwork in
 * this game. Generating fresh pictures of them would produce eighteen icons
 * that look like a set and six that do not look like the game. So those are
 * CROPPED from the paintings the player already knows — the same reasoning
 * icons.ts gives for the app icon being a crop of Amanda's own portrait.
 */

/** Shared rules, so the twelve drawn ones read as one set. */
const RULES = [
  "A single flat ICON, centred, filling about 68% of the frame with clear empty",
  "margin on every side. ONE bold subject with an instantly readable silhouette.",
  "THICK dark outline, flat cel-shaded colour, strong LIGHT-TO-DARK contrast so",
  "the shape still reads when the whole image is turned to greyscale.",
  "At most three colours plus the outline.",
  "NO text, NO letters, NO numbers, NO frame, NO border, NO drop shadow.",
  "Background: one FLAT SOLID deep navy filling the whole frame, no scenery, no",
  "transparency grid, no checkerboard.",
].join(" ");

/** An icon cropped out of artwork the game already has. */
export interface Cropped {
  /** Under assets/raw/. */
  from: string;
  /** Where the subject sits, as fractions of the source, left/top/side. */
  crop: { x: number; y: number; size: number };
}

export const ACHIEVEMENT_CROPS: Record<string, Cropped> = {
  /*
   * ═══ ONLY THE TWO CHARACTERS ═══
   *
   * The four arena paintings were cropped here too, and all four came back
   * as a blank wall, a patch of sky, some brickwork and an empty forecourt.
   * The mistake is worth keeping written down: a BACKGROUND does not crop
   * into an icon. Those paintings are places, and a place is the part of a
   * picture that is not the subject — there is no 68% square anywhere in
   * them that says "train station".
   *
   * A character is the opposite. Amanda's portrait and Chuppy's card are
   * built around a face, which is exactly what an icon is, so these two crop
   * perfectly and are unmistakably from this game.
   *
   * The arenas moved to the drawn set below, where they are a hoop, a
   * signal, a lamp and a pump — the THING that names each place.
   */
  taught: { from: "brand/amanda_portrait.png", crop: { x: 0.26, y: 0.08, size: 0.48 } },
  chuppy: { from: "brand/chuppy_card.png", crop: { x: 0.2, y: 0.18, size: 0.6 } },
};

/** The twelve that are drawn. */
export const ACHIEVEMENT_LOOK: Record<string, string> = {
  // ── the ladder: the thing that NAMES each place, not the place ──
  arena_court:
    "a basketball hoop seen from the front, backboard and chain net, bolted to " +
    "a bare pole, cream board and orange rim",
  arena_station:
    "an old railway signal lamp on a post, its round lens glowing, one arm " +
    "raised beside it, dark steel and warm amber",
  arena_alley:
    "a bent street lamp leaning over, its light cone falling in a pool below " +
    "it, the glass cracked, dark blue night and pale yellow light",
  arena_fuel:
    "a petrol pump standing square with its nozzle hooked on the side and the " +
    "hose curling, chunky and boxy, cream body and red trim",

  // ── first steps ──
  first_win:
    "a single small golden trophy cup with two handles, sitting squarely, " +
    "a soft halo of light behind it, warm gold against cream",

  // ── the album ──
  cards_10:
    "a small fan of three playing cards held together, face down, with bold " +
    "chunky backs and rounded corners, cream and deep teal",
  album_half:
    "an open album lying flat, the left page covered in stuck-on cards and the " +
    "right page empty with four blank slots, cream paper and warm brown board",
  album_full:
    "a closed album standing upright with a heavy gold clasp and a burst of " +
    "light escaping the edges of its pages, rich cream and gold",
  family:
    "three identical monster cards standing in a tight row, shoulder to " +
    "shoulder, all the same colour, with a connecting glow along where they " +
    "touch, deep green and cream",
  legend:
    "an ornate crown resting on a card, rays of light behind it, the card " +
    "edged in filigree, regal purple and bright gold",

  // ── play ──
  trio:
    "three square tiles arranged in a straight line and touching along their " +
    "edges, lit from within, the outer two plain and the middle one blazing, " +
    "cream tiles and hot gold light",
  untouched_king:
    "a crown sitting behind a rounded shield, the shield unscratched and " +
    "catching a highlight, deep steel blue and gold",
  wins_10:
    "a golden trophy cup framed by two laurel branches curving up on either " +
    "side, bold and symmetrical, gold and olive green",
  wins_50:
    "a large golden trophy cup on a stepped plinth with flames rising behind " +
    "it, heavy and ceremonial, gold and deep orange",

  // ── around the game ──
  chests_10:
    "a wooden treasure chest with its lid thrown open and light pouring out, " +
    "iron bands and a heavy hinge, warm brown and gold",
  friend:
    "two rounded monster silhouettes side by side, both facing forward, " +
    "sharing one game controller held between them, cream shapes on navy",
};

export function buildAchievementPrompt(id: string, styleBrief: string): string {
  return [ACHIEVEMENT_LOOK[id], RULES, `Art style: ${styleBrief}`].join(" ");
}
