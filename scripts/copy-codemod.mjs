/**
 * Turns the game's screen strings into lookups, so a language can change them.
 *
 *   node scripts/copy-codemod.mjs            report what it can and cannot do
 *   node scripts/copy-codemod.mjs --apply    rewrite the source
 *   node scripts/copy-codemod.mjs --apply --only components/Shop.tsx
 *
 * ═══ WHAT THIS IS FOR ═══
 *
 * Card text is bilingual in its own data and `say()` reads it. Screen text is
 * not: it is written into components as literals, which is why copy.ts has
 * said for months that "nothing can change those at runtime without turning
 * all 547 into lookups". This is that, done once, by machine.
 *
 *     <button>התחל קרב!</button>
 *     <button>{t("a12", "התחל קרב!")}</button>
 *
 * `t` is `line` from game/copy.ts under a shorter name — it already does
 * exactly this job for the handful of strings that were wired by hand.
 *
 * ═══ WHY IT IS SAFE TO RUN ═══
 *
 * `t(id, shipped)` returns `shipped` whenever there is no override and no
 * English, which is every string in Hebrew today. So a correct rewrite is
 * invisible: the Hebrew game renders exactly what it rendered before, and
 * `tsc` plus the test suite catch an incorrect one. That invariant is the
 * whole reason this can be done mechanically.
 *
 * ═══ WHAT IT REFUSES TO DO ═══
 *
 * A string literal is an expression, and most places a string sits are
 * expression positions where a call is equally valid. The exceptions are
 * skipped and listed rather than guessed at:
 *
 *   - template literals containing ${...}: the text in the document is not
 *     the text in the file, so the id would not match what it replaces
 *   - object keys, type positions, and anything inside an import
 *   - lines where the recorded text appears more than once, because then
 *     "replace the text on this line" is ambiguous
 *
 * Skipped strings stay Hebrew in both languages. That is a worse outcome
 * than translating them and a far better one than a broken build.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MAP = join(ROOT, "docs", "copy.map.json");
const APPLY = process.argv.includes("--apply");
const onlyIx = process.argv.indexOf("--only");
const ONLY = onlyIx > -1 ? process.argv[onlyIx + 1] : null;

if (!existsSync(MAP)) {
  console.error("Run `pnpm copy` first — docs/copy.map.json is missing.");
  process.exit(1);
}

/**
 * Files the codemod leaves alone, and why.
 *
 * cardMeta.ts is bilingual already: its records carry `he` and `en` side by
 * side and `say()` reads them, so wrapping the Hebrew half in a lookup would
 * give the same string two ways to become English.
 */
const SKIP_FILES = [/data[\\/]cardMeta\.ts$/];

/*
 * ═══ TYPESCRIPT ONLY ═══
 *
 * "kind: source" means "not a JSON data file", and three of those entries
 * are the page title, the description meta and the installed app's name —
 * which live in index.html and manifest.webmanifest. The first run happily
 * rewrote both, putting `<title>{t("hfc09a93", "…")}</title>` into the HTML
 * and an ES import at the top of a JSON manifest.
 *
 * They cannot be lookups at all: they are read before the app exists, by the
 * browser and by Android. The store listing is where those get a second
 * language.
 */
const entries = JSON.parse(readFileSync(MAP, "utf8")).filter(
  (e) =>
    e.where.kind === "source" &&
    /\.tsx?$/.test(e.where.file) &&
    !SKIP_FILES.some((re) => re.test(e.where.file)),
);

/** Group by file, and work bottom-up so earlier edits cannot move later ones. */
const byFile = new Map();
for (const e of entries) {
  if (ONLY && !e.where.file.endsWith(ONLY)) continue;
  if (!byFile.has(e.where.file)) byFile.set(e.where.file, []);
  byFile.get(e.where.file).push(e);
}

const done = [];
const skipped = [];

/**
 * Decide how this one string is written into the file, and hand back the
 * replacement for it.
 *
 * Everything is judged from the line itself. A parser would be better and is
 * not worth it for a transform that runs once: the cases below cover what
 * this codebase actually does, and anything they do not recognise is skipped
 * rather than rewritten on a guess.
 */
function rewrite(line, text, id) {
  const call = `t(${JSON.stringify(id)}, ${JSON.stringify(text)})`;

  // A JSX attribute: title="..." -> title={t(...)}
  const attr = new RegExp(`(\\w+)=(["'])${escapeRe(text)}\\2`);
  if (attr.test(line)) return { line: line.replace(attr, `$1={${call}}`), kind: "attribute" };

  // A quoted string anywhere an expression is allowed.
  for (const q of ['"', "'"]) {
    const quoted = `${q}${text}${q}`;
    const at = line.indexOf(quoted);
    if (at === -1) continue;
    if (isObjectKey(line, at, quoted.length)) return null;
    return { line: line.replace(quoted, call), kind: "string" };
  }

  // A backtick with no interpolation behaves like a quoted string.
  const tick = "`" + text + "`";
  if (line.includes(tick) && !text.includes("${")) {
    return { line: line.replace(tick, call), kind: "template" };
  }

  // A JSX text node: >טקסט< -> >{t(...)}<
  const jsx = new RegExp(`>(\\s*)${escapeRe(text)}(\\s*)<`);
  if (jsx.test(line)) return { line: line.replace(jsx, `>$1{${call}}$2<`), kind: "jsx" };

  return null;
}

/**
 * Is this quoted string a KEY rather than a value?
 *
 * It matters because a key is the one place a string is not an expression,
 * so `{ "טקסט": 1 }` must be left alone while `{ foo: "טקסט" }` must not.
 *
 * The first attempt asked only whether a colon followed, and that is also
 * true of the second arm of a ternary — so `title={muted ? "הפעלת צליל" :
 * "השתקה"}` was refused, along with thirty others. A colon after is
 * necessary and not sufficient: a key is also preceded by an opening brace,
 * a comma, or nothing at all. A ternary arm is preceded by a `?`.
 */
function isObjectKey(line, at, length) {
  const after = line.slice(at + length).match(/^\s*(.)/);
  if (after?.[1] !== ":") return false;
  const before = line.slice(0, at).match(/(\S)\s*$/);
  return !before || before[1] === "{" || before[1] === ",";
}

const short = (t) => (t.length > 32 ? t.slice(0, 32) + "…" : t);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const [file, items] of byFile) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) {
    for (const e of items) skipped.push(`${e.id}: ${file} is gone`);
    continue;
  }
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  let touched = 0;

  // Bottom-up: a rewrite only ever changes its own line, but working
  // backwards keeps that true even if one day it does not.
  for (const e of [...items].sort((a, b) => b.where.line - a.where.line)) {
    const i = e.where.line - 1;
    const line = lines[i];
    if (line === undefined || !line.includes(e.text)) {
      skipped.push(`${e.id}: "${short(e.text)}" is no longer on line ${e.where.line} of ${file}`);
      continue;
    }
    if (line.split(e.text).length > 2) {
      skipped.push(`${e.id}: "${short(e.text)}" appears twice on line ${e.where.line} of ${file}`);
      continue;
    }
    if (line.includes(`t("${e.id}"`)) continue; // already done on an earlier run

    /*
     * A string that already has an English twin on the same line is a
     * LocalizedString, and `say()` is how it becomes English — wrapping the
     * Hebrew half as well would give one string two routes to translation.
     *
     * It is also how the first run broke the build. data/catalog.ts holds
     * `name: { he: "מפלץ פירורים", en: "Crumb Demon" }`, and wrapping that
     * `he` made catalog.ts import copy.ts, which already imports catalog.ts.
     * The cycle left `line` undefined at module-init and three test suites
     * died on "line is not a function". The import cycle was the symptom;
     * translating something twice was the mistake.
     */
    if (/\ben:\s*["'`]/.test(line)) {
      skipped.push(`${e.id}: "${short(e.text)}" already has English beside it in ${file}`);
      continue;
    }

    const out = rewrite(line, e.text, e.id);
    if (!out) {
      skipped.push(`${e.id}: cannot tell how "${short(e.text)}" is written in ${file}:${e.where.line}`);
      continue;
    }
    lines[i] = out.line;
    done.push({ id: e.id, file, kind: out.kind });
    touched++;
  }

  if (touched && APPLY) {
    writeFileSync(abs, ensureImport(lines, file).join("\n"), "utf8");
  }
}

/**
 * Give the file the `t` it now calls, if it has not got one.
 *
 * The path is computed from where the file sits rather than guessed at a
 * fixed depth — the first version wrote `../../game/copy` into
 * components/Shop.tsx, which is one level too far up and would not have
 * compiled.
 */
function ensureImport(lines, file) {
  if (lines.some((l) => /\bline as t\b/.test(l))) return lines;
  const dir = file.split("/").slice(0, -1).join("/");
  let rel = relative(dir, "apps/client/src/game/copy").split("\\").join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  const stmt = `import { line as t } from "${rel}";`;
  let last = -1;
  for (let i = 0; i < lines.length; i++) if (/^import /.test(lines[i])) last = i;
  lines.splice(last + 1, 0, stmt);
  return lines;
}


const byKind = {};
for (const d of done) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;

console.log(`${done.length} strings ${APPLY ? "rewritten" : "can be rewritten"}:`);
for (const [k, n] of Object.entries(byKind)) console.log(`   ${String(n).padStart(4)} ${k}`);
console.log(`\n${skipped.length} skipped:`);
for (const s of skipped.slice(0, 40)) console.log(`   ${s}`);
if (skipped.length > 40) console.log(`   … and ${skipped.length - 40} more`);
if (!APPLY) console.log("\nNothing was written. Re-run with --apply.");
