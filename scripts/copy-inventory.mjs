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
import { idFor, slotify } from "./copy-slots.mjs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname — the repo path can contain non-ASCII characters
// that a URL percent-encodes.
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "apps", "client", "src");
const OUT = join(ROOT, "docs", "COPY.md");
export const MAP = join(ROOT, "docs", "copy.map.json");
/**
 * The English of every screen string, by id.
 *
 * It is read back in here so that regenerating the document NEVER loses a
 * translation — the English column comes out pre-filled with whatever has
 * already been written, and only the empty cells are work left to do.
 */
export const EN = join(ROOT, "data", "copy.en.json");

const HEBREW = /[֐-׿]/;
/** Make a literal safe to drop into a RegExp. */
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A string in quotes or a JSX text node — the things a player actually reads. */
/*
 * ═══ THE JSX BRANCH TAKES A LINE END AS A BOUNDARY, NOT JUST A `<` ═══
 *
 * It used to require `>text<` on one line, and this codebase does not often
 * write that. It writes
 *
 *     <button>
 *       <Icon name="deck" size={18} /> האלבום שלי
 *     </button>
 *
 * where the text begins after a `/>` and ends at the newline. Twelve strings
 * on the home screen alone were never collected — not untranslated, absent:
 * "my album", "the playground", "how to play", "what's new". They surfaced
 * only when the game was switched to English and they were still Hebrew.
 *
 * So the RIGHT boundary may now be the end of the line. The left one must
 * still be a `>`: letting it be the start of the line as well matched whole
 * lines of ordinary code — `t("sf076071", "כבר הולך?"),` came back as a
 * string — and produced 354 nonsense rows while losing 217 real ones.
 */
/*
 * The `(?<![=\-!<>])>(?!=)` is a comparison guard. `(f) => t("sa039c8a", "…")` ends in
 * a `>` too, so without it the fat arrow became the left boundary and the
 * whole line of code came back as a string — taking the real strings inside
 * it out of the document at the same time. `>=` needed the lookahead for the
 * same reason: `if (c.stats.hp >= 800) return t("sdf5d45f", "הוא עבה");`.
 */
const STRING_LITERAL =
  /"([^"\n]*[֐-׿][^"\n]*)"|'([^'\n]*[֐-׿][^'\n]*)'|`([^`\n]*[֐-׿][^`\n]*)`|(?<![=\-!<>])>(?!=)\s*([^<>{}\n]*[֐-׿][^<>{}\n]*?)\s*(?=<|$)/gm;

/**
 * One editable string. `where` is enough to find it again, and to verify it has
 * not moved underneath us before writing anything.
 */
function entry(id, section, text, where) {
  return { id, section, text, where };
}

/**
 * An id that does not move when the file around it does.
 *
 * ═══ THESE USED TO BE COUNTERS ═══
 *
 * `s1, s2, s3…` in the order the files were walked. That was fine while the
 * ids only lived in this document and the sidecar map, both regenerated
 * together. It stops being fine now, for two reasons that arrived on the
 * same day: the ids are written INTO the source by copy-codemod.mjs, and
 * data/copy.en.json is keyed by them. Add one Hebrew string near the top of
 * App.tsx and every id after it shifts by one — silently reattaching several
 * hundred English translations to the wrong lines.
 *
 * So the id is derived from what it identifies: the file, the text, and
 * which occurrence of that text in that file it is. Adding a string changes
 * nothing but its own id.
 */
const seen = new Map();
const id = (prefix, relFile, text) => idFor(seen, prefix, relFile, text);

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
    for (const f of found) {
      const e = entry(id("d", rel, f.text), section, f.text, {
        kind: "json",
        file: rel,
        path: f.path,
      });
      /*
       * Card text is already bilingual — every name, ability and role in
       * these files is a LocalizedString, so the English is sitting one key
       * away from the Hebrew we just read. Carrying it across means a third
       * of this document arrives translated instead of asking Or to write
       * 182 English card names that already exist.
       */
      const path = f.path;
      if (path[path.length - 1] === "he") {
        let node = json;
        for (const key of path.slice(0, -1)) node = node?.[key];
        if (typeof node?.en === "string") e.en = node.en;
      }
      entries.push(e);
    }
  }
}

// ── the client screens ─────────────────────────────────────────────
/**
 * The admin panel is not in here, and this document is the reason.
 *
 * It opens with "every text a player sees", and an admin screen is not one:
 * it is a tool for one adult, and the style guide makes it the single place
 * in the game allowed to explain itself. It had crept in anyway — 300 of the
 * 1,194 rows were Admin*.tsx — because the panel was built after this script
 * and nothing here ever said not to.
 *
 * It matters more now than it did. The document has an English column, and
 * three hundred rows of a Hebrew tool in it is three hundred rows of work
 * that must never be done.
 */
const SKIP = /^Admin|^components[\/]Admin|CardEditor|^lab[\/]/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !SKIP.test(name)) out.push(p);
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

/**
 * A paragraph of JSX text spread over several lines.
 *
 * ═══ THE ABOUT SCREEN WAS INVISIBLE ═══
 *
 * This file works a line at a time, and a <p> whose sentence wraps has no
 * single line that is the string:
 *
 *     <p>
 *       הכירו את אמנדה: המפלצת הכי חזקה באלבום המפלצות. דרקונים יורקי אש, ענקי
 *       אבן, אפילו צ'ופי המחשמל — כולם ניסו להילחם בה ונכשלו. אמנדה אכלה את
 *       כולם לארוחת ערב, והיא תשמח לאכול גם אתכם לקינוח.
 *     </p>
 *
 * So 127 lines of Hebrew produced no row at all, and nearly all of them were
 * About, privacy and terms — the most text there is in the game. Switching to
 * English left the whole screen in Hebrew with nothing in the document to
 * blame.
 *
 * A block is a run of two or more lines that carry nothing but text: no tag,
 * no brace, no quote. Anything mixed — a paragraph with a <b> or an already
 * converted t() inside it — is left to the line-by-line pass, because
 * joining it would move code into a string.
 */
/*
 * Apostrophes are allowed: צ'ופי has one, and excluding them threw out
 * whole paragraphs. A single-quoted JS string cannot be mistaken for text
 * here anyway — a block only counts when the line before it ends with a
 * `>` and the line after starts with a `<`.
 */
const PLAIN = /^[^<>{}"`]+$/;

function textBlocks(lines) {
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!PLAIN.test(lines[i].trim()) || !lines[i].trim()) continue;
    let j = i;
    while (j + 1 < lines.length && lines[j + 1].trim() && PLAIN.test(lines[j + 1].trim())) j++;
    const before = lines[i - 1]?.trim() ?? "";
    const after = lines[j + 1]?.trim() ?? "";
    const run = lines.slice(i, j + 1);
    /*
     * One line counts too. A <button> whose label sits on its own line is
     * the same text node as a paragraph, just shorter, and requiring two
     * lines left "קדימה", "← חזרה" and "לראות שוב את הפתיח" uncollected.
     */
    /*
     * A brace bounds a text node just as a tag does. "מה חדש" sits between
     * a `>` above and a `{newsUnread && …}` below, and insisting on a `<`
     * underneath left it — and the rest of its kind — uncollected.
     */
    const opens = before.endsWith(">") || before.endsWith("}");
    const closes = after.startsWith("<") || after.startsWith("{");
    if (opens && closes && run.some((l) => HEBREW.test(l))) {
      blocks.push({ from: i, to: j, text: run.map((l) => l.trim()).join(" ") });
    }
    i = j;
  }
  return blocks;
}

function fromLines(entries, relFile, lines, section, prefix) {
  const consumed = new Set();
  /** Inside a multi-line {/* … *\/} JSX comment. */
  let inJsxComment = false;
  for (const b of textBlocks(lines)) {
    for (let k = b.from; k <= b.to; k++) consumed.add(k);
    entries.push(
      entry(id(prefix, relFile, b.text), section, b.text, {
        kind: "source",
        file: relFile,
        line: b.from + 1,
        endLine: b.to + 1,
      }),
    );
  }

  lines.forEach((line, i) => {
    if (consumed.has(i)) return;
    const trimmed = line.trim();
    /*
     * Comments are notes to developers, not copy — INCLUDING JSX ones.
     *
     * `{/* "בן"/"בת", and the third is not "לא אומר" — … *\/}` is a comment
     * explaining why three buttons are worded the way they are. It was read
     * as three strings, and the codemod then rewrote the comment to quote
     * ids instead of words, destroying the explanation it existed to give.
     */
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("{/*") ||
      inJsxComment
    ) {
      if (trimmed.includes("*/")) inJsxComment = false;
      else if (trimmed.startsWith("{/*")) inJsxComment = true;
      return;
    }
    if (!HEBREW.test(line)) return;
    for (const m of line.matchAll(STRING_LITERAL)) {
      const text = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
      if (!text || !HEBREW.test(text)) continue;
      /*
       * A capture that swallowed markup is not a string.
       *
       * The JSX branch of the pattern matches between a > and a <, and on a
       * line holding two elements it runs straight through the tag between
       * them — producing rows like `size={14} /> אפשר להניח קלף`. Harmless
       * while this document was Hebrew only; with an English column it asks
       * Or to translate a fragment of JSX.
       */
      if (/[<>]|=\{/.test(text)) continue;

      /*
       * A template literal shows its slots, not its expressions.
       *
       * `${e.actor} הפיל את ${e.target}` is listed as `{0} הפיל את {1}`,
       * because the expressions are not text and nobody can translate them.
       * The raw form is kept beside it: until copy-codemod.mjs converts the
       * line, that is still what is written in the file, and both the apply
       * step and the codemod need to be able to find it there.
       */
      /*
       * A Hebrew string with its English twin on the same line.
       *
       * cardMeta.ts holds the game's vocabulary as `{ he: "נדיר", en:
       * "Rare" }` — bilingual in place, read by say(), and deliberately left
       * alone by the codemod. Without this the document would list all 48 of
       * them as untranslated and ask for English that is already two columns
       * to the right in the source.
       */
      const twin = line.match(
        new RegExp(escapeRe(text) + "[\"'`]\\s*,\\s*en:\\s*[\"'`]([^\"'`]+)"),
      );

      const isTemplate = m[3] !== undefined && text.includes("${");
      const slots = isTemplate ? slotify(text) : null;
      if (isTemplate && !slots) continue; // unbalanced braces — do not guess
      const shown = slots ? slots.text : text;

      entries.push(
        entry(id(prefix, relFile, shown), section, shown, {
          kind: "source",
          file: relFile,
          line: i + 1,
          ...(slots ? { raw: text } : {}),
        }),
      );
      if (twin) entries[entries.length - 1].en = twin[1];
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
const english = existsSync(EN) ? JSON.parse(readFileSync(EN, "utf8")) : {};
const translated = entries.filter((e) => english[e.id] ?? e.en).length;
const parts = [
  "# הטקסטים של אמנדה",
  "",
  `כל טקסט שהשחקן רואה — ${entries.length} במספר, ${translated} מהם כבר באנגלית.`,
  "",
  "## איך עורכים",
  "",
  "**שתי עמודות למלא, ושתיהן אופציונליות.**",
  "",
  "| עמודה | למה היא |",
  "| --- | --- |",
  "| `טקסט חדש` | לשנות את העברית. מה שנשאר ריק לא ישתנה |",
  "| `אנגלית` | התרגום. מה שנשאר ריק פשוט יישאר בעברית במשחק |",
  "",
  "אחר כך אומרים לי, ואני מריץ `pnpm copy:apply`: העברית נכתבת בחזרה לקוד",
  "— לכל טקסט יש מזהה שיודע בדיוק מאיפה הוא נלקח — והאנגלית נכתבת ל-",
  "`data/copy.en.json`, שהמשחק טוען כשבוחרים אנגלית.",
  "",
  "אל תשנו את עמודת המזהה ואל תמחקו שורות. אם טקסט מופיע פעמיים ברשימה, הוא",
  "באמת מופיע פעמיים במשחק — אפשר לשנות כל אחד בנפרד.",
  "",
  "> **מה לא לתרגם מילולית:** הקול של אמנדה. היא דמות, ו-`\"ילד ילד ילד, בוא",
  "> להילחם\"` שעובר מילה במילה מפסיק להיות היא. עדיף לכתוב לה שורה חדשה",
  "> באנגלית מאשר לתרגם את זו.",
  "",
];

for (const [section, items] of bySection) {
  parts.push(
    `## ${section}`,
    "",
    "| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |",
    "| --- | --- | --- | --- |",
  );
  for (const e of items)
    parts.push(`| ${e.id} | ${esc(e.text)} | | ${esc(english[e.id] ?? e.en ?? "")} |`);
  parts.push("");
}

mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(OUT, parts.join("\n"), "utf8");
writeFileSync(MAP, JSON.stringify(entries, null, 1), "utf8");
console.log(
  `${entries.length} strings -> docs/COPY.md (+ docs/copy.map.json)
` +
    `${translated} of them already carry English; ${entries.length - translated} to go.`,
);
