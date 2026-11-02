import { Fragment, useEffect, useRef, useState } from "react";
import { TUNNEL, stopsReached, tunnelProgress, type GrantGives, type TunnelLane } from "@amanda/shared";
import { Icon } from "./Icon";
import { Lock } from "./SignedInOnly";
import { Overlay } from "./Overlay";
import { CATALOG } from "../data/catalog";
import { RARITY_META } from "../data/cardMeta";
import { flyReward } from "../game/reward";
import { haptics } from "../game/haptics";
import { pressed } from "../game/press";
import { claimStop, isClaimed, lastTunnel, loadTunnel, waiting, type TunnelState } from "../game/tunnel";
import { line as t, lineF as tf } from "../game/copy";
import { say } from "../game/lang";

/**
 * ═══ מנהרת הפרסים ═══
 *
 * Or: *"we want to add a prize track like in Brawl Stars. We'll call it 'the
 * prize tunnel' and it should look like a car wash tunnel... it works by
 * trophies, and adds little prize stations between the arenas. Make both
 * tracks now with the better prizes, and write 'coming soon' on the Legendary
 * Pass."*
 *
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * One thing: TAKE THE PRIZE THAT IS WAITING. Everything else on it — the
 * stations further up, the better lane, the trophy numbers — is there to
 * answer "and what is next", which is the question the home screen cannot
 * answer in a strip.
 *
 * So the hero is the station you can claim, and it is the only thing on the
 * screen that is lit, full colour, and has a button on it. A station you have
 * passed is grey and ticked; one you have not reached is dark; the Legendary
 * Pass lane is dark all the way along with one word on it.
 *
 * ═══ IT IS A CAR WASH, AND THAT IS NOT DECORATION ═══
 *
 * A row of numbered boxes is a table. The arches are what make it a place you
 * travel through — you are the car, the trophies carry you forward, and the
 * prizes are on the rollers either side. Pure CSS (see tunnel.css); nothing
 * here is an image that has to be drawn, downloaded or paid for.
 */
const BASE = import.meta.env.BASE_URL;

/**
 * One thing a station hands over, as a picture and a number.
 *
 * A prize is not one thing — a station can give a chest AND diamonds — so a
 * tile is a row of these rather than a single icon, and the shape of the row
 * is read off the gift itself. Nothing is written twice: the gift in
 * packages/shared/src/tunnel.ts is the only place that says what is in it.
 */
interface Bit {
  /** A picture, when the prize has one of its own. */
  art?: string;
  /** Otherwise an icon from the set. */
  icon?: "gem" | "chest" | "deck" | "king" | "joker";
  /**
   * How the picture is drawn, which is NOT decoration.
   *
   * Or: *"the images are cut."* They were: every prize was a 38px square
   * with `object-fit: cover`, and a monster card is a PORTRAIT — so the game
   * was advertising its prizes by showing a card's chin. A card is drawn as
   * a little card, with the frame and the shape it has everywhere else; a
   * chest, a face or an icon is drawn whole inside a square.
   */
  shape: "card" | "thing";
  /** The colour behind it: rarity for a card, its own for everything else. */
  tone?: string;
  /** "×3", "40" — never a word. */
  amount?: string;
  /** What it is, for a screen reader and for the title attribute. */
  alt: string;
}

/**
 * ⚠ A SHOP ITEM'S PICTURE IS NOT IN THIS BUILD.
 *
 * Avatars, backs, emoji and catchphrases are rows in `shop_items` — their art
 * and their names live in the database, which is right (Or can change both
 * without a deploy) and means a tile here cannot draw one without asking the
 * server. Rather than making this screen wait on a fetch it does not
 * otherwise need, the KIND is read off the id, which is the one part of a
 * shop item that is structural: `avatar.skater` is an avatar in every build.
 *
 * An avatar is the exception worth making, because its picture IS its id
 * everywhere else in the game (see shopItemArt) and a face is the one prize
 * here that means nothing as an icon.
 */
function itemBit(id: string): Bit {
  const [kind, name] = id.split(".");
  if (kind === "avatar" && name)
    return {
      art: `${BASE}brand/av_${name}.webp`,
      shape: "thing",
      tone: "#4aa3ff",
      alt: t("s74e74c0", "אווטאר"),
    };
  if (kind === "back")
    return { icon: "deck", shape: "thing", tone: "#b06fd6", alt: t("s0ea25a4", "גב קלף") };
  if (kind === "emoji")
    return { icon: "joker", shape: "thing", tone: "#4ade80", alt: t("s3a33d19", "אימוג׳ים") };
  return { icon: "joker", shape: "thing", tone: "#9aa4ad", alt: t("s8bbbe6d", "פריט") };
}

/** The colour a chest glows in, which is the one everybody already knows. */
const CHEST_TONE: Record<string, string> = {
  wood: "#c98b4a",
  silver: "#cdd6e4",
  gold: "#ffb020",
};

function bitsOf(gives: GrantGives): Bit[] {
  const bits: Bit[] = [];
  for (const c of gives.cards ?? []) {
    const card = CATALOG.get(c.cardId);
    bits.push({
      art: `${BASE}cards/${c.cardId}.webp`,
      shape: "card",
      tone: card ? RARITY_META[card.rarity].color : undefined,
      amount: c.copies > 1 ? `×${c.copies}` : undefined,
      alt: card ? say(card.name) : c.cardId,
    });
  }
  if (gives.chest)
    bits.push({
      art: `${BASE}scenes/chest_${gives.chest}.png`,
      icon: "chest",
      shape: "thing",
      tone: CHEST_TONE[gives.chest] ?? "#ffb020",
      alt: t("s18b2098", "תיבה"),
    });
  if (gives.diamonds)
    bits.push({
      icon: "gem",
      shape: "thing",
      tone: "#7fe7ff",
      amount: String(gives.diamonds),
      alt: t("s10a6bc3", "יהלומים"),
    });
  for (const id of gives.items ?? []) bits.push(itemBit(id));
  return bits;
}

function Prize({ bits }: { bits: Bit[] }) {
  return (
    <span className="tun__prize">
      {bits.map((b, i) => (
        <span
          className={`tun__bit tun__bit--${b.shape}`}
          key={i}
          title={b.alt}
          style={b.tone ? ({ ["--tone" as string]: b.tone } as object) : undefined}
        >
          {b.art ? (
            <img
              src={b.art}
              alt={b.alt}
              /* A missing picture falls back to the icon beside it rather
                 than to a broken-image box, which is the one thing on a
                 prize tile that reads as a bug. */
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : null}
          {b.icon && !b.art && <Icon name={b.icon} size={26} />}
          {b.amount && <b className="tun__amount">{b.amount}</b>}
        </span>
      ))}
    </span>
  );
}

/**
 * The strip on the home screen: where you are in the tunnel, and whether
 * something is waiting in it.
 *
 * Under the arena ladder on purpose — they are the same sentence read twice.
 * The ladder says where the trophies have taken you; this says what they
 * earned on the way.
 */
export function TunnelStrip({ best, onOpen }: { best: number; onOpen: () => void }) {
  const [state, setState] = useState<TunnelState>(lastTunnel);
  useEffect(() => {
    void loadTunnel().then(setState);
  }, [best]);

  /*
   * ⚠ THE TRACK IS KNOWN WITHOUT THE SERVER; ONLY THE CLAIMS ARE NOT.
   *
   * This used to fall back to "nothing reached" while the answer was in the
   * air, and a player at 692 trophies was told הכול נלקח — everything taken
   * — by a strip that had simply not been told anything yet. The stations
   * ship with the game; the count of what is OPEN is arithmetic on the
   * trophies this screen already has in its hand.
   */
  const reached = state.known ? state.reached : stopsReached(best);
  const at = state.known ? state.best : best;
  const next = TUNNEL[reached] ?? null;
  const due = waiting(state);
  /* What is at the next station, as a picture: the single most motivating
     thing a track can show, and it costs one line. */
  const face = next ? bitsOf(next.free)[0] : null;

  return (
    <button
      className={`tunnel-strip${due ? " tunnel-strip--due" : ""}`}
      onClick={onOpen}
      title={t("s2213087", "מנהרת הפרסים")}
    >
      <span className="tunnel-strip__arch" aria-hidden="true" />
      <span className="tunnel-strip__text">
        <b>{t("s2213087", "מנהרת הפרסים")}</b>
        <span className="tunnel-strip__bar" aria-hidden="true">
          <i style={{ width: `${tunnelProgress(at) * 100}%` }} />
        </span>
        <small>
          {/*
            One voice. A badge with "9" on it beside a line that says "9
            prizes are waiting" is the same fact twice, and the lit border is
            already doing the work of catching the eye.
          */}
          {due ? (
            /* The one thing worth saying here: something is waiting. */
            tf("sbd894ed", "{0} פרסים מחכים", due)
          ) : next ? (
            <>
              <Icon name="win" size={12} /> {tf("s75e5443", "עוד {0}", Math.max(0, next.at - at))}
            </>
          ) : (
            t("s3627cf5", "הכול נלקח")
          )}
        </small>
      </span>
      {/* The prize at the end of this stretch, so the strip shows what it is
          for rather than only how far it is. */}
      {face && (
        <span className="tunnel-strip__next" aria-hidden="true">
          {face.art ? <img src={face.art} alt="" /> : <Icon name={face.icon ?? "gem"} size={22} />}
        </span>
      )}
    </button>
  );
}

/**
 * One prize, on one of the two lanes.
 *
 * Three states and they are told apart by colour before they are read:
 * something to take is gold and moving, something taken is flat and ticked,
 * something ahead is dark. The pass lane is never any of those — it is not
 * for sale, and it wears a padlock and the royal colour all the way along.
 */
function Lane({
  lane,
  gives,
  taken,
  canTake,
  guest,
  onTake,
}: {
  lane: TunnelLane;
  gives: GrantGives;
  taken: boolean;
  canTake: boolean;
  guest: boolean;
  onTake?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span
      className={`tun__lane tun__lane--${lane}${taken ? " is-taken" : ""}${
        canTake ? " is-ready" : ""
      }`}
    >
      {/* The sweep of light across a prize that is waiting. Drawn only on
          the tiles that can be taken. */}
      {canTake && <span className="tun__shine" aria-hidden="true" />}
      <Prize bits={bitsOf(gives)} />
      {taken ? (
        <span className="tun__tick" aria-label={t("s28c6942", "נלקח")}>
          <Icon name="ready" size={16} />
        </span>
      ) : canTake ? (
        <button className="tun__take" onClick={onTake}>
          {t("sf07fc28", "לקחת")}
          {guest && <Lock />}
        </button>
      ) : lane === "pass" ? (
        <span className="tun__shut" aria-hidden="true">
          <Lock />
        </span>
      ) : null}
    </span>
  );
}

/**
 * ═══ ONE STATION ═══
 *
 * The pass lane above the road, the toll ON the road, the free lane below
 * it — which is the shape every game that does this well uses, and the
 * reason is that it reads as a JOURNEY rather than as a table of rows. Or:
 * *"it should look like a track — maybe more space between the prizes, with
 * a marker of where you are right now, even before you have reached the next
 * prize. Look at how it is done in Brawl Stars and Clash Royale."*
 *
 * The number used to sit under everything, which made it a caption on a row
 * of boxes. On the road it is a milestone.
 */
function Station({
  index,
  state,
  signedIn,
  guest,
  gated,
  onTake,
  won,
}: {
  index: number;
  state: TunnelState;
  signedIn: boolean;
  guest: boolean;
  gated: (open: () => void) => () => void;
  onTake: (stop: number, lane: TunnelLane, from: HTMLElement) => void;
  /** Just taken — the burst plays here. */
  won?: boolean;
}) {
  const stop = TUNNEL[index]!;
  const open = state.best >= stop.at;
  /** The one ahead of you — the thing the whole screen is pointing at. */
  const isNext = !open && state.best >= (TUNNEL[index - 1]?.at ?? 0);
  const freeTaken = isClaimed(state, index, "free");

  return (
    <li className={`tun${open ? " is-open" : " is-shut"}${isNext ? " is-next" : ""}`}>
      <Lane
        lane="pass"
        gives={stop.pass}
        taken={isClaimed(state, index, "pass")}
        canTake={false}
        guest={guest}
      />
      {/* The toll, on the road. */}
      <span className="tun__node">
        <b>{stop.at}</b>
        <Icon name="win" size={11} />
      </span>
      <Lane
        lane="free"
        gives={stop.free}
        taken={freeTaken}
        canTake={open && !freeTaken && state.known}
        guest={guest}
        onTake={signedIn ? (e) => onTake(index, "free", e.currentTarget) : gated(() => {})}
      />
      {/*
        ⚠ THE BURST IS INSIDE THE STATION, not a sibling on the road.
        Written as its own item in the row it changed the row's content
        while the row was scrolled — and in a right-to-left scroller that
        moves the scroll position, so taking a prize threw the player back
        to the mouth of the tunnel. Absolutely positioned inside the station
        it costs the layout nothing.
      */}
      {won && <span className="tun-pop" aria-hidden="true" />}
    </li>
  );
}

/**
 * ═══ WHERE YOU ARE, BETWEEN TWO STATIONS ═══
 *
 * Or: *"with a marker of where you are right now, even before you have
 * reached the next prize."*
 *
 * Which is the half of a reward track that makes the next one feel close:
 * without it the screen can only say "open" or "shut", and a player three
 * trophies short looks exactly like a player three hundred short. It rides
 * in the gap between two stations, at the real fraction of the way across.
 */
function Marker({ at, through }: { at: number; through: number }) {
  return (
    <span
      className="tun-you"
      style={{ ["--through" as string]: `${Math.round(through * 100)}%` }}
    >
      <b>
        <Icon name="win" size={11} /> {at}
      </b>
    </span>
  );
}

export function Tunnel({
  best,
  signedIn,
  guest,
  gated,
  onClaimed,
  onClose,
}: {
  /** The high-water mark, which is what the tunnel is measured against. */
  best: number;
  signedIn: boolean;
  guest: boolean;
  gated: (open: () => void) => () => void;
  /** The purse and the album changed — reload the account. */
  onClaimed?: () => void;
  onClose: () => void;
}) {
  /*
   * The track draws itself from the trophies this screen was handed, and the
   * server's answer only ever adds to it (which prizes are already taken).
   * Without that seed the whole tunnel reads as locked for the first second
   * of every visit.
   */
  const seeded = (was: TunnelState): TunnelState =>
    was.known ? was : { ...was, best: Math.max(was.best, best), reached: stopsReached(best) };
  const [state, setState] = useState<TunnelState>(() => seeded(lastTunnel()));
  const [error, setError] = useState<string | null>(null);
  /** The station that was just taken, so the tile can celebrate. */
  const [won, setWon] = useState<number | null>(null);
  const road = useRef<HTMLOListElement>(null);

  useEffect(() => {
    void loadTunnel().then((s) => setState(seeded(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best]);

  /*
   * Opened where you are standing, not at the mouth.
   *
   * Twenty-odd stations do not fit on a phone, and the first few are a
   * thousand trophies behind anybody who has been playing — a tunnel that
   * always opens at its start makes a player scroll past their own history
   * to find the thing they came for. The marker is the thing to centre on:
   * it is exactly where they are.
   */
  useEffect(() => {
    const here = road.current?.querySelector(".tun-you") as HTMLElement | null;
    (here ?? (road.current?.children[Math.max(0, state.reached - 1)] as HTMLElement))
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [state.reached]);

  const take = (stop: number, lane: TunnelLane, button: HTMLElement) => {
    setError(null);
    const bits = bitsOf(lane === "pass" ? TUNNEL[stop]!.pass : TUNNEL[stop]!.free);
    const tile = button.closest(".tun__lane") as HTMLElement | null;
    const from = tile?.getBoundingClientRect();
    const gem = bits.find((b) => b.icon === "gem");

    // The press, then the row, then the server — the same order a challenge
    // is taken in, and for the same reason: see Challenges.tsx.
    pressed(button, { sound: "newcard" });
    haptics.buzz("aim");
    setState((was) => ({ ...was, claimed: [...was.claimed, { stop, lane }] }));
    /*
     * ⚠ AND THE PANEL STAYS OPEN. Or: *"when you take something from the
     * track it closes. That is no good."*
     *
     * It closed because the prize flew to the purse behind it, which is how
     * a challenge is claimed — and a challenge panel is a list you are
     * finished with, while a track is a place you are walking along. So the
     * celebration happens HERE, on the tile, and the diamonds fly from the
     * tile to the purse over the top of the panel.
     */
    setWon(stop);
    window.setTimeout(() => setWon((w) => (w === stop ? null : w)), 900);
    const landed =
      gem && from
        ? flyReward({ icon: "gem", amount: Number(gem.amount ?? 0), from })
        : Promise.resolve();

    void (async () => {
      const why = await claimStop(stop, lane);
      if (why) {
        setState((was) => ({
          ...was,
          claimed: was.claimed.filter((c) => !(c.stop === stop && c.lane === lane)),
        }));
        setError(why);
        return;
      }
      await landed;
      setState(seeded(await loadTunnel()));
      onClaimed?.();
    })();
  };

  /*
   * Where the marker goes: in the gap BEFORE the next station, at the real
   * fraction of the way across it.
   */
  const here = state.reached;
  const through = tunnelProgress(state.best);

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--tunnel" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s4848cb9", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>
        <h2 className="tunnel__title">{t("s26a4e3d", "מנהרת הפרסים")}</h2>
        <div className="tunnel__body">
          {/*
            ═══ WHICH LANE IS WHICH, SAID ONCE ═══

            Or: *"write 'coming soon' on the Legendary Pass."*

            Beside the road rather than on the stations: the pass lane has
            one at every station, and that many identical labels down a row
            is a texture, not a message. Here it is read once, at the head of
            the lane it belongs to, where a dark row of prizes is explained
            before a child has to wonder why it cannot be touched.
          */}
          <div className="tunnel__tags" aria-hidden="true">
            <span className="tunnel__tag tunnel__tag--pass">
              Legendary Pass
              <b>{t("sa63fff7", "בקרוב")}</b>
            </span>
            <span className="tunnel__tag">{t("s373d8d1", "חינם")}</span>
          </div>
          <ol className="tunnel__road" ref={road}>
            {TUNNEL.map((_, i) => (
              <Fragment key={i}>
                {/* The stretch of road before this station, and the player
                    on it when this is the stretch they are walking. */}
                <li className={`tun-gap${i <= here ? " is-done" : ""}`} aria-hidden="true">
                  {i === here && <Marker at={state.best} through={through} />}
                </li>
                <Station
                  index={i}
                  state={state}
                  signedIn={signedIn}
                  guest={guest}
                  gated={gated}
                  onTake={take}
                  won={won === i}
                />
              </Fragment>
            ))}
            {/* The end of the road, which is also where the marker stands
                once there is nothing left ahead. */}
            <li className={`tun-gap tun-gap--end${here >= TUNNEL.length ? " is-done" : ""}`} aria-hidden="true">
              {here >= TUNNEL.length && <Marker at={state.best} through={1} />}
            </li>
          </ol>
        </div>
        {error && <p className="warn">{error}</p>}
      </div>
    </Overlay>
  );
}

/** How many free prizes are waiting, for the dot on the home screen. */
export { waiting as prizesWaiting };
