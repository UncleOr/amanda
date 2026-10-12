/**
 * Brings Or's filled-in spreadsheets back into docs/COPY.md.
 *
 *   node scripts/copy-back.mjs             merge the edits in
 *   node scripts/copy-back.mjs --dry-run   say what would change, touch nothing
 *
 * ═══ WHY IT STOPS AT COPY.MD INSTEAD OF WRITING THE CODE ═══
 *
 * `copy-apply.mjs` already does the dangerous half, and it does it carefully:
 * before it rewrites a string in a source file it checks that the text
 * CURRENTLY there is still exactly the text the document was generated from,
 * and skips the row rather than overwriting something by position. That check
 * is the reason a copy tool has never yet been the reason a line of the game
 * went missing, and it is not worth having a second copy of it.
 *
 * So this script does the boring half only: it fills two columns of the
 * markdown from two columns of a spreadsheet. Then `pnpm copy:apply` runs
 * unchanged, against a document it already knows how to verify.
 *
 * ═══ WHAT IT REFUSES TO DO ═══
 *
 * A row whose "current text" no longer matches what the game actually says is
 * a row written against a version that has moved — usually because the sheet
 * was generated before a regeneration. Those are reported and skipped. An
 * edit applied to the wrong row is worse than an edit lost, because only one
 * of the two is visible.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readXlsx } from "./xlsx.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOC = join(ROOT, "docs", "COPY.md");
const MAP = join(ROOT, "docs", "copy.map.json");
const COPY_SHEET = join(ROOT, "docs", "COPY.xlsx");
const TUT_SHEET = join(ROOT, "docs", "TUTORIAL.xlsx");
const DRY = process.argv.includes("--dry-run");

/*
 * The column names, in one place, because they are Or's words and he
 * changes them: *"I want it like this in the columns: source text (in
 * Hebrew) | new text Hebrew | new text English."*
 */
const SRC = "טקסט מקור (בעברית)";
const NEW_HE = "טקסט חדש עברית";
const NEW_EN = "טקסט חדש אנגלית";

if (!existsSync(DOC) || !existsSync(MAP)) {
  console.error("Run `pnpm copy` first — docs/COPY.md is missing.");
  process.exit(1);
}

const entries = new Map(JSON.parse(readFileSync(MAP, "utf8")).map((e) => [e.id, e]));

/** id → { he, en }, last one wins if a row somehow appears twice. */
const edits = new Map();
const stale = [];
const unknown = [];
const notes = [];

/** Column index by header name, so a reordered sheet still reads correctly. */
const columns = (header) => {
  const at = {};
  header.forEach((h, i) => (at[String(h).trim()] = i));
  return at;
};

function take(rows, { he, en, note, current }) {
  const at = columns(rows[0] ?? []);
  for (const row of rows.slice(1)) {
    const id = String(row[at["מזהה"]] ?? "").trim();
    if (!/^[a-z][0-9a-f]{7}$/.test(id)) continue;

    const comment = note != null ? String(row[at[note]] ?? "").trim() : "";
    if (comment) notes.push({ id, comment });

    const nextHe = he != null ? String(row[at[he]] ?? "").trim() : "";
    const nextEn = en != null ? String(row[at[en]] ?? "").trim() : "";
    if (!nextHe && !nextEn) continue;

    const entry = entries.get(id);
    if (!entry) {
      unknown.push(id);
      continue;
    }
    /*
     * Excel does not round-trip whitespace faithfully — a cell can come back
     * with a trailing space that was never typed — so the comparison is made
     * on collapsed whitespace. Everything else must match character for
     * character.
     */
    const seen = String(row[at[current]] ?? "").replace(/\s+/g, " ").trim();
    const truth = entry.text.replace(/\s+/g, " ").trim();
    if (seen && seen !== truth) {
      stale.push({ id, seen, truth });
      continue;
    }

    const prev = edits.get(id) ?? { he: "", en: "" };
    edits.set(id, { he: nextHe || prev.he, en: nextEn || prev.en });
  }
}

if (existsSync(COPY_SHEET)) {
  const book = readXlsx(COPY_SHEET);
  for (const rows of Object.values(book))
    take(rows, { he: NEW_HE, en: NEW_EN, current: SRC });
}

/*
 * The tutorial sheet carries the Hebrew only. Its other columns — when the
 * line fires, what it points at, what it waits for — are the SHAPE of the
 * tutorial, and that lives in code; a note in the last column is how Or asks
 * for one of those to change, so the notes are printed rather than applied.
 */
if (existsSync(TUT_SHEET)) {
  const book = readXlsx(TUT_SHEET);
  for (const [name, rows] of Object.entries(book)) {
    if (!(rows[0] ?? []).includes("מזהה")) continue; // the fixed-strings sheet
    take(rows, { he: NEW_HE, en: NEW_EN, note: "הערה שלך", current: SRC });
    void name;
  }
}

if (!edits.size && !notes.length) {
  console.log("Nothing filled in — both spreadsheets are still empty.");
  process.exit(0);
}

/*
 * ═══ AN EDIT IS A CELL THAT CHANGED ═══
 *
 * The English column comes out of the generator PRE-FILLED with every
 * translation already written, so a sheet Or has not touched at all still
 * arrives with a thousand non-empty English cells. Counting those as edits
 * made the first run report "1019 edits merged" over a file nobody had
 * opened — a number that is not wrong so much as meaningless, and a report
 * that cannot tell you nothing happened is a report you stop reading.
 *
 * So the comparison is against what the document already says, row by row.
 */
// ── merge into the markdown ───────────────────────────────────────────
const esc = (t) => String(t ?? "").replace(/\|/g, "\\|");
const unesc = (t) => String(t ?? "").replace(/\\\|/g, "|");
let he = 0;
let en = 0;
const missing = new Set(edits.keys());

const merged = readFileSync(DOC, "utf8")
  .split(/\r?\n/)
  .map((line) => {
    if (!line.startsWith("|")) return line;
    // Same unescaped-pipe split as copy-apply.mjs: the game's own name
    // contains a pipe, and splitting naively cut two rows in half.
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) return line;
    const id = cells[0];
    if (!edits.has(id)) return line;
    missing.delete(id);

    const want = edits.get(id);
    const nextHe = want.he || unesc(cells[2]);
    const nextEn = want.en || unesc(cells[3]);
    if (nextHe === unesc(cells[2]) && nextEn === unesc(cells[3])) return line;
    if (nextHe !== unesc(cells[2])) he++;
    if (nextEn !== unesc(cells[3])) en++;
    return `| ${cells[0]} | ${cells[1]} | ${esc(nextHe)} | ${esc(nextEn)} |`;
  })
  .join("\n");

const filled = he + en;

if (!DRY) writeFileSync(DOC, merged, "utf8");

// ── what happened ─────────────────────────────────────────────────────
console.log(
  filled
    ? `${he} Hebrew and ${en} English cells changed -> docs/COPY.md${DRY ? " (dry run)" : ""}`
    : "Nothing changed — every cell still says what the document already said.",
);
if (missing.size)
  console.log(`  ${missing.size} had no row in the document: ${[...missing].join(", ")}`);
if (unknown.length) console.log(`  ${unknown.length} unknown ids: ${unknown.join(", ")}`);
for (const s of stale)
  console.log(`  SKIPPED ${s.id} — the sheet says "${s.seen}", the game says "${s.truth}"`);
if (notes.length) {
  console.log(`\n${notes.length} notes for me, which no script can apply:`);
  for (const n of notes) console.log(`  ${n.id}  ${n.comment}`);
}
if (filled && !DRY) console.log("\nNow run `pnpm copy:apply`.");
