import { useEffect, useMemo, useRef, useState } from "react";
import {
  DRAFT_ROUNDS,
  DRAFT_SECONDS,
  dealPacks,
  splitDraft,
  type DraftResult,
} from "@amanda/shared";
import { CATALOG, cardPool } from "../data/catalog";
import { CardDetailModal } from "./CardDetailModal";
import { CardView } from "./CardView";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { sfx } from "../game/sfx";
import { line as t, lineF as tf } from "../game/copy";

/** How often the bar is redrawn. Small enough to look continuous. */
const TICK_MS = 100;

/**
 * THE SCREEN IS FOR: choosing which of two monsters you would rather fight
 * WITH than against.
 *
 * Or: *"draft — what you don't take goes to the opponent."* That sentence is
 * the whole mode and the whole screen. Two cards, one tap, fifteen times.
 *
 * ═══ THE HERO IS THE PAIR ═══
 *
 * Not the counter, not the title. Two big cards side by side with nothing
 * between them is the decision, drawn at the size of a decision — §1, and the
 * reason there is no sentence anywhere on this screen explaining the rule.
 * Tap one, it slides to your pile, the other goes to theirs; by the third
 * pack nobody needs telling.
 *
 * The only words are a count, because fifteen taps with no end in sight is
 * the one thing that would make this feel long.
 */
export function Draft({
  onClose,
  onReady,
  seed,
  best,
}: {
  onClose: () => void;
  onReady: (result: DraftResult) => void;
  /** Given so a draft can be replayed — see dealPacks. */
  seed?: number;
  /**
   * How far this player has climbed.
   *
   * A draft deals the cards for BOTH sides, so Or's rule about the bot's deck
   * lands here harder than anywhere: *"if I am playing at the train station
   * now, I should not be seeing Machines or Sea Dwellers on the other side."*
   * Ungated, this screen would not only show him a family he has not met — it
   * would ask him to choose it, and then hand the one he refused to the
   * opponent.
   */
  best?: number;
}) {
  const { packs, ranOut } = useMemo(() => {
    /*
     * Monsters only. `cardPool` is what both boards are built from anyway, so
     * a draft cannot offer a card the game would not have dealt.
     */
    const monsters = cardPool(best).filter((id) => CATALOG.has(id));
    let s = seed ?? Math.floor(Math.random() * 2_000_000_000);
    const rnd = () => {
      // A small deterministic generator, so the same seed deals the same
      // packs. Nothing here needs a good one.
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    const dealt = dealPacks(monsters, DRAFT_ROUNDS, rnd);
    /*
     * Which card each pack gives up if the clock runs out, drawn here from
     * the SAME generator that dealt it.
     *
     * ⚠ NOT `Math.random()` AT THE MOMENT IT EXPIRES. `seed` exists so that
     * one seed deals one draft, end to end — a timeout that rolled a fresh
     * die would make the same seed produce different decks and quietly take
     * that promise away. Drawn after the deal, so it cannot change the deal.
     */
    return { packs: dealt, ranOut: dealt.map(() => (rnd() < 0.5 ? 0 : 1)) };
  }, [seed, best]);

  const [picked, setPicked] = useState<string[]>([]);
  /** The card being read right now. The clock stops while this is open. */
  const [reading, setReading] = useState<string | null>(null);
  const round = picked.length;
  const pack = packs[round];

  const take = (cardId: string) => {
    sfx.play("draw");
    const next = [...picked, cardId];
    setPicked(next);
    if (next.length >= packs.length) onReady(splitDraft(packs, next));
  };

  /* ═══ FIVE SECONDS, AND READING DOES NOT COST ANY OF THEM ═══ */
  const [leftMs, setLeftMs] = useState(DRAFT_SECONDS * 1000);
  // Back to the top for the next pair, before the pair is even drawn.
  useEffect(() => setLeftMs(DRAFT_SECONDS * 1000), [round]);
  useEffect(() => {
    if (reading) return; // paused: the player is reading a card
    const id = window.setInterval(
      () => setLeftMs((ms) => Math.max(0, ms - TICK_MS)),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [round, reading]);
  /*
   * ⚠ ONCE PER ROUND, WHATEVER THE RENDERS DO. `take` advances the round and
   * the effect above resets the clock, but React does not promise those two
   * happen in one frame — and a second pick fired from a stale zero would
   * eat the next pack without showing it.
   */
  const tookAt = useRef(-1);
  useEffect(() => {
    if (leftMs > 0 || reading || !pack) return;
    if (tookAt.current === round) return;
    tookAt.current = round;
    take(pack[ranOut[round] ?? 0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftMs, reading, round]);

  if (!pack) return null;

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--draft" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s6e44cc7", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        {/* How far through. The only words on the screen. */}
        <span className="draft__count">
          {tf("sa74ea1d", "{0} מתוך {1}", String(picked.length + 1), String(packs.length))}
        </span>

        {/*
          The five seconds, as a bar rather than a number.

          A number would be a second thing to read on a screen whose whole
          job is a choice between two pictures — and the pair is the hero
          (§1). A bar is read without being looked at, which is what a clock
          on a decision has to be.

          And it is SILENT. Or asked last week for a beat a second on the
          match countdown and he was right there, because that happens twice
          a match. This happens fifteen times in a row, and the rule the
          sound pipeline is built on says it best: anything with a tail is a
          nuisance by the tenth time you hear it.
        */}
        <div
          className={`draft__clock${leftMs <= 2000 ? " draft__clock--last" : ""}${
            reading ? " draft__clock--held" : ""
          }`}
          aria-hidden="true"
        >
          <i style={{ width: `${(leftMs / (DRAFT_SECONDS * 1000)) * 100}%` }} />
        </div>

        <div className="draft__pair">
          {pack.map((id) => (
            /*
              ⚠ A DIV, NOT A BUTTON. The information control Or asked for is
              CardView's own ℹ, which is a real <button> — and a button
              inside a button is invalid markup that browsers un-nest in
              their own way, which is how a tap on ℹ ends up picking the
              card instead of opening it. The board does the same thing for
              the same reason (see BoardGrid).
            */
            <div
              key={id}
              className="draft__pick"
              role="button"
              tabIndex={0}
              onClick={() => take(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  take(id);
                }
              }}
            >
              <CardView cardId={id} size="large" onInfo={() => setReading(id)} />
            </div>
          ))}
        </div>

        {/* The two piles, so you can see what you have handed over. */}
        <div className="draft__piles">
          <span className="draft__pile">
            <Icon name="friend" size={14} />
            {picked.length}
          </span>
          <span className="draft__pile draft__pile--theirs">
            <Icon name="monster" size={14} />
            {picked.length}
          </span>
        </div>
      </div>

      {/*
        The card, in full, over the pair.

        Rendered inside the Overlay and NOT inside `.modal--draft`, so a tap
        anywhere on it cannot fall through to the card underneath and pick
        it — which is the one way this button could do damage.
      */}
      {reading && (
        <CardDetailModal cardId={reading} onClose={() => setReading(null)} />
      )}
    </Overlay>
  );
}
