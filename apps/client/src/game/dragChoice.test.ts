/**
 * **The three things Or can now choose about a card in your hand.**
 *
 * Or: *"let me choose, for every monster: a drag movement out of a list of
 * movements, a drag sound out of a list of sounds, a drag animation out of a
 * list of animations."*
 *
 * ═══ WHAT IS ACTUALLY AT RISK HERE ═══
 *
 * Not the dropdowns. The thing that can quietly stop working is the DEFAULT:
 * fifty-three cards behave the way they do because nobody chose anything for
 * them, and an override mechanism that leaks — a `?? ""` in the wrong place,
 * an empty object that is not empty — changes every card in the game at once
 * while the panel keeps showing "automatic".
 *
 * So the first test and the last are both about cards nobody has touched.
 */
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CARRY_STYLES, DRAG_FX, DRAG_SOUNDS, type Card } from "@amanda/shared";
import { CATALOG, cardPool } from "../data/catalog";
import { carryOf, styleFor } from "./carry";
import { DRAG_SOUND_CLIP, VOICE_CLIPS, dragMixOf } from "./cardSound";
import { FX_FOR_STYLE, fxOf } from "./dragFx";
import { setPreviewCard } from "./preview";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const GHOST = read("../components/DragGhost.tsx");
const CSS = read("../styles/board.css");
const SFX = fileURLToPath(new URL("../../public/sfx/", import.meta.url));

/** Chuppy is electric, so he derives `spark` — a loud default to overrule. */
const CHUPPY = "furries_01_chuppy";
const chuppy = (): Card => CATALOG.get(CHUPPY)!;
/** Put a draft of Chuppy on the editor's bench. */
const bench = (drag: Card["drag"]): Card => {
  const card = { ...chuppy(), drag };
  setPreviewCard(card);
  return card;
};

afterEach(() => setPreviewCard(null));

describe("the game still decides for itself", () => {
  it("ships with nobody having chosen anything", () => {
    /*
     * ⚠ The day this fails is the day somebody wrote a choice into
     * data/series/*.json instead of leaving it to the panel. That is allowed
     * — but it means the derivation is no longer what the game looks like,
     * and the tests below that measure "a card nobody touched" stop meaning
     * what they say.
     */
    const chosen = [...CATALOG.values()].filter((c) => c.drag);
    expect(chosen.map((c) => c.id)).toEqual([]);
  });

  it("gives every card a carry, an effect and a sound without being asked", () => {
    for (const id of cardPool()) {
      const card = CATALOG.get(id)!;
      expect(carryOf(id).style, id).toBe(styleFor(card));
      expect(fxOf(id), id).toBe(FX_FOR_STYLE[styleFor(card)]);
      expect(dragMixOf(card).length, `${id} is silent in the hand`).toBeGreaterThan(0);
    }
  });
});

describe("choosing a movement", () => {
  it("beats what the card would have been", () => {
    expect(styleFor(chuppy())).toBe("spark");
    bench({ move: "heavy" });
    expect(carryOf(CHUPPY).style).toBe("heavy");
  });

  it("brings its spring with it, not just its name", () => {
    // A style that renamed the carry without retuning it would read as
    // "nothing happened" — the whole feel is the two numbers.
    const spark = carryOf(CHUPPY).pull;
    bench({ move: "heavy" });
    expect(carryOf(CHUPPY).pull).toBeLessThan(spark);
  });

  it("offers seven, and every one of them is tuned", () => {
    for (const style of CARRY_STYLES) {
      bench({ move: style });
      const carry = carryOf(CHUPPY);
      expect(carry.style, style).toBe(style);
      expect(carry.pull, style).toBeGreaterThan(0);
      expect(carry.damp, style).toBeGreaterThan(0);
    }
  });

  it("lets go when it is put back to automatic", () => {
    bench({ move: "heavy" });
    setPreviewCard(null);
    expect(carryOf(CHUPPY).style).toBe("spark");
  });
});

describe("choosing an animation", () => {
  it("follows the movement when it is left alone", () => {
    // One choice should not need a second choice to look right: pick up a
    // card like a giant and the stones come with it.
    bench({ move: "heavy" });
    expect(fxOf(CHUPPY)).toBe("rubble");
  });

  it("and is its own answer when it is given one", () => {
    bench({ move: "heavy", fx: "wings" });
    expect(carryOf(CHUPPY).style).toBe("heavy");
    expect(fxOf(CHUPPY)).toBe("wings");
  });

  it("can be nothing at all", () => {
    bench({ fx: "none" });
    expect(fxOf(CHUPPY)).toBe("none");
  });

  /*
   * ⚠ THE THIRD OF THE EFFECT THAT IS EASY TO FORGET. An effect lives in
   * three places — the id here, the markup in DragGhost.tsx and a block of
   * CSS — and a missing third is an option in a dropdown that silently does
   * nothing. Same checklist as dragFx.test.ts, now driven by the list Or
   * picks from rather than by a list typed into a test.
   */
  it("draws every one on the list, and moves it", () => {
    const ELEMENT: Record<string, string> = {
      wings: "drag-ghost__wings",
      wingsBig: "drag-ghost__wings",
      lightning: "drag-ghost__bolt",
      drips: "drag-ghost__drip",
      soil: "drag-ghost__soil",
      rubble: "drag-ghost__rubble",
    };
    for (const fx of DRAG_FX) {
      if (fx === "none") continue;
      const cls = ELEMENT[fx]!;
      expect(GHOST, `${fx} is not drawn`).toContain(`fx === "${fx}"`);
      expect(GHOST, `${fx} has no element`).toContain(cls);
      expect(CSS, `${fx} has no look`).toMatch(new RegExp(`\\.${cls}[^{]*\\{[^}]*animation`));
    }
  });

  it("tells the stylesheet which effect it is", () => {
    // The big slow dragon wings used to be keyed on the CARRY (`--soar`),
    // which is the thing Or just separated them from.
    expect(GHOST).toContain("drag-ghost--fx-${fx}");
    expect(CSS).toContain(".drag-ghost--fx-wingsBig .drag-ghost__wings i");
    expect(CSS, "and not on the carry any more").not.toContain(".drag-ghost--soar .drag-ghost__wings");
  });
});

describe("choosing a sound", () => {
  it("replaces the mix instead of joining it", () => {
    expect(dragMixOf(chuppy()).map((l) => l.clip)).toContain("ing-spark");
    const mix = dragMixOf(bench({ sound: "flame" }));
    expect(mix).toHaveLength(1);
    expect(mix[0]!.clip).toBe("ing-flame");
  });

  it("can be silence, which is a thing a card may be", () => {
    expect(dragMixOf(bench({ sound: "none" }))).toEqual([]);
  });

  it("still sizes the sound to the card", () => {
    // A thorn sprout and the Titan King playing the same clip at the same
    // rate is the thing the mixer exists to avoid.
    const big = { ...CATALOG.get("giants_10_titan_king")!, drag: { sound: "stone" } } as Card;
    const small = { ...CATALOG.get("plants_01_thorn_sprout")!, drag: { sound: "stone" } } as Card;
    expect(dragMixOf(big)[0]!.rate).toBeLessThan(dragMixOf(small)[0]!.rate);
  });

  it("offers only sounds that exist, and that are loaded before they are wanted", () => {
    for (const id of DRAG_SOUNDS) {
      const clip = DRAG_SOUND_CLIP[id];
      if (id === "none") {
        expect(clip).toBeNull();
        continue;
      }
      expect(clip, `${id} has no clip`).toBeTruthy();
      expect(existsSync(`${SFX}${clip}.mp3`), `public/sfx/${clip}.mp3 is missing`).toBe(true);
      /*
       * ⚠ A clip asked for mid-gesture that was never decoded arrives after
       * the gesture that wanted it, which is not a sound, it is lag.
       */
      expect(VOICE_CLIPS, `${clip} is not preloaded`).toContain(clip);
    }
  });
});

describe("the bench the panel edits on", () => {
  /*
   * The stage shows the DRAFT. Without it, a choice did nothing until the
   * card was saved, the panel reloaded and the card opened again — and the
   * save alone would not have been enough either, because the panel's save
   * does not write into this tab's CATALOG.
   */
  it("is empty in the game, and only the editor fills it", () => {
    const editor = read("../components/CardEditor.tsx");
    expect(editor).toContain("setPreviewCard(draft)");
    expect(editor).toContain("return () => setPreviewCard(null);");
    for (const file of ["../App.tsx", "./useDrag.ts", "../components/DragGhost.tsx"])
      expect(read(file), `${file} must not move the bench`).not.toContain("setPreviewCard");
  });

  it("does not exist as far as a card nobody is editing is concerned", () => {
    bench({ move: "heavy" });
    expect(carryOf("dragons_01_flame_dragon").style).toBe(
      styleFor(CATALOG.get("dragons_01_flame_dragon")!),
    );
  });
});
