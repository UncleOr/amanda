/**
 * The filter rule, against the real fifty-one cards.
 *
 * Or: *"you should be able to filter on several options (dragons that move,
 * say). And more filter options — you decide, from what is already there.
 * Just as an example: filter by the ones where something happens after they
 * die (call it 'life after death')."*
 *
 * ═══ WHY THIS IS A TEST AND NOT A SCREENSHOT ═══
 *
 * I could open the builder on a phone and look at it, and I did. What that
 * cannot show is whether the rule is right, because the only account I can
 * drive owns six of the fifty-one cards — "dragons that move" against a
 * six-card album proves nothing in either direction. The catalogue is right
 * here, so the rule gets checked against all of it.
 *
 * Two different rules live in one sentence and they are easy to swap:
 * **within a group, OR** (dragons or giants) and **between groups, AND**
 * (dragons AND moving). Getting that backwards returns an empty album for
 * every two-chip combination, which looks exactly like a broken filter.
 */
import { describe, expect, it } from "vitest";
import { FIXED_GROUPS, keep, type Group } from "./DeckBuilder";
import { CATALOG, SERIES, collectable } from "../data/catalog";

const ALL = collectable();

/**
 * The families group, as the screen builds it for somebody who owns all.
 *
 * From the series the ALBUM has cards in, not from SERIES — which is the
 * same derivation the component makes, and this test is the reason it is
 * worth stating twice. SERIES carries `legends`, whose only card is Amanda
 * and she is the opponent, not a prize (shared/collectable.ts). A chip for
 * it would empty the screen, and the one thing a filter must never do is
 * make a child think his album has gone.
 */
const OWNED_SERIES = new Set(ALL.map((c) => c.seriesId));
const FAMILY: Group = {
  id: "family",
  label: () => "family",
  choices: SERIES.filter((s) => OWNED_SERIES.has(s.id)).map((s) => ({
    id: s.id,
    label: () => s.id,
    test: (c) => c.seriesId === s.id,
  })),
};

const GROUPS = [FAMILY, ...FIXED_GROUPS];
const pick = (...ids: string[]) => new Set(ids);
const ids = (cards: { id: string }[]) => cards.map((c) => c.id).sort();

describe("the album filter", () => {
  it("has no chip for a family nothing collectable belongs to", () => {
    expect(SERIES.some((s) => !OWNED_SERIES.has(s.id))).toBe(true);
    for (const choice of FAMILY.choices) {
      expect(keep(ALL, GROUPS, pick(`family:${choice.id}`)).length).toBeGreaterThan(0);
    }
  });

  it("returns everything when nothing is chosen", () => {
    expect(keep(ALL, GROUPS, pick())).toHaveLength(ALL.length);
  });

  it("is OR within a group: dragons or giants", () => {
    const dragons = keep(ALL, GROUPS, pick("family:dragons"));
    const giants = keep(ALL, GROUPS, pick("family:giants"));
    const both = keep(ALL, GROUPS, pick("family:dragons", "family:giants"));
    expect(dragons.length).toBeGreaterThan(0);
    expect(giants.length).toBeGreaterThan(0);
    expect(both).toHaveLength(dragons.length + giants.length);
  });

  it("is AND between groups: dragons THAT MOVE, which is Or's example", () => {
    const dragons = keep(ALL, GROUPS, pick("family:dragons"));
    const moving = keep(ALL, GROUPS, pick("move:moves"));
    const both = keep(ALL, GROUPS, pick("family:dragons", "move:moves"));

    // The thing that would break if the two rules were swapped: an
    // intersection is smaller than either side, a union is larger.
    expect(both.length).toBeLessThan(dragons.length);
    expect(both.length).toBeLessThan(moving.length);
    expect(both.length).toBeGreaterThan(0);
    for (const c of both) {
      expect(c.seriesId).toBe("dragons");
      expect(c.stats.moveSpeed).toBeGreaterThan(0);
    }
  });

  it("splits the album in two on movement, with nothing falling between", () => {
    const moves = keep(ALL, GROUPS, pick("move:moves"));
    const still = keep(ALL, GROUPS, pick("move:static"));
    expect(moves.length + still.length).toBe(ALL.length);
    expect(ids(keep(ALL, GROUPS, pick("move:moves", "move:static")))).toEqual(ids(ALL));
  });

  /*
   * Every choice has to actually divide the album. A filter that returns
   * everything is a button that does nothing, and one that returns nothing
   * is a button that looks broken — "has an ability" was 49 of 51 and was
   * left out for exactly this reason.
   */
  it("gives every choice something to show, and leaves something out", () => {
    for (const group of GROUPS) {
      for (const choice of group.choices) {
        const got = keep(ALL, GROUPS, pick(`${group.id}:${choice.id}`));
        expect(
          got.length,
          `${group.id}:${choice.id} matches nothing`,
        ).toBeGreaterThan(0);
        expect(
          got.length,
          `${group.id}:${choice.id} matches everything`,
        ).toBeLessThan(ALL.length);
      }
    }
  });

  /*
   * "Returns damage" lived inside "armoured" until Or asked for it by name,
   * and taking it out showed what had been wrong with the group: it also
   * held `armorBreak`, which is breaking somebody ELSE's armour — an attack
   * filed under defence. Both halves of that are easy to put back by
   * accident, so both are stated here.
   */
  it("keeps returning damage and being armoured apart", () => {
    const reflect = keep(ALL, GROUPS, pick("power:reflect"));
    const armour = keep(ALL, GROUPS, pick("power:armour"));
    expect(reflect.length).toBeGreaterThan(0);
    expect(armour.length).toBeGreaterThan(0);
    for (const c of reflect) {
      expect(c.abilities.some((a) => a.type === "damageReflect")).toBe(true);
      expect(armour, `${c.id} is in both`).not.toContain(c);
    }
  });

  it("does not call breaking armour being armoured", () => {
    const armour = keep(ALL, GROUPS, pick("power:armour"));
    const breakers = ALL.filter((c) => c.abilities.some((a) => a.type === "armorBreak"));
    expect(breakers.length).toBeGreaterThan(0);
    for (const c of breakers) {
      const alsoArmoured = c.abilities.some((a) =>
        ["armorGain", "armorAura", "damageReductionAura", "damageShareAdjacent", "knockbackImmune"]
          .includes(a.type),
      );
      if (!alsoArmoured) expect(armour, `${c.id} only BREAKS armour`).not.toContain(c);
    }
  });

  it("finds life after death, which is the one Or named", () => {
    const got = keep(ALL, GROUPS, pick("power:death"));
    expect(got.length).toBeGreaterThan(0);
    for (const c of got) {
      expect(c.abilities.some((a) => a.trigger === "onDeath")).toBe(true);
    }
    // And the ones left out really have nothing on death.
    for (const c of ALL) {
      if (got.includes(c)) continue;
      expect(c.abilities.some((a) => a.trigger === "onDeath")).toBe(false);
    }
  });

  it("never offers a card the player does not own", () => {
    const six = ALL.slice(0, 6);
    const got = keep(six, GROUPS, pick("move:moves"));
    for (const c of got) expect(six).toContain(c);
    expect(CATALOG.size).toBeGreaterThan(six.length);
  });
});
