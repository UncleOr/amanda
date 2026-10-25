/**
 * ═══ HOW A CARD BEHAVES IN YOUR HAND ═══
 *
 * Or: *"every card, when we put it on the board — it should also be possible
 * to drag it into position. While it is being dragged it moves in the user's
 * hand IN ITS OWN WAY. If it is a heavy giant it is a bit 'harder' to carry.
 * Fliers beat their wings and pull ahead. Chuppy gives off a current and
 * 'electrifies'."*
 *
 * The drag already existed and every card did it identically: a picture
 * pinned to the pointer, exactly, with a fixed four-degree tilt. Which is the
 * same mistake the battle had — one animation doing the job of fifty-three
 * cards — and the same answer: the card already says what it is, so the way
 * it travels can be read off it.
 *
 * ═══ IT IS A SPRING, AND THE WEIGHT IS THE SPRING ═══
 *
 * Nothing here is a special case. The ghost chases the pointer with a spring,
 * and what a style changes is how that spring is tuned: a giant is slow to
 * start and slow to stop, which IS the feeling of carrying something heavy,
 * and it overshoots and swings because that is what mass does. A flier is
 * stiffer than the pointer itself and arrives AHEAD of it.
 */
import { CATALOG } from "../data/catalog";

/*
 * Or: *"the wings you made here suit insects, but dragons will of course
 * need different wings (which also sound different from insect wings)."*
 *
 * So flying is two styles. They are not one gesture at two sizes: an insect
 * beats faster than the eye resolves and a dragon takes one slow stroke and
 * rides it. The sound splits the same way — see cardSound.ts.
 */
export type CarryStyle = "heavy" | "flutter" | "soar" | "spark" | "steady";

export interface Carry {
  style: CarryStyle;
  /**
   * How hard the card is pulled toward the pointer each frame, 0 to 1. Low is
   * heavy: it falls behind on the way out and keeps going when you stop.
   */
  pull: number;
  /** How quickly the swing dies down. Low swings for longer. */
  damp: number;
  /** How far ahead of the pointer it runs, in pixels of its own velocity. */
  lead: number;
  /** How much it tilts into the direction it is moving, in degrees. */
  tilt: number;
}

const STYLES: Record<CarryStyle, Omit<Carry, "style">> = {
  // A thing you are hauling: late to every turn, and it keeps swinging.
  heavy: { pull: 0.1, damp: 0.86, lead: 0, tilt: 10 },
  // A thing flying itself: it is already where you are going.
  flutter: { pull: 0.34, damp: 0.7, lead: 3.2, tilt: 16 },
  // A dragon flies itself too, and weighs something while it does it: it
  // still runs ahead of your thumb, but it takes longer to turn.
  soar: { pull: 0.22, damp: 0.78, lead: 2.4, tilt: 13 },
  // Light and jumpy, and it crackles — see the sparks in App.tsx.
  spark: { pull: 0.3, damp: 0.62, lead: 1.4, tilt: 12 },
  // Everything else: a card, carried.
  steady: { pull: 0.22, damp: 0.74, lead: 0.8, tilt: 8 },
};

/** Heavy from here up. The Titan is 2,500, a sprout is 200. */
const HEAVY_HP = 1600;

/**
 * Which of the five, from what the card already says about itself.
 *
 * The order is the priority, and it is the same one the walk uses in a
 * battle (arenaFx.ts): what flies does not plod, and after that it is the
 * size and what it is made of. Chuppy comes out `spark` because he is
 * electric, not because he is Chuppy — which is the whole point of deriving
 * it, and means the next electric card crackles too.
 */
export function carryOf(cardId: string): Carry {
  const card = CATALOG.get(cardId);
  if (!card) return { style: "steady", ...STYLES.steady };
  const style: CarryStyle = card.flying
    ? card.seriesId === "dragons"
      ? "soar"
      : "flutter"
    : card.elements[0] === "electric"
      ? "spark"
      : card.stats.hp >= HEAVY_HP || card.midBoss
        ? "heavy"
        : "steady";
  return { style, ...STYLES[style] };
}
