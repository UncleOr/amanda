/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **Wanting to be here.** One arena, at the size it was painted, with the
 * family that lives on it and what that is worth.
 *
 * Or: *"when you press an arena a popup should really open: a big picture of
 * the arena, a picture of the new cards you can get in this arena, add a
 * caption at the bottom — cards from the Slime series get +20% power in the
 * Court! (and of course implement it too). Make it bigger, in short."*
 *
 * It was a line of text appearing under a 76-pixel thumbnail in a list — the
 * story he wrote was being told in grey, at 10px, in a row that grew. Every
 * part of his sentence is the same complaint: the arena is the biggest thing
 * in the game to aim at and it was the smallest thing on the screen.
 *
 * The hero is the PICTURE. The story sits on it. The family is the goods
 * underneath, and the caption is the one rule worth knowing about the place:
 * on this ground, these cards hit harder (packages/shared/src/arenas.ts).
 */
import { ARENA_POWER_BONUS, atArena, type Arena } from "@amanda/shared";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t, lineF as tf } from "../game/copy";
import { lang, say } from "../game/lang";

const BASE = import.meta.env.BASE_URL;

/**
 * The family that lives here, drawn.
 *
 * The art and the name and nothing else. A full CardView carries stats, a
 * rarity bar and an icon row, which is four more things than "this is what
 * is here" needs — and at ten across it would be four things too small to
 * read each.
 */
function Family({ seriesId }: { seriesId: string }) {
  const cards = [...CATALOG.values()].filter((c) => c.seriesId === seriesId);
  if (!cards.length) return null;
  return (
    <div className="ground__cards">
      {cards.map((c) => (
        <figure key={c.id} className="ground__card">
          <img src={`${BASE}cards/${c.id}.webp`} alt="" loading="lazy" />
          <figcaption>{say(c.name)}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function ArenaStory({ arena, onClose }: { arena: Arena; onClose: () => void }) {
  const series = SERIES_BY_ID.get(arena.family);
  const here = say(arena.name);
  const pct = Math.round(ARENA_POWER_BONUS * 100);

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--story" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s910293a", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {/* The place itself, at the size it was painted, with its name on it. */}
        <div
          className="story__art"
          style={{ backgroundImage: `url("${BASE}arena/${arena.id}.webp")` }}
        >
          <h2>{here}</h2>
        </div>

        <div className="story__text">
          <p className="story__tale">{say(arena.story)}</p>

          {series && (
            <>
              <Family seriesId={arena.family} />
              {/*
                The rule of the place, in his words.

                A generated sentence rather than five written ones, because
                the bonus is read from the same table the battle reads
                (ARENA_POWER_BONUS) — a caption promising 20% while the
                engine gives 15 is the worst kind of wrong, and the only way
                to be sure of it is for both to come from one number.
              */}
              <p className="story__rule">
                {lang() === "he"
                  ? tf(
                      "sa8cfb6f",
                      "קלפים מסדרת {0} מקבלים {1} +{2}% עוצמה!",
                      say(series.name),
                      atArena(here),
                      pct,
                    )
                  : `${say(series.name)} cards hit ${pct}% harder in ${here}!`}
              </p>
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
