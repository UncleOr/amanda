import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canTakeFromBin, takeFromBin, woundedKingMult } from "./useMatch";

/**
 * **The last card thrown can always come back. The ones under it never can.**
 *
 * These import the real functions rather than restating the rule, which the
 * first version of this file did — it agreed with the code by being a copy
 * of it, so it would have gone on passing through every change since.
 *
 * ═══ TWO RULES FROM OR, A MONTH APART ═══
 *
 * *"I need to be able to pull only ONE card back and no more. If I already
 * pulled a card I should not be pulling the ones after it out of the
 * recycling."* — which became one take-back for the whole match.
 *
 * *"You can take back the last card that was thrown, and only it. But not
 * just once."* — with the sequence that defines it: *"I threw an obsidian
 * egg. I threw Thunderwing — I can pull Thunderwing back. I cannot also
 * pull the egg. I carried on. I threw a healing bloom — I can pull the
 * healing bloom back."*
 *
 * They are the same rule said twice: never dig DOWN, always undo the LAST.
 * The flag is not a budget any more, it is "this throw has already been
 * undone", and a throw clears it.
 */
describe("fetching the last thrown card back", () => {
  it("is offered while a throw is waiting to be undone", () => {
    expect(canTakeFromBin(false, 2)).toBe(true);
  });

  it("is not offered twice for the same throw, however full the bin is", () => {
    expect(canTakeFromBin(true, 9)).toBe(false);
  });

  it("is not offered when nothing has been thrown", () => {
    expect(canTakeFromBin(false, 0)).toBe(false);
  });

  /*
   * ═══ OR'S OWN SEQUENCE, PLAYED OUT ═══
   *
   * The egg, the sniper, the bloom. This is the whole rule in one test, and
   * it walks the real functions — the state the component keeps and the two
   * pure pieces it keeps it with.
   */
  it("walks the egg, the sniper and the bloom", () => {
    let state = { hand: "healing_bloom" as string | null, discard: [] as string[] };
    let undone = false;

    const throwIt = () => {
      state = { hand: null, discard: [...state.discard, state.hand!] };
      undone = false; // a new throw re-arms it — discardHand does this
    };
    const draw = (card: string) => {
      state = { ...state, hand: card };
    };
    const fetch = () => {
      if (!canTakeFromBin(undone, state.discard.length)) return false;
      state = takeFromBin(state);
      undone = true;
      return true;
    };

    // "I threw an obsidian egg."
    draw("obsidian_egg");
    throwIt();
    draw("thunderwing");
    // "I threw Thunderwing —"
    throwIt();
    draw("something_else");

    // "— I can pull Thunderwing back."
    expect(fetch()).toBe(true);
    expect(state.hand).toBe("thunderwing");

    // "I cannot also pull the egg."
    expect(fetch()).toBe(false);
    expect(state.hand).toBe("thunderwing");
    expect(state.discard, "the egg is still down there, out of reach").toContain("obsidian_egg");

    // "I carried on. I threw a healing bloom —"
    draw("healing_bloom");
    throwIt();
    draw("yet_another");

    // "— I can pull the healing bloom back."
    expect(fetch()).toBe(true);
    expect(state.hand).toBe("healing_bloom");

    // And still not the egg.
    expect(fetch()).toBe(false);
    expect(state.discard).toContain("obsidian_egg");
  });
});

describe("taking from the bin", () => {
  it("gives you the card on top", () => {
    expect(takeFromBin({ hand: "c", discard: ["a", "b"] }).hand).toBe("b");
  });

  it("buries what you gave up instead of leaving it on top", () => {
    expect(takeFromBin({ hand: "c", discard: ["a", "b"] }).discard).toEqual(["c", "a"]);
  });

  it("does not grow or shrink the bin when you swap", () => {
    expect(takeFromBin({ hand: "c", discard: ["a", "b"] }).discard.length).toBe(2);
  });

  it("empties the bin when you had nothing in hand", () => {
    expect(takeFromBin({ hand: null, discard: ["a"] }).discard).toEqual([]);
  });
});

/**
 * The radioactive eraser, aimed at a King.
 *
 * The card promises a flat 2000 off; the engine takes a multiplier; only the
 * client knows the King's full health. The one rule that is not arithmetic is
 * the floor: a King is never erased, however big the number.
 */
describe("a King an eraser was aimed at", () => {
  it("is not touched when nothing hit it", () => {
    expect(woundedKingMult("furries_01_chuppy", 0)).toBeNull();
  });

  it("is left standing even by a wound bigger than it is", () => {
    const mult = woundedKingMult("furries_01_chuppy", 999999);
    expect(mult).not.toBeNull();
    expect(mult!).toBeGreaterThan(0);
  });

  it("loses health rather than all of it", () => {
    const mult = woundedKingMult("furries_01_chuppy", 2000);
    expect(mult).not.toBeNull();
    expect(mult!).toBeLessThan(1);
  });
});

/**
 * ═══ AND THE ONE LINE THAT MAKES IT TRUE ═══
 *
 * The rule above is pure and testable; the thing that ARMS it is not. The
 * flag is cleared inside `discardHand`, in the component, and a test that
 * models the clearing itself cannot see it go missing — checked by taking
 * the line out and watching eleven tests stay green.
 *
 * Without that line the rule silently reverts to one take-back a match,
 * which is what it was before Or asked for this and is indistinguishable
 * from it in every pure test.
 */
describe("a throw re-arms the undo", () => {
  const SRC = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");

  it("clears the flag when a card is thrown", () => {
    const at = SRC.indexOf("const discardHand = useCallback");
    expect(at, "discardHand not found").toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf("}, [refill]);", at));
    expect(body, "a throw must make the undo available again").toContain(
      "binUsedRef.current = false",
    );
    expect(body).toContain("setBinUsed(false)");
  });

  it("sets it when the card is fetched back", () => {
    const at = SRC.indexOf("const takeDiscard = useCallback");
    const body = SRC.slice(at, SRC.indexOf("}, []);", at));
    expect(body).toContain("binUsedRef.current = true");
  });
});
