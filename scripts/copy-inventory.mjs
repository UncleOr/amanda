/**
 * Collects every Hebrew string a player can see into one document Or can edit,
 * and keeps a sidecar map so his edits can be written straight back.
 *
 * Or writes the copy; this exists so he never has to open a source file to do
 * it. He fills the "טקסט חדש" column in docs/COPY.md and nothing else.
 *
 *   node scripts/copy-inventory.mjs    regenerate the document
 *   node scripts/copy-apply.mjs        write his edits back into the source
 *
 * Covered: card and series names, ability and role text, action cards, every
 * screen string in the client, and the game's name in the page title and the
 * installed-app manifest.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the repo path can contain non-ASCII characters
// that a URL percent-encodes.
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "apps", "client", "src");
const OUT = join(ROOT, "docs", "COPY.md");
export const MAP = join(ROOT, "docs", "copy.map.json");

const HEBREW = /[֐-׿]/;
/** A string in quotes or a JSX text node — the things a player actually reads. */
const STRING_LITERAL =
  /"([^"\n]*[֐-׿][^"\n]*)"|'([^'\n]*[֐-׿][^'\n]*)'|`([^`\n]*[֐-׿][^`\n]*)`|>\s*([^<>{}\n]*[֐-׿][^<>{}\n]*?)\s*</g;

/**
 * One editable string. `where` is enough to find it again, and to verify it has
 * not moved underneath us before writing anything.
 */
function entry(id, section, text, where) {
  return { id, section, text, where };
}

// ── the card data ──────────────────────────────────────────────────
/** Every Hebrew leaf in a JSON file, as a path the apply step can follow. */
function jsonStrings(value, path, out) {
  if (Array.isArray(value)) value.forEach((v, i) => jsonStrings(v, [...path, i], out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) jsonStrings(v, [...path, k], out);
  else if (typeof value === "string" && HEBREW.test(value)) out.push({ path, text: value });
}

function collectData(entries) {
  const seriesDir = join(ROOT, "data", "series");
  const files = [
    ...readdirSync(seriesDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(seriesDir, f)),
    join(ROOT, "data", "action-cards.json"),
  ];
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const json = JSON.parse(readFileSync(file, "utf8"));
    const found = [];
    jsonStrings(json, [], found);
    const isActions = rel.endsWith("action-cards.json");
    const section = isActions ? "קלפי פעולה" : `סדרה — ${json.name?.he ?? rel}`;
    for (const f of found)
      entries.push(
        entry(`d${entries.length + 1}`, section, f.text, {
          kind: "json",
          file: rel,
          path: f.path,
        }),
      );
  }
}

// ── the client screens ─────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Which screen each file is responsible for, in the order a player meets it. */
const SECTIONS = [
  // Put the variant lines first: they are the ones worth most attention, and
  // each row there is one of several things Amanda might say at that moment.
  ["data/voice.ts", "הקול של אמנדה — שורות מתחלפות (כמה גרסאות לכל רגע)"],
  ["App.tsx", "מסכי המשחק — פתיחה, בנייה, קרב, תוצאה"],
  ["components/BattleLog.tsx", "דוח הקרב"],
  ["components/CardDetailModal.tsx", "חלון פרטי מפלצת"],
  ["components/ActionDetailModal.tsx", "חלון פרטי קלף פעולה"],
  ["components/ActionCardView.tsx", "תווית קלף פעולה"],
  ["components/CardView.tsx", "קלף מפלצת"],
  ["components/BoardGrid.tsx", "הלוח"],
  ["components/Arena.tsx", "זירת הקרב"],
  ["components/CardGallery.tsx", "גלריית קלפים (כלי פיתוח)"],
  ["components/ArenaPreview.tsx", "מעבדת קרב (כלי פיתוח)"],
  ["data/cardMeta.ts", "טבלאות — אלמנטים, נדירות, סדרות, יכולות"],
  ["data/catalog.ts", "נתוני קלפים"],
];

function fromLines(entries, relFile, lines, section, prefix) {
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // comments are notes to developers, not copy
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (!HEBREW.test(line)) return;
    for (const m of line.matchAll(STRING_LITERAL)) {
      const text = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
      if (!text || !HEBREW.test(text)) continue;
      entries.push(
        entry(`${prefix}${entries.length + 1}`, section, text, {
          kind: "source",
          file: relFile,
          line: i + 1,
        }),
      );
    }
  });
}

function collectSource(entries) {
  const files = walk(SRC);
  const byRel = new Map(files.map((f) => [relative(SRC, f).replace(/\\/g, "/"), f]));
  const ordered = [
    ...SECTIONS.filter(([rel]) => byRel.has(rel)),
    ...[...byRel.keys()].filter((rel) => !SECTIONS.some(([s]) => s === rel)).map((r) => [r, r]),
  ];
  for (const [rel, title] of ordered)
    fromLines(
      entries,
      `apps/client/src/${rel}`,
      readFileSync(byRel.get(rel), "utf8").split(/\r?\n/),
      title,
      "s",
    );
}

/** The game's name where it lives outside the app itself. */
function collectChrome(entries) {
  for (const rel of ["apps/client/index.html", "apps/client/public/manifest.webmanifest"]) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    fromLines(
      entries,
      rel,
      readFileSync(abs, "utf8").split(/\r?\n/),
      "שם המשחק וכותרות הדפדפן",
      "h",
    );
  }
}

const entries = [];
collectChrome(entries);
collectData(entries);
collectSource(entries);

// ── write the document ─────────────────────────────────────────────
const bySection = new Map();
for (const e of entries) {
  if (!bySection.has(e.section)) bySection.set(e.section, []);
  bySection.get(e.section).push(e);
}

const esc = (t) => t.replace(/\|/g, "\\|");
const parts = [
  "# הטקסטים של אמנדה",
  "",
  `כל טקסט שהשחקן רואה — ${entries.length} במספר.`,
  "",
  "## איך עורכים",
  "",
  "ממלאים **רק את העמודה האחרונה** (`טקסט חדש`). מה שנשאר ריק פשוט לא ישתנה.",
  "אחר כך אומרים לי, ואני מריץ `pnpm copy:apply` שכותב את השינויים בחזרה לקוד —",
  "לכל טקסט יש מזהה שיודע בדיוק מאיפה הוא נלקח.",
  "",
  "אל תשנו את עמודת המזהה ואל תמחקו שורות. אם טקסט מופיע פעמיים ברשימה, הוא",
  "באמת מופיע פעמיים במשחק — אפשר לשנות כל אחד בנפרד.",
  "",
];

for (const [section, items] of bySection) {
  parts.push(`## ${section}`, "", "| מזהה | טקסט נוכחי | טקסט חדש |", "| --- | --- | --- |");
  for (const e of items) parts.push(`| ${e.id} | ${esc(e.text)} | |`);
  parts.push("");
}

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(OUT, parts.join("\n"), "utf8");
writeFileSync(MAP, JSON.stringify(entries, null, 1), "utf8");
console.log(`${entries.length} strings -> docs/COPY.md (+ docs/copy.map.json)`);
