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

/**
 * ═══ AND THEN OR LOOKED AT THE WHOLE SCREEN ═══
 *
 * *"And in general it has become a mess in the character editing interface,
 * so tidy it a bit into a sensible, comfortable order so I can go over them
 * with Hod."*
 *
 * The mess was real and it was mostly ORDER: the picture at the bottom and
 * the preview at the top, the "is it in the game" tick buried in the middle
 * of the numbers with two paragraphs after it, and a heading that said
 * "powers" over the elements while explaining what a level-up adds.
 *
 * An order cannot be measured for being sensible. What it can be held to is
 * being THE ONE THAT WAS AGREED — so it is written down here, and a section
 * that wanders has to wander past this test.
 */
describe("the order of the form", () => {
  const headings = [...SRC.matchAll(/<h4 className="ed__h">\s*\n\s*([^\n<]+)/g)].map((m) =>
    m[1]!.trim(),
  );

  it("goes from who it is to what it does to how it is tuned", () => {
    expect(headings).toEqual([
      /*
       * ⚠ "ביד" IS SECOND, AND IT WAS SEVENTH. Or, looking at the panel
       * after it shipped: *"I do not see a choice of movement and animation
       * and sound."* It was there — measured in the deployed bundle — and
       * it was under the numbers and the board movement, which is a long
       * way down a form on a 390px-tall screen.
       *
       * It belongs beside the card anyway: it is the only section you check
       * by DRAGGING the thing in the sticky column, so it goes where the
       * column is. The tuning follows after.
       */
      "ביד",
      "תמונה",
      "יסודות",
      "יכולות",
      "מספרים",
      "תנועה בקרב",
      "במשחק",
    ]);
  });

  it("opens with the card itself and the words on it", () => {
    // Name, story and family before any of the headings above — this is the
    // part he reads out loud with a seven-year-old.
    const first = SRC.indexOf('<h4 className="ed__h">');
    const head = SRC.slice(0, first);
    for (const field of ["שם (עברית)", "סיפור (עברית)", "סדרה"])
      expect(head, `${field} is not in the opening block`).toContain(field);
  });

  it("keeps the card on the screen beside all of it", () => {
    /*
     * The preview was the first row of a column, so by the time you reached
     * the numbers — or the three lists about the feel of the card in your
     * hand — the card had scrolled off the top. It is a sticky column now.
     */
    expect(SRC).toContain('<div className="ed__fields">');
    const css = readFileSync(fileURLToPath(new URL("../admin.css", import.meta.url)), "utf8");
    const form = css.slice(css.indexOf(".ed__form {"), css.indexOf(".ed__fields {"));
    expect(form).toContain("display: grid");
    const preview = css.slice(css.indexOf(".ed__preview {"));
    expect(preview.slice(0, preview.indexOf("}"))).toContain("position: sticky");
    /*
     * ⚠ AND THE WRAPPER MUST NOT BE A SCROLL CONTAINER. `.ed` said
     * `overflow: hidden`, which makes it the scrolling ancestor every sticky
     * inside it sticks to — a box that never scrolls. Measured at 1100x740:
     * the card sat 886px above the top of the screen. The card LIST has been
     * written sticky since it was built and was broken the same way, unseen,
     * from the day the panel started scrolling.
     */
    const ed = css
      .slice(css.indexOf(".ed {"), css.indexOf(".ed__list {"))
      .replace(/\/\*[\s\S]*?\*\//g, ""); // the comment explaining it says it too
    expect(ed).toContain("overflow-x: clip");
    expect(ed, "a hidden overflow kills every sticky below it").not.toContain("overflow: hidden");
  });

  it("keeps an ability row inside the screen Or actually uses", () => {
    /*
     * Measured at 844px — the landscape phone — before it was fixed: a 367px
     * row whose last control started 224px off the left edge, clipped and
     * unreachable. `1fr` cannot go below min-content, and the min-content of
     * these selects grew the day their options were written in Hebrew.
     */
    const css = readFileSync(fileURLToPath(new URL("../admin.css", import.meta.url)), "utf8");
    const row = css.slice(css.indexOf(".ed__ability {"), css.indexOf(".ed__ability-note"));
    expect(row).toContain("minmax(0, 1fr)");
    expect(css).toContain(".ed__ability { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }");
  });

  it("puts the switch that makes a card real next to the save button", () => {
    const live = SRC.indexOf("במשחק\n");
    expect(SRC.indexOf("קיים במשחק")).toBeGreaterThan(live);
    expect(SRC.indexOf("מחולק במשחק")).toBeGreaterThan(live);
    expect(SRC.indexOf('className="ed__actions"')).toBeGreaterThan(SRC.indexOf("מחולק במשחק"));
  });
});

/**
 * ═══ NAMES A PERSON WOULD SAY ═══
 *
 * Or: *"give the behaviours normal names so I understand what is going on
 * there, preferably in Hebrew."* He was choosing between `sideKnockback` and
 * `absorbOnCollision` in a dropdown, in English, in camelCase.
 *
 * The engine's names are still the VALUES — they are what is saved into the
 * card and matched by `switch (ab.type)` — so what these check is that
 * nothing is PRINTED raw any more. The names themselves are in game/vocab.ts
 * and vocab.test.ts measures them against the engine.
 */
describe("the lists are in Hebrew", () => {
  it("prints a name for the trigger and the effect, not the id", () => {
    expect(SRC).toContain("{TRIGGER_HE[t].he}");
    expect(SRC).toContain("{EFFECT_HE[t].he}");
    // The old rows, which printed the enum member itself.
    expect(SRC).not.toMatch(/<option key=\{t\} value=\{t\}>\s*\n\s*\{t\}/);
  });

  it("says under each ability which numbers it reads", () => {
    // A JSON box with no idea what goes in it is a box you type `{}` into
    // forever. The names come out of the engine's own handlers.
    expect(SRC).toContain("function paramHint");
    expect(SRC).toContain('className="ed__ability-note"');
  });

  it("names the elements, the range and the rarity too", () => {
    expect(SRC).toContain("{ELEMENT_HE[el]}");
    expect(SRC).toContain("{RANGE_HE[r].he}");
    expect(SRC).toContain("{RARITY_HE[r]}");
    // And takes the lists from the engine rather than retyping them.
    expect(SRC).not.toContain('{["melee", "ranged", "sniper"]');
    expect(SRC).not.toContain('{["common", "rare", "epic", "legendary"]');
  });
});

/**
 * ═══ THE THREE CHOICES ABOUT THE CARD IN YOUR HAND ═══
 *
 * Or: *"let me choose, for every monster: a drag movement out of a list of
 * movements, a drag sound out of a list of sounds, a drag animation out of a
 * list of animations."*
 *
 * What they DO is measured in game/dragChoice.test.ts. What is here is the
 * panel's half: that all three are offered, that "automatic" is a real row
 * rather than a blank, and that choosing it again leaves no trace.
 */
describe("choosing how a card is carried", () => {
  it("offers all three, by the names he asked for", () => {
    for (const label of ["תנועה בגרירה", "אנימציה בגרירה", "צליל בגרירה"])
      expect(SRC, label).toContain(label);
    expect(SRC).toContain("CARRY_STYLES.map");
    expect(SRC).toContain("DRAG_FX.map");
    expect(SRC).toContain("DRAG_SOUNDS.map");
  });

  it("says what automatic came out as, rather than showing a blank", () => {
    expect(SRC).toContain('<option value="">אוטומטי — {CARRY_HE[autoMove].he}</option>');
    expect(SRC).toContain('<option value="">אוטומטי — {FX_HE[autoFx].he}</option>');
    expect(SRC).toContain('<option value="">אוטומטי — תערובת</option>');
  });

  /*
   * ⚠ AUTOMATIC IS THE ABSENCE OF THE FIELD. `{ drag: {} }` and no `drag` at
   * all would be two states that mean the same thing and compare as
   * different — so a card Or opened, looked at and left alone would save as
   * edited, and the "ships with nothing chosen" measurement in
   * dragChoice.test.ts would stop being true of cards nobody chose for.
   */
  it("leaves no trace when everything is put back to automatic", () => {
    const fn = SRC.slice(SRC.indexOf("const setDrag ="));
    const body = fn.slice(0, fn.indexOf("\n    });"));
    expect(body).toContain("else delete next[key];");
    expect(body).toContain("if (!Object.keys(next).length)");
    expect(body).toContain("const { drag: _gone, ...rest } = d;");
  });

  it("describes what the card comes out as, in words", () => {
    expect(SRC).toContain("תנועה — {CARRY_HE[nowMove].he}");
    expect(SRC).toContain("אנימציה — {FX_HE[nowFx].he}");
    expect(SRC).toContain("צליל — {nowSound}");
  });

  /*
   * ⚠ READ OFF THE DRAFT, NOT THROUGH THE PREVIEW SEAM. The seam is set in
   * an effect, which is one render behind the form — so a line that
   * described the card through it would be describing the card you had a
   * keystroke ago. `dragMixOf` takes the card itself for exactly this.
   */
  it("describes the card being edited and not the one before it", () => {
    expect(SRC).toContain("dragMixOf(draft)");
    expect(SRC).toContain("styleFor(draft)");
  });
});
