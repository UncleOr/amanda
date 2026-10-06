import { useState } from "react";
import { ARENAS, arenaFor, arenaProgress } from "@amanda/shared";
import { Icon } from "./Icon";

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

export function ArenaTrack({ trophies }: { trophies: number }) {
  const [open, setOpen] = useState(false);
  const here = arenaFor(trophies);
  const progress = arenaProgress(trophies);
  const next = ARENAS[ARENAS.indexOf(here) + 1];

  return (
    <>
      <button className="track" onClick={() => setOpen(true)} title="כל הארנות">
        <span
          className="track__art"
          style={{ backgroundImage: `url("${BASE}arena/${here.id}.webp")` }}
          aria-hidden="true"
        />
        <span className="track__text">
          <b>{here.name.he}</b>
          <span className="track__bar" aria-hidden="true">
            <i style={{ width: `${progress * 100}%` }} />
          </span>
          <small>
            {next ? (
              <>
                <Icon name="win" size={12} /> {trophies} · עוד {next.from - trophies} ל
                {next.name.he}
              </>
            ) : (
              <>
                <Icon name="win" size={12} /> {trophies} · הגעת לסוף הדרך
              </>
            )}
          </small>
        </span>
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal modal--arenas" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" onClick={() => setOpen(false)} title="סגירה">
              <Icon name="exit" size={15} />
            </button>
            <h2 className="arenas__title">הדרך</h2>
            <ol className="arenas__list">
              {ARENAS.map((a) => {
                const reached = trophies >= a.from;
                const current = a.id === here.id;
                return (
                  <li
                    key={a.id}
                    className={`arenas__row${reached ? " is-open" : " is-locked"}${
                      current ? " is-here" : ""
                    }`}
                  >
                    <span
                      className="arenas__art"
                      style={{ backgroundImage: `url("${BASE}arena/${a.id}.webp")` }}
                      aria-hidden="true"
                    />
                    <span className="arenas__who">
                      <b>{a.name.he}</b>
                      <small>{a.tease.he}</small>
                    </span>
                    <span className="arenas__at">
                      {current ? (
                        <span className="arenas__badge">אתה כאן</span>
                      ) : reached ? (
                        <Icon name="ready" size={18} />
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
        </div>
      )}
    </>
  );
}
