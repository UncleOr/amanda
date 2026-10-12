import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVER_ERRORS } from "@amanda/shared";
import { serverError } from "./serverError";

/**
 * The server names a refusal and the client says it in words. That is two
 * halves of one sentence, written in two packages, and nothing in the type
 * system holds them together across the wire — so these do.
 *
 * The failure this exists for is quiet: a code that has no words comes out
 * as the generic "that didn't work", which is true, useless, and looks like
 * nothing is broken.
 */

describe("every refusal the server can send", () => {
  it("has words, and they are not the generic fallback", () => {
    const generic = serverError("something.not.a.code");
    const dumb: string[] = [];
    for (const code of SERVER_ERRORS) {
      const said = serverError(code);
      expect(said, `${code} said nothing`).toBeTruthy();
      if (code !== "retry" && said === generic) dumb.push(code);
    }
    expect(dumb, "these codes fall through to the generic message").toEqual([]);
  });

  it("fills the one code that carries a number", () => {
    const said = serverError("shop.poor:7");
    expect(said).toContain("7");
    // ...and survives the value going missing, rather than printing "{0}".
    expect(serverError("shop.poor")).not.toContain("{0}");
  });

  it("never shows an unknown code to the player", () => {
    for (const raw of ["friend.invented", "no database", "you do not have that card", "???"]) {
      const said = serverError(raw);
      expect(said).not.toContain(raw);
      expect(said).toBe(serverError("some.other.nonsense"));
    }
  });

  it("passes null through, so a call site need not check first", () => {
    expect(serverError(null)).toBeNull();
    expect(serverError(undefined)).toBeNull();
    expect(serverError("")).toBeNull();
  });
});

/**
 * ═══ AND THE OTHER DIRECTION ═══
 *
 * A code the SERVER sends that is not in the shared list would reach the
 * player as the generic message, which is the same quiet failure seen from
 * the other end. The server is plain TypeScript with no import linking its
 * string literals to this list, so the only way to catch it is to read them.
 */
/*
 * The suite runs with its cwd at apps/client, so the server is reached from
 * THIS FILE rather than from a relative path that happens to work in a
 * terminal. fileURLToPath and not .pathname: this repository lives under a
 * Hebrew directory name and a URL percent-encodes it.
 */
const SERVER = fileURLToPath(new URL("../../../server/src", import.meta.url));

describe("the server", () => {
  it("only returns codes the client knows", () => {
    const dir = SERVER;
    const known = new Set<string>(SERVER_ERRORS);
    const bad: string[] = [];
    for (const file of readdirSync(dir)) {
      // The admin panel is a tool for one adult and answers in Hebrew.
      if (!file.endsWith(".ts") || file.startsWith("admin")) continue;
      const src = readFileSync(join(dir, file), "utf8");
      for (const [, code] of src.matchAll(/return\s+"([a-z]+\.[a-zA-Z]+)"/g))
        if (!known.has(code)) bad.push(`${file}: ${code}`);
      // The template form, `shop.poor:${n}`.
      for (const [, code] of src.matchAll(/return\s+`([a-z]+\.[a-zA-Z]+):\$\{/g))
        if (!known.has(code)) bad.push(`${file}: ${code}`);
    }
    expect(bad).toEqual([]);
  });

  it("has no Hebrew left on a player-facing path", () => {
    const bad: string[] = [];
    for (const file of ["friends.ts", "reports.ts"]) {
      const src = readFileSync(join(SERVER, file), "utf8");
      src.split("\n").forEach((l, i) => {
        const code = l.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
        if (/return\s+[`"][^`"]*[֐-׿]/.test(code)) bad.push(`${file}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
