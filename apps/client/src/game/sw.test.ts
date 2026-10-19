/**
 * **The dead end the service worker used to hand a tester.**
 *
 * Or sent a photograph of Tzod's phone, taken trying to open the game: the
 * WebView's own "Webpage not available", net::ERR_FAILED, dark grey on the
 * app's dark blue. Inside a WebView that screen is the end of the road —
 * there is no address bar, no reload and no back, so the only way out is to
 * kill the app.
 *
 * The worker made it. The navigation branch ended in `Response.error()`,
 * which IS net::ERR_FAILED: one failed request at launch and the app had no
 * page at all. And the cache it was supposed to fall back to is emptied by
 * every deploy, because the version it keeps is stamped with the build hash.
 *
 * These RUN the worker rather than read it. sw.js is plain JavaScript against
 * `self`, `caches` and `fetch`, so it can be evaluated with those three
 * stubbed — which is the only way to ask the question that matters: when
 * everything fails, what does the browser get?
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(
  fileURLToPath(new URL("../../public/sw.js", import.meta.url)),
  "utf8",
);

interface Harness {
  navigate: (url: string) => Promise<Response>;
  cache: Map<string, Response>;
  unregistered: () => boolean;
  install: () => Promise<void>;
}

/** Run sw.js with the three globals a worker has, and hand back its hooks. */
function load(opts: { network?: (req: Request) => Promise<Response> } = {}): Harness {
  const listeners: Record<string, (e: never) => void> = {};
  const store = new Map<string, Response>();
  let unregistered = false;
  const waits: Promise<unknown>[] = [];

  const caches = {
    open: async () => ({
      put: async (req: Request | string, res: Response) =>
        void store.set(typeof req === "string" ? req : req.url, res),
      add: async (req: Request | string) => {
        const key = typeof req === "string" ? req : req.url;
        const res = await network(new Request(key));
        if (!res.ok) throw new Error("not ok");
        store.set(key, res);
      },
    }),
    match: async (req: Request | string) =>
      store.get(typeof req === "string" ? new URL(req, "https://playamanda.com/play/").href : req.url),
    keys: async () => [...new Set<string>()],
    delete: async () => true,
  };
  const network =
    opts.network ?? (async () => new Response("<html>live</html>", { status: 200 }));

  const self = {
    location: new URL("https://playamanda.com/play/sw.js"),
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
  new Function("self", "caches", "fetch", SRC)(self, caches, network);

  return {
    cache: store,
    unregistered: () => unregistered,
    install: async () => {
      listeners.install?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) } as never);
      await Promise.all(waits);
    },
    navigate: (url: string) => {
      let answer!: Promise<Response>;
      const request = new Request(url);
      Object.defineProperty(request, "mode", { value: "navigate" });
      listeners.fetch?.({
        request,
        respondWith: (p: Promise<Response>) => (answer = p),
      } as never);
      return answer;
    },
  };
}

const HOME = "https://playamanda.com/play/";

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
   * /play (no slash) is a 301 to /play/, and returning a redirected response
   * for a navigation is a TypeError inside respondWith — which the browser
   * reports as net::ERR_FAILED. Cached once, that is a phone that cannot open
   * the game again until its storage is wiped.
   */
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
