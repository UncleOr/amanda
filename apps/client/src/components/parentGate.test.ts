import { describe, expect, it } from "vitest";
import { mayFollowLinks } from "./About";

/**
 * Who may be handed a link out of the game.
 *
 * Apple's Kids Category forbids a link that leaves a children's app without a
 * parental gate, and Google's Families Policy expects the same care. Or's
 * answer: for anybody who has not said they are an adult, the link becomes
 * words — "search YouTube for…" — which cannot be tapped at all.
 *
 * So this one boolean is what two app stores will be checking, and the only
 * direction it is safe to be wrong in is "no". These pin that.
 */
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("may this person follow a link out of the game", () => {
  it("no, when nobody has said how old they are", () => {
    // The common case, and the one that matters: an anonymous account that
    // has never been asked. Silence is not consent.
    expect(mayFollowLinks(null)).toBe(false);
    expect(mayFollowLinks(undefined)).toBe(false);
    expect(mayFollowLinks("")).toBe(false);
  });

  it("no, for a child", () => {
    expect(mayFollowLinks(yearsAgo(7))).toBe(false);
    expect(mayFollowLinks(yearsAgo(12))).toBe(false);
    expect(mayFollowLinks(yearsAgo(17))).toBe(false);
  });

  it("yes, for an adult", () => {
    expect(mayFollowLinks(yearsAgo(18))).toBe(true);
    expect(mayFollowLinks(yearsAgo(40))).toBe(true);
  });

  it("no, for anything that is not a date at all", () => {
    // A birth date arrives from a database column and could be anything.
    // Garbage must fall on the safe side rather than throwing or passing.
    for (const junk of ["tomorrow", "0000-00-00", "1", "לא יודע", "2026-13-45"])
      expect(mayFollowLinks(junk), junk).toBe(false);
  });
});
