/**
 * The prize, leaving the challenge and landing in the bar.
 *
 * Or: *"when you take a challenge's prize there should be an animation of
 * what was taken — the trophy, say — bursting open in a fun way, and then
 * flying up to the bar, and the numbers there going up."*
 *
 * ═══ WHY THIS IS NOT A REACT COMPONENT ═══
 *
 * It crosses the whole tree. The prize starts inside the challenges panel,
 * which is four components deep inside a modal, and lands in the purse, which
 * is a sibling of that modal's grandparent. Threading a callback between them
 * would mean three components learning about an animation none of them owns —
 * and the thing being animated does not exist in either place: it is a token
 * in the air between them.
 *
 * So it is plain DOM over the top of everything, the way the ident is a
 * separate root. It is also what makes it cheap to be careful: a missing
 * target, a reduced-motion setting or an interrupted animation all end in the
 * same place — the node is removed and the promise resolves — so the caller's
 * "and now refresh the number" always runs.
 *
 * ═══ THE NUMBER GOES UP WHEN THE TOKEN LANDS ═══
 *
 * Not before, which is what made the first version feel wrong: the count
 * jumped the moment the button was pressed and the token then flew to a total
 * that had already changed, which reads as decoration rather than as cause.
 * `flyReward` resolves on touchdown and the caller reloads THEN.
 */

/** Where each kind of prize is kept, so it knows where it is flying to. */
const PURSE: Record<string, string> = {
  gem: ".purse__item--gem",
  // The nachos are a bar rather than a balance (see HomeScreen), and the bar
  // is the thing that fills — so that is what they land on.
  nacho: ".nachos",
};

export interface Flight {
  /** An icon name from Icon.tsx — "gem" or "nacho" today. */
  icon: string;
  /** How many, drawn beside the token. */
  amount: number;
  /** Where it starts: the thing that was pressed. */
  from: DOMRect;
}

/** Milliseconds, and they are the whole feel of it. */
const BURST = 420;
const FLIGHT = 620;

/**
 * Play it, and resolve when the prize lands.
 *
 * Resolves immediately — without drawing anything — when there is nowhere to
 * fly to or the player has asked for less motion. A prize that cannot be
 * animated must still be a prize that is taken.
 */
/**
 * How many tokens fly for a prize of this size.
 *
 * Or: *"when you take a challenge or anything with diamonds or nachos, make
 * it so that it is not one diamond flying up to the bar but MANY diamonds,
 * by the number I got."*
 *
 * Which is right and is also the whole reason one token felt thin: the size
 * of the prize was written on it in digits and shown by nothing. One each is
 * the obvious rule and it holds up to about a dozen; past that they stop
 * being countable and start being a swarm, so the count caps and the digits
 * carry the rest. Nobody counts fourteen diamonds in the air anyway — what
 * they read is "a lot".
 */
function tokensFor(amount: number): number {
  return Math.max(1, Math.min(Math.round(amount), 14));
}

/**
 * Play it, and resolve when the LAST of them lands.
 *
 * Resolves immediately — without drawing anything — when there is nowhere to
 * fly to or the player has asked for less motion. A prize that cannot be
 * animated must still be a prize that is taken.
 */
export function flyReward({ icon, amount, from }: Flight): Promise<void> {
  const target = document.querySelector(PURSE[icon] ?? "");
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (!target || still) return Promise.resolve();

  // Narrowed once, here: the closure below outlives the check above.
  const purse = target;
  const to = purse.getBoundingClientRect();
  const base = import.meta.env.BASE_URL;
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  const count = tokensFor(amount);

  /** One coin: born at the prize, thrown out a little, then flown to the bar. */
  function one(i: number): Promise<void> {
    // Spread them around the source so they do not leave as a single stack.
    const a = (i / count) * Math.PI * 2 + Math.random();
    const r = i === 0 ? 0 : 10 + Math.random() * 22;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r * 0.6;

    const node = document.createElement("div");
    node.className = "fly";
    node.setAttribute("aria-hidden", "true");
    node.style.left = `${sx}px`;
    node.style.top = `${sy}px`;
    node.innerHTML =
      // The burst and the number ride on the first one only: the prize is
      // won once, however many coins come out of it.
      (i === 0 ? `<span class="fly__burst"></span>` : "") +
      `<img class="fly__icon" src="${base}icons/${icon}.png" alt="" draggable="false">` +
      (i === 0 ? `<b class="fly__amount">+${amount}</b>` : "");
    document.body.appendChild(node);

    const dx = to.left + to.width / 2 - sx;
    const dy = to.top + to.height / 2 - sy;
    // They leave in a stream rather than a block, and the burst goes first.
    const wait = i === 0 ? 0 : BURST * 0.45 + i * 45;
    const lift = 30 + Math.random() * 30;

    return new Promise<void>((resolve) => {
      let done = false;
      const land = () => {
        if (done) return;
        done = true;
        node.remove();
        /*
         * The bar reacts to being landed on — once per coin, so a big prize
         * makes it bump over and over. A class rather than an inline style,
         * because React owns that element's attributes and will happily
         * write over anything it recognises — and it does not recognise this.
         */
        purse.classList.add("is-gained");
        window.setTimeout(() => purse.classList.remove("is-gained"), 400);
        resolve();
      };

      /*
       * Two animations, one after the other: it swells where it was won, then
       * travels. Written with the Web Animations API rather than as keyframes
       * because the distance is only known now — a CSS keyframe cannot be
       * told where the purse is.
       */
      node
        .animate(
          [
            { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 },
            { transform: "translate(-50%, -50%) scale(1.35)", opacity: 1, offset: 0.55 },
            { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          ],
          {
            duration: BURST,
            delay: wait,
            easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)",
            fill: "both",
          },
        )
        .finished.then(
          () =>
            node.animate(
              [
                { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
                {
                  // A lift before the run, so it arcs instead of sliding.
                  transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.3 - lift}px)) scale(0.9)`,
                  opacity: 1,
                  offset: 0.5,
                },
                {
                  transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.35)`,
                  opacity: 0.1,
                },
              ],
              {
                duration: FLIGHT,
                easing: "cubic-bezier(0.5, 0, 0.75, 0.3)",
                fill: "forwards",
              },
            ).finished,
        )
        .then(land, land);

      /*
       * And a floor under all of it. `finished` never settles if the element
       * is removed mid-flight — a panel closing, a route change — and the
       * caller is waiting on this to refresh the number.
       */
      window.setTimeout(land, wait + BURST + FLIGHT + 400);
    });
  }

  return Promise.all(Array.from({ length: count }, (_, i) => one(i))).then(() => undefined);
}
