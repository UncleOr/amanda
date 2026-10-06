/**
 * The surfaces the game is played on.
 *
 * Or, after seeing the first pass: "I know you like being lazy and doing a bin
 * emoji and a sound emoji… and generating the albums somehow, but in the end
 * you will have to make real graphics for everything, actual pictures that are
 * the background, nice pictures and not some automatic thing."
 *
 * He is right, and the album pages were the clearest case: they were four CSS
 * gradients pretending to be paper. Paper has a fibre, a tooth, foxing at the
 * edges and a print that is very slightly off-register, and none of those are
 * a linear-gradient. These are photographs of the thing instead.
 *
 *   pnpm art:surfaces [style]
 *
 * TWO RULES, and both exist because a background that does not obey them
 * fights the cards in front of it:
 *
 *   EMPTY. No subject, no focal point, no composition. Anything the eye lands
 *   on is a thing the eye is not landing on the board.
 *
 *   QUIET. Low contrast, dark, desaturated. The cards are the only saturated
 *   objects in this game and they have to stay that way.
 */

const SURFACE_RULES = [
  "A FLAT, EVEN, EMPTY BACKGROUND TEXTURE for a game interface.",
  "NO subject, NO character, NO objects, NO focal point, NO composition, NO",
  "text, NO letters, NO logo, NO border, NO frame, NO vignette lettering.",
  "Evenly lit edge to edge with no bright hotspot. LOW CONTRAST and DARK —",
  "it sits BEHIND colourful cards and must never compete with them.",
  "Photographed flat from directly above, filling the whole frame.",
].join(" ");

export const SURFACE_LOOK: Record<string, string> = {
  /*
   * The page of the album. This is what each 4x4 board is drawn on, so the
   * four printed card outlines and the spine stay in CSS on top of it — they
   * have to line up with real slots at any screen size, and a picture of them
   * never would.
   */
  album_page:
    "An empty page of an old monster sticker album, dark slate-blue aged paper, " +
    "visible paper fibre and tooth, faint foxing and darkening towards the edges, " +
    "a very subtle grid of pressed creases, soft and matte",

  /** What the two albums are lying on. */
  desk:
    "The surface of a dark worn wooden table seen from directly above, deep " +
    "charcoal-brown boards with long grain, a few faint scratches and ring " +
    "stains, lit evenly and very dimly",

  /**
   * Behind the home screen, under Amanda. Deliberately the only one of these
   * with any drama in it: nothing is in front of it except the title and two
   * buttons, so it can carry the room.
   */
  menu_backdrop:
    "A dim attic room at night seen as an empty wall and floor, stacks of old " +
    "monster card albums and loose cards piled in the corners far out of focus, " +
    "deep teal and midnight blue, dust motes in a single shaft of cold light",

  /** The strip the battle is fought on, between the two boards. */
  battle_strip:
    "A narrow worn strip of dark stone arena floor seen from above, cracked flagstones, " +
    "scorch marks and scattered grit, deep grey-blue, very dim",
};

export const SURFACE_ASPECT: Record<string, "1:1" | "16:9" | "3:4" | "4:3"> = {
  album_page: "3:4",
  desk: "16:9",
  menu_backdrop: "16:9",
  battle_strip: "16:9",
};

export function buildSurfacePrompt(id: string, styleBrief: string): string {
  return [SURFACE_LOOK[id], SURFACE_RULES, `Art style: ${styleBrief}`].join(" ");
}
