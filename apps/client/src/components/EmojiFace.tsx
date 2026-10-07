import { emojiById } from "@amanda/shared";

/**
 * One drawn emoji.
 *
 * The same shape as `Icon`, and deliberately a different component with a
 * different folder behind it. An icon is FURNITURE — the gem beside a price,
 * the trophy beside a number — and ships with the game. An emoji is CONTENT:
 * some are bought, some are won, and the game asks "do I have this one" about
 * each of them. Two things that look alike and are owned differently should
 * not share a loader.
 *
 * Decorative by default, like an icon: an emoji beside its own label is noise
 * to a screen reader. `label` is for the cases where the picture IS the
 * message, which in a speech bubble it is.
 */
export function EmojiFace({
  id,
  size = 32,
  label,
  className,
  /**
   * Move, the way it does when it is sent.
   *
   * Off by default, because a picker full of jiggling faces is noise — the
   * movement is what makes a message land, and a message is one thing at a
   * time. Each emoji carries its own motion, matched to what it means (see
   * EmojiMotion in emoji.ts).
   */
  alive = false,
}: {
  id: string;
  size?: number;
  /** Give this when nothing nearby says the same thing in words. */
  label?: string;
  className?: string;
  alive?: boolean;
}) {
  const motion = alive ? emojiById(id)?.motion : undefined;
  return (
    <img
      className={`emoji${motion ? ` emoji--${motion}` : ""}${className ? ` ${className}` : ""}`}
      src={`${import.meta.env.BASE_URL}emoji/${id}.png`}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      title={label}
      draggable={false}
    />
  );
}
