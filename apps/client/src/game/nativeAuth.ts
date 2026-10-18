/**
 * **Finishing a Google sign-in that happened in the browser.**
 *
 * Or: *"when I tried to sign in to my Google account it moved to the browser,
 * and the game carried on signed in IN THE BROWSER. In the app it stayed
 * signed out."*
 *
 * ═══ EVERY STEP OF THAT IS WORKING AS DESIGNED ═══
 *
 * Which is why it is confusing rather than obviously broken.
 *
 * 1. Google refuses OAuth inside an embedded WebView — it returns
 *    `disallowed_useragent` — so Capacitor hands accounts.google.com to the
 *    real browser. That is correct and cannot be avoided.
 * 2. The player signs in there.
 * 3. Google redirects to the site with `?code=`, and the BROWSER is the thing
 *    holding that page. So the browser exchanges the code and the browser
 *    ends up with the session.
 * 4. The app is never told anything happened.
 *
 * The native half of the answer is an Android App Link: the domain has proved
 * it owns this package since the TWA (/.well-known/assetlinks.json carries
 * the package name and the signing fingerprint), so Android can hand that
 * redirect to the APP instead of the browser. See scripts/android-capacitor.cjs.
 *
 * This is the other half, and without it the link does nothing useful:
 * Capacitor raises a JavaScript event and navigates nowhere, so the app comes
 * to the front still showing the page it was on.
 *
 * ═══ WHY IT RELOADS RATHER THAN EXCHANGING THE CODE ITSELF ═══
 *
 * Because the code that handles a return from Google already exists, is
 * already the one the website uses every day, and already copes with the
 * cases — a code that is spent, an error instead of a code, a session that
 * arrives before the account does (account.ts). Calling
 * `exchangeCodeForSession` here would be a second implementation of it, and
 * the second one is the one nobody tests.
 *
 * The PKCE verifier is in this WebView's storage, where `signInWithOAuth` put
 * it when the player pressed the button. Same origin, same storage, so the
 * reload lands on a page that can finish what this WebView started.
 *
 * ═══ NO CAPACITOR IMPORT ═══
 *
 * This file ships to the WEBSITE as well, where there is no Capacitor and no
 * bundler should be asked to find one. Capacitor injects `window.Capacitor`
 * into the page at runtime, and that is the only thing touched here. On the
 * web every branch below is false and this module does nothing at all.
 */

/** The shape of the bits of the Capacitor bridge this file uses. */
interface Bridge {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: {
      addListener?: (
        event: "appUrlOpen",
        handler: (data: { url?: string }) => void,
      ) => unknown;
      getLaunchUrl?: () => Promise<{ url?: string } | null>;
    };
  };
}

function bridge(): Bridge | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: Bridge }).Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

/**
 * Is this URL a return from a sign-in, rather than somebody sharing a link?
 *
 * Checked rather than assumed, because the App Link catches EVERY
 * playamanda.com/play/ link — a tester sending the game to a friend, a
 * bookmark, a link in a message. Reloading the app for one of those would be
 * a flicker for no reason, and reloading it with no code in the address would
 * throw away whatever the player was in the middle of.
 */
export function isSignInReturn(url: string): boolean {
  try {
    const u = new URL(url);
    const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
    return Boolean(
      u.searchParams.get("code") ??
        u.searchParams.get("error") ??
        u.searchParams.get("error_description") ??
        hash.get("access_token") ??
        hash.get("error"),
    );
  } catch {
    // Not a URL we can read is not a sign-in we can finish.
    return false;
  }
}

/**
 * Take the session out of the link and hand it to supabase-js.
 *
 * ═══ WHY NAVIGATING THERE DID NOTHING ═══
 *
 * This used to rewrite the link onto the site and navigate there, trusting
 * the page to sort itself out on reload. Or's trace is what showed it
 * cannot:
 *
 *     appUrlOpen  com.asulins.amanda://auth  #access_token,refresh_token,...
 *     going-to    https://playamanda.com     #access_token,refresh_token,...
 *
 * The token arrives. The deep link works. And the destination differs from
 * the page already open only in its FRAGMENT — which is a same-document
 * navigation. The browser updates the address and does not reload. So the
 * supabase client is never constructed again, `detectSessionInUrl` never
 * runs, and nothing at all happens. Three screens that look identical to the
 * player, three different causes, and this is the third.
 *
 * Reloading on purpose would work and is the wrong shape: a flash, a second
 * boot, and the session still arriving by a side effect of page load. The
 * tokens are right here in the URL. Handing them over directly is immediate,
 * and `onAuthChange` already tells the game to look again the moment a
 * session appears.
 *
 * Imported lazily because account.ts imports THIS file for nativeRedirectTo,
 * and a cycle evaluated at module load is how one of them ends up undefined.
 * By the time a link arrives, both have long finished loading.
 */
async function finishSignIn(url: string): Promise<void> {
  const u = new URL(url);
  const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
  const err = u.searchParams.get("error_description") ?? hash.get("error_description");
  const code0 = u.searchParams.get("error_code") ?? hash.get("error_code") ?? "";

  const account = await import("./account");

  /*
   * ═══ "ALREADY LINKED" IS NOT A FAILURE, IT IS A DIFFERENT ANSWER ═══
   *
   * Google said yes. Supabase refused the LINK, because this Google account
   * already belongs to an Amanda account made earlier — on another device, or
   * in the browser before the app existed.
   *
   * linkGoogle has always known what to do with that: stop linking and sign
   * them INTO that account, so they get their real album back. But it knew it
   * for the error returned by the CALL, and in the app there is no such
   * error — the exchange happens in the browser and the refusal arrives here,
   * on a deep link, long after that function returned. So it silently did
   * nothing, which is what Or filmed twice.
   *
   * Signing in means going out to the browser again. That is a real cost and
   * it is the correct one: the alternative is a player staring at a button
   * that cannot work for them and will never say why.
   */
  if (err || code0) {
    const already = `${code0} ${err ?? ""}`.toLowerCase().includes("already");
    trace(already ? "already-linked" : "refused", (err ?? code0).slice(0, 48));
    if (already) await account.signInWithGoogleInstead();
    return;
  }

  const { db } = account;
  const sb = db();
  if (!sb) {
    trace("no-client");
    return;
  }

  // Implicit flow: the tokens themselves are in the fragment.
  const access = hash.get("access_token");
  const refresh = hash.get("refresh_token");
  if (access && refresh) {
    const { error } = await sb.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    trace(error ? "setSession-failed" : "signed-in", error?.message.slice(0, 60) ?? "");
    return;
  }

  // PKCE: a code to exchange, using the verifier this WebView already holds.
  const code = u.searchParams.get("code") ?? hash.get("code");
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    trace(error ? "exchange-failed" : "signed-in", error?.message.slice(0, 60) ?? "");
    return;
  }

  trace("nothing-usable");
}

/**
 * Listen for the app being opened by a link, and finish a sign-in if that is
 * what it was. Safe to call anywhere; does nothing off a device.
 */
/**
 * ═══ A BREADCRUMB, BECAUSE I HAVE NOW GUESSED THIS TWICE ═══
 *
 * The sign-in has failed three times for three different reasons, and each
 * time the only evidence was Or filming his phone. The first video is what
 * told me the app DID come home — which moved the problem from "the scheme
 * does not work" to "the navigation after it fails". That was worth more
 * than any amount of reasoning from here.
 *
 * This writes down what the app actually saw, so the next photograph is data
 * instead of another guess. Four things, in order of what they rule out:
 *
 *   native   is this even the app, or a browser?
 *   plugin   did @capacitor/app register, so a link can be delivered at all?
 *   url      did a link arrive, and what was in it — code, token, error?
 *   went     where were we sent as a result?
 *
 * localStorage because it has to survive the navigation it is recording.
 * Capped and stripped: the code in a callback is a live credential for a few
 * seconds, so the VALUES are dropped and only the names kept. "code" is the
 * thing worth knowing; its contents are not.
 */
const CRUMB = "amanda.signin.trace";

function trace(step: string, detail = ""): void {
  try {
    const now = new Date().toISOString().slice(11, 19);
    const was = window.localStorage.getItem(CRUMB) ?? "";
    const line = `${now} ${step}${detail ? " " + detail : ""}`;
    window.localStorage.setItem(CRUMB, (was + "\n" + line).trim().slice(-400));
  } catch {
    // A browser with storage switched off is one we cannot leave notes in.
  }
}

/** What arrived, with nothing secret in it. */
function shape(url: string): string {
  try {
    const u = new URL(url);
    const q = [...u.searchParams.keys()];
    const h = [...new URLSearchParams(u.hash.replace(/^#/, "")).keys()];
    return `${u.protocol}//${u.host || "(no host)"} ?${q.join(",") || "-"} #${h.join(",") || "-"}`;
  } catch {
    return "(unparseable)";
  }
}

/** What the app recorded about the last sign-in attempt. For the UI to show. */
export function signInTrace(): string {
  try {
    return window.localStorage.getItem(CRUMB) ?? "";
  } catch {
    return "";
  }
}

export function watchForSignInReturn(): void {
  const cap = bridge();
  const app = cap?.Plugins?.App;
  if (!cap) return;
  if (!app?.addListener) {
    // The app is running natively and cannot be handed a link. Worth knowing:
    // it means @capacitor/app did not register, and no amount of correct
    // redirecting will ever come back.
    trace("native-but-no-App-plugin");
    return;
  }
  trace("listening");

  app.addListener("appUrlOpen", ({ url }) => {
    trace("appUrlOpen", shape(url ?? ""));
    if (!url || !isSignInReturn(url)) return;
    /*
     * `replace` and not `assign`: the page being left is the one the player
     * pressed "sign in" on, and putting it in the history means the back
     * button walks into a half-finished sign-in.
     */
    void finishSignIn(url);
  });

  /*
   * And the cold-start case. `appUrlOpen` fires when a RUNNING app is handed
   * a link — which is the usual way round here, since the player left the app
   * to sign in and it is still in the background. But Android may have killed
   * it while the browser had the screen, and then the link starts the app
   * fresh and the event has already been and gone before anything is
   * listening.
   */
  void app
    .getLaunchUrl?.()
    .then((launch) => {
      const url = launch?.url;
      trace("appUrlOpen", shape(url ?? ""));
    if (!url || !isSignInReturn(url)) return;
      // Already there — the WebView was started on it — so nothing to do.
      void finishSignIn(url);
    })
    .catch(() => {
      // An app that cannot say how it was launched is an app that was
      // launched normally. Nothing to finish.
    });
}

/**
 * Where Google should send the player back to.
 *
 * ═══ THE HTTPS LINK WAS NOT ENOUGH ═══
 *
 * The first attempt redirected to the site and relied on an Android App Link
 * to hand that address to the app instead of the browser. The domain is set
 * up for it — assetlinks.json carries this package and Play's app-signing
 * fingerprint, which is the right one, checked — and Or still came back to a
 * signed-out game.
 *
 * Chrome hands a verified link to an app when somebody TAPS it. It is much
 * less willing to do so in the middle of a chain of server redirects, and an
 * OAuth callback is nothing but: Google redirects to Supabase, Supabase
 * redirects to the site, and from the browser's point of view it is finishing
 * a navigation it started itself.
 *
 * A custom scheme removes the judgement call. Nothing else on the phone
 * claims `com.asulins.amanda://`, there is nothing to verify, and Android
 * hands it over however the navigation came about.
 *
 * On the web this returns null and the caller keeps the address it already
 * used, which is the one thing here that must not change: that address is
 * allow-listed in Supabase and written down in docs/SUPABASE-SETUP.md.
 */
export function nativeRedirectTo(): string | null {
  return bridge() ? "com.asulins.amanda://auth" : null;
}
