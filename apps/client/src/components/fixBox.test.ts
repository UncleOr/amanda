import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { notesFor, type FixNote } from "./FixBox";

/**
 * **Seeing a card, hearing it, carrying it — and the box under all three.**
 *
 * Or: *"let me also see the card in the panel and hear its voice, and maybe
 * drag it and see how it looks. Leave me a free box to leave you fixes in, in
 * free language. I will tell you here in this chat to go over all the fixes I
 * left you in the arenas and the cards, and you will go over them, fix them,
 * report what was done, put it into the card's fix history in the admin
 * interface, and clear the box for me."*
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const EDITOR = read("./CardEditor.tsx");
const ARENAS = read("./AdminArenas.tsx");
const BOX = read("./FixBox.tsx");
const GHOST = read("./DragGhost.tsx");
const APP = read("../App.tsx");
const CSS = read("../admin.css");

const note = (over: Partial<FixNote>): FixNote => ({
  id: "x",
  scope: "card",
  target: "dragons_01_flame_dragon",
  note: "n",
  status: "open",
  done_note: null,
  created_at: "2026-10-28T00:00:00Z",
  done_at: null,
  ...over,
});

describe("picking out one thing's notes", () => {
  const notes = [
    note({ id: "1" }),
    note({ id: "2", status: "done", done_note: "done it" }),
    note({ id: "3", target: "giants_01_stone_colossus" }),
    note({ id: "4", scope: "arena", target: "dragons_01_flame_dragon" }),
  ];

  it("takes the open one and the history, for that thing only", () => {
    const mine = notesFor(notes, "card", "dragons_01_flame_dragon");
    expect(mine.open?.id).toBe("1");
    expect(mine.done.map((n) => n.id)).toEqual(["2"]);
  });

  /*
   * ⚠ An arena and a card could share an id — nothing stops an arena being
   * called the same thing as a card, and `target` is a bare string on
   * purpose (the database does not know what a card is). Matching on the
   * target alone would show one thing's notes under another.
   */
  it("does not confuse an arena with a card of the same name", () => {
    expect(notesFor(notes, "arena", "dragons_01_flame_dragon").open?.id).toBe("4");
  });

  it("has no open note when there is none", () => {
    expect(notesFor(notes, "card", "nobody").open).toBeNull();
    expect(notesFor(notes, "card", "nobody").done).toEqual([]);
  });
});

describe("the box", () => {
  it("is under a card and under an arena, and is the same box", () => {
    expect(EDITOR).toContain('<FixBox\n            scope="card"');
    expect(ARENAS).toContain('scope="arena"');
    // One component, not two that drift.
    expect(BOX).toContain("export function FixBox");
  });

  it("marks the things that have something waiting", () => {
    // The reason the panel holds every note at once: otherwise "which cards
    // did I leave something on" is a screen of its own that nobody opens.
    expect(EDITOR).toContain('notesFor(notes, "card", e.card.id).open');
    expect(ARENAS).toContain('notesFor(notes, "arena", arena.id).open');
  });

  /*
   * ⚠ THE DRAFT FOLLOWS THE THING, NOT EVERY RENDER. Resetting the textarea
   * whenever `notes` changes identity would wipe a half-typed note the
   * moment anything else in the panel saved.
   */
  it("reloads the draft when the card changes and not otherwise", () => {
    const effect = BOX.slice(BOX.indexOf("useEffect(() => {"));
    expect(effect.slice(0, 300)).toContain("}, [scope, target]);");
  });

  it("shows what was asked and what was done, in that order", () => {
    expect(BOX).toContain("fix__asked");
    expect(BOX).toContain("fix__did");
    expect(BOX.indexOf("fix__asked")).toBeLessThan(BOX.indexOf("fix__did"));
    // The answer is the readable one; the question may be grey.
    const did = CSS.slice(CSS.indexOf(".fix__did"), CSS.indexOf(".fix__when"));
    expect(did).toContain("var(--text)");
  });
});

describe("seeing, hearing and carrying a card", () => {
  /*
   * ⚠ THE PREVIEW THAT WAS NEVER A PREVIEW. `.card` is `height: 100%` and
   * the column above it had no height, so the "picture of the card" at the
   * top of this editor was three pixels of border — and read as an empty gap
   * rather than as a broken card, which is why it went unreported for as
   * long as it did. Or asking to "see the card in the panel" is the same bug
   * in the words of somebody with no reason to know it was supposed to be
   * there already.
   */
  it("gives the stage a height, which is what a card needs to exist", () => {
    const stage = CSS.slice(CSS.indexOf(".ed__stage {"), CSS.indexOf(".ed__stage:active"));
    expect(stage).toContain("aspect-ratio: 3 / 4");
  });

  it("lets a touch drag lift the card instead of scrolling the panel", () => {
    // Invisible on a desktop, and the whole feature on a phone.
    const stage = CSS.slice(CSS.indexOf(".ed__stage {"), CSS.indexOf(".ed__stage:active"));
    expect(stage).toContain("touch-action: none");
  });

  it("carries it with the game's own ghost rather than a second copy", () => {
    // ArenaPreview spent a week showing five families out of nine because
    // its list was typed by hand. One component, two places that render it.
    expect(EDITOR).toContain("<DragGhost drag={drag} />");
    expect(APP).toContain("<DragGhost drag={drag} />");
    expect(GHOST).toContain("export function DragGhost");
    expect(APP.match(/drag-ghost drag-ghost--/g) ?? [], "the markup is in one file").toHaveLength(0);
  });

  it("has nowhere to drop, so a drag in the panel changes nothing", () => {
    expect(EDITOR).toContain("useDrag(() => {})");
  });

  /*
   * ⚠ AND NOT FROM A BUTTON. There was a "play the name" button beside the
   * card for an hour. Or: *"I do not need the play-the-name button, I am
   * supposed to hear it when I drag."* The press that starts a carry is the
   * one gesture that says a card's name in the game, so a button next to it
   * is a second way to hear a thing the panel exists to show as it is.
   */
  it("says the name on the press that starts the carry, and from nowhere else", () => {
    expect(EDITOR).toContain("sfx.voice(voiceFor(draft.id).name)");
    expect(EDITOR, "the play button is back").not.toContain("ed__hear");
    expect((EDITOR.match(/sfx\.voice/g) ?? []).length).toBe(1);
  });

  /*
   * What the button did carry and a drag cannot is the SILENCE. Nine of the
   * sixteen names have no recording yet, and a card that says nothing is
   * indistinguishable from a card whose sound is broken — which is the
   * failure this whole area is written to avoid.
   */
  it("still says out loud when a card has no recording", () => {
    expect(EDITOR).toContain("לשם שלו אין עדיין הקלטה");
  });
});
