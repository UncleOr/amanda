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
  win: "a golden laurel wreath crown bursting with light, triumphant",
  lose: "a cracked grey skull-less stone marker split down the middle, dull and defeated",

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
};

export function buildIconPrompt(id: string, styleBrief: string): string {
  return [ICON_LOOK[id], ICON_RULES, `Art style: ${styleBrief}`].join(" ");
}
