/**
 * **The panel, in a language Or reads.**
 *
 * Or: *"give the behaviours normal names so I understand what is going on
 * there, preferably in Hebrew."*
 *
 * Two different things can go wrong with a translation table and only one of
 * them is a typo:
 *
 *   A MISSING NAME is an empty row in a dropdown that saves perfectly and
 *   means something. `Record<Enum, …>` catches it at compile time; this says
 *   it again for the enums, because a `Record` with the right keys and an
 *   empty string in one of them still compiles.
 *
 *   A NAME FOR SOMETHING THE ENGINE DOES NOT DO is worse, because it reads
 *   as a feature. The last block measures the list against the engine
 *   itself rather than against what this file believes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ABILITY_TRIGGERS,
  ABILITY_TYPES,
  CARRY_STYLES,
  DRAG_FX,
  DRAG_SOUNDS,
  ELEMENTS,
  RANGES,
  RARITIES,
  type AbilityTrigger,
  type AbilityType,
  type CarryStyle,
  type DragFx,
  type DragSound,
  type Element,
  type Range,
  type Rarity,
} from "@amanda/shared";
import { CATALOG } from "../data/catalog";
import {
  CARRY_HE,
  EFFECT_HE,
  ELEMENT_HE,
  FX_HE,
  RANGE_HE,
  RARITY_HE,
  SOUND_HE,
  TRIGGER_HE,
} from "./vocab";

/** Every .ts in the engine that is not a test: what it actually does. */
const ENGINE = (() => {
  const dir = fileURLToPath(new URL("../../../../packages/engine/src/", import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => readFileSync(`${dir}${f}`, "utf8"))
    .join("\n");
})();

const HEBREW = /[֐-׿]/;

/** id → the printed name, for every list the panel offers. */
const LISTS: Array<[string, readonly string[], (id: string) => string]> = [
  ["תנועה בגרירה", CARRY_STYLES, (id) => CARRY_HE[id as CarryStyle].he],
  ["אנימציה בגרירה", DRAG_FX, (id) => FX_HE[id as DragFx].he],
  ["צליל בגרירה", DRAG_SOUNDS, (id) => SOUND_HE[id as DragSound].he],
  ["מתי", ABILITY_TRIGGERS, (id) => TRIGGER_HE[id as AbilityTrigger].he],
  ["מה", ABILITY_TYPES, (id) => EFFECT_HE[id as AbilityType].he],
  ["יסודות", ELEMENTS, (id) => ELEMENT_HE[id as Element]],
  ["טווח", RANGES, (id) => RANGE_HE[id as Range].he],
  ["נדירות", RARITIES, (id) => RARITY_HE[id as Rarity]],
];

describe("every list the panel shows", () => {
  for (const [what, ids, name] of LISTS) {
    it(`names all of ${what} in Hebrew`, () => {
      expect(ids.length).toBeGreaterThan(1);
      for (const id of ids) {
        const he = name(id);
        expect(he, `${id} has no name`).toBeTruthy();
        expect(HEBREW.test(he), `"${he}" (${id}) is not Hebrew`).toBe(true);
        expect(he, `${id} is still showing the engine's own id`).not.toBe(id);
      }
    });

    it(`gives no two of ${what} the same name`, () => {
      // Two rows that read alike are a dropdown where one of them is a
      // guess — and the engine's ids are only visible in the saved data.
      const names = ids.map(name);
      expect(new Set(names).size, names.join(", ")).toBe(ids.length);
    });
  }
});

describe("what the engine really does", () => {
  /*
   * ⚠ THE EDITOR'S OWN PROMISE, CHECKED. Its docstring says "picking from
   * the engine's own lists means a card that saves is a card that works",
   * and for at least one entry that has never been true: `armorGain` is in
   * ABILITY_TYPES and no handler anywhere matches it. A card given it saves
   * cleanly and does nothing in a battle, which reads as the engine being
   * broken rather than as the list being wrong.
   *
   * So the dropdown says so, and this is what keeps the saying honest: the
   * marked ones must be exactly the unimplemented ones, measured against
   * packages/engine. Write a handler and this test tells you to take the
   * warning off.
   */
  it("marks exactly the effects nothing in the engine answers to", () => {
    const unhandled = ABILITY_TYPES.filter((t) => !ENGINE.includes(`"${t}"`));
    const marked = ABILITY_TYPES.filter((t) => EFFECT_HE[t].dead);
    expect(unhandled).toEqual(marked);
    expect(unhandled, "nothing marked — did ABILITY_TYPES change shape?").toContain("armorGain");
  });

  it("names numbers that the engine actually reads", () => {
    // The params hints are taken out of the handlers. An invented one is a
    // number Or would type into a card forever with nothing reading it.
    for (const type of ABILITY_TYPES) {
      for (const param of (EFFECT_HE[type].params ?? "").split(",")) {
        const name = param.trim();
        if (!name) continue;
        expect(ENGINE, `${type} says it reads "${name}" and nothing does`).toContain(
          `params.${name}`,
        );
      }
    }
  });

  /*
   * ═══ AND THE NUMBERS ALREADY WRITTEN ON THE CARDS ═══
   *
   * The line under each ability made one of these visible the first time it
   * was drawn: Chuppy carried `{ pct: 20 }` on "breaks armour", and that
   * handler is two lines long — `target.armor = 0` — and reads nothing. Or:
   * *"you can delete the number."*
   *
   * A dead param is not harmless. It reads as a dial, so the next person to
   * balance the card turns it and nothing happens; and `amount: 30` on
   * Amanda's heal is worse than nothing, because the engine reads
   * `hpPerSecond` and falls back to 50 — the card says 30 and heals 50.
   *
   * The allowed list can only shrink. A new one fails here.
   */
  it("finds no number on a card that its own effect never reads", () => {
    const KNOWN = [
      // Three cards whose row attack carries a `knockback` that the row
      // attack does not read. Left alone because taking it off is a change
      // to Or's balance data and it is his to make, not a tidy-up.
      "dragons_10_sky_king aoeRowAttack knockback",
      "giants_09_thunder_giant aoeRowAttack knockback",
      "giants_10_titan_king aoeRowAttack knockback",
      // ⚠ Amanda heals 50/s, not 30. Renaming this to `hpPerSecond` would
      // be a nerf of forty per cent, so it is a question for Or.
      "legends_01_amanda healAura amount",
    ];
    const dead: string[] = [];
    for (const card of CATALOG.values())
      for (const ab of card.abilities) {
        const reads = (EFFECT_HE[ab.type].params ?? "").split(",").map((p) => p.trim());
        for (const key of Object.keys(ab.params ?? {}))
          if (!reads.includes(key)) dead.push(`${card.id} ${ab.type} ${key}`);
      }
    expect(dead.sort()).toEqual([...KNOWN].sort());
  });

  it("gives a number to every effect that takes one", () => {
    // The reverse: an effect whose handler reads a param and whose line says
    // "no numbers" sends Or away with an empty box and a card that does
    // nothing. Checked only for the effects whose handler is a `case`, since
    // that is where the param is read beside the name.
    const needs = ["knockback", "damageReflect", "regen", "healAura", "stackingDot"] as const;
    for (const type of needs) expect(EFFECT_HE[type].params, type).toBeTruthy();
  });
});
