import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CATALOG, SERIES } from "../data/catalog";
import { STARTER_ALBUM } from "@amanda/shared";

/**
 * **The card panel, after Or looked at it properly.**
 *
 * Four things in one message: *"I need the cards in the admin panel divided
 * by series. Each one needs a choice of still, walking or flying, and a pace.
 * In the starter pack — why is the Leviathan ticked, say? And I need the
 * picture for each one. With an option to replace the picture."*
 *
 * Read out of the source as text, like every other component rule in this
 * project — there is no jsdom here.
 */
const SRC = readFileSync(fileURLToPath(new URL("./CardEditor.tsx", import.meta.url)), "utf8");

describe("the list is divided by series", () => {
  it("groups the cards rather than sorting ids as text", () => {
    // It was `.sort((a, b) => a.card.id.localeCompare(b.card.id))` — which put
    // the Demons' one card between the Crumb Demon and the Dragons.
    expect(SRC).not.toContain("a.card.id.localeCompare");
    expect(SRC).toContain("const shelves = useMemo");
  });

  it("takes the order of the shelves from the album, not from this file", () => {
    // SERIES is sorted by the order a player MEETS the families, so the panel
    // and the album read the same way down the page. A second order here
    // would be a second answer to "what comes after the Insects".
    expect(SRC).toContain("SERIES.filter((s) => byId.has(s.id))");
  });

  it("orders a shelf by the number in the series", () => {
    expect(SRC).toContain("a.card.numberInSeries - b.card.numberInSeries");
  });

  /*
   * A card whose family the build does not know — invented in the panel, or
   * left behind when a family was renamed — must still be reachable. The
   * Strays were deleted this week; a row of one of theirs that fell through
   * a grouping would be a card nobody could ever edit or switch off again.
   */
  it("keeps a card whose family the build does not have", () => {
    expect(SRC).toContain('out.push({ id: "", name: "בלי סדרה", cards: loose })');
  });

  it("shows every card in the game, under some shelf", () => {
    // Measured rather than asserted about the code: whatever the grouping
    // does, these are the families it has to cover.
    const known = new Set(SERIES.map((s) => s.id));
    const homeless = [...CATALOG.values()].filter((c) => !known.has(c.seriesId));
    for (const c of homeless) expect(c.seriesId, `${c.id} needs the "בלי סדרה" shelf`).toBe("system");
  });
});

describe("still, walking or flying", () => {
  it("is one choice of three, not two fields that disagree", () => {
    expect(SRC).toContain('{ id: "still", he: "נייח"');
    expect(SRC).toContain('{ id: "walks", he: "הולך"');
    expect(SRC).toContain('{ id: "flies", he: "מעופף"');
  });

  /*
   * ⚠ WHY IT CANNOT STAY A TICKBOX PLUS A NUMBER. `flying` does exactly one
   * thing in the engine — it lets a unit pass over whatever is in front of it
   * WHILE IT ADVANCES (flying.test.ts pins the two `if (!u.flying)` lines,
   * both inside movement). So "flying, move speed 0" is a card that is
   * labelled a flyer and behaves as a statue, and the old editor could save
   * one with two clicks and no warning.
   */
  it("writes both fields from the one choice", () => {
    const fn = SRC.slice(SRC.indexOf("function setMove"));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    expect(body).toContain('flying: to === "flies"');
    expect(body).toContain('moveSpeed: to === "still" ? 0 : speed');
  });

  it("gives a card that starts moving a pace instead of leaving it at zero", () => {
    expect(SRC).toContain("const DEFAULT_PACE = { walks: 1, flies: 1.5 }");
  });

  /*
   * ⚠ FOUND BY CLICKING IT. Tapping נייח to see what it does and tapping
   * מעופף back put the Flame Dragon from 1.5 onto 1 — a third slower, with
   * nothing on the screen saying so. A balance change by misclick is the
   * worst kind: the next person to look at the card believes the number.
   */
  it("gives a card back the pace it had before it was made still", () => {
    expect(SRC).toContain("const pace = useRef(0);");
    expect(SRC).toContain("if (d.stats.moveSpeed > 0) pace.current = d.stats.moveSpeed;");
    expect(SRC).toContain("pace.current || DEFAULT_PACE[");
    // And a different card starts from its own pace, not the last one's.
    expect(SRC).toContain("pace.current = entry.card.stats.moveSpeed;");
  });

  it("asks for the pace only when there is something to pace", () => {
    expect(SRC).toContain('move === "still" ? (');
    expect(SRC).toContain("משבצות בשנייה");
  });

  /*
   * attackSpeed is SECONDS BETWEEN BLOWS, so a bigger number is a slower
   * card. The label said only "attack rate", which reads as the opposite —
   * a dial that nerfs a card for somebody trying to buff it.
   */
  it("says which way the attack number runs", () => {
    expect(SRC).toContain("קצב תקיפה — שניות בין מכות");
  });
});

describe("the starter pack question", () => {
  /*
   * Or: *"in the starter pack — why is the Leviathan ticked, say?"* Because
   * the tick was `launch` wearing the wrong label. `launch` is the curated
   * roster — every card the game deals at all — and the Leviathan is in it.
   * The starter pack is eight named cards in decks.ts and is not a per-card
   * property, which is why it is now stated here and not editable.
   */
  it("no longer calls the roster tick the starter pack", () => {
    expect(SRC).not.toContain("בחבילת הפתיחה");
    expect(SRC).toContain("מחולק במשחק");
  });

  it("says plainly whether a card is in the starter pack", () => {
    expect(SRC).toContain("STARTER_ALBUM as readonly string[]).includes(draft.id)");
    expect(SRC).toContain("חבילת הפתיחה של שחקן חדש");
  });

  it("and the Leviathan is not in it", () => {
    // The card that prompted the question, checked against the real list
    // rather than against what the panel says about it.
    const leviathan = [...CATALOG.values()].find((c) => c.name.he.includes("לווייתן"));
    expect(leviathan, "the Leviathan has been renamed — update this test").toBeTruthy();
    expect(STARTER_ALBUM as readonly string[]).not.toContain(leviathan!.id);
    expect(leviathan!.launch, "it IS dealt in the game, which is what the tick means").toBe(true);
  });
});

describe("the picture", () => {
  it("draws one beside every card in the list", () => {
    expect(SRC).toContain('<img className="ed__thumb" src={artUrl(e.card.art.sprite)}');
  });

  it("offers to replace it with a file from the computer", () => {
    expect(SRC).toContain('type="file"');
    expect(SRC).toContain("החלף תמונה");
    expect(SRC).toContain("upload(art, draft.id)");
  });

  /*
   * The bucket refuses anything over 2MB and Or's source pictures are phone
   * photos and exports. Refusing them would be correct and useless, so they
   * are shrunk here first — without this the button works for the files I
   * made and fails for every file he has.
   */
  it("shrinks and re-encodes before uploading", () => {
    expect(SRC).toContain("768 / Math.max(bitmap.width, bitmap.height)");
    expect(SRC).toContain('"image/webp", 0.9');
  });

  it("holds no credentials of its own", () => {
    // Same rule the file was written with: the panel supplies `call`, `say`
    // and now `upload`, so there is one place that knows who is signed in.
    expect(SRC).not.toContain("createClient");
    expect(SRC).toContain("upload: (file: Blob, cardId: string)");
  });
});
