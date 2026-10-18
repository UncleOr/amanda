/**
 * **Which incoming links are a sign-in coming home, and which are just links.**
 *
 * Or: *"when I tried to sign in to my Google account it moved to the browser,
 * and the game carried on signed in IN THE BROWSER. In the app it stayed
 * signed out."*
 *
 * The fix hands the redirect back to the app with an Android App Link — and
 * an App Link catches EVERY playamanda.com/play/ link, not only the one
 * coming back from Google. A tester sending the game to a friend, a bookmark,
 * a link in a message: all of them wake the app the same way.
 *
 * So the app reloads itself on exactly one of those and ignores the rest.
 * Getting that wrong in either direction is a real failure:
 *
 *   too eager — the app reloads when somebody opens a shared link, throwing
 *               away a board they were in the middle of building
 *   too shy   — the sign-in never finishes, which is the bug being fixed
 *
 * `isSignInReturn` is the whole of that decision, so it is the whole of this
 * file. It is a pure function over a string, which is the one part of this
 * that can be tested without a phone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asLoadableUrl, isSignInReturn, nativeRedirectTo } from "./nativeAuth";

const SITE = "https://playamanda.com/play/";

describe("a sign-in coming home", () => {
  it("recognises the authorisation code", () => {
    expect(isSignInReturn(`${SITE}?code=abc123`)).toBe(true);
  });

  it("recognises a refusal, which still has to be handled", () => {
    // Pressing "cancel" on Google's screen is a return too: the app has to
    // come back and stop waiting, not sit there as if it were still going.
    expect(isSignInReturn(`${SITE}?error=access_denied`)).toBe(true);
    expect(isSignInReturn(`${SITE}?error_description=the+user+said+no`)).toBe(true);
  });

  /*
   * Implicit-flow providers put the answer in the fragment instead of the
   * query. Supabase can hand back either depending on the flow in use, and a
   * check that knew about only one of them would work until the day somebody
   * changed a setting in a dashboard.
   */
  it("recognises an answer in the fragment, not only in the query", () => {
    expect(isSignInReturn(`${SITE}#access_token=xyz&token_type=bearer`)).toBe(true);
    expect(isSignInReturn(`${SITE}#error=access_denied`)).toBe(true);
  });

  it("takes the code wherever on the site it lands", () => {
    expect(isSignInReturn("https://playamanda.com/play/index.html?code=abc")).toBe(true);
    expect(isSignInReturn("https://playamanda.com/play/?foo=1&code=abc&bar=2")).toBe(true);
  });
});

describe("an ordinary link, which must be left alone", () => {
  /*
   * The one that matters. This is a tester sharing the game, and reloading
   * the app for it would throw away whatever they were doing.
   */
  it("ignores somebody opening the game", () => {
    expect(isSignInReturn(SITE)).toBe(false);
    expect(isSignInReturn("https://playamanda.com/play/index.html")).toBe(false);
  });

  it("ignores links with other things in the query", () => {
    for (const url of [
      `${SITE}?lang=en`,
      `${SITE}?gallery`,
      `${SITE}?arena=1`,
      `${SITE}#album`,
      `${SITE}?utm_source=whatsapp`,
    ]) {
      expect(isSignInReturn(url), url).toBe(false);
    }
  });

  /*
   * It is handed whatever Android hands it, which on a bad day is not a URL
   * at all. Returning false is the safe answer: the app carries on, and the
   * worst case is a sign-in that has to be pressed again.
   */
  it("says no to nonsense instead of throwing", () => {
    for (const junk of ["", "not a url", "://", "code=abc", "javascript:alert(1)"]) {
      expect(() => isSignInReturn(junk)).not.toThrow();
      expect(isSignInReturn(junk), junk).toBe(false);
    }
  });

  /*
   * A near miss on purpose: "code" as part of another word must not count.
   * `URLSearchParams.get` is exact, and this is the test that says so rather
   * than trusting it.
   */
  it("is not fooled by a parameter that merely contains the word", () => {
    expect(isSignInReturn(`${SITE}?promocode=abc`)).toBe(false);
    expect(isSignInReturn(`${SITE}?qr_code=abc`)).toBe(false);
  });
});

/**
 * ═══ AND THE SCHEME COMES HOME TOO ═══
 *
 * The redirect inside the app is `com.asulins.amanda://auth`, so the same
 * check has to recognise it arriving. It carries the code in exactly the
 * same places an https return does — this is still an OAuth callback, only
 * the scheme has changed — and `new URL()` parses a custom scheme fine.
 */
describe("the custom scheme the app comes back on", () => {
  const APP = "com.asulins.amanda://auth";

  it("is recognised with a code", () => {
    expect(isSignInReturn(`${APP}?code=abc123`)).toBe(true);
  });

  it("is recognised with a refusal", () => {
    expect(isSignInReturn(`${APP}?error=access_denied`)).toBe(true);
  });

  it("is recognised with a token in the fragment", () => {
    expect(isSignInReturn(`${APP}#access_token=xyz`)).toBe(true);
  });

  /*
   * The app being opened by its own scheme for some other reason is not a
   * sign-in, and must not reload the game out from under whoever is playing.
   */
  it("is left alone when it carries nothing", () => {
    expect(isSignInReturn(APP)).toBe(false);
    expect(isSignInReturn("com.asulins.amanda://auth?from=somewhere")).toBe(false);
  });
});

describe("which address the sign-in asks to come back to", () => {
  /*
   * On the web there is no Capacitor, so this answers null and the caller
   * keeps the https address it has always used — the one allow-listed in
   * Supabase and written down in docs/SUPABASE-SETUP.md. Changing that by
   * accident would break sign-in for every browser player at once, which is
   * the whole reason this returns null rather than a URL.
   */
  it("leaves the website's address alone", () => {
    expect(nativeRedirectTo()).toBeNull();
  });
});

/**
 * ═══ THE ADDRESS THE WEBVIEW IS ACTUALLY SENT TO ═══
 *
 * The bug a video of Or's phone exposed. Android handed the app
 * `com.asulins.amanda://auth?code=...` exactly as intended — the scheme did
 * its job — and the code then told the WebView to NAVIGATE to it. A WebView
 * has no idea what that scheme is, so the navigation was refused, the old
 * page stayed put, and the sign-in looked like it had done nothing at all.
 *
 * The code has to reach a page that can exchange it, which is the site. The
 * scheme is swapped for the site; the query and the fragment come across
 * untouched, because they are what the exchange reads.
 */
describe("turning the arriving link into one the WebView can load", () => {
  /*
   * `asLoadableUrl` builds the replacement from the page's own origin, so the
   * test has to say what that is. Stubbed rather than run in a DOM: the thing
   * under test is string arithmetic, and the origin it lands on is part of
   * what is being checked.
   */
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "https://playamanda.com" } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("swaps the custom scheme for the site, keeping the code", () => {
    const out = new URL(asLoadableUrl("com.asulins.amanda://auth?code=abc123"));
    expect(out.protocol).toBe("https:");
    expect(out.host).toBe("playamanda.com");
    expect(out.searchParams.get("code")).toBe("abc123");
  });

  it("keeps an error, which still has to be handled", () => {
    const out = new URL(asLoadableUrl("com.asulins.amanda://auth?error=access_denied"));
    expect(out.searchParams.get("error")).toBe("access_denied");
  });

  it("keeps a fragment, where implicit-flow answers arrive", () => {
    const out = new URL(asLoadableUrl("com.asulins.amanda://auth#access_token=xyz"));
    expect(out.hash).toBe("#access_token=xyz");
  });

  /*
   * It must never produce the scheme again, whatever came in. That is the
   * entire failure being fixed: a WebView cannot go there.
   */
  it("never hands back something the WebView cannot load", () => {
    for (const url of [
      "com.asulins.amanda://auth?code=a",
      "com.asulins.amanda://auth",
      "com.asulins.amanda://anything#error=x",
    ]) {
      expect(asLoadableUrl(url).startsWith("com.asulins.amanda:"), url).toBe(false);
    }
  });

  it("leaves an https link exactly as it is", () => {
    const https = "https://playamanda.com/play/?code=abc";
    expect(asLoadableUrl(https)).toBe(https);
  });
});
