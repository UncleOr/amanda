import { describe, expect, it } from "vitest";
import {
  challengesFor,
  challengesIn,
  israelDay,
  periodEndsOn,
  periodKey,
  progressFrom,
  type MatchFacts,
  type Pools,
} from "@amanda/shared";

const POOLS: Pools = {
  cards: [
    { id: "lion_a", he: "אריה", en: "Lion" },
    { id: "slime_b", he: "ריר", en: "Slime" },
    { id: "ghost_c", he: "רוח", en: "Ghost" },
  ],
  series: [
    { id: "lions", he: "אריות", en: "The Lions" },
    { id: "slimes", he: "רירים", en: "The Slimes" },
  ],
};

/** Noon UTC, so no test here is sitting on a midnight boundary by accident. */
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("the day ends in Israel", () => {
  it("reads the calendar date in Jerusalem, not in UTC", () => {
    // 22:30 UTC on the 6th is already the 7th in Israel (UTC+3 in October).
    expect(israelDay(new Date("2026-10-06T22:30:00Z"))).toBe("2026-10-07");
    expect(israelDay(new Date("2026-10-06T06:00:00Z"))).toBe("2026-10-06");
  });

  it("starts the week on Sunday", () => {
    // 2026-10-07 is a Wednesday; the Sunday before it is the 4th.
    expect(periodKey("weekly", at("2026-10-07"))).toBe("2026-10-04");
    expect(periodKey("weekly", at("2026-10-04"))).toBe("2026-10-04");
    // ...and the Saturday after is still the same week.
    expect(periodKey("weekly", at("2026-10-10"))).toBe("2026-10-04");
    expect(periodKey("weekly", at("2026-10-11"))).toBe("2026-10-11");
  });

  it("keys the month by the month", () => {
    expect(periodKey("monthly", at("2026-10-31"))).toBe("2026-10");
    expect(periodKey("monthly", at("2026-11-01"))).toBe("2026-11");
  });

  it("ends each period on the first day that is outside it", () => {
    expect(periodEndsOn("daily", at("2026-10-07"))).toBe("2026-10-08");
    expect(periodEndsOn("weekly", at("2026-10-07"))).toBe("2026-10-11");
    expect(periodEndsOn("monthly", at("2026-10-07"))).toBe("2026-11-01");
    // Across a month end, and across a year end.
    expect(periodEndsOn("daily", at("2026-10-31"))).toBe("2026-11-01");
    expect(periodEndsOn("daily", at("2026-12-31"))).toBe("2027-01-01");
    expect(periodEndsOn("monthly", at("2026-12-15"))).toBe("2027-01-01");
  });

  /*
   * The point of the whole module: the day a challenge is live is never
   * decided twice. If the key and the end-date ever disagree about which day
   * a period covers, a player loses progress at a boundary.
   */
  it("agrees with itself: a period's last day ends on the next period's first", () => {
    for (let d = 1; d <= 31; d++) {
      const day = at(`2026-10-${String(d).padStart(2, "0")}`);
      const endsOn = periodEndsOn("daily", day);
      expect(periodKey("daily", day)).not.toBe(endsOn);
      expect(periodKey("daily", new Date(`${endsOn}T12:00:00Z`))).toBe(endsOn);
    }
  });
});

describe("the set for a period", () => {
  it("is three daily, two weekly and one monthly", () => {
    const live = challengesFor(POOLS, at("2026-10-07"));
    expect(live.filter((c) => c.period === "daily")).toHaveLength(3);
    expect(live.filter((c) => c.period === "weekly")).toHaveLength(2);
    expect(live.filter((c) => c.period === "monthly")).toHaveLength(1);
  });

  it("is the same set every time it is asked — this is what lets it not be stored", () => {
    const once = challengesFor(POOLS, at("2026-10-07"));
    const twice = challengesFor(POOLS, new Date("2026-10-07T23:00:00+03:00"));
    expect(twice).toEqual(once);
  });

  it("is a different set tomorrow", () => {
    const today = challengesFor(POOLS, at("2026-10-07")).map((c) => c.id);
    const tomorrow = challengesFor(POOLS, at("2026-10-08")).map((c) => c.id);
    expect(tomorrow).not.toEqual(today);
  });

  it("never gives the same challenge twice in one period", () => {
    for (let d = 1; d <= 28; d++) {
      const day = at(`2026-10-${String(d).padStart(2, "0")}`);
      const ids = challengesFor(POOLS, day).map((c) => c.id);
      expect(new Set(ids).size, `duplicate challenge on day ${d}`).toBe(ids.length);
    }
  });

  it("gives a full set on every day of a year, with a reward and a sentence", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 365; i++) {
      const day = new Date(start + i * 86_400_000 + 12 * 3600_000);
      const live = challengesFor(POOLS, day);
      expect(live, `short set on ${israelDay(day)}`).toHaveLength(6);
      for (const c of live) {
        expect(c.he.length, `empty sentence on ${c.id}`).toBeGreaterThan(3);
        expect(c.need).toBeGreaterThan(0);
        const paid = (c.reward.diamonds ?? 0) + (c.reward.nachos ?? 0);
        expect(paid, `${c.id} pays nothing`).toBeGreaterThan(0);
      }
    }
  });

  /*
   * A template that names a card asks the pools for one. An empty pool used to
   * be the way this returned a short set; now it skips the template and walks
   * on, so a catalogue that has not loaded yet still gives a usable screen.
   */
  it("still fills the set when there are no cards to name", () => {
    const bare = challengesFor({ cards: [], series: [] }, at("2026-10-07"));
    expect(bare.length).toBeGreaterThan(0);
    for (const c of bare) expect(c.goal.kind).not.toBe("playCard");
  });

  it("keeps an id stable for as long as the challenge is live", () => {
    const morning = challengesIn("daily", periodKey("daily", at("2026-10-07")), POOLS);
    const evening = challengesIn(
      "daily",
      periodKey("daily", new Date("2026-10-07T20:00:00+03:00")),
      POOLS,
    );
    expect(evening.map((c) => c.id)).toEqual(morning.map((c) => c.id));
  });
});

describe("whether a match counted", () => {
  const facts = (over: Partial<MatchFacts> = {}): MatchFacts => ({
    won: true,
    score: 7,
    cardIds: ["lion_a", "slime_b"],
    frontSeries: ["lions"],
    backSeries: ["slimes"],
    ...over,
  });

  it("counts playing, always", () => {
    expect(progressFrom({ kind: "play" }, facts({ won: false, score: 1 }))).toBe(1);
  });

  it("counts a win only when it was one", () => {
    expect(progressFrom({ kind: "win" }, facts())).toBe(1);
    expect(progressFrom({ kind: "win" }, facts({ won: false }))).toBe(0);
  });

  it("counts a score at the threshold, not just above it", () => {
    expect(progressFrom({ kind: "score", least: 7 }, facts({ score: 7 }))).toBe(1);
    expect(progressFrom({ kind: "score", least: 8 }, facts({ score: 7 }))).toBe(0);
  });

  it("counts a card that was on the board", () => {
    expect(progressFrom({ kind: "playCard", cardId: "lion_a" }, facts())).toBe(1);
    expect(progressFrom({ kind: "playCard", cardId: "ghost_c" }, facts())).toBe(0);
  });

  it("tells the front row from the back row", () => {
    const goal = { kind: "placeSeries", seriesId: "lions", row: "front" } as const;
    expect(progressFrom(goal, facts())).toBe(1);
    expect(progressFrom({ ...goal, row: "back" }, facts())).toBe(0);
  });
});

/**
 * ═══ AND EVERY ONE OF THEM SAYS IT IN ENGLISH TOO ═══
 *
 * Or, with the panel open in an English game: *"the challenges are in
 * Hebrew."*
 *
 * They were, and nothing could have translated them. Every other string in
 * this game either sits in docs/COPY.md under an id or carries `en` beside
 * its `he` in a data file; a challenge is BUILT at run time out of a
 * template and a card's name, so there was no id to translate and no column
 * to put one in.
 *
 * Which makes this the kind of thing that comes back: the next template
 * somebody adds will be written in Hebrew, because that is how the five
 * above it are written. So the test is over the whole year.
 */
describe("a challenge in English", () => {
  it("exists for every challenge the year can produce", () => {
    const seen = new Set<string>();
    for (let d = 0; d < 365; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d, 12));
      for (const c of challengesFor(POOLS, day)) {
        expect(c.en, `${c.id}: ${c.he}`).toBeTruthy();
        seen.add(c.en);
      }
    }
    // Enough different sentences that this is reading real templates.
    expect(seen.size).toBeGreaterThan(10);
  });

  it("is English, not the Hebrew pasted back", () => {
    for (let d = 0; d < 60; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d, 12));
      for (const c of challengesFor(POOLS, day))
        expect(c.en, c.id).not.toMatch(/[\u0590-\u05ff]/);
    }
  });

  /*
   * === A NAME IS NOT ALWAYS A NAME ===
   *
   * Every English family is called "The" something — The Giants, The Slimes —
   * and one template uses that name as an adjective. It read "Put a The
   * Giants card in the back row", and it was found the way copy bugs are
   * always found: on a screen, in a frame of the trailer.
   */
  it("never puts an article in front of an article", () => {
    for (let d = 0; d < 365; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d, 12));
      for (const c of challengesFor(POOLS, day)) {
        expect(c.en, c.id).not.toMatch(/\b(a|an|the)\s+the\s/i);
      }
    }
  });

  it("names the card or the family it is about", () => {
    // The two templates that take a name out of the pools must take the
    // ENGLISH one — the half of this that a `en: he` typo would pass.
    const names = ["Lion", "Slime", "Ghost", "The Lions", "The Slimes"];
    let named = 0;
    for (let d = 0; d < 120; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d, 12));
      for (const c of challengesFor(POOLS, day))
        if (names.some((n) => c.en.includes(n))) named++;
    }
    expect(named, "no challenge ever named anything").toBeGreaterThan(0);
  });
});
