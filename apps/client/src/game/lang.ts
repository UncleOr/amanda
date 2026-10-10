/**
 * Which language the game is in.
 *
 * Or: *"when we upload to the store we'll upload in Hebrew and English
 * together. That's mandatory for me."* A store page in English that installs
 * a Hebrew-only game is a one-star review, so the game has to follow.
 *
 * ═══ CHANGING LANGUAGE RELOADS THE PAGE ═══
 *
 * On purpose, and it is the whole reason this file is twenty lines instead of
 * a context provider threaded through ninety components.
 *
 * A language is not a piece of game state that changes while you play — it is
 * chosen once, deliberately, probably in the first minute, and then never
 * again. Reloading makes that one action correct everywhere at once: the
 * direction of the document, the stylesheets that resolved logical properties
 * at mount, the text already drawn into the Pixi canvas, the title in the tab
 * and the name on the home screen.
 *
 * The alternative — subscribing every component that reads a word — is ninety
 * files of plumbing whose failure mode is a screen half in each language, and
 * the bug would be invisible to me because I would have to notice the one
 * panel that did not re-render.
 *
 * It costs a match in progress, which is why the switch is not on the board.
 */
export type Lang = "he" | "en";

const KEY = "amanda.lang";

/** Hebrew unless someone said otherwise. This is Hod's game first. */
function load(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "he";
  } catch {
    return "he";
  }
}

let current: Lang = load();

export function lang(): Lang {
  return current;
}

/**
 * Tell the document what it is showing, before React renders a thing.
 *
 * index.html ships `lang="he" dir="rtl"` because that is what most players
 * get and a flash of the wrong direction is worse than a static default.
 * This corrects it at boot for the ones who chose otherwise.
 */
export function applyLang(): void {
  const el = document.documentElement;
  el.lang = current;
  el.dir = current === "he" ? "rtl" : "ltr";
}

export function setLang(next: Lang): void {
  if (next === current) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* it will not stick, but the reload below still switches this session */
  }
  current = next;
  location.reload();
}

/**
 * The right half of a `{he, en}` pair.
 *
 * Every card, series, ability and action card already carries both — see
 * LocalizedStringSchema — so this is the whole of the translation for all 182
 * of them. The fallback is Hebrew rather than empty: a missing English string
 * should read as untranslated, not as a blank where a monster's name was.
 */
export function say(text: { he: string; en?: string } | undefined): string {
  if (!text) return "";
  if (current === "en") return text.en?.trim() || text.he;
  return text.he;
}
