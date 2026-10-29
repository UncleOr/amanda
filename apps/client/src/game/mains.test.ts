import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALL_MAINS,
  FAMILY_MAINS,
  STARTER_ALBUM,
  isCollectable,
  isMain,
  mainsOf,
} from "@amanda/shared";
import { CATALOG, SERIES } from "../data/catalog";
import { MAINS_WITHOUT_A_VOICE } from "./cardSound";
import { voiceFor } from "./cardSound";

/**
 * **The two cards each family is met through.**
 *
 * Or: *"pick which 2 from each series are the main ones, that are the first
 * ones you get, and that also say their own name when you tap them, in a
 * fitting voice."*
 *
 * ═══ WHY THESE ARE PINNED AT ALL ═══
 *
 * Because the sentence is three promises that only mean anything together,
 * and each of them breaks silently and separately:
 *
 *   A MAIN THAT IS NOT A CARD. One wrong digit in the list and a family is
 *   met through nothing, which looks exactly like the draw being ordinary.
 *
 *   A MAIN YOU CANNOT BE GIVEN. A card that is not collectable cannot come
 *   out of a chest, so naming one as the card a family is met through is
 *   naming a card nobody ever meets.
 *
 *   A MAIN THAT IS NOT FIRST. Four of these families are already in the
 *   album before the first match, so for those four "the first ones you
 *   get" was decided in decks.ts and not here. Picking a main outside the
 *   starter album for one of them makes the claim false on day one — and
 *   there is no screen anywhere that would show it.
 */
const card = (id: string) => CATALOG.get(id);

describe("which cards a family is met through", () => {
  it("names cards that exist", () => {
    expect(ALL_MAINS.length).toBeGreaterThan(10);
    for (const id of ALL_MAINS) expect(card(id), `${id} is not a card`).toBeDefined();
  });

  it("names cards that can actually be won", () => {
    for (const id of ALL_MAINS)
      expect(isCollectable(card(id)!), `${id} can never come out of a chest`).toBe(true);
  });

  it("puts each one in the family it is a main of", () => {
    for (const [seriesId, ids] of Object.entries(FAMILY_MAINS))
      for (const id of ids) expect(card(id)!.seriesId, id).toBe(seriesId);
  });

  it("gives two to every family that has two to give", () => {
    for (const s of SERIES) {
      const playable = s.cards.filter(isCollectable);
      if (!playable.length) continue; // the Legends: Amanda is the opponent
      const want = Math.min(2, playable.length);
      expect(mainsOf(s.id).length, `${s.id} has ${playable.length} cards`).toBe(want);
    }
  });

  it("names nobody twice", () => {
    expect(new Set(ALL_MAINS).size).toBe(ALL_MAINS.length);
  });

  /*
   * ⚠ THE ONE THAT MAKES THE CLAIM TRUE ON DAY ONE. The Dragons, the
   * Giants, the Plants and the Furries are in the album before a match is
   * played, so their mains cannot be chosen freely: whatever the starter
   * album holds IS the first card of that family you get.
   */
  it("agrees with the starter album about the families it covers", () => {
    const starter = [...STARTER_ALBUM] as string[];
    const families = new Set(starter.map((id) => card(id)!.seriesId));
    expect(families.size).toBeGreaterThan(3);
    for (const seriesId of families)
      for (const id of mainsOf(seriesId))
        expect(starter, `${id} is a main of a family you already own`).toContain(id);
  });
});

/* ───────────────────────── the voice ───────────────────────── */

describe("saying its own name", () => {
  const SRC = readFileSync(fileURLToPath(new URL("./cardSound.ts", import.meta.url)), "utf8");

  /*
   * Every main is written into MAIN_NAME, recorded or not. The nulls are
   * the point: `sfx.voice` is silent on a missing clip, so a main simply
   * left out of the table is indistinguishable from one whose recording was
   * never made — and it would stay that way until somebody tapped all of
   * them and listened.
   */
  it("accounts for every main, recorded or not", () => {
    const block = SRC.slice(SRC.indexOf("const MAIN_NAME"), SRC.indexOf("MAINS_WITHOUT_A_VOICE"));
    for (const id of ALL_MAINS)
      expect(block, `${id} is a main nobody decided about`).toContain(`${id}:`);
  });

  it("speaks for the ones that have a clip", () => {
    const speaking = ALL_MAINS.filter((id) => voiceFor(id).name);
    expect(speaking.length).toBeGreaterThan(5);
    for (const id of speaking) expect(voiceFor(id).name).toMatch(/^card-name-/);
  });

  it("keeps the ones with no clip silent rather than pointing at a 404", () => {
    for (const id of MAINS_WITHOUT_A_VOICE) expect(voiceFor(id).name).toBeUndefined();
    // And they are mains, not an unrelated list that drifted.
    for (const id of MAINS_WITHOUT_A_VOICE) expect(isMain(id)).toBe(true);
  });

  it("lets a card that is not a main have a voice too", () => {
    // The biggest card in a family is a perfectly good reason to speak.
    expect(isMain("slimes_10_zelig_giant_ooze")).toBe(false);
    expect(voiceFor("slimes_10_zelig_giant_ooze").name).toBe("card-name-zelig");
  });

  it("lets one card override what the table gives it", () => {
    // MAIN_NAME sits between the series and the card, so CARDS still wins —
    // the merge order Or asked for holds for names as well as for cries.
    const order = SRC.slice(SRC.indexOf("export function voiceFor"));
    expect(order.indexOf("...(spoken")).toBeLessThan(order.indexOf("...CARDS[cardId]"));
  });
});

/* ───────────────────────── where it is heard ───────────────────────── */

describe("when a card says its name", () => {
  const APP = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
  const SFX = readFileSync(fileURLToPath(new URL("./sfx.ts", import.meta.url)), "utf8");

  /*
   * ⚠ ONE GESTURE, AND IT IS NOT "OPENING THE CARD".
   *
   * `openInfo` is the one door every screen opens a card through, so putting
   * the voice there is a single line that reaches the album, the deck
   * builder, the rack and the hand. It was there for an afternoon. Or:
   *
   *   *"the voice should be said when you press, before the drag. Not every
   *   time you press it. That is just annoying. Trust me, that is how it is
   *   in Marvel Snap and it is great."*
   *
   * The convenient place and the right place are different places, and this
   * is the kind of difference a test is for: the next person to want a card
   * to speak will find the same one-line door and the same reason it looks
   * right.
   */
  it("says it on the press that picks the card up", () => {
    expect(APP).toContain("sfx.voice(voiceFor(m.hand!).name)");
    expect(APP).toContain("if (!ACTIONS.has(id)) sfx.voice(voiceFor(id).name);");
  });

  it("says nothing when a card is merely opened to be read", () => {
    const door = APP.slice(APP.indexOf("const openInfo"), APP.indexOf("const showBoards"));
    expect(door, "openInfo speaks again — see the comment above it").not.toContain("sfx.voice");
  });

  it("will not lay a voice over itself", () => {
    // Several cards of one element dying together share a cry, and two
    // copies of one clip a tenth of a second apart do not sound like a
    // stutter — they sound like a broken recording.
    expect(SFX).toContain("if (now - (spokenAt.get(slug) ?? -Infinity) < 350) return;");
  });
});

/* ───────────────────────── the recording desk ───────────────────────── */

describe("the nine that still have to be recorded", () => {
  /*
   * ⚠ THE GAP THAT CLOSES ITSELF WRONG. A clip is made by `pnpm art:voices`
   * from a spec in packages/art, and read by the client from a slug in
   * MAIN_NAME. Those are two files that have to agree on a filename, and
   * when they do not the result is a clip that exists, a card that is
   * silent, and nothing anywhere that says so — the most expensive shape of
   * this failure, because the money has already been spent.
   */
  const VOICES = readFileSync(
    fileURLToPath(new URL("../../../../packages/art/src/voices.ts", import.meta.url)),
    "utf8",
  );
  const specs = [
    ...VOICES.matchAll(/id: "(card-name-[a-z-]+)",\s+cardId: "([a-z_0-9]+)"/g),
  ];

  it("has a spec for every main, recorded or not", () => {
    const byCard = new Map(specs.map((m) => [m[2]!, m[1]!]));
    for (const id of ALL_MAINS)
      expect(byCard.get(id), `${id} has no voice spec in packages/art`).toBeDefined();
  });

  it("agrees with the client about what each clip is called", () => {
    for (const [, slug, cardId] of specs) {
      const want = voiceFor(cardId!).name;
      // A spec whose clip is not recorded yet has nothing to disagree with.
      if (!want) continue;
      expect(want, `${cardId} is recorded as ${slug} and played as ${want}`).toBe(slug);
    }
  });

  /*
   * Or, when the two-per-family pick was first reported back to him: *"hold
   * on, did you cancel it? Because Mother Tree and Zelig also made sounds
   * and that is great for me. I meant AT LEAST 2 voices."*
   *
   * So two is a floor and not a quota, and the pair in mains.ts is about
   * which cards a family is MET through — a different question that happens
   * to share an answer. Nothing stops a third card speaking, and three of
   * them already do: Lava, the Titan King, Zelig and the Great Mother Tree
   * are none of them mains.
   *
   * Pinned against the SPECS rather than the mp3s on disk, because the
   * recordings are bought one run at a time and the plan should hold before
   * the money is spent.
   */
  it("plans at least two voices for every family with two cards", () => {
    const planned = new Map<string, number>();
    for (const [, , cardId] of specs) {
      const seriesId = card(cardId!)!.seriesId;
      planned.set(seriesId, (planned.get(seriesId) ?? 0) + 1);
    }
    for (const s of SERIES) {
      const playable = s.cards.filter(isCollectable).length;
      if (playable < 2) continue; // the Furries and the Demons are one card
      expect(planned.get(s.id) ?? 0, `${s.id} has ${playable} cards`).toBeGreaterThanOrEqual(2);
    }
  });

  it("lets more than two of a family speak, which is the point of a floor", () => {
    const extras = [...CATALOG.values()].filter((c) => voiceFor(c.id).name && !isMain(c.id));
    expect(extras.map((c) => c.id).sort()).toContain("plants_10_great_mother_tree");
    expect(extras.map((c) => c.id).sort()).toContain("slimes_10_zelig_giant_ooze");
    expect(extras.length, "every voice in the game belongs to a main").toBeGreaterThan(2);
  });

  it("leaves nothing to pay for — all sixteen say their name", () => {
    /*
     * This said 9 for a fortnight: the list Or was quoted a price for. He
     * said *"run art:voices"* on 2026-10-29 and the nine arrived, so the
     * number is zero and the measurement is now the other way round — if
     * one reappears, somebody wired a main to a clip that does not exist,
     * and the only symptom would be a card that stopped speaking.
     */
    expect(MAINS_WITHOUT_A_VOICE).toEqual([]);
    for (const id of ALL_MAINS) expect(voiceFor(id).name, `${id} is silent`).toBeTruthy();
  });
});
