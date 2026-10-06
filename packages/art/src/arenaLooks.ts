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

/*
 * ── Or's arenas, 2026-10-06 ──
 *
 * Named by him, in order, and the order IS the progression: a games room on
 * the carpet at the start, a petrol station at the top. Every one of them is
 * somewhere a child in Israel actually goes, which is the whole idea — the
 * monsters are fighting on your floor, in your street, at the station you pass
 * on the way to your grandmother.
 *
 * They still have to be QUIET. Seen from above, low contrast, nothing busy in
 * the middle band, or the cards stop reading. A battlefield that is more
 * interesting than the battle is a worse battlefield than a flat grey one.
 */
export const ARENA_LOOKS: ArenaLook[] = [
  {
    id: "playroom",
    he: "חדר המשחקים",
    brief:
      "A child's playroom floor seen from directly above: a worn patterned rug in " +
      "muted blues and browns, scattered building blocks, a toy car and a few loose " +
      "crayons pushed to the far edges. Warm lamplight from one side. The middle of " +
      "the rug is plain and empty.",
  },
  {
    id: "court",
    he: "המגרש",
    brief:
      "A neighbourhood outdoor basketball court seen from directly above at dusk: " +
      "cracked faded asphalt, worn white painted lines, a few weeds through the " +
      "cracks, a chain-link fence shadow falling across the far edges. Desaturated " +
      "grey-green. The centre of the court is empty tarmac.",
  },
  {
    id: "station",
    he: "תחנת הרכבת",
    brief:
      "An empty railway platform seen from directly above at night: wet concrete, a " +
      "yellow safety line down each side, rails and gravel at the far edges, puddles " +
      "reflecting cold station lights. Deep blue-grey. The middle of the platform is " +
      "bare and unlit.",
  },
  {
    id: "alley",
    he: "סמטת האימה",
    brief:
      "A narrow dark alley floor seen from directly above: wet uneven cobbles, a " +
      "drain grate, scattered rubbish and a fallen bin pushed against the walls at " +
      "the far edges, one weak green streetlamp glow seeping in from one side. " +
      "Very dark, murky green-black, mist along the ground. The centre is empty.",
  },
  {
    id: "fuel",
    he: "תחנת הדלק",
    brief:
      "A petrol station forecourt seen from directly above at night: oil-stained " +
      "concrete, faded painted lane arrows, a pump island and a fallen traffic cone " +
      "pushed to the far edges, harsh canopy light pooling and dying out towards the " +
      "corners, a rainbow sheen in one puddle. Industrial grey and amber. The middle " +
      "of the forecourt is bare.",
  },

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
