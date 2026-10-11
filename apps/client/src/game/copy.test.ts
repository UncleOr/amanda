/**
 * Filling the slots in a line that carries values.
 *
 * The battle report is almost entirely these — "המלך {0} נפל כבר בשנייה {1}"
 * — and it is the one screen a player reads after every single match. It is
 * also awkward to reach in a browser, needing a whole match played out, so
 * the substitution is pinned here instead.
 */
import { describe, it, expect } from "vitest";
import { lineF } from "./copy";

/** An id with no override and no English: lineF falls through to the shipped text. */
const UNKNOWN = "test-no-such-id";

describe("a line with values in it", () => {
  it("fills the slots in order", () => {
    expect(lineF(UNKNOWN, "המלך {0} נפל כבר בשנייה {1}", "צ׳ופי", 7)).toBe(
      "המלך צ׳ופי נפל כבר בשנייה 7",
    );
  });

  it("fills a slot used before another and a slot at the very end", () => {
    expect(lineF(UNKNOWN, "{0} עשה {1}% מהנזק", "הדרקון", 62)).toBe("הדרקון עשה 62% מהנזק");
    expect(lineF(UNKNOWN, "עוד {0}", "3 ימים")).toBe("עוד 3 ימים");
  });

  it("leaves a slot standing when nothing was passed for it", () => {
    // A translation with one slot too many should read as a mistake in the
    // translation. "undefined" in the middle of a Hebrew sentence reads as a
    // crash, and would be reported as one.
    expect(lineF(UNKNOWN, "המלך {0} נפל בשנייה {1}", "צ׳ופי")).toBe("המלך צ׳ופי נפל בשנייה {1}");
  });

  it("passes a zero through, rather than treating it as missing", () => {
    expect(lineF(UNKNOWN, "נותרו {0} קלפים", 0)).toBe("נותרו 0 קלפים");
  });

  it("leaves a line with no slots alone", () => {
    expect(lineF(UNKNOWN, "הקרב נגמר", "unused")).toBe("הקרב נגמר");
  });
});
