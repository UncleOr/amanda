/**
 * **The page is running against a build that no longer exists.**
 *
 * Or, at the end of a tutorial stage: *"it said it could not show me the
 * battle."* Underneath it, the reason:
 *
 *     Failed to fetch dynamically imported module:
 *     .../assets/WebGLRenderer-CF5Wwt7Y.js
 *
 * ═══ WHAT THAT ACTUALLY MEANS ═══
 *
 * Every build gives the files hashed names, and a deploy deletes the old
 * ones. A page loaded before the deploy is still holding the old names — so
 * the moment it asks for anything it has not already fetched, it asks for a
 * file that is gone. Not a network blip: a permanent 404 that only a reload
 * can fix, because only a reload fetches an index.html with the new names.
 *
 * It bit the arena first because the arena is the one thing fetched at the
 * last possible second, and the vite config now merges pixi into one chunk
 * so that particular fetch happens early. But the shop, the album and every
 * other lazy screen have exactly the same shape, and so will the next one.
 *
 * ═══ WHY IT DOES NOT RELOAD ON THE SPOT ═══
 *
 * Because the player is usually in the middle of something. A reload during
 * a battle throws away the match; during a build phase it throws away ninety
 * seconds of a child arranging cards. main.tsx already solved this for the
 * service worker: it waits for a safe moment — the home screen — and reloads
 * then. This hands the same machinery a second reason to fire.
 *
 * So the failure stays handled where it happens (the arena skips to the
 * result, the panel shows its own fallback), and the PAGE is repaired the
 * next time the player is standing somewhere nothing can be lost.
 */

let stale = false;

/**
 * Something could not be fetched because the build moved underneath us.
 *
 * Safe to call for any dynamic-import failure. A genuine network failure
 * marks the page stale too, and the worst that costs is one reload at the
 * menu, which a player on a bad connection will read as the game loading.
 */
export function markStale(): void {
  stale = true;
}

/** Is this page holding file names that have stopped existing? */
export function isStale(): boolean {
  return stale;
}

/**
 * Was this failure the build moving, rather than something in our own code?
 *
 * Browsers do not agree on the wording, so this matches the part they share.
 * Chrome and the Android WebView say "Failed to fetch dynamically imported
 * module"; Safari says "Importing a module script failed"; Firefox says
 * "error loading dynamically imported module".
 */
export function looksLikeAMovedBuild(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return /dynamically imported module|Importing a module script failed|error loading dynamic/i.test(
    text,
  );
}
