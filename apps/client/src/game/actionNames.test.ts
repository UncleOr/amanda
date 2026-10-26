/**
 * **An action card that names a monster has to name it correctly.**
 *
 * Or: *"besides that, there is an action card called 'מילוי דרקון אש' but
 * the card is called 'פליים דראגון'. Change it and make sure there are no
 * more like it."*
 *
 * He is describing a translation that leaked. The Flame Dragon's Hebrew name
 * is a transliteration — פליים דראגון — and somebody filling in the action
 * card translated the English instead, which produced a perfectly reasonable
 * Hebrew phrase for a card that does not exist. A child reading "מילוי דרקון
 * אש" has no way to find דרקון אש in the album, because there isn't one.
 *
 * "Make sure there are no more like it" is the actual request, and the only
 * way to be sure of it tomorrow as well as today is to stop asking a person.
 * Every `fillEmpty` card names a real card in `params.cardId`, so its own
 * name and its own description can be checked against that card's name in
 * both languages, automatically, for ever.
 */
import { describe, expect, it } from "vitest";
import { ACTIONS, CATALOG } from "../data/catalog";

/** The action cards that summon a specific monster. */
const fillers = [...ACTIONS.values()].filter((a) => a.effect === "fillEmpty");

describe("an action card that fills the board with a monster", () => {
  it("there are some, or this file is testing nothing", () => {
    expect(fillers.length).toBeGreaterThan(0);
  });

  it("names a card that exists", () => {
    for (const a of fillers) {
      const id = a.params?.cardId;
      expect(typeof id, a.id).toBe("string");
      expect(CATALOG.get(String(id)), `${a.id} fills ${String(id)}`).toBeTruthy();
    }
  });

  it("calls it what the card itself is called", () => {
    for (const a of fillers) {
      const card = CATALOG.get(String(a.params?.cardId))!;
      /*
       * The card's own name has to be IN the action card's name. Not equal
       * to it — "מילוי פליים דראגון" is "a Flame Dragon fill" and the word
       * for fill is the point of it — but present, so that the thing you
       * are promised is the thing you can look up.
       */
      expect(a.name.he, `${a.id} should name ${card.name.he}`).toContain(card.name.he);
      expect(a.name.en, `${a.id} should name ${card.name.en}`).toContain(card.name.en);
    }
  });

  it("and says the same name again in its description", () => {
    for (const a of fillers) {
      const card = CATALOG.get(String(a.params?.cardId))!;
      expect(a.description.he, a.id).toContain(card.name.he);
      expect(a.description.en, a.id).toContain(card.name.en);
    }
  });
});
