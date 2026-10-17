import { DEFAULT_BACK, catchphraseById, phraseText, type PlayerCard } from "@amanda/shared";
import { Plaque } from "./Plaque";
import { CardBack } from "./CardView";
import { Icon } from "./Icon";
import { line as t } from "../game/copy";

const BASE = import.meta.env.BASE_URL;

/**
 * The beat before a match: who you are about to fight.
 *
 * Or: *"at the start of a match against a friend (and against the bot too)
 * there should be a second where you see who you are fighting — how many
 * trophies they have, their nickname and their picture."*
 *
 * ═══ IT SITS IN THE COUNTDOWN THAT ALREADY EXISTED ═══
 *
 * There were already three seconds here with a number counting down in the
 * middle of an empty screen, which is the game asking the player to wait and
 * giving them nothing to look at. This is what goes in them. No new phase, no
 * extra second added to the time before you can play — the pause was already
 * being spent.
 *
 * ═══ AND IT IS WHERE THE SHOP BECOMES VISIBLE ═══
 *
 * Or, on why catchphrases are worth buying: *"then people will have a reason
 * to buy from the shop, because it is something you SEE."* This screen is the
 * seeing. It is the one moment both players are looking at each other and
 * nothing else is happening, which makes the avatar and the line under it the
 * most visible things anybody owns. Everything on this card is either free or
 * purchasable on purpose.
 *
 * A missing opponent is a normal state, not an error: the card comes from a
 * database read and a match must never wait on one. The other side then says
 * "היריב" and the screen still works.
 *
 * ═══ AND THE DECK IS HERE BECAUSE THERE WAS NOWHERE ELSE ═══
 *
 * Or: *"you should see the deck at the start of the battle."* A card back
 * cost up to 180 diamonds and was, until this, invisible: the fog over an
 * opponent's board is the fog rather than anything they chose, and the
 * builder's picker is a screen you choose on and then leave. So the one
 * thing in the shop that is described as *"your opponent looks at it all
 * match"* was the one thing nobody ever looked at.
 *
 * It is tucked against the avatar rather than given a row of its own. The
 * screen that matters here is a landscape phone 384px tall and this card is
 * already five things deep — a sixth row would push the catchphrase off the
 * bottom, which would be trading something people chose for something they
 * bought.
 */
export function Versus({
  me,
  them,
  /** Seconds left, drawn as the ring around the whole thing. */
  secondsLeft,
  total,
  /**
   * "Vs.", or "ביחד" in Amanda mode where the other player is a partner.
   *
   * Or: *"in the battle, write Vs. instead of Against. In Hebrew too."* So
   * this one string is the same in both languages — it is a symbol more than
   * a word, the way a scoreline is, and translating it made the English read
   * like a court listing.
   */
  joined = false,
}: {
  me: PlayerCard;
  them: PlayerCard | null;
  secondsLeft: number;
  total: number;
  joined?: boolean;
}) {
  return (
    <div className="versus" role="status">
      <Fighter who={me} saidTo={them?.gender ?? null} mine />
      <div className="versus__vs" aria-hidden="true">
        <span className="versus__word">{joined ? t("s67c1f88", "ביחד") : t("se875ce8", "Vs.")}</span>
        {/* The countdown, small, under the word — the number was the whole
            screen before and it is the least interesting thing on it now. */}
        <span className="versus__clock">{Math.max(1, Math.ceil(secondsLeft))}</span>
        <span
          className="versus__ring"
          style={{ ["--left" as string]: `${Math.max(0, Math.min(1, secondsLeft / total))}` }}
        />
      </div>
      <Fighter who={them} saidTo={me.gender} />
    </div>
  );
}

function Fighter({
  who,
  saidTo,
  mine = false,
}: {
  who: PlayerCard | null;
  /**
   * The gender of the person the line is aimed at — the OTHER card, not this
   * one. A catchphrase is shouted at your opponent, so "בוא להילחם" said to a
   * girl is the wrong word, and the speaker's own gender has nothing to do
   * with it. See `heF` in catchphrases.ts.
   */
  saidTo: "boy" | "girl" | null;
  mine?: boolean;
}) {
  const phrase = catchphraseById(who?.catchphrase);
  const line = phraseText(who?.catchphrase, saidTo);

  return (
    <div className={`versus__side${mine ? " versus__side--mine" : ""}`}>
      <div className="versus__face">
        {who?.avatar ? (
          <img src={`${BASE}brand/${who.avatar}.webp`} alt="" />
        ) : (
          <Icon name="king" size={38} />
        )}
      </div>
      {/*
        The deck they are about to play, leaning against them.

        OUTSIDE `.versus__face`, which is `overflow: hidden` so a square
        avatar can be a circle — anything drawn inside it that reaches past
        the avatar is cut on that circle. It is positioned against the side
        instead, and the side is the element that owns the stacking context.

        `back` is optional on the wire, so an older client or a profile that
        could not be read falls back to the default — which is what a player
        who has never opened the builder genuinely has, not an error state.
      */}
      <span className="versus__deck" aria-hidden="true">
        <CardBack size="small" back={who?.back ?? DEFAULT_BACK} />
      </span>
      <b className="versus__name">{who?.nickname ?? (mine ? t("s91836d5", "אני") : t("sb1bf590", "היריב"))}</b>
      <span className="versus__cups">
        <Icon name="win" size={14} /> {who?.trophies ?? 0}
      </span>
      {/* The line, if they have chosen one. Nothing at all if they have not —
          a card with a name and a face reads perfectly well without it, and
          not every child wants to shout something at a stranger. */}
      {line && phrase && <Plaque phrase={{ ...phrase, he: line }} size="big" />}
    </div>
  );
}
