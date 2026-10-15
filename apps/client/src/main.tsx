import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Intro } from "./components/Intro";
import { AppCrash } from "./components/ErrorBoundary";
import "./styles.css";
// The playground has its own sheet — it is a workbench bolted to the side of
// the game, and keeping it separate keeps that visible.
import "./lab.css";

import { loadCopy } from "./game/copy";
import { loadCardOverrides } from "./game/cardOverrides";
import { loadLiveContent } from "./game/liveContent";
import { track } from "./game/track";
import { applyLang } from "./game/lang";
import { watchViewport } from "./game/viewport";

/*
 * Anything Or has rewritten, fetched in the background.
 *
 * Nothing waits for this. The game ships with all 547 of its own strings, so
 * a slow or missing server costs nothing — the words are already there, and
 * the card text simply updates in place if an override arrives.
 */
/*
 * Direction first, before a single pixel.
 *
 * index.html ships lang="he" dir="rtl" because that is what most players
 * get, and a static default beats a flash of the wrong direction. This
 * corrects it for anyone who chose English — synchronously, above React,
 * so the first paint is already the right way round.
 */
applyLang();

/*
 * And how tall the screen really is, before the first overlay is drawn.
 *
 * See game/viewport.ts: this is the third attempt at centring the ident, and
 * the first one that reads a number instead of trusting a unit.
 */
watchViewport();

void loadCopy();
/*
 * And anything he has changed about the cards. Same promise: the game ships
 * with every card it has, so a slow or missing server costs nothing.
 */
void loadCardOverrides();
/*
 * And the phrases, the series and the numbers — one request for the three of
 * them, and the same promise again. See liveContent.ts.
 */
void loadLiveContent();
/*
 * And a mark that somebody opened the game — the usage number Or asked for.
 *
 * `last_seen_at` on the player already says WHEN somebody was last here, and
 * says nothing about how often, which is the actual question. One row a visit
 * answers "how many times this week" and "how many different people today"
 * with the same data. A guest counts: opening the game without an account is
 * a real person having a real session.
 */
track("open", { installed: window.matchMedia?.("(display-mode: standalone)").matches ?? false });

/*
 * Where the generated surfaces live, handed to CSS.
 *
 * A stylesheet cannot read import.meta.env, and the base path is "/" in dev
 * and "/amanda/" on Pages — so a URL written into the CSS is wrong in one of
 * the two places. These are set once, here, from the only value that knows.
 */
const SURFACES: Array<[string, string]> = [
  ["--paper-album", "surfaces/album_page.webp"],
  ["--surface-desk", "surfaces/desk.webp"],
  ["--surface-menu", "surfaces/menu_backdrop.webp"],
  ["--surface-battle", "surfaces/battle_strip.webp"],
  ["--scene-win", "scenes/scene_win.webp"],
  ["--scene-lose", "scenes/scene_lose.webp"],
  ["--scene-profile", "scenes/scene_profile.webp"],
  ["--scene-album", "scenes/scene_album.webp"],
  ["--chest-burst", "scenes/chest_burst.webp"],
];
for (const [name, file] of SURFACES) {
  document.documentElement.style.setProperty(name, `url("${import.meta.env.BASE_URL}${file}")`);
}

/*
 * The opening film, on its own root.
 *
 * ═══ BESIDE THE GAME, NOT INSIDE IT ═══
 *
 * It could have been a component at the top of <App/>. It is not, because a
 * broken video would then be a broken game: inside AppCrash a throw here
 * replaces the whole screen with the crash page, and outside it a throw takes
 * everything down. On its own root it can fail alone — React unmounts that
 * tree and the game, which never knew about it, keeps booting.
 *
 * It is rendered BEFORE the game so its div is already in the document, and
 * it waits for nothing: the game loads behind it the entire time.
 */
const film = document.createElement("div");
document.body.appendChild(film);
createRoot(film).render(<Intro />);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
      One crash anywhere used to take the whole game to a blank screen —
      only the Arena had a boundary round it. See AppCrash.
    */}
    <AppCrash>
      <App />
    </AppCrash>
  </StrictMode>,
);

// Installable to a phone home screen, and playable on a bad connection.
// Dev is left alone — a service worker there just gets in the way of HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  /*
   * ═══ A RUNNING APP HAS TO BE ABLE TO NOTICE A NEW VERSION ═══
   *
   * Or, after a deploy: *"do we need another version? I'm not seeing the
   * changes, not in the browser and not in the app."*
   *
   * The site was live — the right bundle, the right strings, checked with the
   * service worker and the caches wiped. What he had was an app that had been
   * open, and none of the machinery below reached it: `update()` ran once, on
   * load, and a page that is already running never loads again. On a phone,
   * where the app is resumed from the task switcher rather than started, that
   * is close to never.
   *
   * So it asks again whenever the app comes back to the front. Which is
   * exactly the moment a player is about to look at it.
   */
  const wasControlled = !!navigator.serviceWorker.controller;
  let reloading = false;
  let registration: ServiceWorkerRegistration | null = null;
  let lastAsked = Date.now();

  /** At most this often, however many times the app is flicked back to. */
  const ASK_EVERY = 10 * 60 * 1000;

  /*
   * ═══ AND IT MUST NOT RELOAD SOMEBODY MID-MATCH ═══
   *
   * This is the half that made the rest worth doing carefully. A reload takes
   * the board away, and the ninety seconds a child spent building it. Asking
   * for updates more often makes that more likely, not less.
   *
   * App.tsx writes the phase onto <html> (see the effect there), so the
   * answer is one attribute read. "intro" is the home screen and absent means
   * the game has not started yet; both are safe. Anything else waits — the
   * new version is downloaded and sitting in the worker either way, and it
   * lands the moment the match is over.
   */
  const idle = () => {
    const phase = document.documentElement.dataset.phase;
    return !phase || phase === "intro";
  };

  let pending = false;
  const reloadWhenSafe = () => {
    if (reloading) return;
    if (!idle()) {
      pending = true;
      return;
    }
    reloading = true;
    location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // A new version took over a page that was running an old one. Without
    // this the player keeps the old app until they happen to close every tab,
    // which on a phone home screen can be never.
    if (!wasControlled) return;
    reloadWhenSafe();
  });

  /*
   * The match ended and an update was waiting. Polled rather than pushed,
   * because the alternative is another global for one boolean — and once a
   * minute, for a thing that is almost never true, costs nothing.
   */
  window.setInterval(() => {
    if (pending) reloadWhenSafe();
  }, 60 * 1000);

  const ask = () => {
    if (!registration || document.visibilityState !== "visible") return;
    if (Date.now() - lastAsked < ASK_EVERY) return;
    lastAsked = Date.now();
    void registration.update().catch(() => {
      /* offline, or the worker is gone; either is survivable */
    });
  };

  document.addEventListener("visibilitychange", ask);
  window.addEventListener("focus", ask);

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        registration = reg;
        return reg.update();
      })
      .catch(() => {
        /* no service worker is survivable; the game still runs */
      });
  });
}
