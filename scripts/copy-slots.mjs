/**
 * Shared between the three copy scripts: how an id is made, and how a
 * template literal is turned into something translatable.
 *
 * It lives in its own file because copy-inventory.mjs writes files the moment
 * it is imported, so the other two cannot simply import from it.
 */
import { createHash } from "node:crypto";

/**
 * An id that does not move when the file around it does.
 *
 * These were counters — s1, s2, s3 in walk order — which was fine while they
 * lived only in a document regenerated as a whole. It stops being fine the
 * moment they are written INTO the source and data/copy.en.json is keyed by
 * them: adding one Hebrew string near the top of App.tsx would shift every
 * id after it and silently reattach hundreds of translations to the wrong
 * lines. Derived from the file and the text, adding a string changes nothing
 * but its own id.
 *
 * `counts` is the caller's — each run of the inventory keeps its own, so the
 * second occurrence of the same text in the same file gets a different id.
 */
export function idFor(counts, prefix, file, text) {
  const key = `${file}\u0000${text}`;
  const n = (counts.get(key) ?? 0) + 1;
  counts.set(key, n);
  return prefix + createHash("sha1").update(`${key}\u0000${n}`).digest("hex").slice(0, 7);
}

/**
 * Turn `${e.actor} הפיל את ${e.target}` into `{0} הפיל את {1}` plus the two
 * expressions.
 *
 * ═══ WHY THESE NEED ANYTHING SPECIAL ═══
 *
 * A template literal's text is not the text: half of it is computed when the
 * line runs. The battle report is almost entirely these — "המלך {0} נפל כבר
 * בשנייה {1}" — so leaving them out would leave the screen a player reads
 * after every single match in Hebrew forever.
 *
 * Numbered slots rather than named ones. A name would read better, but it has
 * to be derived from the expression, and `${unit.colsMoved.toFixed(1)}` has
 * no name in it — only `toFixed`, which would be a lie. A number is never
 * wrong, and the Hebrew around it says what belongs there.
 *
 * Returns null when the braces do not balance, which means this is not
 * something to guess at.
 */
export function slotify(raw) {
  const parts = [];
  const exprs = [];
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf("${", i);
    if (open === -1) {
      parts.push(raw.slice(i));
      break;
    }
    parts.push(raw.slice(i, open));
    // Walk to the matching brace, so `${a ?? {b: 1}.b}` survives.
    let depth = 1;
    let j = open + 2;
    let quote = null;
    for (; j < raw.length && depth > 0; j++) {
      const c = raw[j];
      if (quote) {
        if (c === "\\") j++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    if (depth !== 0) return null;
    exprs.push(raw.slice(open + 2, j - 1).trim());
    i = j;
  }
  /*
   * A template ending in an expression leaves the loop with nothing after it,
   * so there is one fewer literal chunk than there are slots — and the last
   * slot would simply vanish. "המלך ${f.name} נפל כבר בשנייה ${secs(...)}"
   * came out as "המלך {0} נפל כבר בשנייה " with the seconds missing.
   */
  while (parts.length <= exprs.length) parts.push("");

  const text = parts.map((p, n) => (n === parts.length - 1 ? p : `${p}{${n}}`)).join("");
  return { text, exprs };
}
