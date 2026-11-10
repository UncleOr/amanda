/**
 * **A long press is how you hold a card, not how you highlight a word.**
 *
 * Or: *"when you press and hold, the text gets selected. Can we turn that
 * off? The only case you need it is if there is a code, and then you can
 * have a copy button. Or inside a text box."*
 *
 * Two exceptions, named by him, and they are the whole specification. What
 * makes this worth a test rather than a line of CSS left alone is that the
 * failure is invisible from a desk: a mouse does not raise the long-press
 * menu, so nothing about this can be noticed on the machine it is written on.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const TOKENS = read("../styles/tokens.css");

/** The declarations inside the first rule whose selector matches. */
const ruleFor = (css: string, selector: string): string => {
  const at = css.indexOf(`\n${selector}`);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};

describe("nothing in the game is text to select", () => {
  it("turns off the highlight and the menu that comes with it", () => {
    const body = ruleFor(TOKENS, "body {\n  -webkit-user-select");
    expect(body).toContain("user-select: none");
    /*
     * ⚠ AND THE CALLOUT, WHICH IS THE OTHER HALF AND THE EASIER ONE TO
     * FORGET. `user-select` stops the blue highlight; it does not stop the
     * sheet Android and iOS raise over a long-pressed image offering to
     * copy, share or save it — which on this screen means a card's
     * illustration, and it covers the board while it asks.
     */
    expect(body, "the long-press menu is still there").toContain("-webkit-touch-callout: none");
  });

  it("leaves a real text box alone, which is Or's second exception", () => {
    const fields = ruleFor(TOKENS, "input,\ntextarea,\n[contenteditable=\"true\"] {");
    expect(fields).toContain("user-select: text");
    expect(fields).toContain("-webkit-touch-callout: default");
  });

  it("and a code is selectable whole, which is his first", () => {
    /*
     * `all`, not `text`: a six-character code is useless with four of its
     * characters selected, and dragging two handles accurately is not a
     * thing a seven-year-old does. One press takes the lot.
     *
     * ⚠ EACH IN ITS OWN SHEET, AND THAT IS NOT TIDINESS. The first version
     * of this listed all three together in tokens.css, and collisions.test
     * caught it within the minute: a bare class name belongs to ONE sheet
     * here, and naming them there put three classes in two sheets each —
     * which is the state this project measured its way out of once already.
     */
    for (const [file, cls] of [
      ["../styles/rooms.css", ".room-code {"],
      ["../styles/social.css", ".friends__codeval {"],
      ["../styles/clubs.css", ".club__code {"],
    ] as const) {
      expect(ruleFor(read(file), cls), `${cls} cannot be selected`).toContain("user-select: all");
    }
  });
});

describe("the three codes copy themselves", () => {
  /*
   * The reason the exception exists at all. Each of these was the only way
   * to get a code onto a clipboard, and each is read out to somebody else or
   * typed into their phone.
   */
  const WHERE: ReadonlyArray<readonly [string, string]> = [
    ["../App.tsx", "the room code"],
    ["./Friends.tsx", "a friend code"],
    ["./Club.tsx", "a club invite"],
  ];
  for (const [file, what] of WHERE) {
    it(`is a press that copies — ${what}`, () => {
      expect(read(file), `${file} still prints the code as plain text`).toContain("<CopyCode");
    });
  }

  it("says so when the clipboard refuses, instead of celebrating", () => {
    /*
     * ⚠ `navigator.clipboard` is refused outright in some webviews and on
     * any page that is not a secure origin. A copy button that silently does
     * nothing is worse than no copy button: the child walks away believing
     * the code is on the clipboard. There is a second way — a throwaway
     * textarea and `execCommand` — and if both go, the press has to admit it.
     */
    const src = read("./CopyCode.tsx");
    expect(src).toContain("navigator.clipboard.writeText");
    expect(src, "no fallback for a webview that refuses the clipboard").toContain(
      'document.execCommand("copy")',
    );
    expect(src, "a failed copy is reported as a success").toContain('setSaid(ok ? "copied" : "failed")');
  });
});

describe("and the keyboard stops cutting the game in half", () => {
  it("tells the browser to lay the keyboard OVER the page, not shrink it to fit", () => {
    /*
     * Or: *"when the keyboard opens it gets really small and ugly."*
     *
     * Measured at 844 by 190 — what a keyboard leaves of a landscape phone —
     * the home screen is not redrawn smaller, it is cut in half: every step
     * of the type scale is already sitting on its clamp floor, and the
     * layout is `height: 100dvh` with `overflow: hidden`, so the bottom
     * simply stops existing. The field being typed into can be in the half
     * that is gone.
     */
    expect(read("../../index.html")).toContain("interactive-widget=overlays-content");
  });

  it("lifts a dialog clear of it instead", () => {
    const modals = read("../styles/modals.css");
    expect(modals).toContain("padding-bottom: calc(20px + var(--kb, 0px))");
    /*
     * ⚠ `0px` AND NOT `0`. Inside a calc an unitless zero makes the whole
     * expression invalid, and the padding falls back to none at all — so
     * every browser without `visualViewport` would lose the 20px margin the
     * dialogs have always had.
     */
    expect(modals, "an unitless zero would void the calc").not.toContain("var(--kb, 0)");
    const watcher = read("../game/keyboardInset.ts");
    expect(watcher).toContain("window.visualViewport");
    // offsetTop too: a browser that PANS instead of resizing moves the
    // visual viewport down the page rather than shortening it, and without
    // that term the keyboard measures as no keyboard at all.
    expect(watcher, "a panning browser measures as no keyboard").toContain("vv.offsetTop");
  });
});
