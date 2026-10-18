import type { IconName } from "../components/Icon";
import type { AbilityType, Element, Range, Rarity } from "@amanda/shared";

export interface ElementMeta {
  he: string;
  en: string;
  /** An id in `icons/` — see components/Icon.tsx, not an emoji. */
  icon: IconName;
  color: string;
}

export const ELEMENT_META: Record<Element, ElementMeta> = {
  fire: { he: "אש", en: "Fire", icon: "fire", color: "#e2492f" },
  water: { he: "מים", en: "Water", icon: "water", color: "#2f7fe2" },
  earth: { he: "אדמה", en: "Earth", icon: "earth", color: "#8a6d3b" },
  air: { he: "אוויר", en: "Air", icon: "air", color: "#9fd6e8" },
  electric: { he: "חשמל", en: "Electric", icon: "electric", color: "#f2c530" },
  metal: { he: "מתכת", en: "Metal", icon: "metal", color: "#9aa4ad" },
  light: { he: "אור", en: "Light", icon: "light", color: "#f5f0d0" },
  dark: { he: "אופל", en: "Dark", icon: "dark", color: "#7a5cad" },
  poison: { he: "רעל", en: "Poison", icon: "poison", color: "#6fbf3b" },
  variable: { he: "משתנה", en: "Variable", icon: "variable", color: "#b06fd6" },
};

export const RANGE_META: Record<Range, { he: string; en: string; icon: IconName }> = {
  melee: { he: "קרוב", en: "Melee", icon: "melee" },
  ranged: { he: "רחוק", en: "Ranged", icon: "ranged" },
  sniper: { he: "צלף", en: "Sniper", icon: "sniper" },
};

export const RARITY_META: Record<Rarity, { he: string; en: string; color: string }> = {
  common: { he: "נפוץ", en: "Common", color: "#9aa4ad" },
  rare: { he: "נדיר", en: "Rare", color: "#4aa3ff" },
  epic: { he: "אפי", en: "Epic", color: "#b06fd6" },
  legendary: { he: "אגדי", en: "Legendary", color: "#ffb020" },
};

/**
 * One colour per series. The series bonus needs 3+ cards of the same series on
 * the board, so the series has to be readable at a glance — this colour drives
 * the card frame and name plate, making same-series cards group visually.
 */
export const SERIES_META: Record<string, { he: string; en: string; color: string }> = {
  dragons: { he: "דרקונים", en: "Dragons", color: "#ff6a3d" },
  giants: { he: "ענקים", en: "Giants", color: "#b98a4e" },
  insects: { he: "חרקים", en: "Insects", color: "#c04ddb" },
  plants: { he: "צמחים", en: "Plants", color: "#4fc85f" },
  slimes: { he: "ריריים", en: "Slimes", color: "#2fc5c0" },
};
export const SERIES_FALLBACK_COLOR = "#8a93a6";

export function seriesColor(seriesId: string): string {
  return SERIES_META[seriesId]?.color ?? SERIES_FALLBACK_COLOR;
}

/**
 * Short labels for ability types, used when a card has no custom text.
 *
 * These are vocabulary, not voice — "Break armour" is the name of a mechanic
 * and translating it is terminology rather than writing. Amanda's own lines
 * are not in here, and they are not mine to translate.
 */
export const ABILITY_LABEL: Partial<Record<AbilityType, { he: string; en: string }>> = {
  knockback: { he: "הדף אחורה", en: "Knock back" },
  sideKnockback: { he: "הדף הצידה", en: "Knock sideways" },
  trample: { he: "דריסה והמשך", en: "Trample onward" },
  pullVacuum: { he: "שאיבה למרכז", en: "Pull to centre" },
  rootOnReveal: { he: "מלכודת הצמדה", en: "Rooting trap" },
  knockbackImmune: { he: "חסין הדיפה", en: "Immovable" },
  damageReflect: { he: "החזרת נזק", en: "Reflect damage" },
  armorGain: { he: "צבירת שריון", en: "Gain armour" },
  armorBreak: { he: "שבירת שריון", en: "Break armour" },
  armorAura: { he: "הילת שריון", en: "Armour aura" },
  damageShareAdjacent: { he: "ספיגה לשכנים", en: "Share with neighbours" },
  damageReductionAura: { he: "הילת הגנה", en: "Shield aura" },
  regen: { he: "התחדשות", en: "Regenerate" },
  healAura: { he: "הילת ריפוי", en: "Healing aura" },
  aoeRowAttack: { he: "מכה אזורית", en: "Area strike" },
  lineDenialDot: { he: "חסימת נתיב", en: "Block the lane" },
  freezeOnHit: { he: "הקפאה במכה", en: "Freeze on hit" },
  stackingDot: { he: "רעל מצטבר", en: "Stacking poison" },
  absorbOnCollision: { he: "בליעת יריב", en: "Swallow rival" },
  slowAura: { he: "הילת האטה", en: "Slowing aura" },
  attackSpeedAura: { he: "הילת מהירות", en: "Speed aura" },
  delayedTransform: { he: "התמרה מושהית", en: "Delayed change" },
  swarmOnDeath: { he: "נחיל במוות", en: "Swarm on death" },
  splitOnDeath: { he: "פיצול במוות", en: "Split on death" },
  sacrificeAdjacent: { he: "הקרבת בעל-ברית", en: "Sacrifice an ally" },
  elementSteal: { he: "גניבת אלמנט", en: "Steal element" },
};
