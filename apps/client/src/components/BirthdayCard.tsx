/**
 * **Happy birthday.**
 *
 * Or, on the morning of his: *"it's my birthday today. Maybe when you open
 * the game on your birthday you get some kind of gold chest with presents?"*
 * And then, having had the chest without ever seeing a card: *"the birthday
 * should come up as a popup when I open the game. With the chest and the
 * diamonds. One after the other. With an animation, fireworks, and about
 * three seconds of a birthday tune."*
 *
 * It is the only thing in the game that happens because of who you are
 * rather than what you did — arenas, chests, challenges and upgrades are all
 * earned — so it says the age out loud. "You are 8 today" is the line a
 * seven-year-old reads twice.
 *
 * ═══ ONE AFTER THE OTHER, AND WHY THAT IS THE WHOLE NOTE ═══
 *
 * The first version put the chest and the diamonds side by side and drew
 * them both at once. That is a RECEIPT: here are two things you now have.
 * Arriving one at a time is a party — the chest lands, you look at it, and
 * then the diamonds turn up as well, which is a second surprise the first
 * version had spent in the same breath as the first.
 *
 * So there are four beats on a timer, and the only thing the player does is
 * watch:
 *
 *     0ms     the card, the music, the fireworks
 *     600ms   the chest drops in
 *     1500ms  the diamonds arrive and count up
 *     2600ms  the way out appears
 *
 * The button is last on purpose. Until it is there the screen cannot be
 * dismissed by a thumb that was already moving, and three seconds is the
 * length of the tune.
 *
 * It announces; it does not grant. The chest is on the shelf and the
 * diamonds are in the purse before this draws — the server does that on the
 * way into the home screen (apps/server/src/birthday.ts).
 */
import { useEffect, useState } from "react";
import { Celebrate, PartyChest } from "./Celebrate";
import { Icon } from "./Icon";
import { line as t, lineF as tf } from "../game/copy";

/** When each beat lands, in milliseconds from the card appearing. */
const BEATS = [600, 1500, 2600];

export function BirthdayCard({
  age,
  diamonds,
  onClose,
}: {
  /** The age they have turned today. Zero when the year is not known. */
  age: number;
  diamonds: number;
  onClose: () => void;
}) {
  /** 0 → nothing yet, 1 → chest, 2 → diamonds, 3 → the button. */
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const timers = BEATS.map((at, i) => window.setTimeout(() => setBeat(i + 1), at));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  /*
   * The number climbs rather than appearing.
   *
   * A hundred and fifty that was never ninety-nine is a label. Counting is
   * the difference between being told what you got and watching it arrive,
   * and it costs one animation-frame loop.
   */
  const [counted, setCounted] = useState(0);
  useEffect(() => {
    if (beat < 2 || diamonds <= 0) return;
    const started = performance.now();
    const SPAN = 900;
    let frame = 0;
    const tick = () => {
      const through = Math.min(1, (performance.now() - started) / SPAN);
      // Fast at first and easing out, so the last few feel like landing.
      setCounted(Math.round(diamonds * (1 - Math.pow(1 - through, 3))));
      if (through < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [beat, diamonds]);

  return (
    <Celebrate
      kicker={t("sfe72726", "יום הולדת שמח")}
      /*
       * The age, when there is one. `birth_date` is optional — a player can
       * skip it at sign-up — and in that case there is no year to count
       * from, so the screen says the thing that is true instead of inventing
       * a number.
       */
      title={age > 0 ? tf("sb4b4284", "בן {0} היום!", age) : t("s5dc59d0", "היום זה היום שלך!")}
      sound="birthday"
      fireworks
      /*
       * Nothing dismisses this until the tune has played and the button is
       * there. Celebrate closes on a tap anywhere, which is right for a
       * screen you have already read and wrong for one that is still
       * arriving — a thumb that was already moving would take the whole
       * thing away before the chest had landed.
       */
      onClose={beat >= 3 ? onClose : () => {}}
    >
      <div className="bday">
        <span className={`bday__gift${beat >= 1 ? " is-in" : ""}`}>
          <PartyChest />
        </span>
        {diamonds > 0 && (
          <span className={`bday__gems${beat >= 2 ? " is-in" : ""}`}>
            <Icon name="gem" size={26} /> {counted}
          </span>
        )}
      </div>
      <button
        className={`btn-fight bday__out${beat >= 3 ? " is-in" : ""}`}
        disabled={beat < 3}
        onClick={onClose}
      >
        {t("sf6a63bb", "תודה!")}
      </button>
    </Celebrate>
  );
}
