/**
 * The arena stories, in a document Or can sit and write in.
 *
 *   node scripts/arena-stories.mjs            build docs/ARENA-STORIES.md
 *   node scripts/arena-stories.mjs --apply    write his edits back into the game
 *   node scripts/arena-stories.mjs --apply --dry-run
 *
 * ═══ WHY THIS IS NOT COPY.xlsx ═══
 *
 * Or: *"make me a simple document where I edit only the arena stories, I'll
 * sit on it with Hod in the evening."*
 *
 * The copy document already carries these — 1,429 rows of every string in the
 * game, which is the right tool for a sweep and the wrong one for an evening
 * at the table with a seven-year-old. This is eight blocks of Hebrew and
 * nothing else: the name of a place, the one line on its locked card, and the
 * story you are told when you first arrive.
 *
 * ═══ AND IT WILL NOT OVERWRITE ANYTHING BY POSITION ═══
 *
 * Same rule as copy-apply.mjs: before a line is replaced, the text currently
 * in arenas.ts must still be exactly the text this document was generated
 * from. If something moved, that block is reported and skipped. A writing
 * tool must never be the reason a line of the game goes missing.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "packages", "shared", "src", "arenas.ts");
const DOC = join(ROOT, "docs", "ARENA-STORIES.md");
/**
 * What the game said when the document was built.
 *
 * ⚠ Without this the staleness check is a tautology, and it was one: the
 * apply step re-reads arenas.ts, so comparing the source against the source
 * always matched and a document written a week ago would quietly flatten
 * anything changed since. This file is the third party that can tell them
 * apart. It is not for Or to read.
 */
const LOCK = join(ROOT, "docs", "arena-stories.lock.json");
const APPLY = process.argv.includes("--apply");
const DRY = process.argv.includes("--dry-run");

/** Which family you first meet at each arena, in words rather than ids. */
const FAMILY = {
  slimes: "הדביקים",
  insects: "החרקים",
  machines: "המכונות",
  sea: "שוכני הים",
  strays: "חיות הרחוב",
  foods: "המאכלים",
  galactics: "הגלקטיים",
  demons: "השדים",
};

/**
 * Pull every arena out of the source.
 *
 * Read with a regex rather than by importing the module, because the apply
 * half has to put the text back on the LINE it came from — and an import
 * gives values with no idea where they were written.
 */
function readArenas() {
  const text = readFileSync(SRC, "utf8");
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  lines.forEach((line, i) => {
    const id = line.match(/^\s*id: "([a-z_]+)",\s*$/);
    if (id) {
      cur = { id: id[1], line: i };
      out.push(cur);
      return;
    }
    if (!cur) return;
    const name = line.match(/^\s*name: \{ he: "(.*?)", en: "(.*?)" \},\s*$/);
    if (name) cur.name = { he: name[1], en: name[2], line: i };
    const from = line.match(/^\s*from: (\d+),\s*$/);
    if (from) cur.from = Number(from[1]);
    const intro = line.match(/^\s*introduces: "([a-z_]+)",\s*$/);
    if (intro) cur.introduces = intro[1];
    if (/^\s*locked: true,\s*$/.test(line)) cur.locked = true;
    const tease = line.match(/^\s*tease: \{ he: "(.*?)", en: "(.*?)" \},\s*$/);
    if (tease) cur.tease = { he: tease[1], en: tease[2], line: i };
    // `story` is a block: `story: {` then `he: "…",` then `en: "…",`.
    if (/^\s*story: \{\s*$/.test(line)) {
      const he = (lines[i + 1] ?? "").match(/^\s*he: "(.*)",\s*$/);
      const en = (lines[i + 2] ?? "").match(/^\s*en: "(.*)",\s*$/);
      if (he && en) cur.story = { he: he[1], en: en[1], line: i + 1, enLine: i + 2 };
    }
  });
  return out.filter((a) => a.name && a.story);
}

/* ───────────────────────── writing the document ───────────────────────── */

const HEAD = `# הסיפורים של הארנות

**זה המסמך היחיד שצריך לערוך בשביל הסיפורים.** כל השאר במשחק לא מושפע.

לכל מקום יש שני דברים לכתוב:

- **הרמז** — שורה אחת. זה מה שרואים על הארנה כשהיא עוד נעולה.
- **הסיפור** — מה שקוראים כשמגיעים לשם בפעם הראשונה. אפשר כמה שורות.

**איך עורכים:** פשוט מוחקים את הטקסט וכותבים במקומו, באותה שורה.
אל תמחקו את השורות עם \`**רמז**\` ו\`**סיפור**\` ואל תגעו בשורות שמתחילות
ב-\`<!--\`. כשסיימתם — תגידו לי ואני אכניס את זה למשחק.

**האנגלית היא טיוטה שלי** ותתעדכן אחרי שתכתבו. אל תתעסקו איתה.

---
`;

function buildDoc(arenas) {
  const parts = [HEAD];
  arenas.forEach((a, i) => {
    const where = a.locked ? "🔒 נעולה" : `${a.from.toLocaleString("en-US")} גביעים`;
    const meets = a.introduces ? ` · פוגשים: ${FAMILY[a.introduces] ?? a.introduces}` : "";
    parts.push(
      `\n## ${i + 1} · ${a.name.he}\n` +
        `<!-- id: ${a.id} -->\n` +
        `*${where}${meets}*\n\n` +
        `**רמז**\n${a.tease.he}\n\n` +
        `**סיפור**\n${a.story.he}\n`,
    );
  });
  parts.push(`
---

## מקומות שעוד אין להם סיפור

אלה שני המקומות החדשים מהסולם ששלחת. אין להם עדיין כלום במשחק —
תכתבו, ואני אבנה אותם.

### החתוליה
*פוגשים: ?*

**רמז**


**סיפור**


### החניון
*פוגשים: המכונות*

**רמז**


**סיפור**

`);
  writeFileSync(DOC, parts.join(""), "utf8");
  const lock = {};
  for (const a of arenas) lock[a.id] = { tease: a.tease.he, story: a.story.he };
  writeFileSync(LOCK, JSON.stringify(lock, null, 1) + "\n", "utf8");
  console.log(`\n${arenas.length} ארנות -> docs/ARENA-STORIES.md\n`);
}

/* ───────────────────────── reading it back ───────────────────────── */

/** The text under a `**label**` line, up to the next blank line. */
function fieldsFromDoc() {
  const lines = readFileSync(DOC, "utf8").split(/\r?\n/);
  const out = new Map();
  let id = null;
  let field = null;
  let buf = [];
  const flush = () => {
    if (id && field) {
      const text = buf.join(" ").replace(/\s+/g, " ").trim();
      if (text) out.set(`${id}:${field}`, text);
    }
    field = null;
    buf = [];
  };
  for (const line of lines) {
    const marker = line.match(/^<!--\s*id:\s*([a-z_]+)\s*-->/);
    if (marker) {
      flush();
      id = marker[1];
      continue;
    }
    if (/^##/.test(line)) {
      flush();
      // A heading with no id marker under it is one of the unbuilt places.
      id = null;
      continue;
    }
    if (/^\*\*רמז\*\*\s*$/.test(line)) {
      flush();
      field = "tease";
      continue;
    }
    if (/^\*\*סיפור\*\*\s*$/.test(line)) {
      flush();
      field = "story";
      continue;
    }
    if (field === null) continue;
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^[*_#]/.test(line.trim())) {
      flush();
      continue;
    }
    buf.push(line.trim());
  }
  flush();
  return out;
}

function apply(arenas) {
  const edits = fieldsFromDoc();
  const lines = readFileSync(SRC, "utf8").split(/\r?\n/);
  const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : null;
  if (!lock) {
    console.log(
      "  ⚠ אין קובץ נעילה — אי אפשר לדעת אם המשחק השתנה מאז שהמסמך נבנה.\n" +
        "    כל שינוי מודפס למטה, תסתכלו עליו.\n",
    );
  }
  const planned = [];
  let changed = 0;

  for (const a of arenas) {
    for (const field of ["tease", "story"]) {
      const next = edits.get(`${a.id}:${field}`);
      if (next === undefined) continue;
      const here = a[field];
      if (next === here.he) continue;
      /*
       * The check that is not a tautology: what the GAME says now must still
       * be what the DOCUMENT was built from. Comparing the source against
       * itself (which is what this did first) always matches, so a document
       * written last week would silently flatten anything changed since.
       */
      const was = lock?.[a.id]?.[field];
      if (lock && was !== here.he) {
        planned.push(
          `⚠ דילגתי על ${a.name.he} (${field === "tease" ? "רמז" : "סיפור"}) — ` +
            `הטקסט במשחק השתנה מאז שהמסמך נבנה.\n   במשחק עכשיו: ${here.he}`,
        );
        continue;
      }
      const line = lines[here.line] ?? "";
      if (!line.includes(`"${here.he}"`)) {
        planned.push(`⚠ דילגתי על ${a.name.he} (${field}) — לא מצאתי את השורה`);
        continue;
      }
      lines[here.line] = line.replace(`"${here.he}"`, `"${next.replace(/"/g, '\\"')}"`);
      planned.push(`${a.name.he} · ${field}\n   ${here.he}\n   -> ${next}`);
      changed++;
    }
  }

  for (const note of planned) console.log("  " + note.replace(/\n/g, "\n  "));
  if (!changed) {
    console.log("\n  אין שינויים.\n");
    return;
  }
  if (DRY) {
    console.log(`\n  ניסיון בלבד: ${changed} שינויים.\n`);
    return;
  }
  writeFileSync(SRC, lines.join("\n"), "utf8");
  console.log(`\n  ${changed} שינויים נכנסו ל-packages/shared/src/arenas.ts\n`);
}

const arenas = readArenas();
if (!arenas.length) {
  console.error("לא נמצאו ארנות ב-" + SRC);
  process.exit(1);
}
if (APPLY) apply(arenas);
else buildDoc(arenas);
