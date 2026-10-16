/**
 * Which day is somebody's birthday.
 *
 * One line of code and worth a test for one reason: it decides who gets a
 * gold chest, and the obvious implementation of it — build two Dates and
 * compare their months and days — is wrong in a way that only shows up for
 * some players, in some timezones, at some hours of the day. `birth_date` is
 * a calendar date with no time and no zone; `new Date("1989-10-16")` is
 * midnight UTC, which in Jerusalem is 03:00 on the 16th in winter and 03:00
 * on a different clock in summer. Compare the two strings and none of that
 * can happen.
 */
import { describe, expect, it } from "vitest";
import { israelDay } from "@amanda/shared";
import { isBirthday } from "./birthday.js";

describe("whose birthday it is", () => {
  it("matches on the month and day, whatever the year", () => {
    expect(isBirthday("1989-10-16", "2026-10-16")).toBe(true);
    expect(isBirthday("2019-10-16", "2026-10-16")).toBe(true);
  });

  it("does not match a different day", () => {
    expect(isBirthday("1989-10-15", "2026-10-16")).toBe(false);
    expect(isBirthday("1989-11-16", "2026-10-16")).toBe(false);
  });

  /*
   * The same date in two timezones is the failure this is shaped to avoid.
   * 22:00 on the 15th in London is already the 16th in Jerusalem, and the
   * player whose birthday it is lives in Jerusalem.
   */
  it("uses the Israeli day, not the machine's", () => {
    const lateOnTheFifteenth = new Date("2026-10-15T21:30:00Z");
    expect(israelDay(lateOnTheFifteenth)).toBe("2026-10-16");
    expect(isBirthday("1989-10-16", israelDay(lateOnTheFifteenth))).toBe(true);
  });

  it("is not fooled by a birth date that is only a prefix match", () => {
    // "2026-10-1" would match "2026-10-16" under a startsWith.
    expect(isBirthday("1989-10-01", "2026-10-16")).toBe(false);
  });

  /*
   * A leap-day birthday lands in the years it exists in and not otherwise.
   * Choosing 28 February or 1 March on somebody's behalf is a decision for
   * whoever has that birthday, not for this file — but it should at least be
   * a decision somebody made on purpose, so it is written down here.
   */
  it("leaves 29 February alone", () => {
    expect(isBirthday("2000-02-29", "2024-02-29")).toBe(true);
    expect(isBirthday("2000-02-29", "2026-02-28")).toBe(false);
    expect(isBirthday("2000-02-29", "2026-03-01")).toBe(false);
  });
});
