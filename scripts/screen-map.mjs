/**
 * Every control in the client, and which screen it is on.
 *
 * Or: *"settings screens and everything needed — which menu each button is
 * in."* Read out of the source rather than written from memory, because a
 * map of the UI drawn by hand is a map of the UI as I remember it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p) && !/\.test\./.test(p)) files.push(p);
  }
})("apps/client/src");

/** The shipped Hebrew out of a t()/tf() call, or a bare string. */
const LABEL = /\btf?\(\s*"[a-z][0-9a-f]{7}",\s*"((?:[^"\\]|\\.)*)"/;

const rows = [];
for (const file of files) {
  const name = basename(file, ".tsx");
  if (/^Admin|^CardEditor$/.test(name)) continue; // one adult, stays Hebrew
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    // A control is a <button, a <a className="btn, or an onClick
    if (!/<button|className="btn|role="button"/.test(line)) return;
    // Look ahead a few lines for the label this control carries.
    let label = "";
    for (let j = i; j < Math.min(i + 7, lines.length); j++) {
      const m = LABEL.exec(lines[j]);
      if (m) { label = m[1]; break; }
      const bare = /^\s*([^<>{}\n]*[֐-׿][^<>{}\n]*)\s*$/.exec(lines[j]);
      if (bare && bare[1].trim().length > 1) { label = bare[1].trim(); break; }
    }
    const cls = /className=[{`"]([^"`}]*)/.exec(line)?.[1]?.split(/\s+/)[0] ?? "";
    if (!label) return;
    rows.push({ screen: name, label, cls, line: i + 1 });
  });
}

const byScreen = new Map();
for (const r of rows) {
  if (!byScreen.has(r.screen)) byScreen.set(r.screen, []);
  byScreen.get(r.screen).push(r);
}

for (const [screen, list] of [...byScreen].sort()) {
  console.log(`\n## ${screen}  (${list.length})`);
  const seen = new Set();
  for (const r of list) {
    if (seen.has(r.label)) continue;
    seen.add(r.label);
    console.log(`  ${String(r.line).padStart(5)}  ${r.label}`);
  }
}
console.log(`\n${rows.length} controls across ${byScreen.size} screens`);
