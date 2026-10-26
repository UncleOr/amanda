/**
 * **The one Hebrew sentence an English player met every single match.**
 *
 * Or: *"the catchphrases — 'kid kid kid, come and fight' — are still in
 * Hebrew even when the game is in English. They need translating."*
 *
 * They had been translated nowhere, and `phraseText` could not have used a
 * translation if one existed: it returned `he` whatever language was asked
 * for. So the versus screen, which is the first thing you see in a match,
 * carried a Hebrew line into an otherwise English game, for ever.
 *
 * Two things to pin, and the second is the one that rots: every phrase has
 * an English line, and the function actually reads it.
 */
import { describe, expect, it } from "vitest";
import { CATCHPHRASES, NO_PHRASE, phraseText } from "@amanda/shared";

const real = CATCHPHRASES.filter((p) => p.id !== NO_PHRASE);

describe("a catchphrase in English", () => {
  it("there are some, or this file is testing nothing", () => {
    expect(real.length).toBeGreaterThan(5);
  });

  it("exists for every line that can be said", () => {
    for (const p of real) expect(p.en, p.id).toBeTruthy();
  });

  it("is actually what phraseText returns when English is asked for", () => {
    for (const p of real) expect(phraseText(p.id, null, "en"), p.id).toBe(p.en);
  });

  it("leaves Hebrew alone", () => {
    for (const p of real) expect(phraseText(p.id, null, "he"), p.id).toBe(p.he);
  });

  it("is not the Hebrew with the letters still in it", () => {
    // A line somebody "translated" by pasting the Hebrew back is a line
    // that passes the test above and fails the player.
    for (const p of real) expect(p.en, p.id).not.toMatch(/[\u0590-\u05ff]/);
  });

  it("says nothing when nothing was chosen", () => {
    expect(phraseText(NO_PHRASE, null, "en")).toBeNull();
    expect(phraseText(undefined, null, "en")).toBeNull();
  });

  it("still uses the feminine Hebrew line where there is one", () => {
    // The gendered pair is a Hebrew problem — "come and fight" said to a
    // girl is a different word — and English has no such thing to get
    // wrong. Adding `en` must not have quietly broken it.
    const gendered = CATCHPHRASES.filter((p) => p.heF);
    for (const p of gendered) expect(phraseText(p.id, "girl", "he")).toBe(p.heF);
  });
});
