import { describe, expect, it } from "vitest";
import { nextCue, type CoachView } from "./coach";
import { CATALOG } from "../data/catalog";

/**
 * The coach teaches rules, so these pin the rules rather than the wording.
 * A tutorial that explains a mechanic the engine does not have is worse than
 * no tutorial, which is the whole reason this file exists.
 */
const base: CoachView = {
  phase: "build",
  hand: null,
  handIsAction: false,
  placements: {},
  king: null,
  discardCount: 0,
  actionBarCount: 0,
};

const find = (pred: (id: string) => boolean) => [...CATALOG.values()].find((c) => pred(c.id))!.id;
const staticTank = [...CATALOG.values()].find(
  (c) => c.launch && c.stats.moveSpeed === 0 && c.stats.hp >= 800,
)!.id;
const flyer = [...CATALOG.values()].find((c) => c.launch && c.flying)!.id;

describe("the coach", () => {
  it("asks for a King before anything else", () => {
    const cue = nextCue({ ...base, hand: staticTank }, new Set());
    expect(cue?.id).toBe("king");
  });

  it("names a static card and points at the guard posts", () => {
    const cue = nextCue({ ...base, hand: staticTank, king: flyer }, new Set());
    expect(cue?.id).toBe("tank");
    expect(cue?.target).toContain("guard");
  });

  /*
   * Since 2026-10-06 the bonus needs the three to be TOUCHING, so these two
   * pin the chain rather than the count: (0,0)–(0,1)–King is a chain of three
   * that share edges, and the same three cards scattered is not.
   */
  it("lights up a touching chain, counting the King as one of the three", () => {
    const dragons = [...CATALOG.values()].filter((c) => c.seriesId === "dragons").slice(0, 2);
    const said = new Set(["king", "tank", "flyer", "action", "weak", "bin", "bar"]);
    const cue = nextCue(
      {
        ...base,
        king: dragons[0]!.id,
        placements: { "0-0": dragons[1]!.id, "0-1": flyer },
      },
      said,
    );
    expect(cue?.id).toBe("synergy");
  });

  it("stays quiet when the same three are scattered", () => {
    const dragons = [...CATALOG.values()].filter((c) => c.seriesId === "dragons").slice(0, 2);
    const said = new Set(["king", "tank", "flyer", "action", "weak", "bin", "bar"]);
    const cue = nextCue(
      {
        ...base,
        king: dragons[0]!.id,
        // Both corners, each diagonal from the King and far from each other.
        placements: { "0-0": dragons[1]!.id, "3-3": flyer },
      },
      said,
    );
    expect(cue?.id).not.toBe("synergy");
  });

  it("sends a flyer to the back instead", () => {
    const cue = nextCue({ ...base, hand: flyer, king: staticTank }, new Set());
    expect(cue?.id).toBe("flyer");
  });

  it("explains an action card as a thing you take, not place", () => {
    const cue = nextCue({ ...base, hand: "energy_boost", handIsAction: true }, new Set());
    expect(cue?.id).toBe("action");
    expect(cue?.text).toContain("לא מניחים");
  });

  it("says each thing only once", () => {
    const said = new Set<string>();
    const view = { ...base, hand: staticTank, king: flyer };
    const first = nextCue(view, said)!;
    said.add(first.id);
    expect(nextCue(view, said)?.id).not.toBe(first.id);
  });

  /**
   * The series bonus counts three of the SAME SERIES anywhere on the board —
   * it is not about them being adjacent. This checks the coach only speaks up
   * when the engine's rule is actually met.
   */
  it("mentions the series bonus only once three of a series are down", () => {
    const dragons = [...CATALOG.values()].filter((c) => c.seriesId === "dragons").slice(0, 3);
    // NOT a dragon: the King stands on your board and counts towards the
    // series total, exactly as it does in the engine. The first version of
    // this test used a dragon as the King, so two placements already made
    // three and it failed against correct code.
    const notADragon = [...CATALOG.values()].find((c) => c.launch && c.seriesId !== "dragons")!.id;
    const two: CoachView = {
      ...base,
      king: notADragon,
      placements: { "0-0": dragons[0]!.id, "0-1": dragons[1]!.id },
      discardCount: 0,
    };
    const said = new Set(["king", "tank", "flyer", "action", "weak", "bin", "bar"]);
    expect(nextCue(two, said)).toBeNull();

    const three = { ...two, placements: { ...two.placements, "0-2": dragons[2]!.id } };
    expect(nextCue(three, said)?.id).toBe("synergy");
  });

  it("says nothing during the battle itself", () => {
    expect(nextCue({ ...base, phase: "battle", hand: staticTank }, new Set())).toBeNull();
  });
});

/**
 * Or wrote the tutorial as a walkthrough, so the ORDER is part of the spec,
 * not an accident of which condition happened to be checked first.
 */
describe("the walkthrough order", () => {
  it("asks for a King before commenting on the card in hand", () => {
    // both are true at once: no King, and a static tank in hand
    const cue = nextCue({ ...base, hand: staticTank }, new Set());
    expect(cue?.id).toBe("king");
  });

  it("talks about the card before the bin", () => {
    // both true: a tank in hand AND something already thrown away
    const cue = nextCue(
      { ...base, hand: staticTank, king: flyer, discardCount: 2 },
      new Set(["king"]),
    );
    expect(cue?.id).toBe("tank");
  });

  it("leaves the fog until the fog actually lifts", () => {
    const said = new Set(["king", "tank", "flyer", "action", "weak", "bin", "synergy"]);
    expect(nextCue({ ...base, king: flyer }, said)).toBeNull();
    expect(nextCue({ ...base, phase: "panic", king: flyer }, said)?.id).toBe("fog");
  });

  it("says 'let us see' only after the fog line", () => {
    const said = new Set(["king", "tank", "flyer", "action", "weak", "bin", "synergy"]);
    const view = { ...base, phase: "panic", king: flyer };
    expect(nextCue(view, said)?.id).toBe("fog");
    said.add("fog");
    expect(nextCue(view, said)?.id).toBe("go");
  });

  it("skips a step whose moment never comes rather than stalling", () => {
    // no tank and no flyer will ever be in hand here; the bin line still lands
    const said = new Set(["king"]);
    const cue = nextCue({ ...base, king: flyer, hand: null, discardCount: 1 }, said);
    expect(cue?.id).toBe("bin");
  });
});

/*
 * The second lesson: what to play against what they played.
 *
 * Two promises, and the second matters more than the first. She may only say
 * these in the panic seconds, because until then their board is fogged and a
 * tip about a card you cannot see is noise. And she may only say them when
 * the counter is really in your hand and the thing it beats is really on
 * their board — a tutorial that teaches a rule you cannot act on is worse
 * than silence.
 */
describe("the second lesson — countering what the opponent played", () => {
  const withAbility = (ability: string) =>
    [...CATALOG.values()].find((c) => c.abilities.some((a) => a.type === ability))?.id;

  const poisoner = withAbility("stackingDot")!;
  const wide = withAbility("aoeRowAttack")!;
  const wall = [...CATALOG.values()].find((c) => c.stats.hp >= 1200)!.id;
  const splitter = withAbility("splitOnDeath")!;

  const panic = (over: Partial<CoachView>): CoachView => ({
    ...base,
    phase: "panic",
    matchNo: 2,
    king: flyer,
    ...over,
  });

  it("says nothing about counters during the first match", () => {
    const cue = nextCue(
      panic({ matchNo: 1, hand: poisoner, opponent: { placements: { "3-1": wall }, king: null } }),
      new Set(),
    );
    expect(cue?.id).not.toBe("x-poison");
  });

  /*
   * It used to wait for panic, on a belief that turned out to be wrong: the
   * opponent's FRONT ROW is visible for the whole ninety seconds of building,
   * and that is the row with the walls and the swarms in it. The caller hands
   * over only the revealed cells, so "can she see it" is settled before this
   * code runs — and an empty board is an empty board.
   */
  it("counters during the build too, where their front row is already showing", () => {
    const cue = nextCue(
      { ...panic({ hand: poisoner, opponent: { placements: { "3-1": wall }, king: null } }), phase: "build" },
      new Set(["king", "tank", "flyer"]),
    );
    expect(cue?.id).toBe("x-poison");
  });

  it("says nothing when the caller has shown her nothing", () => {
    const cue = nextCue(
      panic({ hand: poisoner, opponent: { placements: {}, king: null } }),
      new Set(),
    );
    expect(cue?.id).not.toBe("x-poison");
  });

  it("offers poison when they have a wall and you are holding poison", () => {
    const cue = nextCue(
      panic({ hand: poisoner, opponent: { placements: { "3-1": wall }, king: null } }),
      new Set(),
    );
    expect(cue?.id).toBe("x-poison");
  });

  it("does not offer poison when you are not holding any", () => {
    const cue = nextCue(
      panic({ hand: flyer, opponent: { placements: { "3-1": wall }, king: null } }),
      new Set(),
    );
    expect(cue?.id).not.toBe("x-poison");
  });

  it("does not offer poison when there is no wall to use it on", () => {
    const weakest = [...CATALOG.values()].sort((a, b) => a.stats.hp - b.stats.hp)[0]!.id;
    const cue = nextCue(
      panic({ hand: poisoner, opponent: { placements: { "3-1": weakest }, king: null } }),
      new Set(),
    );
    expect(cue?.id).not.toBe("x-poison");
  });

  it("offers a wide swing against something that multiplies", () => {
    const cue = nextCue(
      panic({ hand: wide, opponent: { placements: { "3-1": splitter }, king: null } }),
      new Set(),
    );
    expect(cue?.id).toBe("x-wide");
  });

  it("offers the burning lane only when they have actually queued a lane up", () => {
    const lava = withAbility("lineDenialDot")!;
    const ant = [...CATALOG.values()].find((c) => c.launch)!.id;
    const spread = nextCue(
      panic({ hand: lava, opponent: { placements: { "3-0": ant, "3-1": ant }, king: null } }),
      new Set(),
    );
    expect(spread?.id).not.toBe("x-lane");
    const queued = nextCue(
      panic({ hand: lava, opponent: { placements: { "3-1": ant, "2-1": ant }, king: null } }),
      new Set(),
    );
    expect(queued?.id).toBe("x-lane");
  });

  it("each counter line is said at most once", () => {
    const view = panic({ hand: poisoner, opponent: { placements: { "3-1": wall }, king: null } });
    const cue = nextCue(view, new Set(["x-poison"]));
    expect(cue?.id).not.toBe("x-poison");
  });
});
