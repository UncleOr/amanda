import { NACHOS_PER_CHEST, nachoBar, nachoChestKind, chestsFilled } from "@amanda/shared";
import { Icon } from "./Icon";

/**
 * How close the next chest is, in nachos.
 *
 * Or: *"we have to create a situation where the player is always one or two
 * games away from some goal."* This is the bar that does it. It fills about
 * every three matches, it fills after a loss as well as a win, and it never
 * goes backwards — which is the whole difference between it and the trophy
 * count sitting above it.
 *
 * ═══ WHY IT DRAWS EVERY NACHO AND NOT A PERCENTAGE ═══
 *
 * Five pips rather than a filling line, because the number has to be
 * countable at a glance by a seven-year-old: "two more" is a thought you can
 * have about five things in a row and not about a bar that is 60% along. The
 * next chest's picture sits at the end of it, so what the counting is FOR is
 * never a separate thing to look up.
 *
 * ═══ AND NO SENTENCE UNDER IT ═══
 *
 * It said "עוד 5 נאצ'וס לתיבה" and Or cut it: *"we don't need that
 * sentence."* He is right, and the reason is the paragraph above — the pips
 * ARE the sentence. Spelling out a number you can see by counting five things
 * is the screen not trusting its own picture, and it cost a line of height on
 * every size.
 */
export function NachoBar({ nachos }: { nachos: number }) {
  const bar = nachoBar(nachos);
  const next = nachoChestKind(chestsFilled(nachos));
  const pips = Array.from({ length: NACHOS_PER_CHEST }, (_, i) => i < bar.have);

  return (
    <div
      className={`nachos nachos--${next}`}
      // The whole thing says what it means; the pips below are decoration.
      role="img"
      aria-label={`${bar.have} נאצ'וס מתוך ${bar.need} לתיבה הבאה`}
      title="כל משחק נותן נאצ'וס, לפי כמה טוב שיחקת"
    >
      <span className="nachos__row" aria-hidden="true">
        {pips.map((on, i) => (
          <i key={i} className={on ? "is-on" : ""}>
            <Icon name="nacho" size={18} />
          </i>
        ))}
        <span className={`nachos__chest nachos__chest--${next}`}>
          <Icon name="chest" size={26} />
        </span>
      </span>
    </div>
  );
}
