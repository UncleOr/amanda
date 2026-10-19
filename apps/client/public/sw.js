/**
 * Minimal service worker — enough to make Amanda installable and playable with
 * a bad connection, without the classic failure mode of a cached app that can
 * never update.
 *
 * Navigations go to the NETWORK first (so a new version always lands, falling
 * back to the cache only when offline); hashed assets and artwork are immutable,
 * so they come from the CACHE first.
 */
const VERSION = "amanda-v5";

/*
 * The page itself: /play/, spelled out rather than left as "./".
 *
 * A relative URL in a worker resolves against sw.js, which is the same
 * thing — and is a rule that lives in the browser rather than in this file.
 * Written out, what it means is visible here and it can be exercised in a
 * test.
 */
const SHELL = new URL("./", self.location).href;

self.addEventListener("install", (event) => {
  // Take over as soon as this version is ready.
  self.skipWaiting();
  /*
   * ═══ AND KEEP THE SHELL, SO "FALLING BACK TO THE CACHE" IS NOT A LIE ═══
   *
   * Nothing used to be pre-cached, and `activate` deletes every cache that is
   * not this exact VERSION — which is stamped with the build hash, so EVERY
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
    const cache = await caches.open(VERSION);
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
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Artwork, audio and build output — content that never changes in place. */
function isImmutable(url) {
  return /\/(assets|cards|arena|music|sfx)\//.test(url.pathname) || /\.(png|webp|mp3|ogg)$/.test(url.pathname);
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
            const cache = await caches.open(VERSION);
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
            const hit = (await caches.match(request)) ?? (await caches.match(SHELL));
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

  if (!isImmutable(new URL(request.url))) return;

  event.respondWith(
    (async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(VERSION);
        cache.put(request, fresh.clone());
      }
      return fresh;
    })(),
  );
});
