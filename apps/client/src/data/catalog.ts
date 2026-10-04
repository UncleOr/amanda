import {
  CRUMB_DEMON,
  parseActionCards,
  parseSeries,
  type ActionCard,
  type Card,
  type Series,
} from "@amanda/shared";
import actionsJson from "../../../../data/action-cards.json";

/**
 * Auto-load every series file under /data/series. Dropping a new NN-name.json
 * there makes its cards appear in the game with no code change.
 */
const seriesModules = import.meta.glob("../../../../data/series/*.json", {
  eager: true,
}) as Record<string, { default: unknown }>;

export const SERIES: Series[] = Object.keys(seriesModules)
  .sort()
  .map((path) => parseSeries(seriesModules[path]!.default));

/** All series indexed by id, for lookups (synergy, detail view). */
export const SERIES_BY_ID: Map<string, Series> = new Map(SERIES.map((s) => [s.id, s]));

/** Series synergies passed to the battle engine (activate at 3 same-series cards). */
export const SYNERGIES = SERIES.map((s) => ({
  seriesId: s.id,
  threshold: s.synergy.threshold,
  ability: s.synergy.ability,
}));

/** Every playable monster card, keyed by id. */
export const CATALOG: Map<string, Card> = new Map();
for (const s of SERIES) for (const c of s.cards) CATALOG.set(c.id, c);

/**
 * The weak filler placed on empty slots when the build timer ends
 * (GDD §4 — "Crumb Demon"). Synthesised in code, not part of the card pool.
 */
export const CRUMB_DEMON_CARD: Card = {
  id: "crumb_demon",
  seriesId: "system",
  numberInSeries: 1,
  name: { he: "מפלץ פירורים", en: "Crumb Demon" },
  elements: ["earth"],
  rarity: "common",
  stats: {
    hp: CRUMB_DEMON.hp,
    power: CRUMB_DEMON.power,
    attackSpeed: CRUMB_DEMON.attackSpeed,
    moveSpeed: 0,
    range: "melee",
  },
  flying: false,
  midBoss: false,
  launch: false,
  abilities: [],
  art: { placeholderColor: "#7a7a7a", sprite: null },
};
CATALOG.set(CRUMB_DEMON_CARD.id, CRUMB_DEMON_CARD);

/** Cards designed to sit in the King slot (big mid-bosses first, then the rest). */
export const KING_CANDIDATES: Card[] = [...CATALOG.values()].filter(
  (c) => c.midBoss && c.launch,
);

/** The colour used to render a card's placeholder shape. */
export function cardColor(cardId: string): string {
  return CATALOG.get(cardId)?.art.placeholderColor ?? "#888888";
}

/**
 * The playable pool — the curated launch roster. Cards outside it stay in the
 * data, ready to switch on in a later content update (set `launch: true`).
 */
export function cardPool(): string[] {
  return [...CATALOG.values()].filter((c) => c.launch).map((c) => c.id);
}

/** All action cards, keyed by id. */
export const ACTIONS: Map<string, ActionCard> = new Map(
  parseActionCards(actionsJson).map((a) => [a.id, a]),
);

/**
 * Action cards whose effects are wired up. Some are "active" (do something when
 * clicked in the bar), some are "passive" (act by merely being in the bar).
 */
export const ACTIVE_ACTIONS = [
  "energy_boost", // +power to all your cards
  "xray", // reveal the opponent
  "full_refuel", // ×1.5 a chosen card (targeted)
  "recall_card", // remove a chosen card (targeted)
  "sandstorm", // shuffle the enemy front row
] as const;
export const PASSIVE_ACTIONS = ["fill_lava", "fill_colossus", "fill_flame", "fill_cube"] as const;
export const SUPPORTED_ACTIONS: string[] = [...ACTIVE_ACTIONS, ...PASSIVE_ACTIONS];

/** Active actions that require picking a card on your board before they apply. */
export const TARGETED_ACTIONS = ["full_refuel", "recall_card"];

/** How many action cards get shuffled into a match deck (GDD: 4). */
export const ACTION_DECK_COUNT = 4;
/** Max action cards a player can hold in the bar at once. */
export const ACTION_SLOTS = 3;

/** True if an action card acts passively (no click needed). */
export function isPassiveAction(id: string): boolean {
  return (PASSIVE_ACTIONS as readonly string[]).includes(id);
}
/** True if an active action needs a board target to apply. */
export function isTargetedAction(id: string): boolean {
  return TARGETED_ACTIONS.includes(id);
}
