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
    for (const part of (selector ?? "").split(",")) {
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

/**
 * Bare class names that more than one sheet in styles/ writes a rule for.
 *
 * This is a SNAPSHOT, not an approval. styles.css is an index whose import
 * order is load-bearing — home-layout.css exists precisely to override the
 * sheets above it — so most of these are a component and its phone layout,
 * which is fine. Some are two components that happen to share a word, which
 * is not.
 *
 * What the list is for is the NEW entry. A name appearing here that was not
 * here before is either a deliberate override, and it is added with a
 * reason, or it is a component quietly taking a name another one already
 * owns — which is what happened the hour the opening film called itself
 * `.intro`, the name the home screen has had since the game was built.
 * The list getting shorter is always good news.
 */
const SHARED_BETWEEN_GAME_SHEETS: string[] = [
  "action-chip (actions.css, report.css, rooms.css)",
  "action-chip__card (actions.css, report.css, rooms.css)",
  "action-chip__info (actions.css, report.css)",
  "action-chip__main (actions.css, report.css)",
  "action-chip__row (actions.css, rooms.css)",
  "actions (cards.css, report.css)",
  "actions--open (report.css, rooms.css)",
  "actions__empty (cards.css, report.css, rooms.css)",
  "actions__handle (cards.css, effects.css, report.css)",
  "actions__title (cards.css, report.css, rooms.css)",
  "aisle__row (home-layout.css, social.css)",
  "album__bar (album.css, home-layout.css)",
  "album__cover (chests.css, home-layout.css)",
  "album__grid (album.css, home-layout.css)",
  "album__scroll (album.css, home-layout.css)",
  "battle (battle.css, report.css, social.css)",
  "board (board.css, modals.css)",
  "boards (board.css, report.css)",
  "btn-album (chests.css, profile.css)",
  "btn-link (report.css, rooms.css)",
  "build (board.css, home.css, report.css)",
  "count (effects.css, report.css)",
  "extras (home-layout.css, home.css)",
  "good (home-layout.css, social.css)",
  "good__art (home-layout.css, social.css)",
  "good__blurb (home-layout.css, social.css)",
  "hand (cards.css, effects.css, modals.css, report.css)",
  "hand__buttons (cards.css, report.css)",
  "hand__counts (effects.css, report.css)",
  "hand__current (cards.css, effects.css, modals.css, report.css)",
  "hand__hint (cards.css, report.css)",
  "intro (home.css, report.css)",
  "intro--hero (album.css, chests.css, home-layout.css)",
  "intro__art (album.css, profile.css)",
  "intro__buttons (home.css, report.css)",
  "intro__card (home.css, modals.css, report.css)",
  "intro__hint (home.css, report.css)",
  "intro__name (album.css, chests.css)",
  "intro__secondary (report.css, rooms.css)",
  "intro__sub (album.css, chests.css)",
  "intro__tag (home.css, report.css)",
  "join (report.css, rooms.css)",
  "join__input (report.css, rooms.css)",
  "me (chests.css, profile.css)",
  "me__name (chests.css, profile.css)",
  "midline (board.css, modals.css)",
  "modal--shop (home-layout.css, social.css)",
  "mute (home.css, report.css)",
  "panel (home-layout.css, profile.css)",
  "pick (chests.css, profile.css)",
  "pick--ways (chests.css, profile.css)",
  "pick__card (chests.css, profile.css)",
  "profile__face (home-layout.css, profile.css)",
  "profile__faces (home-layout.css, profile.css)",
  "profile__hero (home-layout.css, profile.css)",
  "profile__name (home-layout.css, profile.css)",
  "profile__note (home-layout.css, profile.css)",
  "profile__scroll (home-layout.css, profile.css)",
  "profile__stats (home-layout.css, profile.css)",
  "profile__top (home-layout.css, profile.css)",
  "profile__trace (home-layout.css, profile.css)",
  "profile__who (home-layout.css, profile.css)",
  "profile__wide (home-layout.css, profile.css)",
  "rail__promo (home-layout.css, home.css)",
  "record (chests.css, home-layout.css)",
  "record__cell (chests.css, home-layout.css)",
  "record__grid (chests.css, home-layout.css)",
  "record__n (chests.css, home-layout.css)",
  "record__streak (chests.css, home-layout.css)",
  "record__sub (chests.css, home-layout.css)",
  "record__title (chests.css, home-layout.css)",
  "result (battle.css, report.css)",
  "result__card (battle.css, report.css)",
  "room-code (report.css, rooms.css)",
  "shop__shelves (home-layout.css, social.css)",
  "shop__sign (home-layout.css, social.css)",
  "side__cups (home-layout.css, report.css)",
  "side__label (board.css, report.css)",
  "side__who (home-layout.css, report.css)",
  "stat__icon (cards.css, effects.css)",
  "targeting-bar (board.css, rooms.css)",
  "targeting-bar__cancel (board.css, rooms.css)",
  "targeting-bar__text (board.css, rooms.css)",
  "topbar (effects.css, report.css, topbar.css)",
  "topbar__exit (actions.css, report.css)",
  "topbar__phase (album.css, report.css, topbar.css)",
  "topbar__timer (report.css, topbar.css)",
  "topbar__title (effects.css, report.css, topbar.css)",
  "versus (home-layout.css, home.css, report.css)",
  "versus__x (home.css, report.css)",
  "warn (cards.css, effects.css, report.css)",
  "who__avatar (home.css, report.css)",
  "who__name (home.css, report.css)",
];

describe("class names", () => {
  /*
   * ═══ WHY THIS NOW CHECKS EVERY PAIR ═══
   *
   * It only ever compared lab.css against the game, because lab.css was
   * where the .shelf collision happened. So when the opening film arrived
   * with a sheet of its own calling itself `.intro` — the name the home
   * screen has had since the game was built — nothing said a word.
   *
   * `position: fixed; inset: 0; z-index: 200; display: grid` landed on the
   * start screen. It stopped responding to clicks and reflowed whenever a
   * tab inside it changed. Or found it; this test did not.
   */
  it("no two game sheets claim the same bare class name", () => {
    const dir = join(SRC, "styles");
    const owners = new Map<string, string[]>();
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".css")) continue;
      for (const name of bareClasses(readFileSync(join(dir, file), "utf8"))) {
        if (!owners.has(name)) owners.set(name, []);
        owners.get(name)!.push(file);
      }
    }
    const clashes = [...owners]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name} (${files.join(", ")})`)
      .sort();
    expect(clashes).toEqual(SHARED_BETWEEN_GAME_SHEETS);
  });

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
