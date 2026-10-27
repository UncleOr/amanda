/**
 * **The dead end the service worker used to hand a tester — and the artwork
 * it used to throw away.**
 *
 * Or sent a photograph of Tzod's phone, taken trying to open the game: the
 * WebView's own "Webpage not available", net::ERR_FAILED, dark grey on the
 * app's dark blue. Inside a WebView that screen is the end of the road —
 * there is no address bar, no reload and no back, so the only way out is to
 * kill the app.
 *
 * The worker made it. The navigation branch ended in `Response.error()`,
 * which IS net::ERR_FAILED: one failed request at launch and the app had no
 * page at all.
 *
 * And then, months later: *"in places with no reception the game loads
 * without pictures and it's rubbish."* Same worker, same cause one level
 * down — the cache it fell back to was emptied by every deploy, because the
 * name it keeps is stamped with the build time. A card you had seen was gone
 * again by the next afternoon.
 *
 * These RUN the worker rather than read it. sw.js is plain JavaScript against
 * `self`, `caches` and `fetch`, so it can be evaluated with those three
 * stubbed — which is the only way to ask the question that matters: when
 * everything fails, what does the browser get?
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(
  fileURLToPath(new URL("../../public/sw.js", import.meta.url)),
  "utf8",
);

/** The two cache names sw.js uses, unstamped as they are in public/. */
const BUILD = "amanda-v5";
const ART = "amanda-art";
const HOME = "https://playamanda.com/play/";
const MANIFEST = HOME + "art.json";

interface Harness {
  navigate: (url: string) => Promise<Response>;
  get: (url: string) => Promise<Response | undefined>;
  /** Named caches, exactly as the worker sees them. */
  caches: Map<string, Map<string, Response>>;
  /** This build's cache: the page and the hashed code. */
  cache: Map<string, Response>;
  /** The permanent one: pictures and sound. */
  art: Map<string, Response>;
  unregistered: () => boolean;
  install: () => Promise<void>;
  activate: () => Promise<void>;
  fetched: string[];
}

interface Options {
  network?: (req: Request) => Promise<Response>;
  /** Seed the named caches before the worker runs. */
  seed?: Record<string, Record<string, string>>;
  saveData?: boolean;
}

/**
 * A cache lookup that honours `Vary`, because the real one does.
 *
 * ⚠ This is the whole reason the stub is not a plain Map. The shell was in
 * the cache and the worker still showed the offline page: the server answers
 * the HTML with `Vary: Origin`, a top-level NAVIGATION carries no Origin
 * header and the worker's own `fetch()` carries one, so the Cache API
 * refused a match between two requests it had been told might differ. Found
 * by pulling the plug on a real build, not by reading the code.
 *
 * A response marked `__vary` only matches when the caller passed
 * `ignoreVary`, which is exactly the shape of that bug.
 */
function vary(
  store: Map<string, Response>,
  url: string,
  req: Request | string,
  opts?: CacheQueryOptions,
): Response | undefined {
  const hit = store.get(url);
  if (!hit) return undefined;
  const picky = (hit as Response & { __vary?: boolean }).__vary;
  if (picky && !opts?.ignoreVary) return undefined;
  void req;
  return hit;
}

/** A response the server marked `Vary:`, as GitHub Pages and Vite both do. */
function varying(body: string): Response {
  const res = new Response(body, { status: 200 });
  Object.defineProperty(res, "__vary", { value: true });
  return res;
}

/** Run sw.js with the globals a worker has, and hand back its hooks. */
function load(opts: Options = {}): Harness {
  const listeners: Record<string, (e: never) => void> = {};
  const named = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  let unregistered = false;

  for (const [name, entries] of Object.entries(opts.seed ?? {})) {
    const m = new Map<string, Response>();
    for (const [url, body] of Object.entries(entries)) m.set(url, new Response(body));
    named.set(name, m);
  }
  const bucket = (name: string) => {
    if (!named.has(name)) named.set(name, new Map());
    return named.get(name)!;
  };
  const key = (req: Request | string) => (typeof req === "string" ? req : req.url);

  const network: (req: Request) => Promise<Response> =
    opts.network ?? (async () => new Response("<html>live</html>", { status: 200 }));
  const fetchStub = async (req: Request | string, init?: RequestInit) => {
    const request = typeof req === "string" ? new Request(req, init) : req;
    fetched.push(request.url);
    return network(request);
  };

  const caches = {
    open: async (name: string) => {
      const store = bucket(name);
      return {
        put: async (req: Request | string, res: Response) => void store.set(key(req), res),
        match: async (req: Request | string, o?: CacheQueryOptions) =>
          vary(store, key(req), req, o),
        delete: async (req: Request | string) => store.delete(key(req)),
        add: async (req: Request | string) => {
          const url = key(req);
          const res = await fetchStub(url);
          if (!res.ok) throw new Error("not ok");
          store.set(url, res);
        },
      };
    },
    // The real caches.match searches every cache, which is what lets a
    // navigation find the shell wherever it happens to live.
    match: async (req: Request | string, o?: CacheQueryOptions) => {
      const url = typeof req === "string" ? new URL(req, HOME).href : req.url;
      for (const store of named.values()) {
        const hit = vary(store, url, req, o);
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => [...named.keys()],
    delete: async (name: string) => named.delete(name),
  };

  const self = {
    location: new URL("https://playamanda.com/play/sw.js"),
    navigator: opts.saveData ? { connection: { saveData: true } } : {},
    addEventListener: (name: string, fn: (e: never) => void) => void (listeners[name] = fn),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
    registration: {
      unregister: async () => {
        unregistered = true;
        return true;
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function("self", "caches", "fetch", SRC)(self, caches, fetchStub);

  const run = (name: string) => async () => {
    const waits: Promise<unknown>[] = [];
    listeners[name]?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) } as never);
    await Promise.all(waits);
  };
  const ask = (url: string, navigate: boolean) => {
    let answer: Promise<Response> | undefined;
    const request = new Request(url);
    if (navigate) Object.defineProperty(request, "mode", { value: "navigate" });
    listeners.fetch?.({
      request,
      respondWith: (p: Promise<Response>) => (answer = p),
    } as never);
    return answer;
  };

  return {
    caches: named,
    cache: bucket(BUILD),
    art: bucket(ART),
    fetched,
    unregistered: () => unregistered,
    install: run("install"),
    activate: run("activate"),
    get: async (url: string) => ask(url, false),
    navigate: (url: string) => ask(url, true)!,
  };
}

/** A network that serves a manifest, and "bytes" for everything else. */
function siteWith(manifest: unknown, opts: { fail?: RegExp } = {}) {
  return async (req: Request) => {
    if (opts.fail?.test(req.url)) throw new Error("offline");
    if (req.url === MANIFEST) return new Response(JSON.stringify(manifest), { status: 200 });
    return new Response("bytes", { status: 200 });
  };
}

const ONE_CARD = { eager: { "cards/a.webp": "h1" }, all: { "cards/a.webp": "h1" } };

describe("when the network is gone at launch", () => {
  const dead = () => load({ network: async () => { throw new Error("offline"); } });

  /*
   * THE WHOLE POINT. Not an error — a page, with something on it to press.
   */
  it("answers with a page instead of a failure", async () => {
    const res = await dead().navigate(HOME);
    expect(res.status, "net::ERR_FAILED is what status 0 looks like").toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<button");
    expect(body, "the button has to be the way out").toContain("location.reload()");
  });

  /*
   * And it is still there afterwards. The first version unregistered the
   * worker here — and then the button went straight to the network, which
   * is still down, so the way out worked exactly once.
   */
  it("stays, so the button lands back on this page", async () => {
    const h = dead();
    await h.navigate(HOME);
    expect(h.unregistered()).toBe(false);
  });

  /* With a shell in hand it is useful again, and stays. */
  it("serves the cached page when it has one, and stays registered", async () => {
    const h = dead();
    h.cache.set(HOME, new Response("<html>cached</html>", { status: 200 }));
    const res = await h.navigate(HOME);
    expect(await res.text()).toContain("cached");
    expect(h.unregistered()).toBe(false);
  });
});

describe("what it keeps", () => {
  /*
   * The install used to pre-cache nothing while `activate` deleted every
   * cache that is not this exact build — so the fallback above had nothing to
   * fall back to for most of the life of any install.
   */
  it("keeps the shell the moment it installs", async () => {
    const h = load();
    await h.install();
    expect([...h.cache.keys()]).toContain(HOME);
  });

  /*
   * The shell ALONE is a black screen offline: index.html is a few lines and
   * a script tag, and the script is a hashed file that was never fetched.
   * Measured by stopping the server and reloading — the page came back, the
   * title came back, and the body was empty. So the HTML is read for what it
   * loads, because the hashes change every build and the file that was just
   * downloaded is the one place they are always right.
   */
  it("keeps the code the page cannot start without", async () => {
    const page =
      '<!doctype html><html><head>' +
      '<link rel="stylesheet" crossorigin href="/play/assets/index-abc.css">' +
      '<link rel="icon" href="/play/favicon-32.png">' +
      '</head><body><script type="module" crossorigin src="/play/assets/index-xyz.js"></scr' +
      'ipt></body></html>';
    const h = load({
      network: async (req) =>
        new Response(req.url.endsWith("/") ? page : "asset", { status: 200 }),
    });
    await h.install();
    const keys = [...h.cache.keys()];
    expect(keys).toContain("https://playamanda.com/play/assets/index-xyz.js");
    expect(keys, "and the stylesheet, whatever order the attributes are in").toContain(
      "https://playamanda.com/play/assets/index-abc.css",
    );
    expect(keys, "but not every link in the document").not.toContain(
      "https://playamanda.com/play/favicon-32.png",
    );
  });

  it("never stores a redirect", async () => {
    const redirected = new Response("<html>moved</html>", { status: 200 });
    Object.defineProperty(redirected, "redirected", { value: true });
    const h = load({ network: async () => redirected });
    await h.navigate(HOME);
    expect([...h.cache.keys()]).not.toContain(HOME);
  });

  it("stores an ordinary page", async () => {
    const h = load();
    await h.navigate(HOME);
    expect([...h.cache.keys()]).toContain(HOME);
  });
});

/*
 * ═══ THE ARTWORK, WHICH USED TO GO WITH EVERY DEPLOY ═══
 *
 * Or: *"in places with no reception the game loads without pictures and it's
 * rubbish."*
 *
 * Measured first: a cold home screen pulls 1.8MB of artwork and the library
 * is 22MB, of which 7.6MB is the set that makes the game whole. Two things
 * were wrong — a picture was kept only after it had been seen once, and
 * every deploy emptied the lot — and the second is why the first was never
 * survivable.
 *
 * The second was not a bug, which is why it lived so long: `wordmark.png`
 * has a fixed name, so a cache kept for ever once served a broken logo for
 * days. These are the tests that say the worker can now have both.
 */
describe("the permanent art cache", () => {
  it("survives a deploy that empties this build's cache", async () => {
    const h = load({
      network: siteWith(ONE_CARD),
      seed: {
        "amanda-v5-OLDBUILD": { [HOME]: "last week's page" },
        [ART]: { [HOME + "cards/a.webp"]: "a card" },
      },
    });
    await h.activate();
    expect([...h.caches.keys()], "the old build goes").not.toContain("amanda-v5-OLDBUILD");
    expect(
      [...h.art.keys()],
      "and the card that cost 40KB to fetch does not",
    ).toContain(HOME + "cards/a.webp");
  });

  it("drops only the file whose contents changed", async () => {
    /*
     * The wordmark case and the album case at once. `a.webp` is the same
     * file it was; `wordmark.png` is the fixed logo under the old name. One
     * of them has to go and the other has to stay, and the old worker could
     * only ever do both or neither.
     */
    const h = load({
      network: siteWith({
        eager: {},
        all: { "cards/a.webp": "h1", "brand/wordmark.png": "NEW" },
      }),
      seed: {
        [ART]: {
          [HOME + "cards/a.webp"]: "a card",
          [HOME + "brand/wordmark.png"]: "the logo with the black box",
          [HOME + "#art-manifest"]: JSON.stringify({
            all: { "cards/a.webp": "h1", "brand/wordmark.png": "OLD" },
          }),
        },
      },
    });
    await h.activate();
    const kept = [...h.art.keys()];
    expect(kept, "unchanged, so it stays").toContain(HOME + "cards/a.webp");
    expect(kept, "re-exported under the same name, so it goes").not.toContain(
      HOME + "brand/wordmark.png",
    );
  });

  it("forgets nothing when the manifest cannot be fetched", async () => {
    /*
     * ⚠ The most important one here. Offline is exactly when the cache is
     * all that stands between a child and a grey screen, and offline is also
     * when this fetch fails. A worker that pruned on failure would empty the
     * album at the worst possible moment.
     */
    const h = load({
      network: siteWith(ONE_CARD, { fail: /art\.json/ }),
      seed: { [ART]: { [HOME + "cards/a.webp"]: "a card" } },
    });
    await h.activate();
    expect([...h.art.keys()]).toContain(HOME + "cards/a.webp");
  });

  it("fetches the eager set so a card you never drew is still there", async () => {
    // The first half of the complaint: the album was full of holes by design,
    // because nothing was fetched until it happened to be shown.
    const h = load({
      network: siteWith({
        eager: { "cards/a.webp": "h1", "icons/play.png": "h2" },
        all: { "cards/a.webp": "h1", "icons/play.png": "h2", "music/track1.mp3": "h3" },
      }),
    });
    await h.activate();
    const kept = [...h.art.keys()];
    expect(kept).toContain(HOME + "cards/a.webp");
    expect(kept).toContain(HOME + "icons/play.png");
    expect(kept, "but not the 5MB of music, which waits until it is played").not.toContain(
      HOME + "music/track1.mp3",
    );
  });

  it("does not re-fetch what it already has", async () => {
    const h = load({
      network: siteWith(ONE_CARD),
      seed: {
        [ART]: {
          [HOME + "cards/a.webp"]: "a card",
          [HOME + "#art-manifest"]: JSON.stringify({ all: { "cards/a.webp": "h1" } }),
        },
      },
    });
    await h.activate();
    expect(h.fetched.filter((u) => u.endsWith("cards/a.webp"))).toHaveLength(0);
  });

  it("leaves a phone asking for less data alone", async () => {
    const h = load({ network: siteWith(ONE_CARD), saveData: true });
    await h.activate();
    expect(h.fetched.filter((u) => u.endsWith("cards/a.webp"))).toHaveLength(0);
    // It still prunes, so a changed picture is still fixed.
    expect([...h.art.keys()]).toContain(HOME + "#art-manifest");
  });

  it("files a picture in the permanent cache and a bundle in this build's", async () => {
    const h = load();
    await h.get(HOME + "cards/a.webp");
    await h.get(HOME + "assets/index-xyz.js");
    expect([...h.art.keys()], "a card outlives the deploy").toContain(HOME + "cards/a.webp");
    expect(
      [...h.cache.keys()],
      "a hashed bundle dies with the build that named it",
    ).toContain(HOME + "assets/index-xyz.js");
  });

  it("serves a cached picture without going to the network", async () => {
    const h = load({ seed: { [ART]: { [HOME + "cards/a.webp"]: "a card" } } });
    const res = await h.get(HOME + "cards/a.webp");
    expect(await res!.text()).toBe("a card");
    expect(h.fetched).toHaveLength(0);
  });
});

/*
 * ═══ THE HEADER THAT KILLED THE WHOLE FALLBACK ═══
 *
 * Found by stopping the server and reloading a real build, which is the only
 * way it could have been found: every unit test passed, the shell was in the
 * cache, and `caches.match` returned it happily when asked from the page.
 * The worker still showed "Amanda needs the internet".
 *
 * The HTML comes back with `Vary: Origin`. A top-level navigation sends no
 * Origin header and the worker's own precache `fetch()` sends one, so the
 * Cache API was correctly refusing to match two requests it had been told
 * might differ — and a child in a lift got the dead end anyway.
 */
describe("a server that answers with Vary", () => {
  it("still finds the cached page when the network is gone", async () => {
    const h = load({
      network: async () => { throw new Error("offline"); },
      seed: {},
    });
    h.cache.set(HOME, varying("<html>the game</html>"));
    const res = await h.navigate(HOME);
    const body = await res.text();
    expect(body, "the offline page means the fallback missed").not.toContain(
      "צריכה אינטרנט",
    );
    expect(body).toContain("the game");
  });

  it("still finds a cached picture", async () => {
    const h = load();
    h.art.set(HOME + "cards/a.webp", varying("a card"));
    const res = await h.get(HOME + "cards/a.webp");
    expect(await res!.text()).toBe("a card");
    expect(h.fetched, "it must not go to the network for it").toHaveLength(0);
  });

  it("finds the page even when the link carries a query string", async () => {
    const h = load({ network: async () => { throw new Error("offline"); } });
    h.cache.set(HOME, varying("<html>the game</html>"));
    const res = await h.navigate(HOME + "?utm_source=whatsapp");
    expect(await res.text()).toContain("the game");
  });
});
