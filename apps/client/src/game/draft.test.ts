import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DECK_RULES,
  DRAFT_PACK,
  DRAFT_ROUNDS,
  DRAFT_SECONDS,
  dealPacks,
  splitDraft,
} from "@amanda/shared";
import { cardPool, CATALOG } from "../data/catalog";

/**
 * **Draft: what you don't take goes to the opponent.**
 *
 * Or's whole specification of the mode is that sentence, so these tests are
 * mostly one assertion said in different ways — because the sentence is easy
 * to break by accident and impossible to notice breaking from inside a match.
 */

/** A fixed generator, so a failure is the same failure twice. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const POOL = cardPool().filter((id) => CATALOG.has(id));

describe("dealing the packs", () => {
  it("deals one pack per card a deck will play", () => {
    // Not a number somebody liked: every monster that reaches a board is
    // chosen here, so the count is the deck's.
    expect(DRAFT_ROUNDS).toBe(DECK_RULES.dealt);
    expect(dealPacks(POOL, DRAFT_ROUNDS, rng(7))).toHaveLength(DRAFT_ROUNDS);
  });

  it("puts two cards on the table and not three", () => {
    /*
     * The pack size IS the fairness. With three, one comes to you and TWO go
     * to the opponent — fifteen against thirty. With two it is one each, and
     * "what you don't take goes to them" is exactly true.
     */
    expect(DRAFT_PACK).toBe(2);
    for (const pack of dealPacks(POOL, DRAFT_ROUNDS, rng(7))) expect(pack).toHaveLength(2);
  });

  it("never offers the same card twice", () => {
    // Passing on a monster and meeting it anyway would make the rule a lie.
    const seen = dealPacks(POOL, DRAFT_ROUNDS, rng(11)).flat();
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("offers only cards the game would have dealt", () => {
    for (const id of dealPacks(POOL, DRAFT_ROUNDS, rng(3)).flat())
      expect(CATALOG.has(id), id).toBe(true);
  });

  it("deals the same draft twice from the same seed", () => {
    expect(dealPacks(POOL, DRAFT_ROUNDS, rng(99))).toEqual(dealPacks(POOL, DRAFT_ROUNDS, rng(99)));
  });

  it("runs out rather than repeating itself", () => {
    // A pool of five cards is two packs and a card left over, not three packs
    // where one card appears twice.
    const packs = dealPacks(["a", "b", "c", "d", "e"], 9, rng(5));
    expect(packs).toHaveLength(2);
    expect(new Set(packs.flat()).size).toBe(4);
  });
});

describe("what you don't take", () => {
  const packs = dealPacks(POOL, DRAFT_ROUNDS, rng(21));
  const took = packs.map((p) => p[0]!);

  it("goes to the opponent, every time", () => {
    const { mine, theirs } = splitDraft(packs, took);
    expect(mine).toEqual(took);
    expect(theirs).toEqual(packs.map((p) => p[1]!));
  });

  it("leaves both sides holding the same number of cards", () => {
    const { mine, theirs } = splitDraft(packs, took);
    expect(mine).toHaveLength(theirs.length);
    expect(mine).toHaveLength(DRAFT_ROUNDS);
  });

  it("gives nobody a card the other side also has", () => {
    const { mine, theirs } = splitDraft(packs, took);
    for (const id of mine) expect(theirs).not.toContain(id);
  });

  it("follows the choice rather than the position", () => {
    // Taking the second card of every pack hands over the first.
    const other = packs.map((p) => p[1]!);
    const { mine, theirs } = splitDraft(packs, other);
    expect(mine).toEqual(other);
    expect(theirs).toEqual(packs.map((p) => p[0]!));
  });

  it("counts nothing from a pack that was never answered", () => {
    const half = took.slice(0, 4);
    const { mine, theirs } = splitDraft(packs, half);
    expect(mine).toHaveLength(4);
    expect(theirs).toHaveLength(4);
  });
});

/* ───────────────────────── the wiring ───────────────────────── */

const MATCH = readFileSync(fileURLToPath(new URL("./useMatch.ts", import.meta.url)), "utf8");

describe("the match it starts", () => {
  /*
   * ⚠ THE ONE THAT WOULD MAKE THE MODE POINTLESS AND LOOK FINE. If the bot's
   * board were planned from the usual random pool, every pick would still
   * work, the screen would still read, and the cards you passed on would
   * simply never turn up. The mode would be a slower way to get a random
   * deck.
   */
  it("plans the opponent's board from the cards you passed on", () => {
    const start = MATCH.slice(MATCH.indexOf("const startDraft"));
    const body = start.slice(0, start.indexOf("const startMirror"));
    expect(body).toContain("generateAiPlan(result.theirs");
  });

  it("gives you the ones you took", () => {
    const start = MATCH.slice(MATCH.indexOf("const startDraft"));
    const body = start.slice(0, start.indexOf("const startMirror"));
    expect(body).toContain("...result.mine");
  });
});

/* ──────────────────── five seconds, and the ℹ button ──────────────────── */

const SCREEN = readFileSync(
  fileURLToPath(new URL("../components/Draft.tsx", import.meta.url)),
  "utf8",
);
const CSS = readFileSync(
  fileURLToPath(new URL("../styles/draft.css", import.meta.url)),
  "utf8",
);

describe("the clock on a pick", () => {
  it("gives five seconds, and says so in one place", () => {
    // Or: *"give up to 5 seconds to choose each card."* A rule of the mode,
    // so it lives beside the pack size and the round count, not in the CSS
    // and the component and the test.
    expect(DRAFT_SECONDS).toBe(5);
    expect(SCREEN).toContain("DRAFT_SECONDS * 1000");
  });

  it("starts again for every pair", () => {
    expect(SCREEN).toContain("useEffect(() => setLeftMs(DRAFT_SECONDS * 1000), [round])");
  });

  it("stops while a card is being read", () => {
    /*
     * ⚠ THE TWO REQUESTS ARE ONE REQUEST. Or asked for the clock and the
     * information button in the same message, and a clock that spends the
     * five seconds you used reading is a button nobody presses twice.
     */
    const run = SCREEN.slice(SCREEN.indexOf("if (reading) return;"));
    expect(run.slice(0, 300)).toContain("window.setInterval");
    expect(SCREEN).toContain("[round, reading]");
  });

  it("takes exactly one card when it runs out, however the renders fall", () => {
    /*
     * ⚠ `take` advances the round and a separate effect resets the clock;
     * React does not promise those land in one frame. Without the guard a
     * second pick fires from a stale zero and eats the next pack without
     * ever drawing it — fifteen rounds become fourteen and nobody can say
     * which card they lost.
     */
    expect(SCREEN).toContain("tookAt.current === round");
    expect(SCREEN).toContain("tookAt.current = round");
  });

  it("and the card it takes comes from the seed, not from a fresh die", () => {
    /*
     * ⚠ THE ONE PROPERTY `seed` EXISTS FOR. One seed deals one draft, end to
     * end. A timeout that rolled `Math.random()` would make the same seed
     * produce different decks, silently, and only in the rounds nobody
     * answered in time.
     */
    const made = SCREEN.slice(SCREEN.indexOf("const dealt = dealPacks"));
    const block = made.slice(0, made.indexOf("}, [seed, best])"));
    /*
     * ⚠ THE OBVIOUS ASSERTION HERE IS VACUOUS, and it failed on its first
     * run for both of the reasons it was wrong. `not.toContain("Math.random")`
     * matches the WARNING in the comment above the line, and it matches the
     * perfectly correct `seed ?? Math.floor(Math.random() * …)` that gives an
     * unseeded draft its seed. So the check is on the one expression that
     * matters, not on the file.
     */
    const line = block.split(/\r?\n/).find((l) => l.includes("ranOut:")) ?? "";
    expect(line).toContain("rnd() < 0.5");
    expect(line).not.toContain("Math.random");
    // Drawn AFTER the deal, so asking for it cannot change what was dealt.
    expect(block.indexOf("dealPacks")).toBeLessThan(block.indexOf("ranOut:"));
  });

  it("is a bar rather than a digit, and it is silent", () => {
    /*
     * The pair is the hero of this screen (§1 of the UI rules), so a number
     * counting down would be a second thing to read on a screen whose whole
     * job is a choice between two pictures.
     *
     * And no ticking: this fires fifteen times in a row, against the match
     * countdown's twice, and the sound pipeline's own rule is that anything
     * with a tail is a nuisance by the tenth time you hear it.
     */
    expect(CSS).toContain(".draft__clock");
    expect(SCREEN).toContain('className={`draft__clock');
    const clock = SCREEN.slice(SCREEN.indexOf('draft__clock'));
    expect(clock.slice(0, 400)).not.toContain("sfx.play");
  });
});

describe("looking at a card before choosing it", () => {
  it("gives each of the two an ℹ that opens it", () => {
    // Or: *"add some button that lets me see the info of each card."*
    expect(SCREEN).toContain("onInfo={() => setReading(id)}");
    expect(SCREEN).toContain("<CardDetailModal cardId={reading}");
  });

  it("and the card you tapped ℹ on is not the card you picked", () => {
    /*
     * ⚠ A BUTTON INSIDE A BUTTON. CardView's ℹ is a real <button>; nesting
     * one inside the pick button is invalid markup that browsers un-nest
     * however they like, and the symptom is a tap on ℹ choosing the card.
     * The board solved this the same way years earlier (BoardGrid): the
     * tappable cell is a div with a role.
     */
    const pair = SCREEN.slice(SCREEN.indexOf('className="draft__pair"'));
    const item = pair.slice(0, pair.indexOf("</div>"));
    expect(item).toContain('role="button"');
    expect(item).not.toMatch(/<button[^>]*className="draft__pick"/);
    // And it is still reachable without a mouse, which a bare div is not.
    expect(item).toContain("tabIndex={0}");
    expect(item).toContain("onKeyDown");
  });

  it("and closing it does not close the draft behind it", () => {
    /*
     * The modal is rendered inside the draft's own Overlay, which is the
     * pattern the album and the deck builder already use — `sheetClick`
     * stops a nested sheet's backdrop click from reaching the outer one.
     * What must NOT happen is it being written inside `.modal--draft`,
     * where a tap on it would fall through to the card underneath.
     */
    const draftModal = SCREEN.indexOf('className="modal modal--draft"');
    const closes = SCREEN.indexOf("</div>\n\n      {/*", draftModal);
    expect(closes, "the detail modal is inside the draft panel").toBeGreaterThan(draftModal);
    expect(SCREEN.indexOf("<CardDetailModal")).toBeGreaterThan(closes);
  });
});
