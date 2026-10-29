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
import type { Card, CarryStyle } from "@amanda/shared";
import { cardFor } from "./preview";

export type { CarryStyle };

/*
 * Or: *"the wings you made here suit insects, but dragons will of course
 * need different wings (which also sound different from insect wings)."*
 *
 * So flying is two styles. They are not one gesture at two sizes: an insect
 * beats faster than the eye resolves and a dragon takes one slow stroke and
 * rides it. The sound splits the same way — see cardSound.ts.
 */
/*
 * And Or's own list of what a carry can FEEL like: *"a drag 'feel' (flies
 * fast, wobbles, slow, heavy, resists, etc.)"*, beside a list of what it
 * should throw off: *"insect wings (small, beating fast), dragon wings
 * (big, moving slowly), flying gravel, lightning, jelly/slime splatter,
 * flying earth."*
 *
 * Two of those feelings had no style at all and both are added here.
 *
 *   ooze   WOBBLES. A slime has no skeleton, so it is the loosest spring in
 *          the set — it arrives late, overshoots, and sways on the way. It
 *          throws drips.
 *   root   RESISTS. A card that does not move on a board does not want to
 *          leave the ground either: it is heavy to start, it judders in the
 *          hand, and it tears earth up with it. Which is also where Or's
 *          *"flying earth"* belongs — the thing that would throw soil is
 *          something being pulled OUT of it, not something walking on it.
 *
 * Seven styles for fifty-one cards, all of them read off what the card
 * already says it is. Nothing is written per card.
 */
/*
 * ⚠ THE SEVEN NAMES LIVE IN @amanda/shared NOW, not here.
 *
 * Or: *"let me choose, for every monster, a drag movement out of a list of
 * movements."* A list somebody chooses from is a list that has to be
 * VALIDATED when it comes back — the panel writes it into the card and the
 * card is parsed by CardSchema on both sides — so the names belong where the
 * schema can see them. The tuning below stays here, because how stiff a
 * spring is has nothing to do with the server.
 */

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
  /*
   * Or's *"wobbles"*. The loosest spring in the set and deliberately so: a
   * low pull makes it late and a low damping stops it settling, which
   * together are a thing with no bones in it. It is NOT a scale — Or:
   * *"when you drag a card its shape changes. It should stay in the shape
   * of a card"* — so the wobble is a sway about its own middle.
   */
  ooze: { pull: 0.14, damp: 0.52, lead: 0, tilt: 20 },
  /*
   * Or's *"resists"*. The slowest to answer of the seven, measured over the
   * same ten frames the spring actually runs: 259px behind the thumb, where
   * a giant is 227 and a sprout is 76. It has to COME HOME though — a card
   * that never catches up is a card you cannot place — so the damping is
   * high enough to settle it inside half a pixel after ninety frames.
   */
  root: { pull: 0.1, damp: 0.88, lead: 0, tilt: 6 },
  // Everything else: a card, carried.
  steady: { pull: 0.22, damp: 0.74, lead: 0.8, tilt: 8 },
};

/** Heavy from here up. The Titan is 2,500, a sprout is 200. */
const HEAVY_HP = 1600;

/**
 * How this card travels in a hand: what Or chose for it, or what it is.
 */
export function carryOf(cardId: string): Carry {
  const card = cardFor(cardId);
  if (!card) return { style: "steady", ...STYLES.steady };
  /*
   * What Or chose for this one card, if he chose anything. One line, and it
   * is deliberately the FIRST line: a derivation that cannot be overruled is
   * a derivation nobody can disagree with, and he has been right about
   * individual cards before.
   */
  const style = card.drag?.move ?? styleFor(card);
  return { style, ...STYLES[style] };
}

/**
 * The style a card gets when nobody has said otherwise.
 *
 * The order is the priority, and it is the same one the walk uses in a
 * battle (arenaFx.ts): what flies does not plod, and after that it is the
 * size and what it is made of. Chuppy comes out `spark` because he is
 * electric, not because he is Chuppy — which is the whole point of deriving
 * it, and means the next electric card crackles too.
 *
 * Exported because the panel shows what it decided: an "automatic" that
 * does not say what it chose is a dropdown nobody can check.
 */
export function styleFor(card: Card): CarryStyle {
  return card.flying
    ? card.seriesId === "dragons"
      ? "soar"
      : "flutter"
    : card.elements[0] === "electric"
      ? "spark"
      : card.seriesId === "slimes"
        ? "ooze"
        : card.stats.hp >= HEAVY_HP || card.midBoss
          ? "heavy"
          : /*
             * Rooted, and that is the whole test: a card with no move speed
             * is one that stands where it is put. Most of them are plants
             * and all of them resist being lifted, which is a property of
             * standing still rather than of being green — so the next
             * rooted card anybody draws resists too.
             */
            card.stats.moveSpeed === 0
            ? "root"
            : "steady";
}
