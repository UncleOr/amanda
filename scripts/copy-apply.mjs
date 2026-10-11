/**
 * Writes Or's copy edits from docs/COPY.md back into the source they came from.
 *
 *   node scripts/copy-apply.mjs            apply the edits
 *   node scripts/copy-apply.mjs --dry-run  show what would change, touch nothing
 *
 * Two columns are read. "טקסט חדש" rewrites the Hebrew in the source it came
 * from. "אנגלית" is the translation, and it goes wherever that kind of text
 * already lives: card data is bilingual in its own JSON, so English is
 * written beside the Hebrew there, and screen strings — which are literals
 * in components — go to data/copy.en.json, keyed by id, which the game
 * loads when English is chosen.
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
const EN = join(ROOT, "data", "copy.en.json");
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
    /*
     * Split on pipes that are NOT escaped.
     *
     * The game's own name is "אמנדה | משחק קלפים מפלצתי" and the generator
     * writes it into the table as `\|`. A plain split("|") cut it in half,
     * the halves landed in the wrong columns, and both rows were then
     * rejected for having an edited "current" column. The verification was
     * right and the parser was wrong: the two strings it could never apply
     * were the title of the game and the name of the installed app.
     */
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    const [id, current, next, english] = cells;
    if (!/^[a-z][0-9a-f]{7}$/.test(id)) continue; // header and divider rows
    if (!next && !english) continue; // both left blank = leave it alone
    const unescape = (t) => (t ?? "").replace(/\\\|/g, "|");
    edits.push({
      id,
      current: unescape(current),
      next: unescape(next),
      en: unescape(english),
    });
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
/** id -> the English on that row, with enough to know where it belongs. */
const english = {};

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
  if (edit.en) english[edit.id] = { en: edit.en, where: e.where };
  if (!edit.next) continue; // English only on this row
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

/*
 * English, placed by the kind of text it is.
 *
 * Card text is a LocalizedString in its own JSON and the English belongs
 * beside the Hebrew, one key away — putting it in a side file instead would
 * split one record across two places. Screen strings have nowhere in the
 * source to put it, so they go to the catalogue the game loads.
 */
const catalogue = existsSync(EN) ? JSON.parse(readFileSync(EN, "utf8")) : {};
let intoJson = 0;
let intoCatalogue = 0;
for (const [id, { en, where }] of Object.entries(english)) {
  const abs = join(ROOT, where.file);
  if (where.kind === "json" && where.path[where.path.length - 1] === "he") {
    if (!jsonFiles.has(abs)) jsonFiles.set(abs, JSON.parse(readFileSync(abs, "utf8")));
    // The parent of the "he" key — the LocalizedString itself, whose sibling
    // "en" is where this belongs.
    const { parent } = atPath(jsonFiles.get(abs), where.path);
    if (parent && typeof parent === "object") {
      // The document arrives with these cells already filled from the data,
      // so most rows are handing back exactly what they were given.
      if (parent.en !== en) {
        parent.en = en;
        intoJson++;
      }
      continue;
    }
  }
  catalogue[id] = en;
  intoCatalogue++;
}

if (DRY) {
  console.log(
    `\nDry run: ${planned.length} Hebrew edits would change, ${skipped.length} skipped.\n` +
      `English: ${intoJson} into card data, ${intoCatalogue} into data/copy.en.json.`,
  );
  process.exit(skipped.length ? 1 : 0);
}

// Nothing is written until every edit has been checked, so a bad row cannot
// leave half the files updated.
if (intoCatalogue) writeFileSync(EN, JSON.stringify(catalogue, null, 1) + "\n", "utf8");
for (const [abs, json] of jsonFiles)
  writeFileSync(abs, JSON.stringify(json, null, 2) + "\n", "utf8");
for (const [abs, lines] of sourceFiles) writeFileSync(abs, lines.join("\n"), "utf8");

console.log(
  `\n${planned.length} Hebrew edits applied, ${intoJson + intoCatalogue} English written, ` +
    `${skipped.length} skipped.`,
);
console.log("Now run `pnpm copy` to regenerate the document from the new source.");
process.exit(skipped.length ? 1 : 0);
