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
import { describe, expect, it } from "vitest";
import { isSignInReturn } from "./nativeAuth";

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
