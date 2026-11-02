import { useEffect, useRef, useState } from "react";
import { TUNNEL, tunnelProgress, type GrantGives, type TunnelLane } from "@amanda/shared";
import { Icon } from "./Icon";
import { Lock } from "./SignedInOnly";
import { Overlay } from "./Overlay";
import { CATALOG } from "../data/catalog";
import { flyReward } from "../game/reward";
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
  /** "x3", "40" — never a word. */
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
    return { art: `${BASE}brand/av_${name}.webp`, alt: t("s74e74c0", "אווטאר") };
  if (kind === "back") return { icon: "deck", alt: t("s0ea25a4", "גב קלף") };
  if (kind === "emoji") return { icon: "joker", alt: t("s3a33d19", "אימוג׳ים") };
  return { icon: "joker", alt: t("s8bbbe6d", "פריט") };
}

function bitsOf(gives: GrantGives): Bit[] {
  const bits: Bit[] = [];
  for (const c of gives.cards ?? []) {
    const card = CATALOG.get(c.cardId);
    bits.push({
      art: `${BASE}cards/${c.cardId}.webp`,
      amount: c.copies > 1 ? `×${c.copies}` : undefined,
      alt: card ? say(card.name) : c.cardId,
    });
  }
  if (gives.chest)
    bits.push({
      art: `${BASE}scenes/chest_${gives.chest}.png`,
      icon: "chest",
      alt: t("s18b2098", "תיבה"),
    });
  if (gives.diamonds)
    bits.push({ icon: "gem", amount: String(gives.diamonds), alt: t("s10a6bc3", "יהלומים") });
  for (const id of gives.items ?? []) bits.push(itemBit(id));
  return bits;
}

function Prize({ bits }: { bits: Bit[] }) {
  return (
    <span className="tun__prize">
      {bits.map((b, i) => (
        <span className="tun__bit" key={i} title={b.alt}>
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
          {b.icon && !b.art && <Icon name={b.icon} size={22} />}
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

  const reached = state.known ? state.reached : 0;
  const next = TUNNEL[Math.min(reached, TUNNEL.length - 1)];
  const due = waiting(state);
  const at = state.known ? state.best : best;

  return (
    <button className={`tunnel-strip${due ? " tunnel-strip--due" : ""}`} onClick={onOpen}>
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
          ) : next && at < next.at ? (
            <>
              <Icon name="win" size={12} /> {tf("s75e5443", "עוד {0}", next.at - at)}
            </>
          ) : (
            t("s3627cf5", "הכול נלקח")
          )}
        </small>
      </span>
    </button>
  );
}

/** One station: the gate, the pass lane above it and the free lane below. */
function Station({
  index,
  state,
  signedIn,
  guest,
  gated,
  onTake,
}: {
  index: number;
  state: TunnelState;
  signedIn: boolean;
  guest: boolean;
  gated: (open: () => void) => () => void;
  onTake: (stop: number, lane: TunnelLane, from: HTMLElement) => void;
}) {
  const stop = TUNNEL[index]!;
  const open = state.known && state.best >= stop.at;
  const lanes: Array<{ lane: TunnelLane; gives: GrantGives }> = [
    { lane: "pass", gives: stop.pass },
    { lane: "free", gives: stop.free },
  ];

  return (
    <li className={`tun${open ? " is-open" : " is-shut"}`}>
      <span className="tun__arch" aria-hidden="true" />
      {lanes.map(({ lane, gives }) => {
        const taken = isClaimed(state, index, lane);
        const canTake = lane === "free" && open && !taken;
        /* The pass lane never offers anything: it is not for sale, and the
           label that says so is beside the lane rather than on every one of
           its twenty-one stations. See the tags beside the road. */
        return (
          <span className={`tun__lane tun__lane--${lane}${taken ? " is-taken" : ""}`} key={lane}>
            <Prize bits={bitsOf(gives)} />
            {taken ? (
              <span className="tun__tick" aria-label={t("s28c6942", "נלקח")}>
                <Icon name="ready" size={16} />
              </span>
            ) : canTake ? (
              <button
                className="tun__take"
                onClick={
                  signedIn ? (e) => onTake(index, lane, e.currentTarget) : gated(() => {})
                }
              >
                {t("sf07fc28", "לקחת")}
                {guest && <Lock />}
              </button>
            ) : null}
          </span>
        );
      })}
      <span className="tun__at">
        <Icon name="win" size={12} /> {stop.at}
      </span>
    </li>
  );
}

export function Tunnel({
  best,
  signedIn,
  guest,
  gated,
  onClaimed,
  onTaking,
  onClose,
}: {
  /** The high-water mark, which is what the tunnel is measured against. */
  best: number;
  signedIn: boolean;
  guest: boolean;
  gated: (open: () => void) => () => void;
  /** The purse and the album changed — reload the account. */
  onClaimed?: () => void;
  /** Close first: the prize flies to a purse that is behind this panel. */
  onTaking?: () => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<TunnelState>(lastTunnel);
  const [error, setError] = useState<string | null>(null);
  const road = useRef<HTMLOListElement>(null);

  useEffect(() => {
    void loadTunnel().then(setState);
  }, []);

  /*
   * Opened at the station you are standing in, not at the first one.
   *
   * Twenty-one stations do not fit on a phone, and the first three are a
   * thousand trophies behind anybody who has been playing — a tunnel that
   * always opens at its mouth makes a player scroll past their own history
   * to find the thing they came for.
   */
  useEffect(() => {
    const here = road.current?.children[Math.max(0, state.reached - 1)] as HTMLElement | undefined;
    here?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [state.reached]);

  const take = (stop: number, lane: TunnelLane, button: HTMLElement) => {
    setError(null);
    const bits = bitsOf(lane === "pass" ? TUNNEL[stop]!.pass : TUNNEL[stop]!.free);
    const from = button.closest(".tun__lane")?.getBoundingClientRect();
    const gem = bits.find((b) => b.icon === "gem");

    // The press, then the row, then the server — the same order a challenge
    // is taken in, and for the same reason: see Challenges.tsx.
    pressed(button, { sound: "newcard" });
    setState((was) => ({ ...was, claimed: [...was.claimed, { stop, lane }] }));
    onTaking?.();
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
      setState(await loadTunnel());
      onClaimed?.();
    })();
  };

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
            twenty-one of them, and twenty-one identical labels down a row is
            a texture, not a message. Here it is read once, at the head of
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
            <Station
              key={i}
              index={i}
              state={state}
              signedIn={signedIn}
              guest={guest}
              gated={gated}
              onTake={take}
            />
          ))}
        </ol>
        </div>
        {error && <p className="warn">{error}</p>}
      </div>
    </Overlay>
  );
}

/** How many free prizes are waiting, for the dot on the home screen. */
export { waiting as prizesWaiting };
