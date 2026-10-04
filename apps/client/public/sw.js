/**
 * Minimal service worker — enough to make Amanda installable and playable with
 * a bad connection, without the classic failure mode of a cached app that can
 * never update.
 *
 * Navigations go to the NETWORK first (so a new version always lands, falling
 * back to the cache only when offline); hashed assets and artwork are immutable,
 * so they come from the CACHE first.
 */
const VERSION = "amanda-v1";

self.addEventListener("install", (event) => {
  // Take over as soon as this version is ready; nothing is pre-cached, so the
  // first visit stays as fast as it was.
  self.skipWaiting();
  event.waitUntil(caches.open(VERSION));
});

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
  return /\/(assets|cards|arena|music)\//.test(url.pathname) || /\.(png|webp|mp3|ogg)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only GETs, and only our own origin — never touch anything else.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(request)) ?? (await caches.match("./")) ?? Response.error();
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
