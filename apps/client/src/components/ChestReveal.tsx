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
 * ═══ ONE TAP, AND THE CHEST DOES THE WAITING ═══
 *
 * It took four. Or asked for that — *"you should open it by tapping it lots
 * of times, and each time it almost opens, like in Brawl Stars"* — and I
 * argued for it in this comment: a chest is worth the wait before it, four
 * taps make the player do that waiting with their hands, and every one of
 * them is allowed to be the one.
 *
 * He has now said twice that it is wrong. *"When you press a chest from the
 * main screen, the chest-opening screen only opens after several times"*, and
 * then: *"opening a chest still doesn't work on one smooth click."*
 *
 * Measured before changing anything, because "it does not respond" and "it
 * responds and asks for more" are different bugs: every tap did land —
 * `--built` ran 0 → 0.25 → 0.5 → 0.75 and the lid jolted each time. So it was
 * never unresponsive. It was asking a seven year old to press four times for
 * something he had already asked for once, and that is what reads as broken.
 *
 * The build-up is kept and moved OFF the player's thumb: one tap, and the
 * chest jolts itself through the same four stages in 480ms and bursts. Same
 * animation, same glow, same sound — the moment before is still there, and
 * nobody has to earn it twice.
 */
import { useEffect, useRef, useState } from "react";
import { CATALOG } from "../data/catalog";
import { CardView, CardBack } from "./CardView";
import { Icon } from "./Icon";
import { EmojiFace } from "./EmojiFace";
import { Plaque } from "./Plaque";
import { CATCHPHRASES, EMOJI, EMOJI_PACKS } from "@amanda/shared";
import { sfx } from "../game/sfx";
import { pressed } from "../game/press";
import { flyReward } from "../game/reward";
import type { Chest } from "../game/account";
import * as V from "../data/voice";
import { line as t, lineF as tf } from "../game/copy";
import { say } from "../game/lang";
import { CardDetailModal } from "./CardDetailModal";

/** How each kind of chest introduces itself, and which painting it is. */
const CHEST_LOOK: Record<string, { he: string; tone: string; art: string }> = {
  // png, not webp: a chest is an object and keeps its transparency, so it sits
  // on the panel instead of on a coloured tile (see process.ts).
  wood: { he: t("s82374a3", "תיבת עץ"), tone: "#b07a3c", art: "chest_wood.png" },
  silver: { he: t("s662d31c", "תיבת כסף"), tone: "#c3cdd8", art: "chest_silver.png" },
  gold: { he: t("s5bba8e8", "תיבת זהב"), tone: "#f0b429", art: "chest_gold.png" },
};

const BASE = import.meta.env.BASE_URL;

interface Props {
  chest: Chest;
  onClose: () => void;
}

/**
 * The stages the lid goes through before it gives.
 *
 * Still four, because that is what the artwork and the `--built` ramp were
 * drawn for — they are frames of an animation now rather than presses.
 */
const STAGES = 4;

/** How long one stage holds. Four of these is 480ms, which is a flinch. */
const STAGE_MS = 120;

export function ChestReveal({ chest, onClose }: Props) {
  const [opened, setOpened] = useState(false);
  /** Which stage the lid is at. 0 before the tap, then 1..STAGES on a timer. */
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
  /**
   * Whether it has already happened, which is NOT the same as whether it is
   * on screen.
   *
   * Or: *"when there's a new card it gets stuck and doesn't go back to the
   * chest."* It did, and this is why. The effect below fired on `party`
   * being false, so closing the celebration put the condition back exactly
   * as it had been and the effect scheduled it again 420ms later — a loop
   * with a timer in it, which is why it looked like a freeze rather than a
   * flicker. The button worked every time; there was simply no way out.
   *
   * A ref rather than state because it must not cause a render of its own:
   * the whole bug was a render putting the condition back.
   */
  const celebrated = useRef(false);

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

  /*
   * One tap starts it, and the rest of the jolts are on a timer.
   *
   * Guarded on `taps` as well as on `opened`: the whole run takes 480ms and
   * a child tapping an exciting thing will press it again inside that, which
   * would otherwise start a second run on top of the first.
   */
  const hit = () => {
    if (opened || taps > 0) return;
    sfx.play("click");
    setTaps(1);
  };

  useEffect(() => {
    if (opened || taps === 0) return;
    if (taps >= STAGES) {
      sfx.play("explode");
      setBurst(true);
      setOpened(true);
      return;
    }
    const t = window.setTimeout(() => {
      setTaps((n) => n + 1);
      sfx.play("click");
    }, STAGE_MS);
    return () => window.clearTimeout(t);
  }, [taps, opened]);

  const allShown = shown >= chest.cards.length;

  /*
   * === AND THE DIAMONDS GO SOMEWHERE YOU CAN SEE ===
   *
   * Or: *"and when you take a chest and it has diamonds and nachos in it,
   * there is no animation of the diamonds and nachos going to the bar."*
   *
   * There was not, and the reason is the one the challenges panel had: this
   * chest covers the whole screen and the purse it would fly to is behind
   * it. So the flight starts as the chest closes, measured first — while
   * the number is still on screen — so the diamonds leave the figure the
   * player has been looking at.
   *
   * Nothing waits for it. The purse underneath is already correct; this is
   * the part that says where the diamonds went, not the part that moves
   * them.
   */
  const takeTheDiamonds = (button: HTMLElement) => {
    pressed(button, { sound: "newcard" });
    if (!chest.diamonds) return;
    const from = document.querySelector(".chest__gems")?.getBoundingClientRect();
    if (from) void flyReward({ icon: "gem", amount: chest.diamonds, from });
  };

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
    if (!allShown || !fresh.length || celebrated.current) return;
    celebrated.current = true;
    const t = window.setTimeout(() => {
      setParty(true);
      sfx.play("newcard");
    }, 420);
    return () => window.clearTimeout(t);
    // `fresh` is derived from the chest and does not change under us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShown]);

  return (
    <div className="chest" role="dialog">
      <div className={`chest__panel chest__panel--${chest.kind}`}>
        <p className="chest__title" style={{ color: look.tone }}>
          {say(look)}
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
              aria-label={tf("s3a10489", "פתח {0}", look.he)}
              style={{
                backgroundImage: `url("${BASE}scenes/${look.art}")`,
                ["--built" as string]: `${taps / STAGES}`,
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
            {/*
              Hidden while the celebration is up.
              Or, with a screenshot of the two stacked: *"Lovely" above
              "Nice"*. The new-card dialog sits OVER the chest on purpose —
              the cards behind it are the rest of what you won — but its
              backdrop is translucent, and a bright orange button showing
              through at 18% does not read as scenery. It reads as a second
              button, directly under the first, in a moment whose whole job
              is to have one thing to press.
            */}
            {!party && (
              /*
               * === ONE BUTTON, NEVER A DEAD ONE ===
               *
               * Or, with a recording of a gold chest: *"I opened a gold
               * chest — I have to SCROLL to reach its button. Really
               * rubbish. Think about it, this is the FUN moment of the
               * game."*
               *
               * Two things were wrong and this is the second of them. The
               * button sat disabled reading "…" for as long as the cards
               * took to turn over — eight cards at 420ms apiece is three
               * and a half seconds of a button you may not press. A child
               * who can already see what is in the chest had no way past
               * it.
               *
               * It presses THROUGH the reveal now: the first press turns
               * every remaining card at once, the next one closes. So the
               * button is alive from the first frame and the deal-out is an
               * offer rather than a queue.
               *
               * (The scrolling was the first thing and it is in chests.css:
               * the panel keeps the cards in a scroller and keeps this
               * where it is.)
               */
              <button
                className="btn-fight"
                onClick={(e) => {
                  if (allShown) {
                    takeTheDiamonds(e.currentTarget);
                    onClose();
                    return;
                  }
                  pressed(e.currentTarget, { sound: "draw", chips: 0 });
                  setShown(chest.cards.length);
                }}
              >
                {t("sbcd9e71", "יפה")}
              </button>
            )}
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
  /** The card whose full sheet is open over the celebration. */
  const [looking, setLooking] = useState<string | null>(null);
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
        <p className="newcard__tag">
          {many ? tf("s297ce81", "{0} קלפים חדשים!", ids.length) : t("s605a181", "קלף חדש!")}
        </p>
        {/*
          ═══ THE PICTURE AND THE NAME, AND NOTHING ELSE ═══

          Or: *"when there is a new card you see its picture — let them see
          only a picture and a name, and then when you press it they see the
          normal display of all the cards."*

          It was a whole CardView: artwork, element badges, rarity, health,
          power, attack speed, range. All of that is true and none of it is
          what this moment is. A new card is an EVENT — the thing you did
          not have and now do — and a specification sheet is what you read
          afterwards, once you have decided you care.

          So the celebration shows the one thing that makes a card itself,
          and the sheet is one press away, where it was always going to be.

          Each card still gets a CELL with a shape on it: `.card` is 100% of
          whatever holds it in both directions, so a card dropped straight
          into a flex row has a width and no height at all and comes out
          invisible — the same trap the album grid fell into.
        */}
        <div className="newcard__cards">
          {ids.slice(0, 3).map((id) => (
            <button
              type="button"
              className="newcard__cell newcard__cell--press"
              key={id}
              onClick={() => {
                sfx.play("click");
                setLooking(id);
              }}
              title={t("s17781ba", "לראות את הקלף")}
            >
              <img src={`${BASE}cards/${id}.webp`} alt="" />
              <span>{say(CATALOG.get(id)?.name ?? { he: "", en: "" })}</span>
            </button>
          ))}
        </div>
        {looking && <CardDetailModal cardId={looking} onClose={() => setLooking(null)} />}
        {/* The one that is not a card: more than three and the row stops
            being a row of cards and starts being a list. */}
        {ids.length > 3 && (
          <p className="newcard__more">{tf("s340e045", "ועוד {0}", ids.length - 3)}</p>
        )}
        <button className="btn-fight" onClick={onClose}>
          {t("s70a58ef", "איזה יופי")}
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
      <span className="chest__prize-tag">{t("sb0e2d63", "חדש אצלך")}</span>
      {pack ? (
        <>
          <span className="chest__prize-faces">
            {EMOJI.filter((e) => e.pack === pack.id).map((e) => (
              <EmojiFace key={e.id} id={e.id} size={34} />
            ))}
          </span>
          <b>{say(pack)}</b>
        </>
      ) : (
        <Plaque phrase={phrase!} size="big" />
      )}
    </div>
  );
}
