/**
 * The four candidate art directions for the style-exploration round, plus the
 * per-series visual templates. Once Or & Hod pick a direction we keep only the
 * winner here and it becomes the project's art bible.
 */

export interface StyleDirection {
  id: string;
  he: string;
  /** Style clause appended to every monster prompt. */
  style: string;
}

export const STYLE_DIRECTIONS: StyleDirection[] = [
  {
    id: "sticker",
    he: "מדבקות אלבום",
    style:
      "die-cut glossy sticker illustration, bold black outline, thick white sticker border, " +
      "vibrant saturated flat colors with simple cel shading, playful 90s trading-sticker album " +
      "aesthetic, crisp vector-like edges, high contrast",
  },
  {
    id: "darkcomic",
    he: "קומיקס אפל",
    style:
      "bold graphic-novel comic illustration, heavy black ink linework and confident cel shading, " +
      "RICH SATURATED VIVID colors, strong bright key light on the creature plus glowing elemental " +
      "rim light so it pops off the page, deep but COLORFUL shadows (never muddy, never black-on-black), " +
      "high contrast, energetic heroic presence, crisp readable silhouette, clean uncluttered backdrop",
  },
  {
    id: "softtoy",
    he: "צעצוע רך תלת-ממד",
    style:
      "cute stylized 3D render as a collectible vinyl toy figure, soft rounded shapes, smooth " +
      "matte materials, warm three-point studio lighting, subtle subsurface glow, pastel-rich " +
      "color palette, premium octane render quality",
  },
  {
    id: "painted",
    he: "פנטזיה מצוירת ביד",
    style:
      "hand-painted fantasy illustration, visible gouache brush strokes, warm storybook color " +
      "palette, soft painterly edges, expressive character design, textured paper feel, " +
      "whimsical children's book art",
  },
];

/** Framing rules shared by every generated card so the set stays uniform. */
export const FRAMING =
  "ONE single full-body creature, centered, three-quarter front view facing slightly left, " +
  "consistent camera distance, character fully inside the image with a small even margin, " +
  "plain simple backdrop with a soft radial glow behind the creature. " +
  "ABSOLUTELY NO TEXT of any kind: no letters, no words, no numbers, no name, no title, no caption, " +
  "no signature, no watermark, no logo. " +
  "NO CARD FRAME and NO BORDER: do not draw a trading card, do not draw a frame, panel, inner " +
  "rectangle, rounded-rectangle outline or picture-in-picture. Just the creature on the backdrop.";

/** Per-series colour/motif guidance layered on top of the chosen style. */
export const SERIES_TEMPLATE: Record<string, string> = {
  dragons: "fiery reds and molten oranges with obsidian black accents, ember particles, scale textures",
  slimes: "translucent glossy gel body, wet highlights, acid green and aqua blue palette, drip shapes",
  plants: "verdant greens with flower-bright accents, leaf and vine shapes, soft organic silhouettes",
  insects: "chitinous exoskeleton sheen, amber and deep violet palette, sharp angular limbs",
  giants: "rough craggy stone and raw hammered metal, earthy grey-brown palette with warm mineral veins, massive heavy blocky silhouette",
};

/** Test monsters used for the style bake-off (aggressive / cute / giant boss). */
export const TEST_MONSTERS = [
  "dragons_01_flame_dragon",
  "slimes_01_basic_slime",
  "slimes_10_zelig_giant_ooze",
];
