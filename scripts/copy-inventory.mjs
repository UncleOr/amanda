/**
 * Collects every Hebrew string the player can see into one markdown file.
 *
 * Or writes the microcopy, so the point of this is to get the strings out of
 * the code and in front of him in reading order, with the exact place each one
 * lives. Edit the text in docs/COPY.md, hand it back, and the change can be
 * applied to the source it came from.
 *
 *   node scripts/copy-inventory.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the repo path can contain non-ASCII characters
// that a URL percent-encodes.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "apps", "client", "src");
const OUT = join(ROOT, "docs", "COPY.md");

const HEBREW = /[\u0590-\u05FF]/;
/** Strings in a quote or a JSX text node — the things a player actually reads. */
const STRING_LITERAL = /"([^"\n]*[\u0590-\u05FF][^"\n]*)"|'([^'\n]*[\u0590-\u05FF][^'\n]*)'|`([^`\n]*[\u0590-\u05FF][^`\n]*)`|>\s*([^<>{}\n]*[\u0590-\u05FF][^<>{}\n]*?)\s*</g;

/** Which screen each file is responsible for, in the order a player meets it. */
const SECTIONS = [
  ["App.tsx", "מסכי המשחק — פתיחה, בנייה, קרב, תוצאה"],
  ["components/BattleLog.tsx", "דוח הקרב"],
  ["components/CardDetailModal.tsx", "חלון פרטי מפלצת"],
  ["components/ActionDetailModal.tsx", "חלון פרטי קלף פעולה"],
  ["components/ActionCardView.tsx", "קלף פעולה"],
  ["components/CardView.tsx", "קלף מפלצת"],
  ["components/BoardGrid.tsx", "הלוח"],
  ["components/Arena.tsx", "זירת הקרב"],
  ["components/CardGallery.tsx", "גלריית קלפים (כלי פיתוח)"],
  ["components/ArenaPreview.tsx", "מעבדת קרב (כלי פיתוח)"],
  ["data/cardMeta.ts", "טבלאות נתונים — אלמנטים, נדירות, סדרות, יכולות"],
  ["data/catalog.ts", "נתוני קלפים"],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function stringsIn(file) {
  const found = [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // skip comments — they are notes to developers, not copy
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (!HEBREW.test(line)) return;
    for (const m of line.matchAll(STRING_LITERAL)) {
      const text = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
      if (text && HEBREW.test(text)) found.push({ line: i + 1, text });
    }
  });
  return found;
}

const files = walk(SRC);
const byRel = new Map(files.map((f) => [relative(SRC, f).replace(/\\/g, "/"), f]));
const ordered = [
  ...SECTIONS.filter(([rel]) => byRel.has(rel)),
  ...[...byRel.keys()].filter((rel) => !SECTIONS.some(([s]) => s === rel)).map((rel) => [rel, rel]),
];

let total = 0;
const parts = [
  "# מילון הטקסטים של אמנדה",
  "",
  "כל טקסט שהשחקן רואה, לפי סדר המסכים. אפשר לערוך כאן ולהחזיר — הטקסט החדש",
  "ייכנס בדיוק למקום שממנו נלקח.",
  "",
  "הקובץ נוצר אוטומטית: `node scripts/copy-inventory.mjs`. אל תערכו אותו בלי",
  "להעביר את השינויים הלאה — הרצה נוספת תדרוס אותו.",
  "",
];

for (const [rel, title] of ordered) {
  const items = stringsIn(byRel.get(rel));
  if (!items.length) continue;
  total += items.length;
  parts.push(`## ${title}`, "", `\`apps/client/src/${rel}\``, "", "| שורה | טקסט |", "| --- | --- |");
  for (const it of items) parts.push(`| ${it.line} | ${it.text.replace(/\|/g, "\\|")} |`);
  parts.push("");
}

parts.splice(8, 0, `סה"כ ${total} טקסטים.`, "");

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(OUT, parts.join("\n"), "utf8");
console.log(`${total} strings -> docs/COPY.md`);
