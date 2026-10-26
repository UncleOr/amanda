import { useState } from "react";
import { ARENAS, arenaFor, arenaProgress, openArenas, toArena } from "@amanda/shared";
import { ArenaStory } from "./ArenaStory";
import { Icon } from "./Icon";
import { Lock } from "./SignedInOnly";
import { Overlay } from "./Overlay";
import { line as t, lineF as tf } from "../game/copy";
import { lang, say } from "../game/lang";

/**
 * The ladder of arenas, on the home screen.
 *
 * Or: "show the arena route on the home screen… and let people see which
 * arenas exist — dark and locked — so there is something to aim for."
 *
 * Both halves of that matter. The strip is where you ARE: one card, lit, with
 * how far you are through it. Tapping it opens the whole ladder, and the ones
 * you have not reached are deliberately dark and named rather than hidden — a
 * ladder you cannot see the top of is not a ladder.
 *
 * Nothing here is a reward and nothing can be pressed for gain. It is the one
 * place in the game that answers "what am I playing towards".
 */
const BASE = import.meta.env.BASE_URL;

export function ArenaTrack({
  trophies,
  /**
   * The high-water mark, not where they are now.
   *
   * Or: *"the story of each arena can only be seen after you have reached
   * it once."* Once. Dropping back down a rung does not take the story
   * away any more than it takes the cards away — you were there.
   */
  best = trophies,
}: {
  trophies: number;
  best?: number;
}) {
  const [open, setOpen] = useState(false);
  /**
   * Which arena has been opened. One at a time: this is a phone.
   *
   * It used to grow the row it was written in and tell the story there, in
   * grey, under the name. Or: *"when you press an arena a popup should
   * REALLY open: a big picture of the arena… make it bigger, in short."*
   */
  const [telling, setTelling] = useState<string | null>(null);
  const here = arenaFor(trophies);
  const progress = arenaProgress(trophies);
  /*
   * The next rung is the next OPEN one, and when there is none the sentence
   * underneath stops promising anything.
   *
   * Or: *"lock the alley and the petrol station for now."* Before this, a
   * player at the top of the ladder was told "908 more to Fright Alley" for
   * an arena that no number of trophies opens — a countdown to nothing,
   * which is worse than no countdown.
   */
  const open_ = openArenas();
  const next = open_[open_.indexOf(here) + 1];
  /* Only ever one you have been to: a locked row does not answer. */
  const tale = ARENAS.find((a) => a.id === telling && !a.locked && best >= a.from) ?? null;

  return (
    <>
      <button className="track" onClick={() => setOpen(true)} title={t("s84b983e", "כל הארנות")}>
        <span
          className="track__art"
          style={{ backgroundImage: `url("${BASE}arena/${here.id}.webp")` }}
          aria-hidden="true"
        />
        <span className="track__text">
          <b>{say(here.name)}</b>
          <span className="track__bar" aria-hidden="true">
            <i style={{ width: `${progress * 100}%` }} />
          </span>
          <small>
            {next ? (
              <>
                <Icon name="win" size={12} /> {tf("sbdb539a", "{0} · עוד {1}", trophies, next.from - trophies)}{" "}
                {/* The trophy again, right after the number: "150 more" of WHAT
                    was the missing half of the sentence. */}
                {/*
                  toArena() is Hebrew grammar: ל and ה collapse, so המגרש
                  becomes למגרש and not להמגרש. English needs none of that
                  and would read "tothe Playroom" if it were applied.
                */}
                <Icon name="win" size={12} />{" "}
                {lang() === "he" ? toArena(say(next.name)) : `to ${say(next.name)}`}
              </>
            ) : (
              <>
                <Icon name="win" size={12} /> {trophies} · {t("s00844be", "הגעת לסוף הדרך")}
              </>
            )}
          </small>
        </span>
      </button>

      {open && (
        <Overlay onClick={() => setOpen(false)}>
          <div className="modal modal--arenas" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" onClick={() => setOpen(false)} title={t("s92d6d79", "סגירה")}>
              <Icon name="exit" size={15} />
            </button>
            <h2 className="arenas__title">{t("s474cafb", "הדרך")}</h2>
            <ol className="arenas__list">
              {ARENAS.map((a) => {
                // A shut arena is never reached, whatever the trophies say.
                const reached = !a.locked && best >= a.from;
                const current = a.id === here.id;
                return (
                  <li
                    key={a.id}
                    className={`arenas__row${reached ? " is-open" : " is-locked"}${current ? " is-here" : ""}`}
                    /*
                     * ═══ THE ROW IS THE BUTTON ═══
                     *
                     * Or: *"after you open the arena — tapping any arena
                     * should tell the story of the arena."*
                     *
                     * A locked one does not answer. Its story is where you
                     * have not been yet, and reading it off the list would
                     * be the same as having been.
                     */
                    onClick={reached ? () => setTelling(a.id) : undefined}
                    data-shut={a.locked ? "" : undefined}
                  >
                    <span
                      className="arenas__art"
                      style={{ backgroundImage: `url("${BASE}arena/${a.id}.webp")` }}
                      aria-hidden="true"
                    />
                    <span className="arenas__who">
                      <b>{say(a.name)}</b>
                      <small>{say(a.tease)}</small>
                    </span>
                    <span className="arenas__at">
                      {current ? (
                        <span className="arenas__badge">{t("s2411278", "אתה כאן")}</span>
                      ) : reached ? (
                        <Icon name="ready" size={18} />
                      ) : a.locked ? (
                        /*
                         * No number, because there is no number. A trophy
                         * count beside a shut door is a promise the ladder
                         * cannot keep; a padlock is the truth and still
                         * leaves the arena on the list to be wanted.
                         */
                        <Lock />
                      ) : (
                        <>
                          <Icon name="win" size={13} /> {a.from}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          {/*
            The arena's own page, opened from the ladder and closing back to
            it. Written inside this Overlay and rendered at the end of the
            body like every other one — see Overlay.tsx for why a backdrop
            click here does not also close the ladder behind it.
          */}
          {tale && <ArenaStory arena={tale} onClose={() => setTelling(null)} />}
        </Overlay>
      )}
    </>
  );
}
