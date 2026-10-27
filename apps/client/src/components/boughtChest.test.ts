/**
 * **A chest you paid for turns up.**
 *
 * Or: *"I bought a chest in the shop and never got it. It should pop up as a
 * chest I can press and open, and it should also be kept for me in the
 * chests place if I don't open it straight away."*
 *
 * The chest was never lost. The server's half has been right all along —
 * shop.ts inserts it sealed, with its contents already rolled, exactly like
 * one won in a match — and the row for the one he bought is in the database
 * with `bought_item = 'chest.wood'` against his name.
 *
 * What never happened was anybody telling the home screen. ChestShelf reads
 * its list once and then waits for CHESTS_CHANGED, and a purchase did not
 * fire it: the chest was already sitting on the shelf behind the shop and
 * would appear the next time the game was opened. "Never got it" is exactly
 * what that looks like.
 *
 * Four joins across two files and a stylesheet, which is the shape of thing
 * that rots quietly. Read out of the source, because there is no DOM here.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SHOP = read("./Shop.tsx");
const SHELF = read("./ChestShelf.tsx");
const LAB = read("../lab.css");

describe("buying a chest", () => {
  it("tells the home screen that the chests changed", () => {
    const take = SHOP.slice(SHOP.indexOf("async function take"), SHOP.indexOf("return (\n    <Overlay"));
    expect(take).toContain("window.dispatchEvent(new Event(CHESTS_CHANGED))");
  });

  it("fires on every purchase, not only on a chest", () => {
    /*
     * A card pack can hand one over too (see `deliver` in shop.ts), and a
     * condition here is a second place that has to agree with the server
     * about which items produce chests. The event is cheap; the shelf asks
     * the server and gets the same list back when nothing changed.
     */
    const take = SHOP.slice(SHOP.indexOf("async function take"), SHOP.indexOf("return (\n    <Overlay"));
    const fire = take.indexOf("CHESTS_CHANGED");
    const branch = take.indexOf('item.kind === "chest"');
    expect(fire).toBeGreaterThan(0);
    expect(branch, "the kind check comes after the event").toBeGreaterThan(fire);
  });

  it("closes the shop, because the thing bought is behind it", () => {
    expect(SHOP).toContain('if (item.kind === "chest") onClose();');
  });
});

describe("the shelf", () => {
  it("still listens for the event the shop now fires", () => {
    expect(SHELF).toContain("window.addEventListener(CHESTS_CHANGED, again)");
  });

  it("marks a chest that was not there a moment ago", () => {
    expect(SHELF).toContain('fresh.has(chest.id) ? " shelf__chest--new" : ""');
  });

  it("does not call everything new on the first load", () => {
    // Opening the game with four chests waiting is not four arrivals, and
    // four of them bouncing at once is noise rather than news.
    expect(SHELF).toContain("const first = seen.current.size === 0;");
  });

  it("has somewhere for a new one to land from", () => {
    expect(LAB).toContain(".shelf__chest--new");
    expect(LAB).toContain("@keyframes chest-land");
    // A child who has asked their phone for less movement gets less.
    const after = LAB.slice(LAB.indexOf("@keyframes chest-land"));
    expect(after).toContain("prefers-reduced-motion");
  });
});
