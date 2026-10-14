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

/*
 * ═══ AND WHY THE IDENT SOMETIMES PLAYED TWICE ═══
 *
 * Or: *"sometimes when you open the game there are two Asulins idents."*
 *
 * The game reloads itself when a new service worker takes over a page that
 * was running an old one — main.tsx, and it is the only way a player on a
 * phone home screen ever gets a new version. That reload is right. What was
 * wrong is that it is indistinguishable, from here, from opening the game:
 * the page starts again from nothing and the ident starts again with it. So
 * after every deploy, the first launch showed Asulins, cut to black, and
 * showed Asulins again.
 *
 * This remembers, for the TAB rather than the device, when the ident last
 * played. A page that starts over within twenty seconds of one is a reload,
 * not an opening — nobody closes a game and comes back inside twenty
 * seconds, and if they somehow do, sessionStorage is gone with the tab and
 * they get their ident.
 *
 * Keyed on time rather than on the service worker's own flag deliberately:
 * the symptom is "the page restarted and the ident ran twice", and a guard
 * that only knows about the one cause I found would miss the next one.
 */
const IDENT_AT = "amanda.ident.at";
const A_RELOAD = 20_000;

/** True when this page is a reload of one that just showed the ident. */
export function identJustPlayed(): boolean {
  try {
    const at = Number(sessionStorage.getItem(IDENT_AT) ?? 0);
    return at > 0 && Date.now() - at < A_RELOAD;
  } catch {
    // No session storage is no memory, so the ident plays. The worst case
    // is the thing it has always done.
    return false;
  }
}

export function markIdentPlayed(): void {
  try {
    sessionStorage.setItem(IDENT_AT, String(Date.now()));
  } catch {
    /* it may play twice after a deploy; not worth failing over */
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
