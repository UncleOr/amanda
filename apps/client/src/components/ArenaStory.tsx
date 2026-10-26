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
import { useEffect, useState } from "react";
import { ARENA_POWER_BONUS, atArena, type Arena } from "@amanda/shared";
import { CardDetailModal } from "./CardDetailModal";
import { CATALOG, SERIES_BY_ID } from "../data/catalog";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t, lineF as tf } from "../game/copy";
import { lang, say } from "../game/lang";
import { sfx } from "../game/sfx";

/**
 * How long the pack takes to come apart before the cards are dealt.
 *
 * Or: *"the animation of a pack of cards opening in the arena still does
 * not exist."* It did not: the pack vanished between two frames and a grid
 * appeared where it had been, which is a state change rather than an event.
 *
 * 260ms, which is about as long as a thing can take before a child presses
 * it again. It is also the length of the burst in chests.css, deliberately
 * — a pack coming apart and a chest lid giving way are the same moment in
 * this game and should not be two different speeds.
 */
const BURST_MS = 260;

const BASE = import.meta.env.BASE_URL;

/**
 * The family that lives here, drawn.
 *
 * The art and the name and nothing else. A full CardView carries stats, a
 * rarity bar and an icon row, which is four more things than "this is what
 * is here" needs — and at ten across it would be four things too small to
 * read each.
 */
function Family({
  seriesId,
  name,
  onPick,
}: {
  seriesId: string;
  name: string;
  /** Open one card's own page. Every card here is a card you can look at. */
  onPick: (cardId: string) => void;
}) {
  const cards = [...CATALOG.values()].filter((c) => c.seriesId === seriesId);
  /*
   * ═══ A PACK, UNTIL YOU OPEN IT ═══
   *
   * Or: *"after you open an arena, show a pack of cards with '(the Slimes)'
   * written beside it, and when you press it, it fans out and you see all
   * the cards the way you do now (and of course you can press each card and
   * see its details)."*
   *
   * Closed is the right first state and not only for the room it saves: ten
   * card backs with a family's name beside them is a THING — something that
   * arrived with this place — and a row of ten small pictures is an index.
   * The fan is what makes opening it worth a press.
   */
  const [open, setOpen] = useState(false);
  /*
   * === AND IT COMES APART BEFORE IT DEALS ===
   *
   * The press has three moments, and the middle one is the one that was
   * missing. The pack jolts and its three backs fly out of the stack; the
   * grid replaces it; the cards land one after another, 26ms apart, the
   * same stagger the album's packs use (album.css) — because a pack opening
   * is a pack opening and two different speeds for it would read as two
   * different games.
   */
  const [bursting, setBursting] = useState(false);
  useEffect(() => {
    if (!bursting) return;
    const t = window.setTimeout(() => {
      setBursting(false);
      setOpen(true);
    }, BURST_MS);
    return () => window.clearTimeout(t);
  }, [bursting]);
  if (!cards.length) return null;

  if (!open)
    return (
      <button
        type="button"
        className={`ground__pack${bursting ? " is-bursting" : ""}`}
        onClick={() => {
          if (bursting) return;
          sfx.play("draw");
          setBursting(true);
        }}
      >
        <span className="ground__fan" aria-hidden="true">
          {/* Three backs, stacked and splayed: the shape of a pack. */}
          {cards.slice(0, 3).map((c) => (
            <i key={c.id} style={{ backgroundImage: `url("${BASE}cards/${c.id}.webp")` }} />
          ))}
        </span>
        <b>{name}</b>
        <small>{cards.length}</small>
      </button>
    );

  return (
    <div className="ground__cards is-dealt">
      {cards.map((c) => (
        <button
          type="button"
          key={c.id}
          className="ground__card"
          onClick={() => onPick(c.id)}
        >
          <img src={`${BASE}cards/${c.id}.webp`} alt="" loading="lazy" />
          <span>{say(c.name)}</span>
        </button>
      ))}
    </div>
  );
}

export function ArenaStory({ arena, onClose }: { arena: Arena; onClose: () => void }) {
  const series = SERIES_BY_ID.get(arena.family);
  const here = say(arena.name);
  const pct = Math.round(ARENA_POWER_BONUS * 100);
  /** A card from the pack, opened. Its own sheet, over this one. */
  const [looking, setLooking] = useState<string | null>(null);

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--story" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s910293a", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {/*
          ═══ THE PLACE, AND IT MOVES ═══

          Or: *"the picture in the arena doesn't really show the location. I
          would turn the picture into a sort of gif that runs in a loop with
          a small animation."*

          Both halves have one cause. The paintings are 1152x576 and the
          window they are shown through is a band — on a phone held sideways
          there is no room for anything taller — so a still picture shows
          about a third of the place and no more, for ever.

          A still is not what this needs. The picture drifts slowly from the
          top of the painting to the bottom and back, so everything in it
          comes past: it answers "show me the location" by showing all of it
          in turn, and it answers "make it a gif" with the same motion. No
          new art, nothing to export, and it works on every arena he paints
          next.
        */}
        <div className="story__art">
          <img className="story__pan" src={`${BASE}arena/${arena.id}.webp`} alt="" />
          <h2>{here}</h2>
        </div>

        <div className="story__text">
          <p className="story__tale">{say(arena.story)}</p>

          {series && (
            <>
              <Family seriesId={arena.family} name={say(series.name)} onPick={setLooking} />
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
      {/*
        One card's own page, opened from the pack. Written inside this
        Overlay and portalled out like every other one — see Overlay.tsx for
        why a click on its backdrop does not also close the arena behind it.
      */}
      {looking && <CardDetailModal cardId={looking} onClose={() => setLooking(null)} />}
    </Overlay>
  );
}
