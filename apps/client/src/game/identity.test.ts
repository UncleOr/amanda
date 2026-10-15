import { describe, expect, it } from "vitest";
import { AVATAR_IDS, SHOP_AVATAR_IDS, avatarFor, handleFor, shownAvatar, shownName } from "@amanda/shared";

/*
 * A name and a face for the ninety-one percent.
 *
 * Measured in the database before any of this was written: 113 players, 10
 * with a nickname. The screen that exists to make an opponent a person was
 * introducing nine out of ten of them as "somebody".
 */

const ids = Array.from({ length: 500 }, (_, i) => `player-${i}-${(i * 7919) % 1000}`);

describe("an automatic handle", () => {
  it("is the same every time for the same player", () => {
    // The whole reason it is derived and not drawn: a random handle would
    // make the same opponent a different person in every match.
    expect(handleFor("abc-123")).toBe(handleFor("abc-123"));
    expect(avatarFor("abc-123")).toBe(avatarFor("abc-123"));
  });

  it("is different for different players", () => {
    const names = new Set(ids.map(handleFor));
    // Not "all distinct" — 500 players into a pool this size will collide,
    // and that is fine for a display name. What matters is that it is not
    // handing everybody the same one.
    expect(names.size).toBeGreaterThan(ids.length * 0.85);
  });

  it("spreads across the faces instead of favouring one", () => {
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(avatarFor(id), (counts.get(avatarFor(id)) ?? 0) + 1);
    expect(counts.size).toBe(AVATAR_IDS.length);
    for (const [, n] of counts) expect(n / ids.length).toBeLessThan(0.15);
  });

  /*
   * A default face that the shop also sells would either give it away or
   * draw somebody wearing a thing they do not own.
   */
  it("never gives away a face the shop sells", () => {
    const sold = new Set<string>(SHOP_AVATAR_IDS);
    for (const id of ids) expect(sold.has(avatarFor(id))).toBe(false);
  });
});

describe("what is actually shown", () => {
  it("prefers what the player chose", () => {
    expect(shownName("הוד", "abc")).toBe("הוד");
    expect(shownAvatar("av_dragon", "abc")).toBe("av_dragon");
  });

  it("treats a blank nickname as no nickname", () => {
    // The field is a text input; "   " is what a child leaves behind.
    expect(shownName("   ", "abc")).toBe(handleFor("abc"));
  });

  it("has nothing to offer for somebody with no id, and says so", () => {
    // A bot has no account, and a guest's card can arrive before their id.
    // Inventing a handle there would be inventing a person.
    expect(shownName(null, null)).toBeNull();
    expect(shownAvatar(null, undefined)).toBeNull();
  });
});
