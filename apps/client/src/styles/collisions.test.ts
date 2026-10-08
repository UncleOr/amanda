import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Two components, one class name.
 *
 * The shop's shelves were `.shelf`. So was the row of chests on the home
 * screen — in lab.css, which is loaded separately and AFTER the game's own
 * sheets, so `display: flex; justify-content: center; flex-wrap: wrap` from a
 * component the shop has never heard of had been applied to every shop shelf
 * for weeks. Nothing looked broken, because a centred flex row of tiles is a
 * perfectly plausible shop. It only surfaced when a grid was put on the row
 * inside it and the row collapsed to one column, having silently become a
 * flex ITEM.
 *
 * That is the shape of the bug this pins: a bare `.name` selector written in
 * two sheets that do not know about each other. Some of these overlaps are
 * deliberate — lab.css dresses the playground in the game's own `.intro` and
 * `.pick` furniture on purpose — so the list is an allowlist rather than a
 * ban. A NEW name appearing here is the thing to look at: either it is a
 * deliberate override, and it goes in the list with a reason, or it is two
 * components quietly fighting, and one of them needs its own name.
 */
/* fileURLToPath, not .pathname: this repository lives under a Hebrew
   directory name and a URL percent-encodes it. */
const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Every selector in a sheet that is a single bare class and nothing else. */
function bareClasses(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set<string>();
  for (const [, selector] of withoutComments.matchAll(/([^{}]+)\{/g)) {
    for (const part of selector.split(",")) {
      const match = /^\.([A-Za-z][\w-]*)$/.exec(part.trim());
      if (match) names.add(match[1]!);
    }
  }
  return names;
}

/**
 * Names lab.css shares with the game's sheets ON PURPOSE: the playground is a
 * workbench bolted to the side of the game and wears its clothes.
 */
const DELIBERATE = [
  "btn-album",
  "btn-lab",
  "btn-modes",
  "extras",
  "intro",
  "intro__choices",
  "intro__sub",
  "intro__version",
  "pick",
];

describe("class names", () => {
  it("lab.css only re-uses game class names on purpose", () => {
    const lab = bareClasses(readFileSync(join(SRC, "lab.css"), "utf8"));
    const game = new Set<string>();
    for (const file of readdirSync(join(SRC, "styles"))) {
      if (!file.endsWith(".css")) continue;
      for (const name of bareClasses(readFileSync(join(SRC, "styles", file), "utf8")))
        game.add(name);
    }
    const shared = [...lab].filter((name) => game.has(name)).sort();
    expect(shared).toEqual(DELIBERATE);
  });
});
