/**
 * The game's own icons, replacing the emoji.
 *
 * Emoji were never Amanda's: they are drawn by whoever made the operating
 * system, they look different on every phone, and next to hand-painted cards
 * they look borrowed. These are drawn in the same language as everything else.
 *
 *   pnpm art:icons-set [style]   generate the ones that do not exist yet
 *
 * The brief below is the whole job. An icon is not a small illustration — at
 * 24 pixels, detail is mud. One subject, one silhouette, a thick outline and
 * flat colour, with nothing touching the edges.
 */

/** Shared rules. Every icon gets these, so the set looks like a set. */
const ICON_RULES = [
  "A single flat ICON, centred, filling about 70% of the frame with clear empty",
  "margin on every side. ONE simple bold subject with an instantly readable",
  "silhouette. THICK black outline, flat cel-shaded colour, at most two or three",
  "colours plus the outline, strong contrast. Chunky and solid — it must stay",
  "legible shrunk to 24 pixels. NO text, NO letters, NO numbers, NO frame, NO",
  "border, NO background scenery, NO drop shadow, NO gradient mesh.",
  "Background: one FLAT SOLID mid-grey filling the whole frame, no checkerboard",
  "pattern, no transparency grid.",
].join(" ");

/**
 * Every icon the game needs, grouped the way a player meets them.
 * The ids are what the app asks for: `icons/<id>.png`.
 */
export const ICON_LOOK: Record<string, string> = {
  // ── the two numbers on every card ──
  hp: "a bold heart, deep crimson red with a bright highlight",
  power: "a clenched armoured fist striking, hot orange and gold",

  // ── how a match ends ──
  //
  // These two are the exception to the rule above. They are never inline —
  // they carry the result screen at 96px and larger — so they may be rich.
  // The first pass obeyed the small-icon brief and made a thin laurel ring and
  // a grey slab: correct for 24px, and lifeless blown up. Closed, bold shapes
  // with a subject, not a symbol.
  win:
    "a fat golden trophy cup overflowing with light, a burst of rays behind it " +
    "and gold confetti flecks, rich and celebratory, deep warm golds and cream",
  lose:
    "a monster card lying face up and cracked clean across the middle, a bite " +
    "taken out of one corner, dim violet and cold grey, glum but funny rather " +
    "than grim",

  // ── what kind of card this is ──
  monster: "a simple fanged monster silhouette head, violet, friendly-menacing",
  action: "a lightning-struck playing card tilted on its corner, electric blue and gold",

  // ── elements ──
  fire: "a single bold flame, orange and yellow",
  water: "a single fat water droplet, bright blue with a white glint",
  earth: "a chunky cracked boulder, warm brown and tan",
  air: "a curling wind swirl, pale cyan and white",
  electric: "a thick jagged lightning bolt, brilliant yellow",
  metal: "a riveted steel gear, cold grey and steel blue",
  light: "a four-pointed sparkle star bursting, pale gold and cream",
  dark: "a crescent of shadow with a violet glow behind it, deep purple and black",
  poison: "a dripping blob of toxic ooze with a bubble, sickly green",
  variable: "two curved arrows chasing each other in a circle, iridescent pink and violet",

  // ── how far a monster reaches ──
  melee: "a short broad sword blade, steel with a gold hilt",
  ranged: "a drawn bow with an arrow nocked, wood brown and string white",
  sniper: "a target reticle with crosshairs, red and white",

  // ── the board ──
  king: "a heavy five-pointed royal crown, gold with a red jewel",
  guard: "a sturdy kite shield with a bold cross band, steel blue and silver",
  stacked: "two cards stacked one on top of the other seen at a slight angle, teal and gold",
  frozen: "a jagged block of blue ice with a frost star on it, pale cyan",

  // ── the hand ──
  deck: "a neat stack of face-down cards seen from the side, indigo with gold edges",
  discard: "an open bin with a single card tipping out of it, grey steel and gold",
  recycle: "two arrows curving into a recycling loop around a card, bright green",

  // ── match state ──
  timer: "a chunky hourglass with sand falling, warm amber and brass",
  ready: "a bold check mark, bright green, thick and confident",
  warning: "a rounded triangle with an exclamation stroke, amber and black",

  /*
   * ── the second pass ──
   *
   * Or, on the first version of the chrome: "I know you like being lazy and
   * doing a bin emoji and a sound emoji and an hourglass emoji and a swords
   * emoji… in the end you will have to make real graphics for everything."
   * He is right, and these are the rest of them: every emoji that was still
   * standing in the interface, drawn in the same hand as the cards.
   */

  // ── sound and music, which is where he noticed it ──
  soundOn: "a chunky speaker cone with two bold curved sound waves, warm cream and gold",
  soundOff: "a chunky speaker cone with a thick diagonal slash through it, dull grey and red",
  musicOn: "two joined musical notes, bold and round, violet and gold",
  musicOff: "two joined musical notes with a thick diagonal slash through them, dull grey",

  // ── the chrome of the screen ──
  exit: "a thick rounded X cross, bold strokes, dusty red and cream",
  menu: "three thick stacked horizontal bars with rounded ends, cream and gold",
  back: "a fat rounded arrow curving back to the left, pale cyan and white",
  again: "two thick arrows chasing each other in a closed circular loop, bright teal",
  plus: "a fat rounded plus sign, bright green with a thick outline",
  play: "a fat rounded triangle pointing right, bright orange",
  stop: "a fat rounded square, pale cyan",
  info: "a bold lowercase letter i inside a thick circle, pale blue and cream",
  erase: "a chunky pink eraser block seen at an angle with a smudge under it, pink and cream",
  report: "a clipboard with three bold ruled lines on it, warm tan board and cream paper",

  // ── things the game is about ──
  gem: "a cut diamond gem with facets and a bright glint, brilliant cyan and white",
  chest: "a fat wooden treasure chest with iron bands, lid slightly ajar with light spilling out, warm brown and gold",
  skull: "a chunky cartoon monster skull with two fangs, bone cream and deep grey",
  infinity: "a bold rounded infinity loop, violet and gold",
  explode: "a chunky comic starburst explosion, orange red and yellow",
  target: "a bold crosshair target over a card corner, red and cream",
  move: "a running boot with two speed lines behind it, tan leather and pale blue lines",
  fly: "a single broad feathered wing, pale cream and soft blue",
  eye: "a wide open eye with a bold round pupil, pale cyan iris and cream",
  hidden: "an eye with a thick bar across it, dull grey and violet",
  build: "a stack of three blocks being set down by a crane hook, warm amber and steel",
  blood: "a single fat dripping blood droplet, deep crimson",
  split: "one blob dividing into two smaller blobs, sickly green",
  thorns: "a short spiked branch with three thorns, dark green and bone",
  joker: "a jester hat with two bells, violet and gold",
  flag: "a chequered finish flag on a short pole, black and white squares",

  // ── who you are playing ──
  robot: "a boxy robot head with two round glowing eyes and an antenna, steel grey and red",
  friend: "two rounded character silhouettes side by side, one teal one gold",
  online: "a globe with a bold meridian and a signal arc beside it, deep blue and cream",
  unplugged: "a power plug pulled out of its socket with the cable curling, grey and red",
  phone: "a phone held upright with a curved rotate arrow around it, steel and gold",
};

export function buildIconPrompt(id: string, styleBrief: string): string {
  return [ICON_LOOK[id], ICON_RULES, `Art style: ${styleBrief}`].join(" ");
}
