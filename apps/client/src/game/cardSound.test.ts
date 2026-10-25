/**
 * **The two ways a card voice fails without making a sound — or a fuss.**
 *
 * Both of them end in silence, which is also what "this card has no voice"
 * looks like, so neither can be found by playing the game and listening.
 *
 *   A CARD ID THAT IS NOT A CARD. `dragons_04_lava` is right; one wrong
 *   digit and the entry sits in the table forever, looking correct, never
 *   matching anything.
 *
 *   A SLUG WITH NO FILE. `sfx.voice` is deliberately quiet when a clip is
 *   missing — an oscillator impression of a dragon would be worse than
 *   nothing — so a renamed or ungenerated clip is indistinguishable from a
 *   card that was never given a voice.
 *
 * And a third, which is not a failure but a promise: Or asked to be able to
 * single out one card rather than a whole series, so the merge order is
 * pinned here.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../data/catalog";
import { voiceFor, VOICE_CLIPS } from "./cardSound";

const SRC = fileURLToPath(new URL("./cardSound.ts", import.meta.url));
const SFX = fileURLToPath(new URL("../../public/sfx/", import.meta.url));

/** The card ids written into the table, read out of the source. */
const declared = (): string[] => {
  const text = readFileSync(SRC, "utf8");
  const block = text.slice(text.indexOf("const CARDS"), text.indexOf("export function voiceFor"));
  return [...block.matchAll(/^\s{2}([a-z]+_\d+_[a-z_]+):/gm)].map((m) => m[1]!);
};

describe("card voices", () => {
  it("names cards that actually exist", () => {
    const ids = declared();
    expect(ids.length, "no entries found — did the table change shape?").toBeGreaterThan(0);
    for (const id of ids) {
      expect(CATALOG.get(id), `${id} is in cardSound.ts and not in the catalogue`).toBeDefined();
    }
  });

  it("points every clip at a file that has sound in it", () => {
    expect(VOICE_CLIPS.length).toBeGreaterThan(0);
    for (const slug of VOICE_CLIPS) {
      const file = `${SFX}${slug}.mp3`;
      expect(existsSync(file), `public/sfx/${slug}.mp3 is missing`).toBe(true);
      /*
       * Two kilobytes. The Ant Soldier's first generation came back as two
       * seconds of silence and was written out as a 358-byte mp3 that no
       * decoder will open — which is the exact shape of this failure, and
       * it reported "ok" at every stage on the way here.
       */
      expect(statSync(file).size, `public/sfx/${slug}.mp3 is too small to be audio`).toBeGreaterThan(
        2048,
      );
    }
  });

  it("lets one card override what its series says", () => {
    // Or: "let me also be able to define a specific animation for a specific
    // card, not only by series or by power."
    const lava = voiceFor("dragons_04_lava");
    expect(lava.place).toBe("card-lava");
    // A card with no entry, no series default and an element nothing maps
    // to asks for nothing — and that has to stay an empty object rather
    // than undefined, because every caller reads a field off it.
    expect(voiceFor("dragons_08_ghost_dragon")).toEqual({});
  });
});

/**
 * **And the kinds, which is how eight sounds cover twenty cards.**
 *
 * Or: *"that sound can also belong to ones in their style — flames, wings,
 * stones and so on."* The merge is element, then series, then the card, and
 * the only thing worth pinning is the ORDER: a card that is fire and also
 * has its own entry must keep its own.
 */
describe("a voice for a whole kind", () => {
  it("gives a card the voice of what it is made of", () => {
    // Acid Ooze is fire first, poison second, and has no entry of its own —
    // but it is a slime, and a slime squelches. Its SERIES wins.
    expect(voiceFor("slimes_03_acid_ooze").place).toBe("card-slime");
    // Spike is earth. The one card in the dragons that grinds.
    expect(voiceFor("dragons_05_spike").place).toBe("card-stone-golem");
  });

  it("gives every earth card the golem's", () => {
    expect(voiceFor("giants_03_hill_giant").place).toBe("card-stone-golem");
  });

  it("lets a card keep its own against its element", () => {
    // Lava is fire. It is not the Flame Dragon.
    expect(voiceFor("dragons_04_lava").place).toBe("card-lava");
    // The Father of Giants is earth. He is not the Stone Golem.
    expect(voiceFor("giants_10_titan_king").place).toBe("card-titan-king");
  });

  it("lets a series beat an element", () => {
    // Every slime squelches, whatever it happens to be made of.
    const slime = voiceFor("slimes_03_acid_ooze");
    expect(slime.place).toBe("card-slime");
  });
});
