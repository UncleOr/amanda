/**
 * Writes Or's copy edits from docs/COPY.md back into the source they came from.
 *
 *   node scripts/copy-apply.mjs            apply the edits
 *   node scripts/copy-apply.mjs --dry-run  show what would change, touch nothing
 *
 * Every change is verified before it is written: the text currently in the file
 * must still be exactly the text the document was generated from. If a string
 * has moved or already changed, that row is reported and skipped rather than
 * overwriting something by position — a copy tool must never be the reason a
 * line of the game goes missing.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOC = join(ROOT, "docs", "COPY.md");
const MAP = join(ROOT, "docs", "copy.map.json");
const DRY = process.argv.includes("--dry-run");

if (!existsSync(DOC) || !existsSync(MAP)) {
  console.error("Run `pnpm copy` first — docs/COPY.md or docs/copy.map.json is missing.");
  process.exit(1);
}

const entries = new Map(JSON.parse(readFileSync(MAP, "utf8")).map((e) => [e.id, e]));

/** Pull the id → new text pairs out of the markdown tables. */
function readEdits() {
  const edits = [];
  for (const line of readFileSync(DOC, "utf8").split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;
    const [id, current, next] = cells;
    if (!/^[a-z]\d+$/.test(id)) continue; // header and divider rows
    if (!next) continue; // left blank = leave it alone
    const unescape = (t) => t.replace(/\\\|/g, "|");
    edits.push({ id, current: unescape(current), next: unescape(next) });
  }
  return edits;
}

/** Follow a recorded path into parsed JSON. */
function atPath(root, path) {
  let node = root;
  for (const key of path.slice(0, -1)) node = node?.[key];
  return { parent: node, key: path[path.length - 1] };
}

const edits = readEdits();
if (!edits.length) {
  console.log("No edits found — the 'טקסט חדש' column is empty everywhere.");
  process.exit(0);
}

/** file → the work queued against it, so each file is written once. */
const jsonFiles = new Map();
const sourceFiles = new Map();
const skipped = [];
const planned = [];

for (const edit of edits) {
  const e = entries.get(edit.id);
  if (!e) {
    skipped.push(`${edit.id}: unknown id — regenerate with \`pnpm copy\``);
    continue;
  }
  if (e.text !== edit.current) {
    skipped.push(`${edit.id}: the "current" column was edited; it must stay as generated`);
    continue;
  }
  const abs = join(ROOT, e.where.file);
  if (!existsSync(abs)) {
    skipped.push(`${edit.id}: ${e.where.file} no longer exists`);
    continue;
  }

  if (e.where.kind === "json") {
    if (!jsonFiles.has(abs)) jsonFiles.set(abs, JSON.parse(readFileSync(abs, "utf8")));
    const { parent, key } = atPath(jsonFiles.get(abs), e.where.path);
    if (!parent || parent[key] !== e.text) {
      skipped.push(`${edit.id}: "${e.text}" is no longer at that place in ${e.where.file}`);
      continue;
    }
    parent[key] = edit.next;
    planned.push({ id: edit.id, file: e.where.file, from: e.text, to: edit.next });
    continue;
  }

  // source files: replace on the recorded line, and only if it still matches
  if (!sourceFiles.has(abs)) sourceFiles.set(abs, readFileSync(abs, "utf8").split(/\r?\n/));
  const lines = sourceFiles.get(abs);
  const i = e.where.line - 1;
  if (lines[i] === undefined || !lines[i].includes(e.text)) {
    skipped.push(`${edit.id}: "${e.text}" is no longer on line ${e.where.line} of ${e.where.file}`);
    continue;
  }
  lines[i] = lines[i].replace(e.text, edit.next);
  planned.push({ id: edit.id, file: e.where.file, from: e.text, to: edit.next });
}

for (const p of planned) console.log(`  ${p.id}  ${p.file}\n      ${p.from}\n   -> ${p.to}`);
for (const s of skipped) console.warn(`  SKIPPED ${s}`);

if (DRY) {
  console.log(`\nDry run: ${planned.length} would change, ${skipped.length} skipped.`);
  process.exit(skipped.length ? 1 : 0);
}

// Nothing is written until every edit has been checked, so a bad row cannot
// leave half the files updated.
for (const [abs, json] of jsonFiles)
  writeFileSync(abs, JSON.stringify(json, null, 2) + "\n", "utf8");
for (const [abs, lines] of sourceFiles) writeFileSync(abs, lines.join("\n"), "utf8");

console.log(`\n${planned.length} applied, ${skipped.length} skipped.`);
console.log("Now run `pnpm copy` to regenerate the document from the new source.");
process.exit(skipped.length ? 1 : 0);
