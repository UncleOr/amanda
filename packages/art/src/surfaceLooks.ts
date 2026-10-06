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

/*
 * ── the painted scenes ──
 *
 * Or: "the same goes for how the results are shown in the personal area. Very
 * app-like. Gaming. Fun. Illustrations."
 *
 * These are NOT backgrounds and they do not obey the rules above. They are the
 * picture a child actually looks at when a match ends and when they open their
 * own page — so each one has a subject, a joke, and somewhere for the eye to
 * land. The rules they do obey:
 *
 *   SHE IS THE HOST, NOT THE VILLAIN. Losing is her being delighted, not the
 *   player being punished. Nothing grim, no gore, no real fear — the game is
 *   for a seven-year-old and the loss screen is the one that has to be kindest.
 *
 *   ROOM ALONG THE BOTTOM. A headline and three buttons sit over the lower
 *   third of every one of these, so the composition keeps that part quiet.
 */
export const SCENE_LOOK: Record<string, string> = {
  /** You won. */
  scene_win:
    "A joyful victory scene: a small triumphant cartoon monster hoisted on the " +
    "shoulders of two other goofy monsters, holding up a huge golden trophy, " +
    "gold confetti and sparks raining down, a banner of light behind them. " +
    "Warm golds and cream against deep teal. Celebratory, funny, loud. " +
    "EMPTY DARKER AREA ACROSS THE BOTTOM THIRD of the frame",

  /** You lost — and she is thrilled about it. */
  scene_lose:
    "A funny defeat scene: a towering teal three-headed spirit queen looming " +
    "with a wide delighted grin, licking her lips, while three small cartoon " +
    "monsters lie comically flattened and dizzy at the bottom with X eyes and " +
    "little stars spinning over them. Playful and silly, absolutely NOT " +
    "frightening, NO blood, NO gore, NO real injury. Cool teals and violets. " +
    "EMPTY DARKER AREA ACROSS THE BOTTOM THIRD of the frame",

  /** The top of the player's own page. */
  scene_profile:
    "A wide heraldic banner for a player card: an ornate dark wooden plaque " +
    "with brass corners and rivets, two small cartoon monster heads peering " +
    "over the top edge from behind it, trailing ribbons, a hanging chain. " +
    "A LARGE EMPTY FLAT PANEL IN THE CENTRE with nothing on it. " +
    "Deep navy and brass, warm and inviting",

  /**
   * The top of the album.
   *
   * The first version came back a PHOTOGRAPH of a real album on a table, and
   * it was both out of key with everything else and impossible to crop into a
   * wide strip — a slice through it is a slice of floor. This asks for a flat
   * drawn band instead, composed as the shape it has to fill.
   */
  scene_album:
    "A WIDE FLAT DRAWN BANNER, not a photograph: a row of monster trading " +
    "cards fanned out side by side across the whole width, seen straight on, " +
    "their backs patterned and their corners overlapping, with a few gold " +
    "stars and sparks between them. Deep indigo and brass over a dark " +
    "background. The composition fills the whole wide strip evenly with no " +
    "empty corners and no single focal point",
};

export const SCENE_ASPECT: Record<string, "16:9" | "21:9" | "4:3"> = {
  scene_win: "4:3",
  scene_lose: "4:3",
  scene_profile: "21:9",
  scene_album: "21:9",
};

const SCENE_RULES = [
  "A rich, finished ILLUSTRATION for a children's monster card game.",
  "NO text, NO letters, NO numbers, NO words anywhere in the image.",
  "NO user interface, NO buttons, NO frame around the picture.",
  "Appealing and readable to a seven-year-old: nothing frightening, no gore,",
  "no blood, no real menace. Bold shapes, strong silhouettes, poster-quality.",
].join(" ");

export function buildScenePrompt(id: string, styleBrief: string): string {
  return [SCENE_LOOK[id], SCENE_RULES, `Art style: ${styleBrief}`].join(" ");
}

export const SURFACE_ASPECT: Record<string, "1:1" | "16:9" | "3:4" | "4:3"> = {
  album_page: "3:4",
  desk: "16:9",
  menu_backdrop: "16:9",
  battle_strip: "16:9",
};

export function buildSurfacePrompt(id: string, styleBrief: string): string {
  return [SURFACE_LOOK[id], SURFACE_RULES, `Art style: ${styleBrief}`].join(" ");
}
