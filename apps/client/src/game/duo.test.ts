import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COOP_LANES } from "@amanda/shared";

/**
 * **2 against 2: eight lanes a side, and you fill four of them.**
 *
 * Or: *"2v2 — two build one board."* The board already knew how to be that;
 * Amanda mode is two people arranging one eight-lane side, and this is the
 * same side with an ordinary pair of boards facing it instead of her.
 *
 * Read out of the source as text, like every other component rule here.
 */
const MATCH = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");
const APP = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");

const startDuo = (() => {
  const from = MATCH.indexOf("const startDuo");
  return MATCH.slice(from, MATCH.indexOf("const startDraft", from));
})();

describe("the shape of a 2v2", () => {
  it("is eight lanes, not four", () => {
    expect(COOP_LANES).toBe(8);
    expect(MATCH).toContain("soloAmandaRef.current || duoRef.current ? { lanes: COOP_LANES }");
  });

  it("puts a partner in the other four lanes", () => {
    expect(startDuo).toContain("duoBoardsRef.current = { mate: lower(mate), foes };");
  });

  it("faces two boards and not one", () => {
    // `lower` pushes a board down by four lanes, so the enemy side is a pair.
    const foes = startDuo.slice(startDuo.indexOf("const foes"));
    expect(foes.slice(0, foes.indexOf("]"))).toContain("lower(fillCrumbs(generateAiPlan");
  });

  /*
   * ⚠ THE BUG AMANDA MODE HAD, THE OTHER WAY ROUND. Or: *"when the fog
   * lifted, Amanda's King was the Insect Empress, and then in the battle
   * itself it changed to Amanda."* Two different opponents, one match —
   * because the board you LOOKED at was generated separately from the board
   * that fought. All three boards here are decided before the countdown.
   */
  it("fights the half you watched being built", () => {
    expect(startDuo).toContain("setMate(");
    const battle = MATCH.slice(MATCH.indexOf("const startBattle"));
    expect(battle.slice(0, battle.indexOf("soloBoardsRef"))).toContain(
      "duoBoardsRef.current.mate",
    );
  });
});

describe("what the screen must not say", () => {
  /*
   * Both modes are `coop`, so every `coop` the screen reads as "this is
   * Amanda" is wrong in a 2v2. There were two, and both were visible in the
   * first screenshot: the enemy was labelled with her name, and the
   * countdown said "together" over a card showing you against them.
   */
  it("does not call the opponent Amanda", () => {
    expect(APP).toContain('{m.coop && !m.duo ? (\n                      t("s9d29f31", "אמנדה")');
  });

  it("does not say you are on the same side as them", () => {
    expect(APP).toContain("joined={m.coop && !m.duo}");
  });
});

/* ───────────────────────── the eight-lane screen ───────────────────────── */

const SOCIAL = readFileSync(
  fileURLToPath(new URL("../styles/social.css", import.meta.url)),
  "utf8",
);
const BATTLE = readFileSync(
  fileURLToPath(new URL("../styles/battle.css", import.meta.url)),
  "utf8",
);
const ARENA = readFileSync(
  fileURLToPath(new URL("../components/Arena.tsx", import.meta.url)),
  "utf8",
);

describe("eight lanes on a 384-tall screen", () => {
  /*
   * ⚠ Two bugs that were in Amanda mode before 2v2 existed, both found by
   * building on the same layout and looking at it on a phone.
   */
  it("orders the two halves whichever one is drawn", () => {
    // These rules named `.mate--theirs`, which MatePeek only renders where
    // there is room. On a phone it renders `.mate--peek`, took order 0, and
    // sat ABOVE the board at order 1 — with "your half" captioning your
    // partner's cards.
    expect(SOCIAL).toContain(".side--split .mate { order: 2; }");
    expect(SOCIAL).toContain(".side--low.side--split .mate { order: -2; }");
  });

  it("makes the frame carry the shape, so a percentage has something to measure", () => {
    // `.arena` is content-sized, so `max-height: 100%` inside it never
    // resolved and the canvas kept its intrinsic 602px in a 332px frame.
    expect(ARENA).toContain('["aspectRatio" as string]: `${W} / ${H}`');
  });

  it("beats the size Pixi writes onto the canvas itself", () => {
    // Pixi sets `width: 576px; height: 602.4px` inline, and an inline style
    // beats a stylesheet — which is why the fit rule had never once applied.
    expect(BATTLE).toContain("width: 100% !important;");
    expect(BATTLE).toContain("height: 100% !important;");
  });
});
