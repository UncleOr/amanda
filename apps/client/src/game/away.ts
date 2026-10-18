/**
 * **The game being put down, and picked up again.**
 *
 * Or: *"the music doesn't stop when I minimise the game."*
 *
 * ═══ TWO SIGNALS, BECAUSE ONE OF THEM IS NOT THE APP ═══
 *
 * `visibilitychange` is the web's answer and it is the right one in a
 * browser: another tab, a locked screen, a minimised window.
 *
 * In the Android app it is the WebView's answer, which is not quite the same
 * question. The WebView reports what Chrome's compositor thinks about the
 * page, and the thing that actually happened is that ANDROID moved the app
 * to the background. Those agree most of the time and the gap is exactly
 * where this kind of bug lives — a split-screen app, a transparent activity
 * over the top, a device that keeps rendering while the app is not in front.
 * `@capacitor/app` raises `appStateChange` from the Android lifecycle
 * itself, which is the fact rather than an inference from it.
 *
 * So both, and whichever arrives first wins. They are idempotent by
 * construction: `suspend()` on something already paused does nothing, and
 * `resume()` only starts what it paused itself.
 *
 * ═══ NO CAPACITOR IMPORT ═══
 *
 * Same rule as nativeAuth.ts, and the same reason: this file ships to the
 * WEBSITE too, where there is no Capacitor and no bundler should be asked to
 * find one. Capacitor injects `window.Capacitor` at runtime and that is the
 * only thing touched here. The bridge is read directly rather than shared
 * with nativeAuth.ts — four lines against coupling "finish a sign-in" to
 * "the app went away", which have nothing to do with each other.
 */
import { music } from "./music";

/** The bit of the Capacitor bridge this file uses. */
interface Bridge {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: {
      addListener?: (
        event: "appStateChange",
        handler: (state: { isActive?: boolean }) => void,
      ) => unknown;
    };
  };
}

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

/**
 * What to do when the game stops being looked at.
 *
 * Only the music. Sound EFFECTS are not held: they are fired by things the
 * player did, so there is nothing to fire while nobody is there, and any
 * already in flight is a few hundred milliseconds that will have finished
 * before the app has finished leaving the screen. Holding them would mean
 * a queue of stale clicks playing on the way back in.
 */
function left(): void {
  music.suspend();
}

function returned(): void {
  music.resume();
}

/**
 * Listen for the app going away. Safe to call anywhere; call it once.
 *
 * Guarded on `document` because this module is imported by tests that run
 * with no DOM — the client has no jsdom, by choice, and a listener attached
 * at import time would make this file untestable rather than well covered.
 */
export function watchForLeaving(): void {
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") left();
      else returned();
    });
  }

  bridge()?.Plugins?.App?.addListener?.("appStateChange", ({ isActive }) => {
    if (isActive) returned();
    else left();
  });
}
