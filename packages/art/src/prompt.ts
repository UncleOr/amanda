import type { Card } from "@amanda/shared";
import { FRAMING, SERIES_TEMPLATE, type StyleDirection } from "./styles.js";
import { CARD_LOOK } from "./cardLooks.js";

/**
 * Turns a card's own GDD data into a visual description. The English name plus
 * the element and the designer's "role" text already describe the creature, so
 * the art stays faithful to the design document rather than inventing a look.
 */
const ELEMENT_LOOK: Record<string, string> = {
  fire: "blazing fire motifs, glowing embers, molten cracks",
  water: "flowing water motifs, wet glossy surface, cool blue tones",
  earth: "rocky earthen textures, moss and soil tones",
  air: "swirling wind motifs, feathery light forms, pale sky tones",
  electric: "crackling electricity arcs, glowing yellow-white sparks",
  metal: "polished metal plating, riveted armor, steel sheen",
  light: "radiant golden glow, soft holy light aura",
  dark: "shadowy smoke wisps, deep violet-black aura, eerie glow",
  poison: "bubbling toxic ooze, sickly green vapor",
  variable: "shifting iridescent surface that changes hue",
};

/** Kept body-shape agnostic — many melee monsters have no limbs at all. */
const RANGE_LOOK: Record<string, string> = {
  melee: "built for close-quarters combat",
  ranged: "poised to hurl something from a distance",
  sniper: "long-range shooter silhouette, focused precise stance",
};

/**
 * Temperament axis. Not every monster should be scary — tiny support creatures
 * read better as adorable, while bosses and heavy hitters stay menacing.
 */
export type Vibe = "cute" | "fierce" | "neutral";

export function vibeOf(card: Card): Vibe {
  const supportive = card.abilities.some((a) =>
    ["healAura", "attackSpeedAura", "armorAura", "regen"].includes(a.type),
  );
  const dark = card.elements.includes("dark");
  const venomous = card.elements.includes("poison");
  const huge = card.stats.hp >= 1000; // a 1400hp steel giant is never "cute"
  if (card.midBoss || dark || card.stats.power >= 700) return "fierce";
  if (!huge && !venomous && (supportive || (card.stats.power <= 350 && card.stats.hp <= 900)))
    return "cute";
  return "neutral";
}

const VIBE_LOOK: Record<Vibe, string> = {
  cute: "ADORABLE and friendly: big expressive sparkling eyes, soft rounded chunky proportions, " +
    "small and huggable, cheerful charming expression, utterly non-threatening and lovable",
  fierce: "MENACING and intimidating: fearsome aggressive expression, bared fangs or sharp " +
    "dangerous forms, powerful imposing presence, battle-ready snarl",
  neutral: "confident and characterful, determined battle-ready expression, appealing heroic design",
};

/** Pose scales with actual movement speed so slow crawlers don't look like chargers. */
function poseFor(card: Card): string {
  if (card.stats.moveSpeed <= 0) return "grounded planted stance";
  if (card.stats.moveSpeed >= 1.5) return "dynamic charging forward pose, sense of speed";
  return "slowly advancing forward, deliberate heavy movement";
}

/** Build the full text prompt for one monster in a given style direction. */
export function buildPrompt(card: Card, dir: StyleDirection): string {
  const element = ELEMENT_LOOK[card.elements[0]!] ?? "";
  const range = RANGE_LOOK[card.stats.range] ?? "";
  const seriesLook = SERIES_TEMPLATE[card.seriesId] ?? "";
  const role = card.role?.en ?? "";
  const scale = card.midBoss
    ? "colossal imposing boss creature, towering and massive"
    : "creature character";
  const motion = poseFor(card);

  const look = CARD_LOOK[card.id];
  return [
    `A ${scale} named "${card.name.en}" for a monster trading-card game.`,
    // The per-card brief leads: it fixes the silhouette and keeps creatures in
    // the same series from coming out as near-identical twins.
    look ? `DESIGN (follow closely): ${look}.` : "",
    role && `Role flavour: ${role}`,
    VIBE_LOOK[vibeOf(card)] + ".",
    [element, range, motion].filter(Boolean).join(", ") + ".",
    // Series cue is a light touch only — it must not flatten the design above.
    seriesLook ? `Subtle family cue (do not let this override the design): ${seriesLook}.` : "",
    dir.style + ".",
    FRAMING + ".",
    "Make this creature clearly and immediately distinguishable from every other " +
      "monster in its family — a different body plan and silhouette, not a recolour.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Prompt used when generating against the approved style anchor image, so the
 * new creature inherits the exact rendering style of the reference.
 */
export function buildAnchoredPrompt(card: Card, dir: StyleDirection): string {
  return (
    "Using the attached reference image ONLY as a style guide (matching its rendering technique, " +
    "line quality, shading, color treatment, framing and background style), draw a COMPLETELY " +
    "DIFFERENT creature: " +
    buildPrompt(card, dir) +
    " Do not copy the reference creature's shape, colors or species — only its art style."
  );
}
