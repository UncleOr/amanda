/**
 * ═══ THE MATCH FETCHES ITS PICTURES BEFORE IT NEEDS THEM ═══
 *
 * Or: *"maybe we should do a kind of 'loading resources' at the start of a
 * match so it runs more smoothly."*
 *
 * He is right about where the seam is, and the build phase is the place to
 * hide it: forty-five seconds in which the player is looking at their own
 * board and the game is doing nothing. Everything the next minute will put
 * on the screen can be in the browser's cache by the time it is asked for —
 * the cards of both boards, the painted arena, the two result paintings, the
 * chests.
 *
 * ⚠ WHY THIS IS NOT A LOADING SCREEN. A screen that says "loading" is a
 * promise that the thing after it will be instant, and this cannot promise
 * that: a phone on a bad connection would then be staring at a progress bar
 * instead of playing. Nothing here blocks, nothing here is awaited, and a
 * fetch that fails or never finishes costs exactly nothing — the game draws
 * what it drew before, which is a coloured box with a name on it.
 *
 * ⚠ AND WHY IT IS AN `Image` AND NOT A `fetch`. Both warm the HTTP cache,
 * but a decoded image is also in the IMAGE cache — so the first paint does
 * not pay for the decode either. Pixi's own `Assets.load` and every <img>
 * in the game read the same two caches.
 */

/** Everything asked for already, so nothing is ever fetched twice. */
const asked = new Set<string>();
/** Waiting to be fetched, in the order asked. */
const queue: string[] = [];
let running = 0;

/**
 * How many at once.
 *
 * Four, because a browser gives a host six connections and the game itself
 * needs some: the point of this is to use the quiet, not to compete with the
 * match for it.
 */
const AT_ONCE = 4;

function pump(): void {
  while (running < AT_ONCE && queue.length) {
    const url = queue.shift()!;
    running++;
    const img = new Image();
    const done = () => {
      running--;
      pump();
    };
    img.onload = done;
    img.onerror = done;
    /*
     * `async` and low priority: this is the lowest-value fetch in the game
     * and must never sit in front of the card a child is dragging.
     */
    img.decoding = "async";
    ("fetchPriority" in img ? (img as { fetchPriority?: string }) : {}).fetchPriority = "low";
    img.src = url;
  }
}

/** Fetch these now, quietly, skipping anything already asked for. */
export function warm(urls: Iterable<string>): void {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url || asked.has(url)) continue;
    asked.add(url);
    queue.push(url);
  }
  pump();
}

/**
 * Fetch these when the browser has nothing better to do.
 *
 * The tail of the catalogue goes here: the cards this match cannot deal are
 * worth having for the NEXT one, and worth nothing at all if fetching them
 * costs a frame of this one.
 */
export function warmSoon(urls: Iterable<string>): void {
  if (typeof window === "undefined") return;
  const later = () => warm(urls);
  /*
   * ⚠ CALLED ON `window`, NOT LIFTED OFF IT.
   *
   * `const idle = window.requestIdleCallback; idle(fn)` does not throw here
   * — it silently does nothing, for ever. Measured: the whole catalogue was
   * queued on every build phase and not one image was fetched, and the count
   * of things asked for sat at 19 through four seconds of idle browser. A
   * browser API that fails by saying nothing is the worst kind, and this
   * file had written one by hand.
   *
   * The timeout is the floor under the idle: a phone that is never idle
   * still gets the tail eventually, which is the whole point of having it.
   */
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") window.requestIdleCallback(later, { timeout: 3000 });
  else window.setTimeout(later, 2000);
}

/** How many have been asked for — read by the test and by a probe. */
export function warmedCount(): number {
  return asked.size;
}
