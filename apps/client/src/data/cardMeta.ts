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

export const RANGE_META: Record<Range, { he: string; icon: IconName }> = {
  melee: { he: "קרוב", icon: "melee" },
  ranged: { he: "רחוק", icon: "ranged" },
  sniper: { he: "צלף", icon: "sniper" },
};

export const RARITY_META: Record<Rarity, { he: string; color: string }> = {
  common: { he: "נפוץ", color: "#9aa4ad" },
  rare: { he: "נדיר", color: "#4aa3ff" },
  epic: { he: "אפי", color: "#b06fd6" },
  legendary: { he: "אגדי", color: "#ffb020" },
};

/**
 * One colour per series. The series bonus needs 3+ cards of the same family on
 * the board, so the family has to be readable at a glance — this colour drives
 * the card frame and name plate, making same-series cards group visually.
 */
export const SERIES_META: Record<string, { he: string; color: string }> = {
  dragons: { he: "דרקונים", color: "#ff6a3d" },
  giants: { he: "ענקים", color: "#b98a4e" },
  insects: { he: "חרקים", color: "#c04ddb" },
  plants: { he: "צמחים", color: "#4fc85f" },
  slimes: { he: "ריריים", color: "#2fc5c0" },
};
export const SERIES_FALLBACK_COLOR = "#8a93a6";

export function seriesColor(seriesId: string): string {
  return SERIES_META[seriesId]?.color ?? SERIES_FALLBACK_COLOR;
}

/** Short Hebrew labels for ability types (used when a card has no custom text). */
export const ABILITY_LABEL: Partial<Record<AbilityType, string>> = {
  knockback: "הדף אחורה",
  sideKnockback: "הדף הצידה",
  trample: "דריסה והמשך",
  pullVacuum: "שאיבה למרכז",
  rootOnReveal: "מלכודת הצמדה",
  knockbackImmune: "חסין הדיפה",
  damageReflect: "החזרת נזק",
  armorGain: "צבירת שריון",
  armorBreak: "שבירת שריון",
  armorAura: "הילת שריון",
  damageShareAdjacent: "ספיגה לשכנים",
  damageReductionAura: "הילת הגנה",
  regen: "התחדשות",
  healAura: "הילת ריפוי",
  aoeRowAttack: "מכה אזורית",
  lineDenialDot: "חסימת נתיב",
  freezeOnHit: "הקפאה במכה",
  stackingDot: "רעל מצטבר",
  absorbOnCollision: "בליעת יריב",
  slowAura: "הילת האטה",
  attackSpeedAura: "הילת מהירות",
  delayedTransform: "התמרה מושהית",
  swarmOnDeath: "נחיל במוות",
  splitOnDeath: "פיצול במוות",
  sacrificeAdjacent: "הקרבת בעל-ברית",
  elementSteal: "גניבת אלמנט",
};
