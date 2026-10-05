import { describe, expect, it } from "vitest";
import { MIN_AGE, ageFrom } from "./account";

/**
 * The age floor exists for a reason, so it is pinned here as arithmetic rather
 * than trusted to a date input. The same rule is a CHECK on the row, so a
 * client that skips this cannot write a birthday that is too recent either.
 */
describe("age", () => {
  // Built from LOCAL parts. toISOString() converts to UTC first, which east of
  // UTC in the evening yields yesterday — the exact confusion this file is
  // about, and it made the first version of these tests lie.
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yearsAgo = (y: number, extraDays = 0) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - y);
    d.setDate(d.getDate() + extraDays);
    return iso(d);
  };

  it("counts whole years", () => {
    expect(ageFrom(yearsAgo(10))).toBe(10);
  });

  it("does not round a birthday up before it happens", () => {
    // one day short of turning MIN_AGE is still too young
    expect(ageFrom(yearsAgo(MIN_AGE, 1))).toBe(MIN_AGE - 1);
    expect(ageFrom(yearsAgo(MIN_AGE, 1)) < MIN_AGE).toBe(true);
  });

  it("lets you in on the day itself", () => {
    expect(ageFrom(yearsAgo(MIN_AGE))).toBe(MIN_AGE);
  });

  it("the floor is 7", () => {
    expect(MIN_AGE).toBe(7);
  });
});
