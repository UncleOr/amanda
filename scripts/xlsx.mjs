/**
 * A very small xlsx reader and writer, with no dependencies.
 *
 * Or, three documents into editing them: *"the MD files are simply awful in
 * terms of user interface. It's very hard to work like this. Any chance of
 * an Excel file that works better for right and left alignment?"*
 *
 * He is right, and markdown is not fixable here: a pipe table lines its
 * columns up with spaces, and a column of Hebrew beside a column of English
 * has no arrangement of spaces that reads straight. Worse, every edit has to
 * keep the pipes intact, so a document meant for writing is really a small
 * exercise in not breaking the format.
 *
 * A spreadsheet has the one thing that actually solves it: `rightToLeft` on
 * the sheet, which flips the whole grid so column A is on the right and
 * Hebrew runs the way he reads it. English cells inside it stay left-aligned
 * on their own, because the alignment is per-cell.
 *
 * ═══ WHY IT IS WRITTEN HERE RATHER THAN INSTALLED ═══
 *
 * An xlsx is a zip of XML, and we need four files inside it. The whole
 * writer is under a hundred lines, it has no supply chain, and it cannot
 * drift — against a dependency that would be pulled in to produce two
 * documents nobody will open after this week.
 *
 * The zip is written with the STORE method — no compression at all. Excel
 * accepts it, these documents are small, and it means the writer needs a
 * CRC and nothing else. Reading does need inflate, because Excel compresses
 * what IT saves, and that comes from node's own zlib.
 */
import { inflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

/* ── zip ───────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** files: { "path/in/zip": Buffer|string } → a zip Buffer, stored uncompressed. */
export function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, body] of Object.entries(files)) {
    const data = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const sum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method 0 = stored
    local.writeUInt32LE(0, 10); // time+date
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(sum, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** A zip Buffer → { "path/in/zip": Buffer }. Handles stored and deflated. */
export function unzip(buf) {
  const out = {};
  // Walk the central directory backwards from the end record, which is the
  // only part of a zip whose location is knowable without scanning.
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);

  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + size);
    out[name] = method === 0 ? raw : inflateRawSync(raw);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ── xlsx ──────────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Excel refuses a file containing control characters, and copy that has
    // been through a terminal sometimes carries one.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const colName = (n) => {
  let s = "";
  for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/**
 * Write one spreadsheet.
 *
 * `sheets` is [{ name, columns: [{ header, width, wrap? }], rows: [[...]] }].
 * Every cell is written as an inline string: these documents are text, and
 * inline strings keep the writer to one file instead of a shared-string
 * table that has to be built and referenced correctly.
 */
export function writeXlsx(path, sheets) {
  const files = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("") +
      "</Types>",

    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>",

    "xl/workbook.xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<sheets>" +
      sheets
        .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("") +
      "</sheets></workbook>",

    "xl/_rels/workbook.xml.rels":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      "</Relationships>",

    /*
     * Four styles, and they are the whole point of the file:
     *   0  plain
     *   1  header — bold, on a dark fill, wrapped
     *   2  body — wrapped and top-aligned, so a long sentence opens downwards
     *   3  the column being edited — same, on a pale fill so it is findable
     */
    "xl/styles.xml":
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
      '<fills count="4"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF31405C"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF6D9"/></patternFill></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
      '<cellXfs count="4">' +
      "<xf/>" +
      '<xf fontId="1" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      '<xf applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf fillId="3" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      "</cellXfs></styleSheet>",
  };

  sheets.forEach((sheet, si) => {
    const cols = sheet.columns
      .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
      .join("");

    const header =
      '<row r="1" ht="26" customHeight="1">' +
      sheet.columns
        .map((c, i) => `<c r="${colName(i)}1" s="1" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`)
        .join("") +
      "</row>";

    const body = sheet.rows
      .map((row, ri) => {
        /*
         * `Array.prototype.map` SKIPS holes — it does not call the callback
         * for an index that was never assigned — so a sparse row silently
         * lost its empty columns and everything after them slid one to the
         * left. Rows that have been read back out of a spreadsheet are
         * sparse exactly where the author left a cell blank, which is to say
         * precisely where this would do the most damage.
         *
         * Widened to the header and filled, so every row is dense.
         */
        const dense = Array.from(
          { length: sheet.columns.length },
          (_, i) => row[i] ?? "",
        );
        const cells = dense
          .map((v, ci) => {
            const edit = !!sheet.columns[ci]?.edit;
            /*
             * An empty cell is normally left out of the file entirely — but
             * the columns Or TYPES IN are empty by definition, and leaving
             * them out means the pale fill marking them never appears on a
             * single row of the document. So those are written even when
             * blank; everything else is skipped.
             */
            if (v === null || v === undefined || v === "") {
              if (!edit) return "";
              return `<c r="${colName(ci)}${ri + 2}" s="3"/>`;
            }
            const style = edit ? 3 : 2;
            return `<c r="${colName(ci)}${ri + 2}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
          })
          .join("");
        return `<row r="${ri + 2}">${cells}</row>`;
      })
      .join("");

    files[`xl/worksheets/sheet${si + 1}.xml`] =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      // The line Or actually asked for: the whole grid mirrors, so column A
      // is on the RIGHT and Hebrew reads outward from where it starts.
      '<sheetViews><sheetView rightToLeft="1" tabSelected="' +
      (si === 0 ? "1" : "0") +
      '" workbookViewId="0">' +
      // The header stays put while he scrolls a thousand rows.
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      "</sheetView></sheetViews>" +
      `<cols>${cols}</cols>` +
      `<sheetData>${header}${body}</sheetData>` +
      // The filter arrows, so he can hide everything already done.
      `<autoFilter ref="A1:${colName(sheet.columns.length - 1)}${sheet.rows.length + 1}"/>` +
      "</worksheet>";
  });

  /*
   * Excel holds an exclusive lock on an open workbook, and the regenerators
   * run as part of `pnpm copy` — so the ordinary case of "Or is reading the
   * document while I rebuild it" arrived as an EBUSY stack trace that said
   * nothing about Excel. It is not an error in the sense of something being
   * broken; it is the file being in use, and it needs one sentence.
   */
  try {
    writeFileSync(path, zip(files));
  } catch (err) {
    if (err.code === "EBUSY" || err.code === "EPERM") {
      console.error(`\n  ${path} is open in Excel — close it and run this again.\n`);
      process.exit(1);
    }
    throw err;
  }
}

/** Read one back: path → { sheetName: rows[][] }, strings only. */
export function readXlsx(path) {
  const files = unzip(readFileSync(path));
  const text = (name) => (files[name] ? files[name].toString("utf8") : "");

  // Excel rewrites inline strings into a shared table when it saves.
  const shared = [];
  for (const [, si] of text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push(
      [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join(""),
    );
  }

  const names = [...text("xl/workbook.xml").matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((m) =>
    unesc(m[1]),
  );

  const out = {};
  names.forEach((name, i) => {
    const xml = text(`xl/worksheets/sheet${i + 1}.xml`);
    const rows = [];
    for (const [, attrs, cells] of xml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rowNum = Number(/r="(\d+)"/.exec(attrs)?.[1] ?? rows.length + 1);
      const row = [];
      /*
       * ═══ WHY THE ATTRIBUTES ARE MATCHED LAZILY ═══
       *
       * An empty cell is written self-closing — `<c r="D2" s="3"/>` — and
       * with a GREEDY `[^>]*` this went wrong in a way that looked like data
       * corruption rather than a parsing bug.
       *
       * Greedy takes ` r="D2" s="3"/`, stopping at the `>`. The `\/>` branch
       * then fails, because the next character is `>` and the slash has been
       * eaten. But the SECOND branch, a bare `>`, matches right there — so
       * instead of backtracking one character and closing the empty cell,
       * the match ran on to the next `</c>` and consumed the cell AFTER it.
       * The empty cell came back holding its neighbour's text, and its
       * neighbour vanished.
       *
       * What that looked like from outside: every English translation
       * appearing one column to the left, in the column Or was supposed to
       * type into. *"Right now it's mixed up, Hebrew and English in the same
       * column."* — this was that.
       *
       * Lazy tries the shortest attribute list first and, at each length,
       * `\/>` BEFORE `>`. So a self-closing cell closes itself.
       */
      for (const [, cAttrs, inner] of cells.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+)\d+"/.exec(cAttrs)?.[1];
        const col = ref ? ref.split("").reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0) - 1 : row.length;
        const type = /t="([^"]*)"/.exec(cAttrs)?.[1];
        let value = "";
        if (type === "s") value = shared[Number(/<v>(\d+)<\/v>/.exec(inner ?? "")?.[1] ?? -1)] ?? "";
        else value = [...(inner ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1])).join("");
        row[col] = value;
      }
      rows[rowNum - 1] = row;
    }
    /*
     * Dense, and rectangular. A worksheet omits empty cells and omits empty
     * rows entirely, so what comes out of the XML is full of holes — and a
     * caller that reads a column by its header index has no way to tell a
     * hole from a short row. Both become "".
     */
    const width = Math.max(0, ...rows.map((r) => (r ? r.length : 0)));
    out[name] = Array.from({ length: rows.length }, (_, i) =>
      Array.from({ length: width }, (_, j) => rows[i]?.[j] ?? ""),
    );
  });
  return out;
}

const unesc = (s) =>
  String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
