/**
 * ═══ THE PANEL, IN HEBREW ═══
 *
 * Or: *"give the behaviours normal names so I understand what is going on
 * there, preferably in Hebrew."*
 *
 * He is looking at `sideKnockback`, `onCollision` and `lineDenialDot` in a
 * dropdown, in English, in camelCase, on a screen he goes over with a
 * seven-year-old. Those are the ENGINE's names and they have to stay the
 * engine's names — they are what gets saved into the card and matched by
 * `switch (ab.type)` — so nothing here renames anything. It is a reading of
 * the same list.
 *
 * ⚠ EVERY LIST IS A `Record<Enum, …>`, NOT AN ARRAY OF PAIRS, and that is
 * the whole protection: add a trigger or an effect to the engine and this
 * file stops compiling until it has a name. A missing name would otherwise
 * show up as an empty dropdown row that saves fine and means something.
 * vocab.test.ts says the same thing again at runtime, for the enums that
 * arrive as data.
 *
 * The one thing that is NOT a translation is `params`: it is the names of
 * the numbers each effect actually reads, taken out of
 * packages/engine/src/abilities.ts. A JSON box with no idea what goes in it
 * is a box you type `{}` into forever.
 */
import type {
  AbilityTrigger,
  AbilityType,
  CarryStyle,
  DragFx,
  DragSound,
  Element,
  Range,
  Rarity,
  Targeting,
} from "@amanda/shared";

/** A name a person would say, and optionally what it means. */
export interface Named {
  he: string;
  note?: string;
}

/* ───────────────────────── in your hand ───────────────────────── */

/** How it follows your finger. Or's *"flies fast, wobbles, slow, heavy, resists"*. */
export const CARRY_HE: Record<CarryStyle, Named> = {
  steady: { he: "רגיל", note: "קלף שנישא ביד" },
  heavy: { he: "כבד", note: "מאחר אחרי האצבע וממשיך להתנדנד כשעוצרים" },
  flutter: { he: "מרפרף", note: "מהיר, רץ קצת לפני האצבע" },
  soar: { he: "דואה", note: "גם הוא רץ קדימה, אבל מסתובב לאט" },
  spark: { he: "חשמלי", note: "קופצני ורוטט" },
  ooze: { he: "רכרוכי", note: "מתנדנד, מאחר ולא נרגע" },
  root: { he: "מתנגד", note: "הכי קשה להרים, נתלש מהקרקע" },
};

/** What comes off it while it is in the air. */
export const FX_HE: Record<DragFx, Named> = {
  none: { he: "כלום", note: "רק הקלף" },
  wings: { he: "כנפי חרק", note: "קטנות ומהירות" },
  wingsBig: { he: "כנפי דרקון", note: "גדולות ואיטיות" },
  lightning: { he: "חשמל וברקים", note: "זרם שמקיף את הקלף ושלושה ברקים" },
  drips: { he: "טפטוף ריר", note: "נוטף מהתחתית" },
  soil: { he: "אדמה עפה", note: "רגבים ואבק — משהו שנתלש" },
  rubble: { he: "אבנים ואבק", note: "נושרות מלמטה" },
  // ── the ten Or asked for, tied to no family ──
  embers: { he: "גיצים", note: "ניצוצות אדומים שעולים ונכבים" },
  bubbles: { he: "בועות", note: "עולות וגדלות ומתפוצצות" },
  frost: { he: "רסיסי קרח", note: "נופלים ומנצנצים" },
  leaves: { he: "עלים", note: "מסתחררים למטה" },
  smoke: { he: "עשן", note: "תימרות אפורות שמתפשטות" },
  gears: { he: "גלגלי שיניים", note: "ברגים קטנים שמסתובבים" },
  fluff: { he: "פלומה", note: "נוצות קטנות שמרחפות לאט" },
  venom: { he: "ענן רעל", note: "ירוק וסמיך, עולה מהקלף" },
  stars: { he: "ניצוצות זהב", note: "כוכבים שנדלקים ונכבים" },
  sand: { he: "חול", note: "זורם למטה בלי הפסקה" },
};

/**
 * What it sounds like while it is carried.
 *
 * "אוטומטי" is absent rather than listed: the mixer layers כנפיים על אש על
 * גודל, and choosing one of these turns the mixer off for this card.
 */
export const SOUND_HE: Record<DragSound, Named> = {
  none: { he: "שקט", note: "בלי קול בגרירה" },
  flame: { he: "להבות" },
  ice: { he: "קרח" },
  stone: { he: "אבן" },
  slime: { he: "ריר" },
  spark: { he: "חשמל" },
  skitter: { he: "רגליים ממהרות" },
  dragonWings: { he: "כנפי דרקון" },
  insectWings: { he: "כנפי חרק" },
  egg: { he: "ביצה נסדקת" },
  // ── the ten ──
  wind: { he: "רוח" },
  bubbles: { he: "בועות מים" },
  gears: { he: "גלגלי שיניים" },
  steam: { he: "קיטור" },
  leaves: { he: "רשרוש עלים" },
  sand: { he: "חול נשפך" },
  growl: { he: "נהמה" },
  chains: { he: "שרשראות" },
  heartbeat: { he: "פעימות לב" },
  magic: { he: "זמזום קסם" },
};

/* ───────────────────────── what a card is ───────────────────────── */

export const ELEMENT_HE: Record<Element, string> = {
  fire: "אש",
  water: "מים",
  earth: "אדמה",
  air: "אוויר",
  electric: "חשמל",
  metal: "מתכת",
  light: "אור",
  dark: "חושך",
  poison: "רעל",
  variable: "משתנה",
};

export const RANGE_HE: Record<Range, Named> = {
  melee: { he: "מכה מקרוב", note: "חייב להיצמד" },
  ranged: { he: "יורה מרחוק" },
  sniper: { he: "צלף", note: "יורה רחוק ומהר" },
};

/**
 * ═══ WHO A CARD GOES AFTER ═══
 *
 * Or: *"give each one a catchy name."* They are names rather than
 * descriptions on purpose — a seven-year-old picking a card off a shelf
 * should be able to say what it DOES in one word, and "shoots whoever
 * attacked it" is not a word. The sentence under it is for the adult
 * turning the dial.
 *
 * ⚠ And every one of them falls back to `lane` when what it hunts is not on
 * the board — which the panel says out loud, because a card that quietly
 * does nothing in half of all matches is the thing Or would find by playing
 * and I would not find at all.
 */
export const TARGETING_HE: Record<Targeting, Named> = {
  lane: { he: "ישר קדימה", note: "מי שעומד מולו במסלול שלו" },
  king: { he: "ציד המלך", note: "חוצה מסלולים אל הכתר, ועובר דרך השומרים בדרך" },
  avenger: { he: "נוקם", note: "יורה במי שפגע בו אחרון, כל עוד הוא חי ולפניו" },
  champion: { he: "צייד אלופים", note: "המפלצת הכי חזקה על הלוח, בכל רגע מחדש. לא המלך" },
  sniperHunter: { he: "צייד צלפים", note: "הולך על מי שיורה מהמרחק הכי גדול" },
  wallbreaker: { he: "שובר חומות", note: "הולך על מי שלא זז — קירות, מגדלים, מה שחונה" },
  invader: { he: "שומר הגבול", note: "על מי שהגיע לקו שלך וכבר התחיל להילחם" },
};

export const RARITY_HE: Record<Rarity, string> = {
  common: "רגיל",
  rare: "נדיר",
  epic: "אפי",
  legendary: "אגדי",
};

/* ───────────────────────── abilities ───────────────────────── */

/** WHEN it happens. */
export const TRIGGER_HE: Record<AbilityTrigger, Named> = {
  onSpawn: { he: "כשהוא נכנס לקרב" },
  onAttack: { he: "בכל פעם שהוא תוקף" },
  onHit: { he: "כשהמכה שלו פוגעת" },
  onKill: { he: "כשהוא מחסל מישהו" },
  onDamaged: { he: "כשהוא חוטף מכה" },
  onDeath: { he: "כשהוא מת" },
  onCollision: { he: "כשהוא נתקל באויב" },
  onReveal: { he: "כשחושפים אותו מתחת לערימה" },
  delayed: { he: "אחרי כמה שניות" },
  aura: { he: "כל הזמן, על מי שמסביב" },
  passive: { he: "כל הזמן, על עצמו" },
};

/** WHAT happens, which numbers it reads, and whether the engine does it. */
export interface Effect extends Named {
  /** The param names the engine's handler actually looks at. */
  params?: string;
  /**
   * ⚠ In the list, with no handler behind it.
   *
   * The editor's own docstring promises that "picking from the engine's own
   * lists means a card that saves is a card that works", and for this one it
   * is not true: `armorGain` is in ABILITY_TYPES and nothing in
   * packages/engine ever matches it. A card given it saves cleanly, shows
   * nothing in a battle and reads as the engine being broken. Said out loud
   * in the dropdown until either a handler exists or the type goes.
   */
  dead?: true;
}

export const EFFECT_HE: Record<AbilityType, Effect> = {
  knockback: { he: "הודף אחורה", params: "slots", note: "דוחף את מי שספג כמה משבצות אחורה" },
  sideKnockback: { he: "הודף הצדה", params: "columns", note: "למסלול שלידו" },
  trample: { he: "ממשיך מיד לבא בתור", note: "אחרי שהוא הרג, בלי להמתין" },
  pullVacuum: { he: "שואב אויבים פנימה", params: "everySeconds, slots" },
  rootOnReveal: { he: "מדביק לקרקע את מי שמולו" },
  knockbackImmune: { he: "אי אפשר להדוף אותו" },

  damageReflect: { he: "מחזיר חלק מהמכה לתוקף", params: "pct" },
  armorGain: { he: "מקבל שריון", params: "armor", dead: true },
  armorBreak: { he: "שובר שריון במכה" },
  armorAura: { he: "נותן שריון לחברים", params: "armor" },
  damageShareAdjacent: { he: "סופג מכות במקום השכנים", params: "pct" },
  damageReductionAura: { he: "מוריד נזק לחברים", params: "pct" },

  regen: { he: "מתרפא לבד", params: "hpPerSecond" },
  healAura: { he: "מרפא חברים קרובים", params: "hpPerSecond" },

  aoeRowAttack: { he: "מכה כמה מסלולים ביחד", params: "lanes" },
  lineDenialDot: { he: "משאיר שלולית שמזיקה במסלול", params: "dps" },
  freezeOnHit: { he: "מקפיא במכה", params: "freezeSeconds, resetCooldown" },
  stackingDot: { he: "רעל שמתחזק כל מכה", params: "dotPerStack" },
  absorbOnCollision: { he: "בולע אויב שנתקל בו", params: "stunSeconds" },
  slowAura: { he: "מאט אויבים שעוברים לידו", params: "pct" },
  attackSpeedAura: { he: "מזרז תקיפות של חברים", params: "pct" },
  statAura: {
    he: "בונוס משפחה — עוצמה וחיים",
    params: "pct",
    note: "עובד כששלושה מהמשפחה נוגעים זה בזה",
  },

  delayedTransform: {
    he: "הופך לצורה חזקה יותר",
    params: "afterSeconds, into, powerBonus",
  },
  hatchOnDeath: { he: "בוקע לקלף אחר כשהוא מת", params: "into, hpPct, powerPct" },
  swarmOnDeath: { he: "משאיר נחיל כשהוא מת", params: "count, spiritHp, spiritPower" },
  splitOnDeath: { he: "מתפצל לקטנים כשהוא מת", params: "count, childHp, childPower" },
  sacrificeAdjacent: { he: "מקריב חבר צמוד ומתחזק", params: "armorGain" },
  elementSteal: { he: "גונב את היסוד של האויב הראשון" },

  /*
   * ── the neutralisers ──
   *
   * Or: *"when it hits a healer — it damages the healing ability; when it
   * hits armour — it cancels the armour; when it hits a poison-spitter — it
   * cancels its abilities."* Each one is its own card, so each one is its
   * own line — and all three are permanent, which the note says, because
   * "cancels" and "cancels for four seconds" are different cards.
   */
  silenceHeal: { he: "מנטרל ריפוי", note: "מי שהוא פוגע בו מפסיק לרפא — את עצמו ואת החברים. לתמיד" },
  silenceArmor: { he: "מנטרל שריון", note: "מוריד את כל השריון של מי שהוא פוגע בו, והוא לא חוזר" },
  silencePoison: { he: "מנטרל רעל", note: "מי שהוא פוגע בו מפסיק להרעיל. לתמיד" },

  /*
   * ── יכולת תנועה: מסביב לגב ──
   *
   * Or: *"it is the same thing, but one for the machines and one for the sea
   * creatures and one for the plants."* So the note is identical on all
   * three and the NAME is what fits the creature — a machine that burrows
   * is wrong, and a card whose ability does not fit the monster is a card a
   * child stops believing.
   */
  dive: { he: "צלילה", note: "מתחיל בקצה האחורי של הלוח של היריב, מסתובב ותוקף אחורה. ליצורי ים" },
  teleport: { he: "טלפורטציה", note: "מתחיל בקצה האחורי של הלוח של היריב, מסתובב ותוקף אחורה. למכונות" },
  burrow: { he: "חפירה", note: "מתחיל בקצה האחורי של הלוח של היריב, מסתובב ותוקף אחורה. לצמחים" },
};
