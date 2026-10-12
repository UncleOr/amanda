/**
 * The spreadsheet writer and reader, against the three bugs that got out.
 *
 *   node --test scripts/xlsx.test.mjs
 *
 * Every case here is something that actually reached Or's screen, which is
 * the only reason any of them are worth a test. Two of the three were
 * invisible from inside the code and obvious from outside it: he opened the
 * document and found the English sitting in the column he was supposed to
 * type into. A reader that quietly moves a column is worse than one that
 * throws, because the file still opens and the damage looks like a decision
 * somebody made.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readXlsx, writeXlsx, zip, unzip } from "./xlsx.mjs";

const DIR = mkdtempSync(join(tmpdir(), "xlsx-"));
const tmp = (name) => join(DIR, name);

const COLUMNS = [
  { header: "מזהה", width: 11 },
  { header: "טקסט מקור (בעברית)", width: 40 },
  { header: "טקסט חדש עברית", width: 40, edit: true },
  { header: "טקסט חדש אנגלית", width: 40, edit: true },
];

test("an empty cell does not swallow the cell after it", () => {
  /*
   * The bug: an empty cell is written self-closing, `<c r="C2" s="3"/>`, and
   * a greedy attribute match ate the slash, took the `>` branch, and ran on
   * to the next `</c>` — carrying the NEXT cell's text back as its own.
   *
   * Which is why every translation appeared one column to its left.
   */
  const path = tmp("gap.xlsx");
  writeXlsx(path, [
    { name: "s", columns: COLUMNS, rows: [["a1234567", "שלום", "", "Hello"]] },
  ]);
  const row = Object.values(readXlsx(path))[0][1];
  assert.deepEqual(row, ["a1234567", "שלום", "", "Hello"]);
});

test("every row comes back the width of the header", () => {
  // A worksheet omits trailing empty cells and empty rows entirely, so what
  // comes out of the XML is ragged. A caller reading a column by index has
  // no way to tell a hole from a short row.
  const path = tmp("ragged.xlsx");
  writeXlsx(path, [
    {
      name: "s",
      columns: COLUMNS,
      rows: [["a1234567", "שלום"], ["b7654321", "", "", ""], ["c1111111", "א", "ב", "ג"]],
    },
  ]);
  const rows = Object.values(readXlsx(path))[0];
  assert.equal(rows.length, 4);
  for (const r of rows) assert.equal(r.length, 4);
  assert.deepEqual(rows[1], ["a1234567", "שלום", "", ""]);
  assert.deepEqual(rows[3], ["c1111111", "א", "ב", "ג"]);
});

test("a sparse row keeps its columns where they are", () => {
  // Rows read back out of a spreadsheet are sparse exactly where the author
  // left a cell blank, and `Array.prototype.map` SKIPS holes rather than
  // calling the callback — so writing a round-tripped row used to shift
  // everything after the first blank one place left.
  const path = tmp("sparse.xlsx");
  const row = [];
  row[0] = "a1234567";
  row[3] = "Hello"; // 1 and 2 are holes, not empty strings
  writeXlsx(path, [{ name: "s", columns: COLUMNS, rows: [row] }]);
  assert.deepEqual(Object.values(readXlsx(path))[0][1], ["a1234567", "", "", "Hello"]);
});

test("Hebrew, pipes and ampersands survive the round trip", () => {
  // The pipe is the one that mattered: the game's own name contains one, and
  // in the markdown document it had to be escaped. In a spreadsheet it is
  // just a character, which was half the point of moving.
  const path = tmp("text.xlsx");
  const texts = [
    "אמנדה | משחק קלפים מפלצתי",
    "ילד ילד ילד, בוא להילחם",
    "R&D <tag> \"quoted\" 'single'",
    "בונים לוח 4×4 — והן נלחמות לבד.",
  ];
  writeXlsx(path, [
    { name: "s", columns: COLUMNS, rows: texts.map((t, i) => [`a${i}234567`, t, "", ""]) },
  ]);
  const rows = Object.values(readXlsx(path))[0];
  texts.forEach((t, i) => assert.equal(rows[i + 1][1], t));
});

test("the sheet is right-to-left, frozen and filtered", () => {
  // The three things Or asked for, and the only reason the file exists.
  const path = tmp("view.xlsx");
  writeXlsx(path, [{ name: "s", columns: COLUMNS, rows: [["a1234567", "א", "", ""]] }]);
  const xml = unzip(readFileSync(path))["xl/worksheets/sheet1.xml"].toString("utf8");
  assert.match(xml, /rightToLeft="1"/);
  assert.match(xml, /state="frozen"/);
  assert.match(xml, /<autoFilter ref="A1:D2"\/>/);
});

test("the shape Excel itself saves reads correctly", () => {
  /*
   * Our writer uses inline strings and no compression. Excel uses a shared
   * string table and deflates everything — so the file that comes BACK from
   * Or exercises a branch our own output never touches. That is the branch
   * that would otherwise fail the first time he saved.
   */
  const strings = [];
  const sid = (t) => {
    const i = strings.indexOf(t);
    return i < 0 ? strings.push(t) - 1 : i;
  };
  const data = [
    ["מזהה", "טקסט מקור (בעברית)", "טקסט חדש עברית"],
    ["hafb233b", "אמנדה", "אמנדה הגדולה"],
  ];
  const col = (n) => String.fromCharCode(65 + n);
  const sheet =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    "<sheetData>" +
    data
      .map(
        (r, ri) =>
          `<row r="${ri + 1}">` +
          r.map((v, ci) => `<c r="${col(ci)}${ri + 1}" t="s"><v>${sid(v)}</v></c>`).join("") +
          "</row>",
      )
      .join("") +
    "</sheetData></worksheet>";

  const base = tmp("base.xlsx");
  writeXlsx(base, [{ name: "גיליון", columns: COLUMNS, rows: [] }]);
  const files = unzip(readFileSync(base));
  files["xl/worksheets/sheet1.xml"] = Buffer.from(sheet, "utf8");
  files["xl/sharedStrings.xml"] = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      strings.map((t) => `<si><t>${t}</t></si>`).join("") +
      "</sst>",
    "utf8",
  );

  const path = tmp("excel.xlsx");
  writeFileSync(path, zip(files));
  const rows = Object.values(readXlsx(path))[0];
  assert.deepEqual(rows[0].slice(0, 3), data[0]);
  assert.deepEqual(rows[1].slice(0, 3), data[1]);
});

test("the columns Or types in are written even when blank", () => {
  // They are blank BY DEFINITION, so leaving them out of the file means the
  // fill that marks them never appears on a single row of the document.
  const path = tmp("fill.xlsx");
  writeXlsx(path, [{ name: "s", columns: COLUMNS, rows: [["a1234567", "א", "", ""]] }]);
  const xml = unzip(readFileSync(path))["xl/worksheets/sheet1.xml"].toString("utf8");
  assert.match(xml, /<c r="C2" s="3"\/>/);
  assert.match(xml, /<c r="D2" s="3"\/>/);
});
