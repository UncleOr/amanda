/**
 * **Owning a thing and wearing it are two different facts.**
 *
 * Or: *"in the shop, instead of YOURS wouldn't EQUIPPED be better?"* — and
 * when it turned out those say different things: *"yes, put a mark on the
 * item that is equipped now. And when you get a new item, give the option
 * to use it right away."*
 *
 * They come apart the moment you own two of a kind, which is the whole
 * point of a shop that sells six avatars: a shelf where all six say "owned"
 * leaves a player counting their own face to work out which is on the chip.
 *
 * The rule is in @amanda/shared because three screens ask it — the shelf,
 * the detail sheet and (through `isWearable`) the "wear it now" button.
 */
import { describe, expect, it } from "vitest";
import {
  CARD_BACKS,
  CATCHPHRASES,
  isWearable,
  isWearing,
  SHOP_KINDS,
  type Wearing,
} from "@amanda/shared";

/** The two kinds matched by item id, exactly as Shop.tsx supplies them. */
const LOOKUP = {
  backOf: (itemId: string) => CARD_BACKS.find((b) => b.item === itemId)?.id ?? null,
  phraseOf: (itemId: string) => CATCHPHRASES.find((p) => p.item === itemId)?.id ?? null,
};

const back = CARD_BACKS.find((b) => b.item)!;
const phrase = CATCHPHRASES.find((p) => p.item)!;
const item = (over: Partial<{ id: string; kind: string; grants: unknown }> = {}) => ({
  id: "x",
  kind: "avatar",
  ...over,
});

describe("which one you are wearing", () => {
  it("knows the avatar on your chip", () => {
    const worn: Wearing = { avatar: "hoodie" };
    expect(isWearing(item({ grants: { avatar: "hoodie" } }), worn, LOOKUP)).toBe(true);
    expect(isWearing(item({ grants: { avatar: "robot" } }), worn, LOOKUP)).toBe(false);
  });

  it("knows the back on your deck", () => {
    const row = item({ id: back.item!, kind: "back" });
    expect(isWearing(row, { back: back.id }, LOOKUP)).toBe(true);
    expect(isWearing(row, { back: "something-else" }, LOOKUP)).toBe(false);
  });

  it("knows the line you say", () => {
    const row = item({ id: phrase.item!, kind: "phrase" });
    expect(isWearing(row, { phrase: phrase.id }, LOOKUP)).toBe(true);
    expect(isWearing(row, { phrase: null }, LOOKUP)).toBe(false);
  });

  it("never calls a chest, a card or an emoji pack worn", () => {
    /*
     * The half that matters: a pack is a set of faces you MAY send and a
     * chest is a thing that opens. Marking either "equipped" would be a
     * sentence about a state that does not exist.
     */
    for (const kind of ["emoji", "chest", "card", "skin"])
      expect(isWearing(item({ kind }), { avatar: "x", back: "y", phrase: "z" }, LOOKUP), kind).toBe(
        false,
      );
  });

  it("says nothing is worn when nothing is chosen", () => {
    const empty: Wearing = {};
    for (const kind of SHOP_KINDS)
      expect(isWearing(item({ kind, grants: { avatar: "a" } }), empty, LOOKUP), kind).toBe(false);
  });

  it("offers 'wear it now' for exactly the three kinds that can be", () => {
    const wearable = SHOP_KINDS.filter(isWearable);
    expect([...wearable].sort()).toEqual(["avatar", "back", "phrase"]);
  });

  it("is the same rule the button asks", () => {
    // A kind that can be worn must be a kind `isWearing` can answer `true`
    // for; otherwise the button offers something the mark can never show.
    expect(isWearing(item({ kind: "avatar", grants: { avatar: "a" } }), { avatar: "a" }, LOOKUP)).toBe(true);
    expect(isWearing(item({ id: back.item!, kind: "back" }), { back: back.id }, LOOKUP)).toBe(true);
    expect(isWearing(item({ id: phrase.item!, kind: "phrase" }), { phrase: phrase.id }, LOOKUP)).toBe(true);
  });
});
