/**
 * **The screen stops, and something good is the only thing on it.**
 *
 * Or has now asked for this shape three times, for three different reasons:
 * *"a message on the screen, a celebration, fireworks, a huge chest with
 * loads of presents"* when you climb an arena; *"of course when it upgrades,
 * confetti and fireworks and a happy sound"*; and *"when you open the game on
 * your birthday you get some kind of gold chest."*
 *
 * Three answers to the same request, so one thing that answers it. The
 * alternative was three screens that each drift — one with eighteen sparks
 * and one with twelve, one that plays a sound and one that forgets, one that
 * is opaque and one that lets the onboarding card read through it. That last
 * one was a real bug on the arena screen and it is exactly what copying a
 * screen instead of sharing it produces.
 *
 * ═══ WHAT IT GUARANTEES ═══
 *
 * - It takes the WHOLE screen, opaquely. These are rare moments and for a few
 *   seconds nothing else exists. A scrim at 0.82 let the card behind compete.
 * - The sound plays exactly once, however many times React re-renders.
 * - The confetti is deterministic, so a state change behind it does not
 *   re-throw it.
 * - A tap anywhere closes it. A child should never have to find a button to
 *   leave a party.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { sfx } from "../game/sfx";

const BASE = import.meta.env.BASE_URL;

/** How many sparks. Enough to read as a burst, few enough to stay smooth. */
const SPARKS = 18;

export function Celebrate({
  kicker,
  title,
  /** A background image, pushed back far enough to read as a place. */
  scene,
  sound = "newcard",
  children,
  onClose,
}: {
  kicker: string;
  title: ReactNode;
  scene?: string | null;
  sound?: Parameters<typeof sfx.play>[0] | null;
  children?: ReactNode;
  onClose: () => void;
}) {
  const played = useRef(false);
  useEffect(() => {
    if (played.current || !sound) return;
    played.current = true;
    sfx.play(sound);
  }, [sound]);

  return (
    <div className="party" role="dialog" onClick={onClose}>
      {scene && (
        <div
          className="party__floor"
          style={{ backgroundImage: `url("${scene}")` }}
          aria-hidden="true"
        />
      )}
      <div className="party__sparks" aria-hidden="true">
        {Array.from({ length: SPARKS }, (_, i) => (
          <i
            key={i}
            style={{
              // Scattered deterministically rather than randomly: a burst
              // that lands differently on every render would re-animate on
              // any state change behind it.
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 6) * 0.12}s`,
              ["--spin" as string]: `${(i * 53) % 360}deg`,
            }}
          />
        ))}
      </div>

      <div className="party__card">
        <span className="party__kicker">{kicker}</span>
        <h2 className="party__name">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** The gold chest, floating. The thing the whole screen is pointing at. */
export function PartyChest() {
  return (
    <span className="party__chest">
      <img src={`${BASE}scenes/chest_gold.png`} alt="" />
    </span>
  );
}
