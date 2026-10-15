/**
 * **The moment you climb an arena.**
 *
 * Or: *"I noticed I moved up an arena without any message on the screen, a
 * celebration, fireworks, a huge chest with loads of presents I got for the
 * occasion."*
 *
 * ═══ THE LADDER WAS INVISIBLE AT THE ONE MOMENT IT MATTERED ═══
 *
 * The five arenas are the game's whole progression — the floor you fight on,
 * the thing the home screen counts towards, the thing four of the eighteen
 * achievements are about — and arriving at one was a number quietly changing
 * in the corner of a results screen. A ladder nobody is told they have
 * climbed is a ladder that is not there.
 *
 * ═══ AND IT IS A SCREEN, NOT A TOAST ═══
 *
 * This happens five times in a player's whole life. That is rare enough to
 * take the screen, stop everything, and be the only thing happening — which
 * is also the only way the fireworks read as being FOR something rather than
 * as decoration.
 *
 * The gifts are granted by the server at the moment the threshold is crossed
 * (progress.ts, measured against best_trophies so each arena pays exactly
 * once). This screen does not grant anything; it announces. The chest it
 * points at is already sitting on the shelf behind it.
 */
import { useEffect, useRef } from "react";
import type { Arena } from "@amanda/shared";
import { Icon } from "./Icon";
import { say } from "../game/lang";
import { sfx } from "../game/sfx";
import { line as t } from "../game/copy";

const BASE = import.meta.env.BASE_URL;

/** How many sparks. Enough to read as a burst, few enough to stay smooth. */
const SPARKS = 18;

export function ArenaUp({ arena, diamonds, onClose }: {
  arena: Arena;
  /** What the server paid for the occasion, so the screen can name it. */
  diamonds: number;
  onClose: () => void;
}) {
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    sfx.play("newcard");
  }, []);

  return (
    <div className="arenaup" role="dialog" onClick={onClose}>
      {/*
        The floor you have just earned, behind everything — this is a place,
        and the player is being shown the place.
      */}
      <div
        className="arenaup__floor"
        style={{ backgroundImage: `url("${BASE}arena/${arena.id}.webp")` }}
        aria-hidden="true"
      />
      <div className="arenaup__sparks" aria-hidden="true">
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

      <div className="arenaup__card">
        <span className="arenaup__kicker">{t("se7b9be7", "עלית ארנה")}</span>
        <h2 className="arenaup__name">{say(arena.name)}</h2>
        {/*
          What is waiting, not what happened. The chest is already on the
          shelf and the diamonds are already counted — this says where to
          look, which is the only thing a child needs from this screen.
        */}
        <div className="arenaup__loot">
          <span className="arenaup__chest">
            <img src={`${BASE}scenes/chest_gold.png`} alt="" />
          </span>
          {diamonds > 0 && (
            <span className="arenaup__gems">
              <Icon name="gem" size={22} /> {diamonds}
            </span>
          )}
        </div>
        {/*
          Just "go". The first version read `קדימה ל{name}` and the names
          already carry their article, so it came out as קדימה להמגרש — the
          preposition twice. A name that is already a name does not need to
          be put in a sentence.
        */}
        <button className="btn-fight" onClick={onClose}>
          {t("s6a89081", "קדימה!")}
        </button>
      </div>
    </div>
  );
}
