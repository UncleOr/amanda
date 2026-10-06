import {
  CRUMB_DEMON,
  parseActionCards,
  parseSeries,
  type ActionCard,
  type Card,
  type Series,
} from "@amanda/shared";
import actionsJson from "../../../../data/action-cards.json";
import { synergyMembers } from "@amanda/engine";

/** Where the King sits on the 4×4, for the adjacency rule. */
const KING_CELL = { x: 1, y: 1 };

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

/** Series synergies passed to the battle engine. */
export const SYNERGIES = SERIES.map((s) => ({
  seriesId: s.id,
  threshold: s.synergy.threshold,
  ability: s.synergy.ability,
}));

/**
 * Which cells on a board you are still arranging are in a live synergy group.
 *
 * Deliberately the ENGINE's own function rather than a second copy of the
 * rule. The board highlights what will happen in the battle, and the only way
 * to be sure of that is for both to be the same code — two implementations of
 * "touching" would eventually disagree, and the one the player can see would
 * be the one that is wrong.
 *
 * Returns seriesId → the cell keys lit up, "king" included when it qualifies.
 */
export function synergyGroups(
  placements: Record<string, string>,
  king: string | null,
): Map<string, Set<string>> {
  const keys = Object.keys(placements);
  const board = keys.map((key) => {
    const [x, y] = key.split("-").map(Number);
    return { cardId: placements[key]!, x: x ?? 0, y: y ?? 0 };
  });
  if (king) board.push({ cardId: king, x: KING_CELL.x, y: KING_CELL.y, king: true } as never);
  const keyAt = (i: number) => (i < keys.length ? keys[i]! : "king");

  const out = new Map<string, Set<string>>();
  for (const syn of SYNERGIES) {
    const lit = synergyMembers(board, (id) => CATALOG.get(id)?.seriesId, syn.seriesId, syn.threshold);
    if (lit.size) out.set(syn.seriesId, new Set([...lit].map(keyAt)));
  }
  return out;
}

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
  targeting: "lane",
  midBoss: false,
  launch: false,
  abilities: [],
  art: { placeholderColor: "#7a7a7a", sprite: "cards/crumb_demon.webp" },
};
CATALOG.set(CRUMB_DEMON_CARD.id, CRUMB_DEMON_CARD);

/** Cards designed to sit in the King slot (big mid-bosses first, then the rest). */
export const KING_CANDIDATES: Card[] = (() => {
  const kings = [...CATALOG.values()].filter((c) => c.midBoss && c.launch);
  const illustrated = kings.filter((c) => c.art.sprite);
  return illustrated.length > 0 ? illustrated : kings;
})();

/** The colour used to render a card's placeholder shape. */
export function cardColor(cardId: string): string {
  return CATALOG.get(cardId)?.art.placeholderColor ?? "#888888";
}

/**
 * The playable pool — the curated launch roster. Cards outside it stay in the
 * data, ready to switch on in a later content update (set `launch: true`).
 *
 * While artwork is still being produced we prefer illustrated cards, so a match
 * never mixes finished cards with placeholder colour blocks. Once every launch
 * card has art this is simply the whole roster.
 */
export function cardPool(): string[] {
  const launch = [...CATALOG.values()].filter((c) => c.launch);
  const illustrated = launch.filter((c) => c.art.sprite);
  // need a sensible deck's worth before we can restrict to illustrated cards
  const pool = illustrated.length >= 12 ? illustrated : launch;
  return pool.map((c) => c.id);
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
  "recycle_bin", // take the last card you threw away back
  "time_freeze", // buy yourself seconds
  "steel_wall", // block the next action card played against you
  "triple_draw", // hold three cards at once instead of one
  "swap_places", // swap two of your placed cards (targeted ×2)
  "radioactive_eraser", // delete an enemy card (targeted on THEIR board)
  "ground_floor", // stack a second card onto your own slots
  "dark_corners", // the same, applied to the four corners at once
  "frozen_hands", // freeze the opponent's hands for five seconds
] as const;
export const PASSIVE_ACTIONS = ["fill_lava", "fill_colossus", "fill_flame", "fill_cube"] as const;
export const SUPPORTED_ACTIONS: string[] = [...ACTIVE_ACTIONS, ...PASSIVE_ACTIONS];

/**
 * Which board an effect asks you to pick a card on, if any.
 *
 * Keyed by effect rather than by card id on purpose: a card needs a target
 * because of what it does. Listing the ids separately let "ground floor" ask
 * for a target it had no use for, and the four stacking slots it promised were
 * never handed out.
 */
export const TARGET_EFFECTS: Record<string, "own" | "enemy"> = {
  upgradeCardTemp: "own",
  removeCard: "own",
  swapOwnCards: "own",
  eraseEnemyCard: "enemy",
};

/** Effects that need two picks, not one. */
export const TWO_PICK_EFFECTS = ["swapOwnCards"];

/** How many separate cells "ground floor" lets you stack onto. */
export const GROUND_FLOOR_SLOTS = 4;

/** The four outer corners of a player's board — what "dark corners" opens up. */
export const CORNER_KEYS = ["0-0", "3-0", "0-3", "3-3"];
export function isCornerKey(key: string): boolean {
  return CORNER_KEYS.includes(key);
}

/** How many action cards get shuffled into a match deck (GDD: 4). */
export const ACTION_DECK_COUNT = 4;
/**
 * How often a match deck contains a Fill card at all.
 *
 * A Fill card drops a whole formation onto the board in one go, so drawing one
 * should feel like luck. Picking the action cards at random from the whole list
 * put an average of 1.8 of them in every deck — and sometimes four — which made
 * the most dramatic card in the game routine.
 */
export const FILL_CARD_CHANCE = 0.5;
/** At most this many Fill cards in a single deck. */
export const FILL_CARDS_PER_DECK = 1;

/** Max action cards a player can hold in the bar at once. */
export const ACTION_SLOTS = 3;

/** True if an action card acts passively (no click needed). */
export function isPassiveAction(id: string): boolean {
  return (PASSIVE_ACTIONS as readonly string[]).includes(id);
}
/** True if an active action needs a board target to apply. */
export function isTargetedAction(id: string): boolean {
  return effectOf(id) in TARGET_EFFECTS;
}
/** True if the target has to be picked on the opponent's board. */
export function isEnemyTargeted(id: string): boolean {
  return TARGET_EFFECTS[effectOf(id)] === "enemy";
}
/** True if the action wants two cards picked before it does anything. */
export function isTwoPickAction(id: string): boolean {
  return TWO_PICK_EFFECTS.includes(effectOf(id));
}
function effectOf(id: string): string {
  return ACTIONS.get(id)?.effect ?? "";
}
