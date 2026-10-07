/**
 * What was in the chest.
 *
 * The server decided the contents and put the cards in the album before this
 * ever runs (apps/server/src/progress.ts), so nothing here can fail and
 * nothing is lost by closing the game half way through. This is a reveal, not
 * a transaction — which is exactly why it is allowed to be slow and enjoyable.
 *
 * Or: "opening a chest is the most 'gaming' moment the game has." It was an
 * icon of a card deck at 96px on a panel. Now there is a painted chest that
 * rattles at you until you tap it, a burst of light when you do, and the cards
 * turn over one at a time — because the whole point of a chest is the moment
 * before you know.
 *
 * ═══ AND IT TAKES FOUR TAPS, NOT ONE ═══
 *
 * Or: *"when you open a chest it should flash and be cool, and you should
 * open it by tapping it lots of times, and each time it almost opens, like in
 * Brawl Stars."*
 *
 * The reason that works, and the reason a single tap does not: a chest is
 * worth exactly as much as the wait before it. One tap spends the moment
 * immediately. Four taps make the player do the waiting with their hands, and
 * every one of them is allowed to be the one — so the thing that is actually
 * being built is not a progress bar, it is a guess.
 *
 * So each tap jolts the lid harder, leaks more light, and resolves nothing.
 * The last one bursts. There is NO sentence anywhere telling anybody to tap:
 * a chest that shudders and glows when you touch it has already said it, and
 * Or was explicit — *"no need to write an explanation about this!!!"*
 */
import { useEffect, useState } from "react";
import { CATALOG } from "../data/catalog";
import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import { EmojiFace } from "./EmojiFace";
import { Plaque } from "./Plaque";
import { CATCHPHRASES, EMOJI, EMOJI_PACKS } from "@amanda/shared";
import { sfx } from "../game/sfx";
import type { Chest } from "../game/account";
import * as V from "../data/voice";

/** How each kind of chest introduces itself, and which painting it is. */
const CHEST_LOOK: Record<string, { he: string; tone: string; art: string }> = {
  // png, not webp: a chest is an object and keeps its transparency, so it sits
  // on the panel instead of on a coloured tile (see process.ts).
  wood: { he: "תיבת עץ", tone: "#b07a3c", art: "chest_wood.png" },
  silver: { he: "תיבת כסף", tone: "#c3cdd8", art: "chest_silver.png" },
  gold: { he: "תיבת זהב", tone: "#f0b429", art: "chest_gold.png" },
};

const BASE = import.meta.env.BASE_URL;

interface Props {
  chest: Chest;
  onClose: () => void;
}

/**
 * Taps to open.
 *
 * Four. Three is over before the player notices it was a game; six turns the
 * best moment in the app into work, and a child is doing it on a phone with
 * one thumb.
 */
const TAPS_TO_OPEN = 4;

export function ChestReveal({ chest, onClose }: Props) {
  const [opened, setOpened] = useState(false);
  /** How many times it has been hit. 0 .. TAPS_TO_OPEN - 1 while it holds. */
  const [taps, setTaps] = useState(0);
  /**
   * The flash, which outlives the chest by a beat.
   *
   * Kept separate from `opened` so the burst can still be on screen while the
   * cards are already turning — the light and the prize overlapping is what
   * makes it feel like one event rather than two screens.
   */
  const [burst, setBurst] = useState(false);
  /** How many cards have been turned over so far. */
  const [shown, setShown] = useState(0);
  const look = CHEST_LOOK[chest.kind] ?? CHEST_LOOK.wood!;
  const [line] = useState(() => V.pick(V.CHEST_LINES));
  /*
   * Cards in here the album had never held. Only ever a handful, and usually
   * none — which is the reason the celebration is worth having.
   */
  const fresh = (chest.fresh ?? []).filter((id) => CATALOG.has(id));
  /** The celebration, held back until every card has turned. */
  const [party, setParty] = useState(false);

  // Turn them over one at a time once it is open.
  useEffect(() => {
    if (!opened || shown >= chest.cards.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), 420);
    return () => window.clearTimeout(t);
  }, [opened, shown, chest.cards.length]);

  // The flash fades on its own; nothing waits for it.
  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(false), 1100);
    return () => window.clearTimeout(t);
  }, [burst]);

  const hit = () => {
    if (opened) return;
    const next = taps + 1;
    if (next >= TAPS_TO_OPEN) {
      sfx.play("explode");
      setBurst(true);
      setOpened(true);
      return;
    }
    setTaps(next);
    sfx.play("click");
  };

  const allShown = shown >= chest.cards.length;

  /*
   * ═══ A NEW CARD IS AN EVENT ═══
   *
   * Or: *"when I get a NEW card, make a bit of a celebration out of it. Pop
   * up a popup, some fireworks, announce a new card."*
   *
   * It waits for the last card to turn rather than firing on the one that is
   * new. Two reasons: the turning is itself a reveal and interrupting it
   * throws away the part the chest exists for, and a chest with three new
   * cards would otherwise set off three separate celebrations on top of each
   * other.
   *
   * It only happens when something is actually new. A chest of duplicates is
   * the ordinary case, and a "celebration" that fires every single time is
   * just the close button with confetti on it.
   */
  useEffect(() => {
    if (!allShown || !fresh.length || party) return;
    const t = window.setTimeout(() => {
      setParty(true);
      sfx.play("win");
    }, 420);
    return () => window.clearTimeout(t);
    // `fresh` is derived from the chest and does not change under us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShown, party]);

  return (
    <div className="chest" role="dialog">
      <div className={`chest__panel chest__panel--${chest.kind}`}>
        <p className="chest__title" style={{ color: look.tone }}>
          {look.he}
        </p>

        {burst && <div className="chest__burst" aria-hidden="true" />}

        {!opened ? (
          <>
            {/*
              The chest IS the button, and the only one. The "open" button that
              used to sit under it would have skipped the whole thing in a
              single press — and with four taps to give, a shortcut past them
              is a shortcut past the feature.

              `--built` carries how far along it is, 0 to 1, and chests.css
              does the rest: the glow, the shake and the light coming out of
              the seam all read from that one number, so the build-up is one
              idea in one place instead of four classes.

              The alternating `--hit-a` / `--hit-b` is how the jolt plays
              AGAIN on a tap that happens while the last jolt is still
              running: a CSS animation only restarts when its name changes, so
              the two names are identical keyframes and the parity swaps them.
            */}
            <button
              className={`chest__lid chest__lid--hit-${taps % 2 === 0 ? "a" : "b"}`}
              onClick={hit}
              aria-label={`פתח ${look.he}`}
              style={{
                backgroundImage: `url("${BASE}scenes/${look.art}")`,
                ["--built" as string]: `${taps / TAPS_TO_OPEN}`,
              }}
            />
            <p className="chest__says">{line}</p>
          </>
        ) : (
          <>
            <div className="chest__cards">
              {chest.cards.map((id, i) => (
                <div key={`${id}-${i}`} className={`chest__card${i < shown ? " is-up" : ""}`}>
                  {i < shown && CATALOG.has(id) ? (
                    <CardView cardId={id} size="small" />
                  ) : (
                    <CardBack size="small" />
                  )}
                </div>
              ))}
            </div>
            {chest.diamonds > 0 && allShown && (
              <p className="chest__gems">
                <Icon name="gem" size={22} /> +{chest.diamonds}
              </p>
            )}
            {/*
              And the thing that is not a card.

              Or wanted emoji and catchphrases winnable as well as buyable, so
              this is the moment that has to land. It comes LAST, after every
              card has turned and the diamonds have landed — it is the rarest
              thing in the chest and it should be the last thing you see, not
              one more tile in a row.
            */}
            {allShown && chest.items?.map((id) => <Prize key={id} id={id} />)}
            <button className="btn-fight" disabled={!allShown} onClick={onClose}>
              {allShown ? "יפה" : "…"}
            </button>
          </>
        )}
      </div>

      {party && <NewCards ids={fresh} onClose={() => setParty(false)} />}
    </div>
  );
}

/**
 * The fuss over a card you have never had.
 *
 * Over the chest rather than instead of it: the chest is still underneath
 * with the rest of what was in it, and closing this goes back to it. A
 * separate screen would make "you got a new card" and "here is what was in
 * the chest" two events, and they are one.
 *
 * The fireworks are drawn here rather than in CSS alone because each one needs
 * its own angle and delay, and twelve hand-written rules for twelve sparks is
 * a worse version of a loop. Everything else about them — the colours, the
 * arc, the fade — is in chests.css.
 */
function NewCards({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const many = ids.length > 1;
  return (
    <div className="newcard" role="dialog" onClick={onClose}>
      <div className="newcard__box" onClick={(e) => e.stopPropagation()}>
        <div className="newcard__fw" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i
              key={i}
              style={{
                // Spread evenly around the circle, then nudged so the ring
                // does not read as a clock face.
                ["--a" as string]: `${(i * 360) / 14 + (i % 3) * 7}deg`,
                ["--d" as string]: `${(i % 5) * 90}ms`,
                ["--r" as string]: `${86 + (i % 4) * 26}px`,
              }}
            />
          ))}
        </div>
        <p className="newcard__tag">{many ? `${ids.length} קלפים חדשים!` : "קלף חדש!"}</p>
        {/*
          Each card gets a CELL with a shape on it. `.card` is 100% of
          whatever holds it in both directions, so a card dropped straight
          into a flex row has a width and no height at all and comes out
          invisible — the same trap the album grid fell into.
        */}
        <div className="newcard__cards">
          {ids.slice(0, 3).map((id) => (
            <span className="newcard__cell" key={id}>
              <CardView cardId={id} size="large" />
            </span>
          ))}
        </div>
        {/* The one that is not a card: more than three and the row stops
            being a row of cards and starts being a list. */}
        {ids.length > 3 && <p className="newcard__more">ועוד {ids.length - 3}</p>}
        <button className="btn-fight" onClick={onClose}>
          איזה יופי
        </button>
      </div>
    </div>
  );
}

/**
 * One shop item found in a chest, drawn as the thing itself.
 *
 * An emoji pack shows its four faces; a catchphrase shows the line in the
 * treatment you have just won. Neither is a name and a gem icon, because what
 * makes both of them worth owning is what they LOOK like — the same reason
 * they are worth buying (Or: "it is something you SEE").
 */
function Prize({ id }: { id: string }) {
  const pack = EMOJI_PACKS.find((p) => p.id === id);
  const phrase = CATCHPHRASES.find((p) => p.item === id);
  if (!pack && !phrase) return null;

  return (
    <div className="chest__prize">
      <span className="chest__prize-tag">חדש אצלך</span>
      {pack ? (
        <>
          <span className="chest__prize-faces">
            {EMOJI.filter((e) => e.pack === pack.id).map((e) => (
              <EmojiFace key={e.id} id={e.id} size={34} />
            ))}
          </span>
          <b>{pack.he}</b>
        </>
      ) : (
        <Plaque phrase={phrase!} size="big" />
      )}
    </div>
  );
}
