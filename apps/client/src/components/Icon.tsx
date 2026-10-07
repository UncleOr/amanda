/**
 * The game's own icons, in place of emoji.
 *
 * Emoji are drawn by whoever made the phone: they differ on every device, they
 * ignore the art direction, and beside hand-painted cards they look borrowed.
 * These are generated with everything else — see packages/art/src/iconLooks.ts
 * and `pnpm art:icons-set`.
 *
 * Decorative by default. An icon that sits beside its own label is noise to a
 * screen reader, so it is hidden from one unless a `label` is given, which is
 * for the cases where the icon IS the label.
 */

/** Every id in iconLooks.ts. Misspell one and the compiler says so. */
export type IconName =
  | "hp"
  | "power"
  | "win"
  | "lose"
  | "monster"
  | "action"
  | "fire"
  | "water"
  | "earth"
  | "air"
  | "electric"
  | "metal"
  | "light"
  | "dark"
  | "poison"
  | "variable"
  | "melee"
  | "ranged"
  | "sniper"
  | "king"
  | "guard"
  | "stacked"
  | "frozen"
  | "deck"
  | "discard"
  | "recycle"
  | "timer"
  | "ready"
  | "warning"
  | "soundOn"
  | "soundOff"
  | "musicOn"
  | "musicOff"
  | "exit"
  | "menu"
  | "back"
  | "again"
  | "plus"
  | "play"
  | "stop"
  | "info"
  | "erase"
  | "report"
  | "gem"
  | "chest"
  | "skull"
  | "infinity"
  | "explode"
  | "target"
  | "move"
  | "fly"
  | "eye"
  | "hidden"
  | "build"
  | "blood"
  | "split"
  | "thorns"
  | "joker"
  | "flag"
  | "nacho"
  | "challenge"
  | "robot"
  | "friend"
  | "online"
  | "unplugged"
  | "phone";

interface Props {
  name: IconName;
  /** Rendered size in px. The files are 128px, so anything up to that is sharp. */
  size?: number;
  /** Give this only when the icon carries meaning no nearby text repeats. */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 18, label, className }: Props) {
  return (
    <img
      className={`icon${className ? ` ${className}` : ""}`}
      src={`${import.meta.env.BASE_URL}icons/${name}.png`}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      title={label}
      draggable={false}
    />
  );
}
