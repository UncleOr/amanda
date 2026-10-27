/**
 * Minimal service worker — enough to make Amanda installable and playable with
 * a bad connection, without the classic failure mode of a cached app that can
 * never update.
 *
 * Navigations go to the NETWORK first (so a new version always lands, falling
 * back to the cache only when offline); hashed assets and artwork are immutable,
 * so they come from the CACHE first.
 *
 * ═══ TWO CACHES, AND ONLY ONE OF THEM IS THROWN AWAY ═══
 *
 * Or: *"in places with no reception the game loads without pictures and it's
 * rubbish."*
 *
 * Measured before changing anything. A cold home screen pulls 1.8MB of
 * artwork; the whole library is 22MB. Two things were wrong, and the second
 * one is why the first was never survivable:
 *
 *   1. A picture was kept only AFTER it had been seen once. A card you never
 *      drew was never downloaded, so the album was full of holes by design.
 *   2. Every deploy emptied the lot. BUILD below is stamped with the build
 *      time (see vite.config.ts), and `activate` deletes every cache that is
 *      not this exact build — so "seen once" reset on most days.
 *
 * And (2) is not a mistake, which is why it survived: `brand/wordmark.png`
 * has a FIXED name, so a cache kept for ever once served a broken logo for
 * days with nothing the player could do about it. The old design resolved
 * "always fresh" against "always there" by throwing everything away.
 *
 * So there are two caches now, with different lifetimes:
 *
 *   BUILD  the page and the hashed code. Emptied every deploy, exactly as
 *          before — that is the freshness guarantee and it is unchanged.
 *   ART    pictures and sound. PERMANENT. Nothing empties it wholesale; a
 *          single file is dropped only when `art.json` says its content hash
 *          changed. That is what makes the wordmark fixable AND the album
 *          survive a deploy, which the old shape could not do at once.
 *
 * After the first launch the game opens fully drawn in aeroplane mode, and
 * stays that way across deploys.
 */
const BUILD = "amanda-v5";

/** Pictures and sound. Never emptied wholesale — pruned file by file. */
const ART = "amanda-art";

/*
 * The page itself: /play/, spelled out rather than left as "./".
 *
 * A relative URL in a worker resolves against sw.js, which is the same
 * thing — and is a rule that lives in the browser rather than in this file.
 * Written out, what it means is visible here and it can be exercised in a
 * test.
 */
const SHELL = new URL("./", self.location).href;

/**
 * What the build says every picture currently contains.
 *
 * Written by the `art-manifest` plugin in vite.config.ts: every image, video
 * and sound in the site, each with a hash of its contents, split into the set
 * worth fetching up front and the set worth waiting for.
 */
const MANIFEST_URL = new URL("art.json", SHELL).href;

/**
 * Where the LAST manifest is kept, so this one can be compared against it.
 *
 * A synthetic key inside the art cache rather than IndexedDB: the cache is
 * already open, it has exactly the right lifetime (it dies with the art it
 * describes), and there is one less storage API to fail in a private window.
 * The `#` makes it something no real request can collide with.
 */
const MANIFEST_KEY = SHELL + "#art-manifest";

self.addEventListener("install", (event) => {
  // Take over as soon as this version is ready.
  self.skipWaiting();
  /*
   * ═══ AND KEEP THE SHELL, SO "FALLING BACK TO THE CACHE" IS NOT A LIE ═══
   *
   * Nothing used to be pre-cached, and `activate` deletes every cache that is
   * not this exact BUILD — which is stamped with the build time, so EVERY
   * deploy empties it. The fallback below therefore had nothing to fall back
   * to for most of the life of any install, and a single failed request at
   * launch went straight to the dead end.
   *
   * One request, for the page itself. If it fails the install still
   * succeeds — an app that will not install because the shop was shut for a
   * second is worse than one with an empty cache.
   */
  event.waitUntil(precache());
});

/**
 * The page, and the code the page cannot start without.
 *
 * The shell on its own is a BLACK SCREEN offline: index.html is four lines
 * and a script tag, and the script is a hashed file that was never fetched.
 * Measured by stopping the server and reloading — the page came back, the
 * title came back, and the body was empty. A dead end with nicer paperwork.
 *
 * So the HTML is read for what it loads. Nothing here knows the hashes; they
 * change every build and they are written in the file that was just
 * downloaded, which is the one place they are always right.
 *
 * Every step is allowed to fail. An app that will not install because the
 * shop was shut for a second is worse than one with a thin cache.
 */
async function precache() {
  try {
    const cache = await caches.open(BUILD);
    const res = await fetch(new Request(SHELL, { cache: "reload" }));
    if (!res.ok || res.redirected) return;
    const html = await res.clone().text();
    await cache.put(SHELL, res);
    const wanted = new Set();
    for (const [, url] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) wanted.add(url);
    // Any order of attributes: Vite writes rel, then crossorigin, then href.
    for (const [tag] of html.matchAll(/<link [^>]*>/g)) {
      if (!/rel="(stylesheet|modulepreload)"/.test(tag)) continue;
      const href = /href="([^"]+)"/.exec(tag);
      if (href) wanted.add(href[1]);
    }
    for (const url of wanted) {
      try {
        await cache.add(new URL(url, SHELL).href);
      } catch {
        /* one asset short is not a reason to have none */
      }
    }
  } catch {
    /* no cache this time; the next launch tries again */
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Every cache from an older build goes. ART is not one of them.
      for (const key of await caches.keys()) {
        if (key !== BUILD && key !== ART) await caches.delete(key);
      }
      /*
       * Claim FIRST. Filling the art cache is 8MB of fetches and the page
       * waiting to be controlled should not be behind them — `waitUntil`
       * keeps the worker alive for the rest either way.
       */
      await self.clients.claim();
      const manifest = await pruneArt();
      if (manifest) await fillArt(manifest);
    })(),
  );
});

/**
 * Drop the pictures whose contents changed, and nothing else.
 *
 * This is the half that replaces "delete everything". A file is removed from
 * the art cache only when the new manifest gives it a different hash — or
 * stops listing it at all — so a fixed wordmark reaches everybody on the next
 * launch while 82 card portraits that did not change stay where they are.
 *
 * Returns the manifest, or null if there is nothing trustworthy to act on.
 *
 * ⚠ A FAILURE HERE MUST NEVER DELETE. Offline is exactly when the cache is
 * the only thing standing between the player and a grey screen, and offline
 * is also when this fetch fails. No manifest, no pruning, no filling — try
 * again next launch.
 */
async function pruneArt() {
  try {
    const res = await fetch(new Request(MANIFEST_URL, { cache: "reload" }));
    if (!res.ok) return null;
    const fresh = await res.json();
    if (!fresh || typeof fresh.all !== "object") return null;

    const cache = await caches.open(ART);
    const previous = await cache.match(MANIFEST_KEY, { ignoreVary: true });
    if (previous) {
      let old = null;
      try {
        old = await previous.json();
      } catch {
        /* a half-written manifest prunes nothing */
      }
      for (const path of Object.keys(old?.all ?? {})) {
        if (old.all[path] === fresh.all[path]) continue;
        await cache.delete(new URL(path, SHELL).href);
      }
    }
    await cache.put(
      MANIFEST_KEY,
      new Response(JSON.stringify(fresh), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    return fresh;
  } catch {
    return null;
  }
}

/**
 * Fetch the pictures the game needs to be whole, in the background.
 *
 * `eager` is the measured set: icons, card portraits, arena backdrops, sound
 * effects and the brand furniture — about 8MB. Out of it on purpose are the
 * two music tracks (5MB), the chest scenes (3.1MB) and the two opening films
 * (3MB), which are big, arrive late in a session, and are kept for ever once
 * they have been seen anyway.
 *
 * Three at a time. The page is loading over the same connection and the point
 * is to be invisible; a hundred parallel fetches would make the first launch
 * worse in order to make the second one better.
 */
async function fillArt(manifest) {
  // A phone asking for less data gets less. It will still fill in as it plays.
  if (self.navigator?.connection?.saveData) return;

  const cache = await caches.open(ART);
  const want = Object.keys(manifest.eager ?? {}).map((p) => new URL(p, SHELL).href);
  let next = 0;
  let stop = false;

  const worker = async () => {
    while (next < want.length && !stop) {
      const url = want[next++];
      try {
        if (await cache.match(url, { ignoreVary: true })) continue;
        const res = await fetch(url, { cache: "no-cache" });
        if (res.ok) await cache.put(url, res);
      } catch {
        /*
         * Out of network or out of room. Either way the right move is to
         * stop the whole fill rather than grind through 200 more failures:
         * what is already cached stays, and the next launch carries on from
         * there because the loop skips what it finds.
         */
        stop = true;
      }
    }
  };

  await Promise.all([worker(), worker(), worker()]);
}

/** Artwork, audio and video — content kept in the permanent cache. */
function isArt(url) {
  if (/\/assets\//.test(url.pathname)) return false;
  return /\.(png|webp|jpe?g|svg|mp3|ogg|mp4|webm)$/i.test(url.pathname);
}

/** Build output — hashed by Vite, and kept with the build that produced it. */
function isBuild(url) {
  return /\/assets\//.test(url.pathname);
}

/*
 * ═══ THE SCREEN A TESTER ACTUALLY SAW ═══
 *
 * Or sent a photograph of Tzod's phone: Chrome's "Webpage not available",
 * net::ERR_FAILED, dark grey on the app's dark blue so even the words were
 * hard to read. Inside a WebView that page is a dead end — there is no
 * address bar, no reload button and no back, so the only way out of it is to
 * kill the app and hope.
 *
 * And this worker is what produced it. The navigation branch ended in
 * `Response.error()`, which IS net::ERR_FAILED: one failed request at launch —
 * a lift, a wifi handover, a second of nothing — and the app had no page at
 * all.
 *
 * A failure a child can see and act on instead. It is deliberately one
 * sentence and one button, it needs no network to render, and the button does
 * the only thing that can help.
 *
 * DRAFT COPY — Or writes the words. These are the only Hebrew strings in the
 * app that are NOT in the copy document, because a service worker runs
 * outside the page and cannot reach it. They have to be edited here.
 */
const OFFLINE_PAGE = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>אמנדה</title>
<style>
  html,body{height:100%;margin:0}
  body{background:#0B0E17;color:#fff;display:flex;flex-direction:column;
       align-items:center;justify-content:center;gap:22px;
       font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;text-align:center;padding:16px}
  p{font-size:clamp(16px,4.6vh,21px);margin:0}
  button{font:inherit;font-size:clamp(16px,4.6vh,21px);font-weight:700;color:#0B0E17;
         background:#ffb020;border:0;border-radius:12px;padding:12px 28px}
</style></head>
<body>
  <p>אמנדה צריכה אינטרנט כדי להיפתח.</p>
  <button onclick="location.reload()">נסה שוב</button>
</body></html>`;

const offline = () =>
  new Response(OFFLINE_PAGE, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only GETs, and only our own origin — never touch anything else.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // `cache: "reload"` is the whole point. GitHub Pages serves the HTML
          // with Cache-Control: max-age=600, and a plain fetch() here goes
          // through the browser's HTTP cache — so for ten minutes after a
          // deploy this "network first" happily returned the OLD page, and the
          // old bundle with it. Going around the cache is what makes the
          // promise in the comment above true.
          const fresh = await fetch(request, { cache: "reload" });
          /*
           * A REDIRECTED response must not be stored. /play (no slash) is a
           * 301 to /play/, and handing a redirected response back for a
           * navigation is a TypeError inside respondWith — which the browser
           * reports as, of all things, net::ERR_FAILED. Cached once, that is
           * a phone that cannot open the game again until its storage is
           * wiped.
           */
          if (!fresh.redirected) {
            const cache = await caches.open(BUILD);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          /*
           * Everything from here down is wrapped, because a throw inside this
           * handler is the very thing being fixed: respondWith sees a
           * rejected promise and the browser shows net::ERR_FAILED. The last
           * line of this function must always be reachable.
           */
          try {
            /*
             * ⚠ `ignoreVary` IS LOAD-BEARING, and it cost an offline test to
             * find. The shell was in the cache, `caches.match` returned it
             * from the page — and the worker still showed the "needs the
             * internet" page.
             *
             * The server answers the HTML with `Vary: Origin`. A top-level
             * NAVIGATION sends no Origin header; the `fetch()` in precache()
             * above, made from inside a worker, sends one. So the Cache API
             * was correctly refusing a match between two requests it had
             * been told might differ — and the whole offline fallback was
             * dead for a header nobody here chose.
             *
             * It is the same URL and the same single-page app either way.
             * `ignoreSearch` for the same reason: a link with a `?utm=…` on
             * it is still the game.
             */
            const opts = { ignoreVary: true, ignoreSearch: true };
            const hit = (await caches.match(request, opts)) ?? (await caches.match(SHELL, opts));
            if (hit && !hit.redirected) return hit;
          } catch {
            /* a broken cache is not a reason to show the dead end */
          }
          /*
           * ═══ AND IT STAYS ═══
           *
           * The first version of this unregistered the worker here, on the
           * grounds that one holding an empty cache is not helping anybody
           * and should get out of the way of the next launch.
           *
           * Pressing the button showed what that costs. With no worker, the
           * reload goes straight to the network — and with the network still
           * down, what comes back is the dead end this page exists to
           * replace. The way out would work exactly once.
           *
           * So it stays, and every press lands back here until there is
           * something better to show.
           */
          return offline();
        }
      })(),
    );
    return;
  }

  const url = new URL(request.url);
  const art = isArt(url);
  if (!art && !isBuild(url)) return;

  event.respondWith(
    (async () => {
      // ignoreVary for the same reason as the navigation above: a CDN that
      // answers artwork with `Vary: Accept-Encoding` would otherwise miss
      // every picture it had already stored, which IS the reported bug.
      const hit = await caches.match(request, { ignoreVary: true });
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok) {
        /*
         * Into the cache that matches how long it should live: a card goes
         * in the permanent one and survives the next deploy, a hashed bundle
         * goes in this build's and dies with it.
         */
        const cache = await caches.open(art ? ART : BUILD);
        cache.put(request, fresh.clone());
      }
      return fresh;
    })(),
  );
});
