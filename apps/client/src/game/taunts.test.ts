import { describe, expect, it } from "vitest";
import { EMOJI, TAUNTS, TAUNT_LIMITS, emojiById, emojiFromSayId, ownedEmoji, sayIdFor, tauntById } from "@amanda/shared";

/*
 * The list is Or's to rewrite — he is the copywriter. These do not check his
 * words; they check that the list stays a list the code can rely on, so that
 * rewriting a line can never quietly break sending it.
 */
describe("the things a player may say", () => {
  it("every id is unique", () => {
    const ids = TAUNTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every line has words in both languages and a face", () => {
    for (const t of TAUNTS) {
      expect(t.he.trim(), t.id).not.toBe("");
      expect(t.en.trim(), t.id).not.toBe("");
      expect(t.face.trim(), t.id).not.toBe("");
    }
  });

  /*
   * The faces used to be unicode characters and are now drawings this game
   * owns, some of which are bought. A sentence everybody is allowed to say
   * must not arrive wearing a picture only some people have — so every face
   * named by a taunt has to be in the FREE set, and this is what says so.
   */
  it("wears only a face that everybody has", () => {
    const free = new Set(EMOJI.filter((e) => e.free).map((e) => e.id));
    for (const t of TAUNTS)
      expect(
        free.has(t.face),
        `${t.id} wears "${t.face}", which is not a free emoji. Either pick a free face ` +
          `or make that one free — a line everybody can send cannot need a purchase to draw.`,
      ).toBe(true);
  });

  it("names a face that actually exists", () => {
    for (const t of TAUNTS) expect(emojiById(t.face), `${t.id} wears "${t.face}"`).toBeDefined();
  });

  it("there is something to say during a match and something at the end", () => {
    expect(TAUNTS.some((t) => t.when === "always")).toBe(true);
    expect(TAUNTS.some((t) => t.when === "end")).toBe(true);
  });

  it("only ids from the list resolve — anything else is somebody poking the socket", () => {
    expect(tauntById(TAUNTS[0]!.id)).toBeDefined();
    expect(tauntById("taunt.nope")).toBeUndefined();
    expect(tauntById("")).toBeUndefined();
    expect(tauntById("__proto__")).toBeUndefined();
  });

  it("the limits are limits", () => {
    expect(TAUNT_LIMITS.gapSeconds).toBeGreaterThan(0);
    expect(TAUNT_LIMITS.perMatch).toBeGreaterThan(0);
  });
});

/**
 * An emoji on its own is a message.
 *
 * Or: *"an emoji on its own should also be sent."* Everything between the tap
 * and the bubble is id-handling, and these pin the whole chain — because the
 * failure Or saw could equally have been the picker, the wire, the server's
 * permission check or the bubble, and only one of them is cheap to look at.
 */
describe("sending an emoji by itself", () => {
  it("every free emoji survives the trip to an id and back", () => {
    for (const e of ownedEmoji([])) {
      const wire = sayIdFor(e.id);
      expect(emojiFromSayId(wire)?.id, `${e.id} did not come back`).toBe(e.id);
    }
  });

  it("gives a guest with nothing eight of them", () => {
    expect(ownedEmoji([]).length).toBe(8);
  });

  it("a pack adds its own and nobody else's", () => {
    const withPack = ownedEmoji(["emoji.monsters"]).map((e) => e.id);
    expect(withPack).toContain("dragon_laugh");
    expect(withPack).not.toContain("amanda_heart");
  });

  /*
   * The server's permission check is `ownedEmoji(theirItems).some(...)` —
   * this is that question, asked of somebody who has bought nothing. If it
   * ever answers false, every emoji in the game is silently undeliverable.
   */
  it("lets somebody who has bought nothing send the free ones", () => {
    const mine = ownedEmoji([]);
    for (const e of mine) {
      const sent = emojiFromSayId(sayIdFor(e.id));
      expect(sent && mine.some((o) => o.id === sent.id)).toBe(true);
    }
  });

  /* A taunt id must NOT read as an emoji, or the bubble draws the wrong one. */
  it("does not mistake a sentence for an emoji", () => {
    expect(emojiFromSayId("taunt.hi")).toBeUndefined();
  });

  /*
   * Every picture a sentence carries has to be one that exists. A missing id
   * is a broken image in the sheet, which is exactly how the say button
   * itself was broken.
   */
  it("every sentence names a face the game actually has", () => {
    const known = new Set(EMOJI.map((e) => e.id));
    for (const t of TAUNTS)
      expect(known.has(t.face), `"${t.he}" points at ${t.face}, which does not exist`).toBe(true);
  });
});
