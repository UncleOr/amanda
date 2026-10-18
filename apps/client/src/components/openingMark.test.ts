/**
 * **The loading mark is a cut-out, and it is small.**
 *
 * Or: *"the entry works, you can still see a grey square."*
 *
 * ═══ THE MARK WAS THE SQUARE ═══
 *
 * He had asked for something of Amanda in place of the WebView's own video
 * spinner, *"small, in the middle"*. It got `icon-512.png` — Amanda, to
 * hand, already shipped. Measured:
 *
 *     512x512   alpha=false   100.0% of pixels fully opaque
 *     corners rgb(5,16,42)    the screen behind rgb(7,10,18)
 *
 * A LAUNCHER icon is a square by definition. Android masks it to whatever
 * shape a phone wants, so the art is painted onto a filled plate, and that
 * plate dropped onto the opening at 61px is a dark navy tile on a near-black
 * screen — with a breathing opacity animation pointing at its edges. The
 * grey circle became a grey square, which is precisely what changed.
 *
 * Two properties make a mark, and neither is visible by reading the code —
 * both live inside an image file, which is why this is measured rather than
 * reviewed:
 *
 *   TRANSPARENT  or it is a plate, whatever is drawn on it
 *   SMALL        or it arrives after the film it exists to cover
 *
 * The second is not a nicety. `brand/ident.mp4` is 69KB and the old mark was
 * 575KB: on the connection where any of this matters, the loading indicator
 * was the slowest thing on the screen.
 *
 * Read as bytes, with no image library — sharp lives in packages/art and the
 * client does not depend on it. A WebP declares alpha in its VP8X flags and
 * carries an ALPH chunk; both are checked, because a file can be rewritten
 * by a tool that keeps one and drops the other.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** What OpeningFilm.tsx points at. Built by scripts/make-loading-mark.mjs. */
const MARK = here("../../public/brand/mark.webp");

/** The film it covers, and therefore the budget it has to beat. */
const IDENT = here("../../public/brand/ident.mp4");

/** The one component that owns the mark. */
const FILM = here("./OpeningFilm.tsx");

/** The two screens that mount it. */
const OPENINGS = ["./Ident.tsx", "./Intro.tsx"].map(here);

/** The chunks of a RIFF/WebP container, in order. */
function chunks(file: string): { id: string; size: number; first: number }[] {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4), "RIFF header").toBe("RIFF");
  expect(b.toString("ascii", 8, 12), "WEBP header").toBe("WEBP");
  const out: { id: string; size: number; first: number }[] = [];
  let at = 12;
  while (at + 8 <= b.length) {
    const size = b.readUInt32LE(at + 4);
    out.push({ id: b.toString("ascii", at, at + 4), size, first: b[at + 8] ?? 0 });
    // Chunks are padded to an even length; the padding is not in the size.
    at += 8 + size + (size % 2);
  }
  return out;
}

describe("the mark is a cut-out, not a plate", () => {
  it("declares alpha in its VP8X flags", () => {
    const vp8x = chunks(MARK).find((c) => c.id === "VP8X");
    expect(vp8x, "a WebP with alpha is an extended-format WebP").toBeDefined();
    // Bit 4 of the first flags byte is ALPHA. 0x10 and nothing else matters.
    expect(vp8x!.first & 0x10, "the alpha flag").toBe(0x10);
  });

  it("actually carries the alpha channel", () => {
    // The flag is a claim; ALPH is the data. A rewrite can lose one.
    expect(chunks(MARK).map((c) => c.id)).toContain("ALPH");
  });
});

describe("the mark is lighter than the film it covers", () => {
  it("is smaller than the ident", () => {
    const mark = statSync(MARK).size;
    const ident = statSync(IDENT).size;
    expect(mark, `${mark}B mark vs ${ident}B ident`).toBeLessThan(ident);
  });

  /*
   * A ceiling as well as a comparison: the ident could be re-cut larger one
   * day, and a 400KB mark passing because the film grew is not the rule.
   */
  it("stays well under what a loading indicator may cost", () => {
    expect(statSync(MARK).size).toBeLessThan(64 * 1024);
  });
});

/**
 * The one line that chooses the picture.
 *
 * Taken out of the source rather than searching the whole file, because the
 * file now EXPLAINS the mistake in a comment — and a test that reads a
 * comment is a test that fails the moment somebody writes down what they
 * learned. It is the assignment that has to be right.
 */
function markPath(file: string): string {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf("const MARK = ");
  expect(at, `no MARK assignment in ${file}`).toBeGreaterThan(-1);

  // `${import.meta.env.BASE_URL}` and then the path, to the closing quote.
  const line = src.slice(at, src.indexOf("\n", at));
  const after = line.slice(line.indexOf("}") + 1);
  return after.slice(0, after.indexOf("`"));
}

describe("one component owns the mark", () => {
  /*
   * The regression was not in the image, it was in the line that chose the
   * image — and that line had been copied into two files, so it was wrong in
   * both and had to be fixed in both. There is one now.
   */
  it("points at brand/mark.webp", () => {
    expect(markPath(FILM)).toBe("brand/mark.webp");
    expect(readFileSync(FILM, "utf8")).toContain('className="opening__mark"');
  });

  it("does not reach for the launcher icon", () => {
    // The exact mistake, by name: a square plate, and 575KB of it.
    expect(markPath(FILM)).not.toContain("icon-512");
  });

  /*
   * And the openings do not grow their own again. A second `const MARK` is
   * how the first one spread; a second `<video class="opening__film">` is
   * how the hold-until-a-frame rule would be escaped.
   */
  it.each(OPENINGS)("%s renders the film through OpeningFilm", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("<OpeningFilm");
    expect(src).not.toContain("const MARK = ");
    expect(src).not.toContain('className="opening__film"');
  });
});

/**
 * ═══ AND THE FILM MUST NOT PAINT OVER IT ═══
 *
 * The mark being right is half of it. The other half is that the WebView's
 * own loading plate — Or's *"grey circle"* — is drawn by the `<video>`
 * element, on top of the mark, before there is any picture to show. The rule
 * is that the film is invisible until it reports a frame.
 *
 * This reads the source, which is weaker than driving a real video element,
 * and it is what is available: the client has no DOM test environment, and
 * the behaviour being guarded only differs from the local one on Android.
 * What it can genuinely catch is the two halves being separated — a CSS rule
 * dropped while the class is still applied, or the class applied from fewer
 * events than it takes to be sure.
 */
describe("the film is held back until it has a frame", () => {
  const CSS = here("../styles/opening.css");

  /**
   * Every declaration written for a selector, from all of its rules.
   *
   * `.opening__film` is written twice on purpose — once for the geometry,
   * with the long account of why it is `position: absolute`, and once at the
   * bottom for what it is allowed to paint. Taking the first block would
   * read the wrong one, and taking the last would break the moment somebody
   * adds a third. So all of them, which is also what the browser does.
   */
  const declarations = (css: string, selector: string): string => {
    const found: string[] = [];
    for (let at = css.indexOf(selector + " {"); at > -1; at = css.indexOf(selector + " {", at + 1)) {
      found.push(css.slice(at, css.indexOf("}", at)));
    }
    expect(found.length, `no rule for ${selector}`).toBeGreaterThan(0);
    return found.join("\n");
  };

  it("starts the film at zero and restores it with --on", () => {
    const css = readFileSync(CSS, "utf8");
    expect(declarations(css, ".opening__film")).toContain("opacity: 0");
    expect(declarations(css, ".opening__film--on")).toContain("opacity: 1");
  });

  /*
   * Three, because exactly one of them has to arrive and which one depends
   * on the platform. Losing them quietly would leave a film that plays
   * invisibly, which is worse than the bug being fixed.
   */
  it.each(["onLoadedData", "onPlaying", "onTimeUpdate"])("listens for %s", (event) => {
    expect(readFileSync(FILM, "utf8")).toContain(`${event}={frame}`);
  });

  it("applies --on only once a frame has arrived", () => {
    const src = readFileSync(FILM, "utf8");
    expect(src).toContain('hasFrame ? " opening__film--on" : ""');
  });
});
