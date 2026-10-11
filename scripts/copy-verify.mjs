/**
 * Un-nest double-wrapped lookups, and make every id in the source agree with
 * the id the document derives for that text.
 *
 *   node scripts/copy-verify.mjs            report
 *   node scripts/copy-verify.mjs --fix      repair, then run `pnpm copy`
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * copy-codemod.mjs skips a string it has already converted by looking for
 * its own id on the line. That is not enough. Regenerating the document
 * gives the text inside an existing call a NEW id of its own — it is, after
 * all, a Hebrew string literal sitting in a source file — and the next run
 * wraps it again:
 *
 *     t("sdb2b008", t("s52b9172", "היריב"))
 *
 * which resolves the inner one and then uses the result as the SHIPPED text
 * for a different id. It still renders, which is why nothing caught it.
 *
 * The second half matters just as much. `t(id, shipped)` only finds English
 * if `id` is the id the document assigned to `shipped`; a mismatch is a
 * string that silently stays Hebrew for ever. Nothing else checks that.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { idFor } from "./copy-slots.mjs";

const FIX = process.argv.includes("--fix");
const map = JSON.parse(readFileSync("docs/copy.map.json", "utf8"));
const byId = new Map(map.map((e) => [e.id, e]));

/** t("id", "text") / tf("id", "text", …) — the id and the shipped string. */
const CALL = /\btf?\("([a-z][0-9a-f]{7})",\s*("(?:[^"\\]|\\.)*")/g;
const NESTED = /\b(tf?)\("([a-z][0-9a-f]{7})",\s*t\("([a-z][0-9a-f]{7})",\s*("(?:[^"\\]|\\.)*")\)/g;

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(p.split("\\").join("/"));
  }
})("apps/client/src");

let unnested = 0;
let remapped = 0;
const unknown = [];

for (const file of files) {
  let s = readFileSync(file, "utf8");
  const before = s;

  // 1 — collapse t("A", t("B", "x")) to the inner call's text, keeping the
  //     outer function (tf carries the arguments) and the outer id; which id
  //     is right gets settled in step 2 against the document.
  s = s.replace(NESTED, (_, fn, outer, _inner, text) => {
    unnested++;
    return `${fn}("${outer}", ${text}`;
  });

  // 2 — every id must be the one the document derives for that text in this
  //     file. Occurrences are counted per file, exactly as the inventory does.
  const counts = new Map();
  s = s.replace(CALL, (whole, id, quoted) => {
    const text = JSON.parse(quoted);
    const want = idFor(counts, id[0], file, text);
    if (want === id) return whole;
    if (!byId.has(want)) {
      unknown.push(`${file}: ${text.slice(0, 40)} — document has no ${want}`);
      return whole;
    }
    remapped++;
    return whole.replace(`"${id}"`, `"${want}"`);
  });

  if (FIX && s !== before) writeFileSync(file, s, "utf8");
}

console.log(`${unnested} nested calls${FIX ? " un-nested" : " found"}`);
console.log(`${remapped} ids${FIX ? " corrected" : " disagree with the document"}`);
if (unknown.length) {
  console.log(`${unknown.length} left alone — regenerate the document and run again:`);
  for (const u of unknown.slice(0, 10)) console.log(`   ${u}`);
}
if (!FIX) console.log("\nNothing written. Re-run with --fix.");
