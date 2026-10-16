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
 * as decoration. The screen itself is Celebrate.tsx, shared now with the
 * birthday chest and the card upgrade.
 *
 * The gifts are granted by the server at the moment the threshold is crossed
 * (progress.ts, measured against best_trophies so each arena pays exactly
 * once). This screen does not grant anything; it announces. The chest it
 * points at is already sitting on the shelf behind it.
 */
import type { Arena } from "@amanda/shared";
import { Celebrate, PartyChest } from "./Celebrate";
import { Icon } from "./Icon";
import { say } from "../game/lang";
import { line as t } from "../game/copy";

const BASE = import.meta.env.BASE_URL;

export function ArenaUp({ arena, diamonds, onClose }: {
  arena: Arena;
  /** What the server paid for the occasion, so the screen can name it. */
  diamonds: number;
  onClose: () => void;
}) {
  return (
    <Celebrate
      kicker={t("se7b9be7", "עלית ארנה")}
      title={say(arena.name)}
      // The floor you have just earned, behind everything — this is a place,
      // and the player is being shown the place.
      scene={`${BASE}arena/${arena.id}.webp`}
      onClose={onClose}
    >
      {/*
        What is waiting, not what happened. The chest is already on the
        shelf and the diamonds are already counted — this says where to
        look, which is the only thing a child needs from this screen.
      */}
      <div className="party__loot">
        <PartyChest />
        {diamonds > 0 && (
          <span className="party__gems">
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
    </Celebrate>
  );
}
