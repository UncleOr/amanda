/**
 * Force the app to fetch itself again.
 *
 * An installed web app can get stuck on an old version: the service worker
 * holds the cached files and the only documented cure is digging through
 * browser settings to clear site data — which nobody should have to do to play
 * a game. This does the same thing from inside the app.
 */
export async function hardRefresh(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* best effort — a reload on its own still helps */
  }
  // Cache-bust the document itself, in case the browser's own HTTP cache is
  // holding the old index.html too.
  const url = new URL(location.href);
  url.searchParams.set("fresh", Date.now().toString(36));
  location.replace(url.toString());
}
