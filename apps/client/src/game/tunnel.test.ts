/**
 * **The prize tunnel, which must never pay twice and must never pay nothing.**
 *
 * Or: *"a prize track like in Brawl Stars. We'll call it the prize tunnel...
 * it works by trophies, and adds little prize stations between the arenas:
 * cards, new cards, chests, a pile of diamonds, avatars, and anything you can
 * get in the shop. Make both tracks now with the better prizes, and write
 * 'coming soon' on the Legendary Pass."*
 *
 * Three kinds of thing can go wrong with a reward track, and only one of them
 * is visible on a screen:
 *
 *   A PRIZE THAT IS NOT A PRIZE. A card id with a typo in it hands over a
 *   copy of nothing; a shop item id that is not a row hands over a receipt
 *   for a thing nobody can wear. Neither fails: both are silent, and the
 *   player is told they received something.
 *
 *   A PRIZE THAT PAYS TWICE. The guard is a primary key and an insert, not a
 *   read-then-write, and that is checked here because it is exactly the kind
 *   of thing a later refactor "tidies" into a race.
 *
 *   A LANE THAT IS NOT FOR SALE AND CAN BE BOUGHT ANYWAY. The screen says
 *   "coming soon"; the SERVER has to say no. A label is not a rule.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ARENAS,
  AVATAR_IDS,
  CHESTS,
  SHOP_AVATAR_IDS,
  SHOP_KINDS,
  TUNNEL,
  canClaim,
  nextStop,
  stopsReached,
  tunnelGives,
  tunnelProgress,
} from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import { isClaimed, waiting, type TunnelState } from "./tunnel";

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const SERVER = read("../../../server/src/tunnel.ts");
const API = read("../../../server/src/api.ts");

const state = (over: Partial<TunnelState> = {}): TunnelState => ({
  best: 0,
  reached: 0,
  claimed: [],
  known: true,
  ...over,
});

describe("the track itself", () => {
  it("climbs, and never stands still", () => {
    for (let i = 1; i < TUNNEL.length; i++)
      expect(TUNNEL[i]!.at, `stop ${i}`).toBeGreaterThan(TUNNEL[i - 1]!.at);
    expect(TUNNEL.length).toBeGreaterThan(15);
  });

  it("gives something on both lanes at every station", () => {
    // An empty gift is a perfectly valid GrantGives and a station that hands
    // over nothing — the one failure that looks like success all the way
    // through the system.
    for (const [i, stop] of TUNNEL.entries())
      for (const lane of ["free", "pass"] as const) {
        const g = tunnelGives(i, lane)!;
        const has = (g.cards?.length ?? 0) + (g.items?.length ?? 0) + (g.diamonds ?? 0);
        expect(has > 0 || !!g.chest, `${lane} at ${stop.at} gives nothing`).toBe(true);
      }
  });

  it("never offers the paid lane the same thing as the free one", () => {
    // The Legendary Pass is the better prizes Or asked for. Two identical
    // lanes would make the whole second row an advertisement for nothing.
    for (const [i, stop] of TUNNEL.entries())
      expect(JSON.stringify(stop.free), `station ${i}`).not.toBe(JSON.stringify(stop.pass));
  });

  it("hands out real cards", () => {
    for (const stop of TUNNEL)
      for (const lane of [stop.free, stop.pass])
        for (const c of lane.cards ?? []) {
          expect(CATALOG.has(c.cardId), `${c.cardId} is not a card`).toBe(true);
          expect(c.copies).toBeGreaterThan(0);
        }
  });

  it("hands out real chests", () => {
    for (const stop of TUNNEL)
      for (const lane of [stop.free, stop.pass])
        if (lane.chest) expect(Object.keys(CHESTS)).toContain(lane.chest);
  });

  it("hands out shop items that are shaped like shop items", () => {
    /*
     * ⚠ THE ID IS A REFERENCE TO A ROW IN THE DATABASE, which no test here
     * can see. What IS checkable is the half of it that is structural: the
     * kind, which is a closed list, and — for an avatar — the face, which is
     * its id everywhere else in the game.
     */
    const faces = new Set<string>([...AVATAR_IDS, ...SHOP_AVATAR_IDS]);
    for (const stop of TUNNEL)
      for (const lane of [stop.free, stop.pass])
        for (const id of lane.items ?? []) {
          const [kind, name] = id.split(".");
          expect(SHOP_KINDS as readonly string[], `${id}`).toContain(kind!);
          expect(name, `${id} has no name after the dot`).toBeTruthy();
          if (kind === "avatar") expect(faces.has(`av_${name}`), `${id}`).toBe(true);
        }
  });

  it("puts stations between the arenas rather than all in one", () => {
    /*
     * Or: *"it adds little prize stations BETWEEN the arenas."* Every arena
     * the tunnel reaches has at least two of them, so no rung of the ladder
     * is a long climb with nothing in it.
     *
     * ⚠ "THE TUNNEL REACHES" AND NOT "EVERY ARENA". Fright Alley and the
     * Fuel Stop are shut — Or: *"lock the alley and the petrol station for
     * now"* — and they are shut from the ADMIN PANEL, so in a test with no
     * overrides applied they read as open. The track stops below them on
     * purpose: stations on a rung nobody can stand on are prizes nobody can
     * win. The day those two open, this test is what asks for more track.
     */
    const last = TUNNEL[TUNNEL.length - 1]!.at;
    const rungs = [...ARENAS].sort((x, y) => x.from - y.from).filter((a) => a.from <= last);
    for (const [i, arena] of rungs.entries()) {
      const top = rungs[i + 1]?.from ?? Infinity;
      const inside = TUNNEL.filter((s) => s.at >= arena.from && s.at < top);
      expect(inside.length, `${arena.id} has ${inside.length} stations`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("how far up the tunnel somebody is", () => {
  it("counts what they have walked past", () => {
    expect(stopsReached(0)).toBe(0);
    expect(stopsReached(TUNNEL[0]!.at)).toBe(1);
    expect(stopsReached(TUNNEL[0]!.at - 1)).toBe(0);
    expect(stopsReached(99999)).toBe(TUNNEL.length);
  });

  it("points at the next one, and at nothing past the end", () => {
    expect(nextStop(0)).toBe(TUNNEL[0]);
    expect(nextStop(99999)).toBe(null);
  });

  it("fills the bar rather than emptying it at the top", () => {
    // Nothing ahead and a bar at zero reads as "you have got nowhere" to the
    // player who has got furthest.
    expect(tunnelProgress(0)).toBe(0);
    expect(tunnelProgress(99999)).toBe(1);
    const mid = TUNNEL[0]!.at / 2;
    expect(tunnelProgress(mid)).toBeGreaterThan(0.4);
    expect(tunnelProgress(mid)).toBeLessThan(0.6);
  });
});

describe("what is waiting", () => {
  it("counts the free prizes that are open and untaken", () => {
    expect(waiting(state({ reached: 3 }))).toBe(3);
    expect(waiting(state({ reached: 3, claimed: [{ stop: 0, lane: "free" }] }))).toBe(2);
  });

  it("never counts the lane nobody can claim", () => {
    // A badge counting prizes nobody can have is an advertisement wearing a
    // notification's clothes.
    expect(waiting(state({ reached: 2, claimed: [{ stop: 0, lane: "pass" }] }))).toBe(2);
  });

  it("says nothing at all until the server has answered", () => {
    // A guest, and a phone with no signal, both draw the whole track — with
    // nothing claimable, which is the truth. "Nothing is waiting" and "we
    // have not been told yet" look identical and mean different things.
    expect(waiting(state({ reached: 5, known: false }))).toBe(0);
  });

  it("knows which prize has been taken, by lane", () => {
    const s = state({ claimed: [{ stop: 4, lane: "free" }] });
    expect(isClaimed(s, 4, "free")).toBe(true);
    expect(isClaimed(s, 4, "pass")).toBe(false);
    expect(isClaimed(s, 5, "free")).toBe(false);
  });
});

describe("the screen it is read on", () => {
  const PANEL = read("../components/Tunnel.tsx");
  const CSS = read("../styles/tunnel.css");
  const APP = read("../App.tsx");
  const HOME = read("../components/HomeScreen.tsx");

  it("does not shut when you take something out of it", () => {
    /*
     * Or: *"when you take something from the track it closes. That is no
     * good."* It closed because it was built like the challenges panel,
     * which closes so the prize can fly to the purse behind it — and a
     * challenge list is a thing you are finished with, while a track is a
     * place you are walking along.
     */
    expect(PANEL).not.toContain("onTaking");
    const where = APP.slice(APP.indexOf('panel.is("tunnel")'));
    expect(where.slice(0, where.indexOf("/>"))).not.toContain("onTaking");
    // And the celebration happens on the tile instead.
    expect(PANEL).toContain("setWon(stop)");
    expect(CSS).toContain(".tun-pop");
  });

  it("puts the burst inside the station rather than on the road", () => {
    /*
     * ⚠ IT WAS AN ITEM IN THE ROW, and inserting one into a scrolled
     * right-to-left scroller moves the scroll position — so taking a prize
     * threw the player back to the mouth of the tunnel. Measured before and
     * after: scrollLeft -1138 both times, once it was absolute.
     */
    expect(CSS).toMatch(/\.tun-pop \{[^}]*position: absolute/);
  });

  it("never crops a prize", () => {
    /*
     * Or: *"the images are cut."* They were: a 38px square with
     * `object-fit: cover`, and a monster card is a portrait — so the screen
     * advertised its prizes by showing a card's chin.
     */
    const card = CSS.slice(CSS.indexOf(".tun__bit--card img {"));
    expect(card.slice(0, card.indexOf("}"))).toContain("object-position: center top");
    const thing = CSS.slice(CSS.indexOf(".tun__bit--thing img {"));
    // A chest, a face or an icon is square-ish and transparent: `cover`
    // would cut the lid off a chest exactly the way it cut off a face.
    expect(thing.slice(0, thing.indexOf("}"))).toContain("object-fit: contain");
    expect(PANEL).toContain('shape: "card"');
  });

  it("says where you are, between two stations", () => {
    // Or: *"with a marker of where you are right now, even before you have
    // reached the next prize."*
    expect(PANEL).toContain("function Marker(");
    expect(PANEL).toContain("tunnelProgress(state.best)");
    expect(CSS).toContain("inset-inline-start: var(--through)");
  });

  it("shares the home screen's row with the arena rather than taking one", () => {
    /*
     * Or: *"the layout of the main screen is not good now. The track is
     * enormous. The challenges are enormous and out of proportion with the
     * icon. The bottom buttons are cut off and need scrolling."*
     *
     * All three were one measurement: a second full-width strip under the
     * arena took the progress row from 78 pixels to 148, which pushed the
     * row of doors 4 pixels off a 390-tall screen — and the challenges tile
     * is a square sized by that row, so it went from 61x61 to 131x131
     * around a 19px rosette. Side by side the row is 76 again.
     */
    expect(HOME).toContain('<div className="home__road">');
    expect(CSS).toContain(".home__road {");
    expect(CSS).toContain("display: flex");
  });
});

describe("the two rules only the server can keep", () => {
  it("refuses the lane that is not for sale", () => {
    expect(canClaim("free")).toBe(true);
    expect(canClaim("pass")).toBe(false);
    // And the server asks that same question rather than trusting a screen:
    // there is no build of the client, hand-edited or otherwise, that can
    // claim the better lane by asking nicely.
    expect(SERVER).toContain("canClaim(lane)");
    expect(SERVER).toMatch(/why: "notForSale"/);
  });

  it("checks the trophies itself", () => {
    expect(SERVER).toContain("await bestTrophiesOf(sb, playerId)");
    expect(SERVER).toMatch(/best < TUNNEL\[stop\]!\.at/);
  });

  it("claims by writing a row, not by reading one first", () => {
    /*
     * ⚠ THE INSERT IS THE CHECK. "Read whether it is claimed, then claim it"
     * is two statements with a gap in the middle, and a child tapping a
     * button on a slow phone is a machine for finding that gap. The primary
     * key on (player_id, stop, lane) is the lock.
     */
    const claim = SERVER.slice(SERVER.indexOf("export async function claimStop"));
    expect(claim).toContain('onConflict: "player_id,stop,lane"');
    expect(claim).toContain("ignoreDuplicates: true");
    // And nothing is handed over until that row is won.
    expect(claim.indexOf("deliver(")).toBeGreaterThan(claim.indexOf("ignoreDuplicates"));
  });

  it("hands a chest over shut", () => {
    // `deliver` rolls a chest and gives you what was inside it, which is
    // right for a gift and wrong here: the lid IS the prize. Sealed onto the
    // shelf the same way a chest won in a match is.
    const claim = SERVER.slice(SERVER.indexOf("export async function claimStop"));
    expect(claim).toContain('from("chests").insert');
    expect(claim).toContain("opened_at: null");
    expect(claim).toContain("chest: undefined");
  });

  it("is reachable, and only with a player behind it", () => {
    expect(API).toContain('path === "/api/meta/tunnel"');
    expect(API).toContain('path === "/api/meta/tunnel/claim"');
    // Both sit below the guard that answers 401 to anybody with no account.
    expect(API.indexOf('path === "/api/meta/tunnel"')).toBeGreaterThan(
      API.indexOf('if (!playerId) return send(res, 401, { error: "who are you" });'),
    );
  });
});
