/**
 * Battlefield backdrops for the battle arena.
 *
 * The arena is a wide 8x4 grid of lanes seen from above at a shallow angle, and
 * the monsters fight ON TOP of it. That makes this the one piece of art that has
 * to stay QUIET: low contrast, desaturated, nothing busy in the middle band, or
 * the cards stop reading. Every brief below is written against that constraint.
 */
export interface ArenaLook {
  id: string;
  he: string;
  brief: string;
}

export const ARENA_LOOKS: ArenaLook[] = [
  {
    id: "rift",
    he: "בקע הלבה",
    brief:
      "A vast cracked obsidian battlefield seen from a high angle. A narrow glowing " +
      "lava rift runs vertically down the exact centre of the image, splitting the " +
      "field into two mirrored halves. Thin orange cracks spread from the rift into " +
      "the black stone. Cold blue fog pools at the top and bottom edges.",
  },
  {
    id: "colosseum",
    he: "הזירה העתיקה",
    brief:
      "The sand floor of a ruined ancient colosseum seen from a high angle. Packed " +
      "grey-brown sand, broken flagstones, a faint circular ritual carving in the " +
      "centre, scattered chipped bones and a few toppled pillar drums near the edges. " +
      "Shafts of pale dusty light fall across it. Deep shadow at the top and bottom.",
  },
  {
    id: "swamp",
    he: "ביצת הצללים",
    brief:
      "A dark swamp battlefield seen from a high angle. Wet black mud and shallow " +
      "stagnant water that reflects a sickly green glow, knotted roots and dead reeds " +
      "around the edges, a few pale toadstools. Low mist drifts across the middle. " +
      "Nothing taller than ankle height anywhere.",
  },
];

/**
 * Framing rules shared by every backdrop. The hard bans exist because the first
 * pass of monster art kept inventing text and frames; a backdrop that does that
 * would sit permanently under the whole battle.
 */
export const ARENA_FRAMING =
  "Top-down three-quarter view of an EMPTY battlefield floor — a stage for " +
  "miniatures, photographed from above and slightly in front. Wide cinematic " +
  "composition. " +
  "ABSOLUTELY NO CREATURES, no monsters, no people, no animals, no characters. " +
  "ABSOLUTELY NO TEXT, no letters, no numbers, no logos, no watermark. " +
  "NO user interface, NO grid lines, NO frame, NO border, NO vignette drawn in. " +
  "The CENTRE of the image must stay visually calm and uncluttered — all detail " +
  "belongs near the top and bottom edges — because game pieces are drawn on top " +
  "of the middle and must stay readable. " +
  "Muted and desaturated, roughly 25% darker than a normal illustration, with no " +
  "bright highlights in the central band. Left and right halves mirror each other " +
  "so neither player's side looks more important.";

export function buildArenaPrompt(look: ArenaLook, styleBrief: string): string {
  return [
    look.brief,
    ARENA_FRAMING,
    `Art style: ${styleBrief}`,
  ].join(" ");
}
