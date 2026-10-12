/**
 * Whether the opening film plays, and how to ask for it again.
 *
 * Or: *"add the video part of the trailer when you open the app, with a skip
 * button. Or maybe only the first time you open it?"*
 *
 * Only the first time. Hod will open this hundreds of times, and ten seconds
 * in front of every one of them is not an opening — it is an obstacle. So it
 * plays once, and the About screen has a way back to it for the times he
 * wants to show somebody.
 *
 * ═══ WHY AN EVENT AND NOT A PROP ═══
 *
 * The film is mounted beside the game rather than inside it, on its own React
 * root, so that a broken video cannot take the game down with it. That puts
 * it outside every piece of state the game has, and the button that replays
 * it is four components deep in a modal. An event crosses that gap without
 * threading a callback through screens that have no other reason to know the
 * film exists.
 */
const SEEN_KEY = "amanda.intro.seen";
const REPLAY = "amanda:intro";

/**
 * True on a first visit, and on a visit where storage is unavailable.
 *
 * Private browsing throws on both the read and the write, which means a
 * player there would see the film every single time. So the failure is read
 * as "not seen" only when the read ITSELF fails — not when it returns empty —
 * and the write below is what actually stops it. If storage is dead, the film
 * plays each visit, which is a worse experience but an honest one: there is
 * nowhere to remember it.
 */
export function shouldPlayIntro(): boolean {
  /*
   * Not over the legal pages.
   *
   * `?legal=privacy` is the URL Google Play is given for the privacy policy,
   * and the first thing it did on a fresh browser was start the film over
   * the top of the document — because a first visit is a first visit however
   * you arrived. A reviewer opening that link watched ten seconds of monsters
   * before they could read the policy they came for.
   */
  if (new URLSearchParams(location.search).has("legal")) return false;
  try {
    return localStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return false; // no storage, no memory — do not trap anyone in a loop
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* it will play again next time; not worth failing over */
  }
}

/** Ask for the film, from anywhere. */
export function replayIntro(): void {
  window.dispatchEvent(new Event(REPLAY));
}

export function onIntroRequest(fn: () => void): () => void {
  window.addEventListener(REPLAY, fn);
  return () => window.removeEventListener(REPLAY, fn);
}
