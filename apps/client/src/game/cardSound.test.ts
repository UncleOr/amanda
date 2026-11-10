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
import {
  ALL_AMANDA, AMANDA_CARD, AMANDA_LINES, dragMix, tapVoice, voiceFor, VOICE_CLIPS } from "./cardSound";

const SRC = fileURLToPath(new URL("./cardSound.ts", import.meta.url));
const SFX = fileURLToPath(new URL("../../public/sfx/", import.meta.url));
/** Every card, for the rules that must hold across all of them. */
const CATALOG_ALL = [...CATALOG.values()];

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
    expect(lava.cry).toBe("card-lava");
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
    expect(voiceFor("slimes_03_acid_ooze").cry).toBe("card-slime");
    // Spike is earth. The one card in the dragons that grinds.
    expect(voiceFor("dragons_05_spike").cry).toBe("card-stone-golem");
  });

  it("gives every earth card the golem's", () => {
    expect(voiceFor("giants_03_hill_giant").cry).toBe("card-stone-golem");
  });

  it("lets a card keep its own against its element", () => {
    // Lava is fire. It is not the Flame Dragon.
    expect(voiceFor("dragons_04_lava").cry).toBe("card-lava");
    // The Father of Giants is earth. He is not the Stone Golem.
    expect(voiceFor("giants_10_titan_king").cry).toBe("card-titan-king");
  });

  it("lets a series beat an element", () => {
    // Every slime squelches, whatever it happens to be made of.
    const slime = voiceFor("slimes_03_acid_ooze");
    expect(slime.cry).toBe("card-slime");
  });
});

/**
 * **The mix, which is the whole of "do them all like that".**
 *
 * Or: *"flame + wings = Flame Dragon, wings + cracking ice = Ice Dragon,
 * different levels of flame + wings give different dragons."* Nothing in
 * dragMix is written per card, so what has to hold is that the recipe comes
 * out of the card's own traits and that the levels actually differ.
 */
describe("what a card sounds like while it is carried", () => {
  const clips = (id: string) => dragMix(id).map((l) => l.clip).sort();

  it("mixes flame and wings into a Flame Dragon", () => {
    expect(clips("dragons_01_flame_dragon")).toEqual(["ing-flame", "ing-wings-dragon"]);
  });

  it("mixes the same wings with ice into an Ice Dragon", () => {
    expect(clips("dragons_06_frost_breath")).toEqual(["ing-ice"]);
    // It does not fly, so it is ice and nothing else — which is the recipe
    // doing what the data says rather than what the name suggests.
    expect(CATALOG.get("dragons_06_frost_breath")!.flying).toBe(false);
    // The one that does both:
    expect(clips("dragons_09_typhoon_dragon")).toContain("ing-wings-dragon");
  });

  it("gives dragons and insects different wings", () => {
    expect(clips("dragons_10_sky_king")).toContain("ing-wings-dragon");
    expect(clips("insects_08_firefly")).toContain("ing-wings-insect");
  });

  it("makes a bigger card slower than a smaller one", () => {
    const king = dragMix("dragons_10_sky_king").find((l) => l.clip === "ing-wings-dragon")!;
    const ghost = dragMix("dragons_08_ghost_dragon").find((l) => l.clip === "ing-wings-dragon")!;
    const bigger = CATALOG.get("dragons_10_sky_king")!.stats.hp;
    const smaller = CATALOG.get("dragons_08_ghost_dragon")!.stats.hp;
    expect(bigger).toBeGreaterThan(smaller);
    expect(king.rate, "the heavier wing beats slower").toBeLessThan(ghost.rate);
  });

  it("leaves the egg alone, because the egg is its own thing", () => {
    expect(clips("dragons_02_obsidian_egg")).toEqual(["card-obsidian-egg"]);
  });

  it("never leaves a card silent in the hand", () => {
    for (const card of CATALOG_ALL) {
      expect(dragMix(card.id).length, `${card.id} makes no sound when carried`).toBeGreaterThan(0);
    }
  });

  it("asks only for clips that exist", () => {
    const wanted = new Set(CATALOG_ALL.flatMap((c) => dragMix(c.id).map((l) => l.clip)));
    for (const clip of wanted) {
      expect(existsSync(`${SFX}${clip}.mp3`), `public/sfx/${clip}.mp3 is missing`).toBe(true);
    }
  });

  it("and every way into a match unlocks the audio", () => {
    /*
     * ⚠ THE SECOND HALF OF THE SAME EVENING. Or: *"I checked Amanda in the
     * playground and she does not talk."* She does not talk THERE by design
     * — but she would not have talked in her own mode either, because
     * `startAmanda` was the one match start in the file that never called
     * `sfx.unlock()`.
     *
     * `unlock()` is the only thing that calls `loadClips`, and `loadClips`
     * is the only thing that ever fetches and decodes a voice. So a session
     * that began with Amanda mode had nothing decoded at all — not her
     * lines, not any card's name. And `sfx.play` resumes a suspended context
     * without loading anything, which is exactly why the clicks worked and
     * nothing else did.
     *
     * Checked for every start rather than for hers, because the next one
     * somebody adds will have the same hole and the same silence.
     */
    const MATCH = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");
    /*
     * ⚠ AND `startAmanda` IS NOT IN THIS LIST, WHICH IS THE CORRECTION THAT
     * MATTERS. It is a one-liner that delegates to `startOnline`, so it has
     * no `sfx.unlock()` of its own and does not need one — the first version
     * of this test asserted on it and failed against perfectly correct code.
     * The real gap was `startAmandaSolo`, the unwinnable preview, which is a
     * start in its own right and had none.
     */
    const starts = [
      "startMatch",
      "startOnline",
      "startPlayground",
      "startAmandaSolo",
      "startMirror",
    ];
    for (const fn of starts) {
      const at = MATCH.indexOf(`const ${fn}`);
      expect(at, `${fn} is gone — rename it here too`).toBeGreaterThan(-1);
      /*
       * To the NEXT declaration, not a fixed number of characters. 1400 was
       * the first guess and `startAmanda` failed on it with the fix in place
       * — the comment explaining the fix is nine hundred characters long and
       * pushed the call out of the window.
       */
      const next = MATCH.slice(at + 10).search(/\n {2}const /);
      const body = MATCH.slice(at, next > 0 ? at + 10 + next : at + 2600);
      /*
       * ⚠ THE CALL, WITH ITS SEMICOLON — NOT THE WORDS.
       *
       * The first version of this asserted `toContain("sfx.unlock()")` and
       * PASSED with the fix deliberately removed, because the comment
       * explaining the fix says `sfx.unlock()` in prose a few lines above
       * the call. A test that matches its own documentation checks nothing.
       * Proved by taking the line out again and watching it fail.
       */
      expect(body, `${fn} never unlocks the audio`).toContain("sfx.unlock();");
    }
  });

  it("gives Amanda a different line each time she is picked up", () => {
    /*
     * ⚠ THE THIRD EVENING OF THE SAME REPORT. Or: *"I still cannot hear
     * Amanda in the playground."*
     *
     * Twice before, the answer was a wiring fault — nothing decoded her
     * clips, and one match start never unlocked the audio. Both were real
     * and both are fixed, and she was STILL silent, because the playground
     * plays `voiceFor(id).name` on the press and Amanda has no `name`. Her
     * seven lines were wired to her MODE and never to her CARD.
     *
     * So the two things worth holding: she answers at all, and she does not
     * answer the same way twice. A constant would have been one line in
     * CARDS and would have quietly undone *"several random options"*.
     */
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const line = tapVoice(AMANDA_CARD);
      expect(line, "Amanda says nothing when she is picked up").toBeDefined();
      expect(ALL_AMANDA, `${line} is not one of her lines`).toContain(line);
      seen.add(line!);
    }
    expect(seen.size, "she says the same thing every time").toBeGreaterThan(1);
    // And everything else answers exactly as it did before.
    expect(tapVoice("dragons_04_lava")).toBe("card-name-lava");
    expect(tapVoice("dragons_08_ghost_dragon")).toBeUndefined();
  });

  it("works through all seven before she repeats one", () => {
    /*
     * ⚠ OR COUNTED, WHICH IS WHY THIS IS A BAG AND NOT A DICE ROLL. *"80%
     * she said 'Amanda', 20% Kiddo Kiddo Kiddo. Zero percent on the rest."*
     *
     * The zero was mine: the tap drew from `hello` only, so four of the
     * seven could not come up. The 80/20 was not what it looked like — two
     * of those three lines are "Amanda." and "I'm Amanda.", which from a
     * sofa are the same line.
     *
     * Both are fixed by the same change, and the bag is the half that keeps
     * being true: seven independent draws will happily skip a line for
     * twenty presses, which a child experiences as the game being broken
     * rather than as chance. Here, seven presses ARE all seven lines —
     * stated as a property over the whole run rather than as a count, so a
     * bag of a different size still has to satisfy it.
     */
    const n = ALL_AMANDA.length;
    const rounds = 40;
    const drawn: string[] = [];
    for (let i = 0; i < n * rounds; i++) drawn.push(tapVoice(AMANDA_CARD)!);

    /*
     * ⚠ STATED OVER ANY 2n-1 DRAWS, NOT OVER ALIGNED BLOCKS OF n. The first
     * version asserted that every window starting at a multiple of seven
     * held all seven, and it failed against perfectly correct code: the
     * tests above this one have already drawn 200 lines, so the bag is
     * part-used by the time this starts and the boundaries are nowhere near
     * multiples of seven. 2n-1 is the window that holds whatever the phase
     * — worst case you are at the end of one bag and the start of the next.
     */
    for (let at = 0; at + (2 * n - 1) <= drawn.length; at++) {
      const window = drawn.slice(at, at + 2 * n - 1);
      expect(
        new Set(window).size,
        `a line is missing from ${2 * n - 1} presses: ${window.join(" ")}`,
      ).toBe(n);
    }
    // No line is ever said twice running, which is the seam between bags.
    for (let i = 1; i < drawn.length; i++) {
      expect(drawn[i], `${drawn[i]} twice in a row at ${i}`).not.toBe(drawn[i - 1]);
    }
    /*
     * And the spread is even to within one draw — the leftover of whatever
     * part-bag this started in. "80% / 20% / zero percent on the rest" is
     * arithmetically impossible here, which is the whole point: it is not
     * made unlikely, it is made unavailable.
     */
    for (const line of ALL_AMANDA) {
      const got = drawn.filter((d) => d === line).length;
      expect(Math.abs(got - rounds), `${line} came up ${got} times in ${rounds} rounds`).toBeLessThanOrEqual(1);
    }
  });

  it("asks the cards for their tap voice through the one function that knows her", () => {
    /*
     * ⚠ AND THE SPECIAL CASE IS WORTH NOTHING IF A CALLER WALKS ROUND IT.
     *
     * `voiceFor(id).name` is the expression that was written at each of the
     * three places a card is pressed, and it is the expression that makes
     * her silent. Writing it again anywhere is the same bug returning, so
     * it is banned in the screens — `voiceFor` itself stays public for the
     * cry and the drag, which are not a tap.
     */
    for (const file of ["../App.tsx", "../components/CardEditor.tsx"]) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      expect(text, `${file} reads a tap voice straight out of voiceFor`).not.toContain(
        "voiceFor(",
      );
    }
  });

  it("and every clip the game can ask for is in the loader", () => {
    /*
     * ⚠ THE OTHER DIRECTION, AND NOTHING CHECKED IT UNTIL AMANDA WAS SILENT
     * FOR AN EVENING.
     *
     * Or: *"Amanda has no sound. Are you sure everything went up?"* It had.
     * All seven clips were on the live site and listed in art.json. They were
     * never DECODED: `ALL_AMANDA` was declared and used nowhere, so
     * `loadClips` never fetched them, `sfx.voice` found no buffer, and it did
     * the correct thing for a missing clip — nothing.
     *
     * Every list in this file guards against a NAME WITH NO FILE. This is the
     * mirror: A FILE NO LOADER FETCHES. It sounds identical from a sofa and
     * no amount of checking the deploy finds it.
     */
    for (const clip of ALL_AMANDA) {
      expect(existsSync(`${SFX}${clip}.mp3`), `public/sfx/${clip}.mp3 is missing`).toBe(true);
      expect(VOICE_CLIPS, `${clip} exists but nothing decodes it`).toContain(clip);
    }
  });
});
