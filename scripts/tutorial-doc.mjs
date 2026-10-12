/**
 * The whole tutorial, written out for Or to edit.
 *
 *   node scripts/tutorial-doc.mjs           → docs/TUTORIAL.md
 *
 * Or: *"write me in some text file all the tutorial steps, I'll fix the text
 * file and then you build from it."*
 *
 * ═══ GENERATED, BECAUSE THE ALTERNATIVE DRIFTS ═══
 *
 * The lines live in data/tutorialLines.ts, the order they fire in lives in
 * game/coach.ts, and the two lessons live in game/lessons.ts. A document
 * typed out by hand from those three is accurate for one afternoon. This one
 * is read out of them, so re-running it is how it stays true.
 *
 * ═══ WHAT OR IS ACTUALLY EDITING ═══
 *
 * Two different things, and the document keeps them apart:
 *
 *   - the WORDS, which go in the "טקסט חדש" column and come back through
 *     `pnpm copy:apply` like every other string in the game;
 *   - the STEPS — their order, what each one waits for, and whether it says
 *     what to DO. That is what he reported ("there are parts where it isn't
 *     clear what you're supposed to do"), and it cannot be fixed by rewording
 *     alone, so every row also shows its trigger, its target and its gate.
 *
 * A step with no gate shows a "continue" button and moves on when it is read.
 * A step WITH one waits for the player to do the thing — and a step that asks
 * for something specific while gating on something general is exactly how
 * "I don't know what it wants" happens. Those are marked.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { writeXlsx } from "./xlsx.mjs";

const read = (p) => readFileSync(p, "utf8");

/**
 * The English already written for a line, by its copy id.
 *
 * Pre-filled rather than left blank, because every one of these lines is
 * already translated — handing back an empty English column would be
 * asking for a thousand translations that exist.
 */
const ENGLISH = JSON.parse(read("data/copy.en.json"));
const english = (id) => (id && ENGLISH[id]) || "";

/**
 * Hebrew → copy id, for the handful of strings this document names by sight
 * rather than reads out of the tutorial data. Built from the inventory, so a
 * string that is renamed in the game stops resolving here instead of
 * resolving to the wrong thing.
 */
const byText = new Map(
  JSON.parse(read("docs/copy.map.json")).map((e) => [e.text, e.id]),
);

/**
 * Card id → the Hebrew name.
 *
 * The decks and the opponent boards are written in ids, which is right for
 * code and useless to Or: `giants_01_stone_colossus` is not a monster he can
 * picture. Resolved from the series files so the document names the creature.
 */
const NAMES = new Map([["crumb_demon", "מפלצת פירורים"]]);
for (const f of readdirSync("data/series")) {
  const series = JSON.parse(read(`data/series/${f}`));
  for (const c of series.cards ?? []) if (c.id && c.name?.he) NAMES.set(c.id, c.name.he);
}
// action-cards.json is a bare ARRAY, not { cards: [...] } like the series.
for (const c of JSON.parse(read("data/action-cards.json")))
  if (c.id && c.name?.he) NAMES.set(c.id, c.name.he);

/** "שם הקלף" when we know it, else the bare id so nothing silently vanishes. */
const named = (id) => (NAMES.has(id) ? `**${NAMES.get(id)}**` : `\`${id}\``);

const LINES_SRC = read("apps/client/src/data/tutorialLines.ts");
const COACH_SRC = read("apps/client/src/game/coach.ts");
const LESSONS_SRC = read("apps/client/src/game/lessons.ts");

/**
 * The copy id out of a t("id", "text") call, when there is one.
 *
 * It is what makes the spreadsheet APPLICABLE rather than a memo. Without it
 * a rewritten line has to be found again by hand among a thousand rows of
 * COPY.md before anything can be done with it, and that is the step where an
 * edit quietly stops existing.
 */
function copyId(raw) {
  return /\bt\(\s*"([a-z][0-9a-f]{7})"/.exec(raw)?.[1] ?? "";
}

/** The shipped Hebrew out of a t("id", "text") call, or a bare "text". */
function shipped(raw) {
  const m = /\bt\(\s*"[a-z][0-9a-f]{7}",\s*"((?:[^"\\]|\\.)*)"\s*\)/.exec(raw);
  if (m) return JSON.parse(`"${m[1]}"`);
  const bare = /^\s*"((?:[^"\\]|\\.)*)"\s*$/.exec(raw);
  return bare ? JSON.parse(`"${bare[1]}"`) : raw.trim();
}

// ── the lines ─────────────────────────────────────────────────────────
const lines = new Map();
for (const block of LINES_SRC.split(/\n  \{\n/).slice(1)) {
  const id = /id:\s*"([^"]+)"/.exec(block)?.[1];
  if (!id) continue;
  const heRaw = /he:\s*([\s\S]*?),\n\s*vars:/.exec(block)?.[1] ?? "";
  const he = shipped(heRaw);
  const cid = copyId(heRaw);
  const vars = (/vars:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? "")
    .split(",").map((v) => v.trim().replace(/"/g, "")).filter(Boolean);
  const when = shipped(/when:\s*([\s\S]*?),?\n\s*\}/.exec(block)?.[1] ?? "");
  lines.set(id, { id, he, vars, when, cid });
}

// ── the order they fire in, and what each one waits for ───────────────
//
// TWO sequences, not one. `nextCue` tries the counter cues FIRST, but only
// from the second lesson on — by then the walkthrough has been given once and
// the thing that needs explaining is the board opposite. Flattening them into
// a single list would describe a tutorial nobody actually plays.
function scan(src) {
  /*
   * Split on the step boundary rather than windowing a regex over the file.
   *
   * The windowed version silently dropped six steps: a long block ran past
   * the character budget, the lazy match backtracked, and the scan carried
   * on from the NEXT id it could reach. A document generated from the code
   * that quietly omits a quarter of it is worse than one typed by hand,
   * because it looks authoritative.
   *
   * `() =>` at four spaces of indent begins every entry in both arrays, so
   * splitting on it gives one piece per step, exactly.
   */
  return src
    .split(/\n {4}\(\) =>/)
    .flatMap((chunk) => {
      /*
       * The LAST step is one arrow holding TWO cues, and both ids are
       * template literals counting the board — `any-bar-${n}` and `any-${n}`
       * — so the walkthrough fires once per CARD rather than once per match.
       * Neither is a line id, so that chunk is taken apart by hand.
       */
      const multi = [
        ["id: `any-bar-", "action-early", ".hand", "bar"],
        ["id: `any-", "any", ".side--me .board", "placements"],
      ].filter(([needle]) => chunk.includes(needle));
      if (multi.length > 1)
        return multi.map(([, id, target, gate]) => ({ id, target, gate }));

      const id = /id:\s*[`"]([a-z0-9-]+)/.exec(chunk)?.[1];
      if (!id || !lines.has(id)) return [];
      // `target: board` is a const inside counterCues; both its values literal.
      const target =
        /target:\s*"([^"]+)"/.exec(chunk)?.[1] ??
        (/target:\s*board/.test(chunk) ? ".side--enemy" : "—");
      const awaits = /awaits:\s*\{\s*kind:\s*"([a-z]+)"(?:,\s*atLeast:\s*([^\s}]+))?/.exec(chunk);
      return [
        {
          id,
          target,
          gate: awaits ? `${awaits[1]}${awaits[2] ? ` ≥ ${awaits[2]}` : ""}` : null,
        },
      ];
    })
    .filter((x) => !/^hello-/.test(x.id));
}

const counterSrc = /function counterCues\([\s\S]*?\n\}/.exec(COACH_SRC)?.[0] ?? "";
const counters = scan(counterSrc);
/*
 * The two greeting lines are not cues at all — App.tsx hands them straight to
 * the tutorial before any of this runs, with `target: null`, so they render
 * centred with nothing ringed. They are the first thing a child sees, so they
 * come first here too.
 */
const order = [
  { id: "hello-1", target: "— (באמצע המסך)", gate: null },
  { id: "hello-2", target: "— (באמצע המסך)", gate: null },
  ...scan(COACH_SRC.replace(counterSrc, "")),
];
// Anything defined but never matched still belongs in the document.
for (const id of lines.keys())
  if (!order.some((o) => o.id === id) && !counters.some((o) => o.id === id))
    order.push({ id, target: "—", gate: null });

// ── the two lessons ───────────────────────────────────────────────────
const lessons = [];
for (const block of LESSONS_SRC.split(/\n  \{\n/).slice(1)) {
  const title = shipped(/title:\s*\{\s*he:\s*([\s\S]*?)\s*\},/.exec(block)?.[1] ?? "");
  const deck = (/deck:\s*\[([\s\S]*?)\]/.exec(block)?.[1] ?? "")
    .split("\n").map((l) => /"([^"]+)"/.exec(l)?.[1]).filter(Boolean);
  const opp = [...(/opponent:\s*\[([\s\S]*?)\n\s{4}\],/.exec(block)?.[1] ?? "")
    .matchAll(/cardId:\s*"([^"]+)",\s*x:\s*(\d+),\s*y:\s*(\d+)(,\s*king:\s*true)?/g)]
    .map((m) => ({ cardId: m[1], x: +m[2], y: +m[3], king: !!m[4] }));
  if (title) lessons.push({ title, deck, opp });
}

const GATE_HE = {
  placements: "שהונח קלף על הלוח",
  king: "שהוכתר מלך",
  bar: "שנלקח קלף פעולה לבר",
  discard: "שנזרק קלף לפח",
};

const out = [];
out.push(
  "# הטוטוריאל — כל השלבים",
  "",
  "**הקובץ הזה נוצר מהקוד** (`node scripts/tutorial-doc.mjs`). אל תערוך",
  "אותו בשביל הסדר או הלוגיקה — תערוך את עמודת **טקסט חדש**, ולכל השאר",
  "תכתוב הערה בעמודה האחרונה ואני אשנה בקוד.",
  "",
  "---",
  "",
  "## איך זה עובד",
  "",
  "אמנדה אומרת שורה אחת בכל פעם, מצביעה על מה שהיא מדברת עליו, וממשיכה.",
  "",
  "- **שלב עם שער** מחכה שתעשה את הפעולה. אין כפתור המשך.",
  "- **שלב בלי שער** הוא משפט להקריא — יש כפתור „המשך ←”.",
  "- שלב שהיעד שלו לא על המסך **מדולג**, לא נתקע.",
  "",
  "> **מה שחיפשת:** אם שורה *מבקשת* משהו מסוים (למשל „שים אותו מול המלך”)",
  "> אבל השער שלה כללי (סתם „שהונח קלף”), היא תיסגר גם אם תניח במקום אחר —",
  "> וזה בדיוק מרגיש כמו „לא ברור מה רוצים ממני”. השורות האלה מסומנות **⚠**.",
  "",
  "---",
  "",
  "## השורות, לפי הסדר שהן נאמרות",
  "",
  "| # | מתי | מצביעה על | מחכה ל | טקסט נוכחי | טקסט חדש | הערה שלך |",
  "| --- | --- | --- | --- | --- | --- | --- |",
);

const esc = (s) => String(s).replace(/\|/g, "\\|");
/*
 * The same rows, collected plainly, for the spreadsheet written at the
 * bottom of this file — see there for why there is a spreadsheet at all.
 * They are gathered AS the markdown is built rather than parsed back out
 * of it, so the two documents are one document in two shapes and cannot
 * drift apart.
 */
const sheetRows = [];
const counterRows = [];
let n = 0;
for (const step of order) {
  const l = lines.get(step.id);
  if (!l) continue;
  n++;
  const gate = step.gate
    ? GATE_HE[step.gate.split(" ")[0]] ?? step.gate
    : "— (כפתור המשך)";
  // A line that names a PLACE but gates on a bare placement.
  const picky = /מול המלך|מאחורה|מקדימה|לידו|בקצה|מול הטור|מולו/.test(l.he);
  const loose = step.gate?.startsWith("placements");
  const warn = picky && loose ? " ⚠" : "";
  out.push(
    `| ${n}${warn} | ${esc(l.when)} | \`${step.target}\` | ${gate} | ${esc(l.he)} | | |`,
  );
  sheetRows.push([l.cid, `${n}${warn}`, l.when, step.target, gate, l.he, "", english(l.cid), ""]);
}

// ── the counter cues, which are a second lesson thing ─────────────────
out.push(
  "",
  "### ומשחק שני בלבד — „מה מנצח את מה”",
  "",
  "אלה **נבדקות לפני** כל מה שלמעלה, אבל רק מהמשחק השני. בשלב הזה כבר",
  "עברת את ההדרכה פעם אחת, והדבר שצריך הסבר הוא הלוח ממול.",
  "",
  "| # | מתי | מצביעה על | מחכה ל | טקסט נוכחי | טקסט חדש | הערה שלך |",
  "| --- | --- | --- | --- | --- | --- | --- |",
);
for (const step of counters) {
  const l = lines.get(step.id);
  if (!l) continue;
  n++;
  out.push(
    `| ${n} | ${esc(l.when)} | \`${step.target}\` | — (כפתור המשך) | ${esc(l.he)} | | |`,
  );
  counterRows.push([l.cid, String(n), l.when, step.target, "— (כפתור המשך)", l.he, "", english(l.cid), ""]);
}

out.push(
  "",
  "**⚠ = השורה מבקשת מיקום מסוים, אבל נסגרת על כל הנחה שהיא.**",
  "אם זה מפריע — תכתוב לי ואני אהדק את השער לאותה משבצת.",
  "",
  "### חורים ידועים שכבר מסומנים",
  "",
  "- אין שורה שמסבירה **מה עושים עם קלף פעולה אחרי שהוא בבר** — רק איך",
  "  לוקחים אותו לשם.",
  "- אין שורה על **קומת קרקע** (קלף על קלף) ולא על **משמר המלך** כרעיון —",
  "  שניהם מלומדים מסימנים על הלוח בלבד.",
  "- `bin` („התחרטת?”) נאמרת רק **אחרי** שכבר זרקת, ולכן אף פעם לא לפני.",
  "",
  "---",
  "",
  "## שני המשחקים",
  "",
  "אלה לא משחקים מול המחשב. **שני הצדדים כתובים מראש**: היד שלך מחולקת",
  "בסדר ידוע, והלוח של היריב הוא רשימה קבועה. `lessons.test.ts` משחק כל",
  "שיעור כמה מאות פעמים עם הקלפים בסדר אקראי ובמקומות אקראיים ונופל אם",
  "השחקן לא מנצח בכל פעם — **לא מזייפים את התוצאה, בונים לוח שמנצח.**",
  "",
);

lessons.forEach((l, i) => {
  out.push(
    `### ${i + 1} · ${l.title}`,
    "",
    "**היד שלך, בסדר הזה:**",
    "",
    ...l.deck.map((c, j) => `${j + 1}. ${named(c)}`),
    "",
    "**הלוח של היריב:**",
    "",
    "| קלף | עמודה | נתיב | |",
    "| --- | --- | --- | --- |",
    // The King stays even when it IS a crumb demon — in lesson one it is one,
    // and "the opponent crowned a crumb" is the whole shape of that match.
    ...l.opp
      .filter((p) => p.cardId !== "crumb_demon" || p.king)
      .map((p) => `| ${named(p.cardId)} | ${p.x} | ${p.y} | ${p.king ? "**מלך**" : ""} |`),
    "",
    "כל השאר — מפלצות פירורים.",
    "",
  );
});

out.push(
  "---",
  "",
  "## מה שקבוע בממשק",
  "",
  "| איפה | טקסט נוכחי | טקסט חדש |",
  "| --- | --- | --- |",
  "| כפתור ההמשך בבועה | המשך ← | |",
  "| הכפתור שמדלג על הכול | אני יודע לשחק | |",
  "| הכניסה מהבית | איך משחקים | |",
  "",
  "---",
  "",
  "כשתסיים: תחזיר לי את הקובץ ואני אחיל. מילים עוברות דרך",
  "`pnpm copy:apply`; סדר, שערים ושלבים חדשים — אני משנה בקוד.",
  "",
);

writeFileSync("docs/TUTORIAL.md", out.join("\n"), "utf8");
console.log(`docs/TUTORIAL.md — ${n} lines, ${lessons.length} lessons`);

/*
 * ═══ AND THE SAME THING AS A SPREADSHEET ═══
 *
 * Or: *"the MD files are simply awful in terms of user interface. It's very
 * hard to work like this. Any chance of an Excel file that works better for
 * right and left alignment?"*
 *
 * This document is worse than COPY.md for exactly the reason he says: it is
 * SEVEN columns wide, two of them hold whole sentences of Hebrew, and a
 * markdown table aligns with spaces. So every row wraps into a paragraph of
 * pipes, and the thing he is meant to be reading — Amanda's line, and the
 * empty box beside it — is the hardest thing on the page to find.
 *
 * Three sheets rather than one, because these are three different jobs: the
 * walkthrough is read in order, the counter cues only fire from the second
 * match, and the fixed interface strings are three buttons.
 */
writeXlsx("docs/TUTORIAL.xlsx", [
  {
    name: "השורות לפי הסדר",
    columns: [
      { header: "מזהה", width: 11 },
      { header: "#", width: 6 },
      { header: "מתי", width: 26 },
      { header: "מצביעה על", width: 22 },
      { header: "מחכה ל", width: 24 },
      { header: "טקסט מקור (בעברית)", width: 58 },
      { header: "טקסט חדש עברית", width: 58, edit: true },
      { header: "טקסט חדש אנגלית", width: 58, edit: true },
      { header: "הערה שלך", width: 34, edit: true },
    ],
    rows: sheetRows,
  },
  {
    name: "ממשחק שני",
    columns: [
      { header: "מזהה", width: 11 },
      { header: "#", width: 6 },
      { header: "מתי", width: 26 },
      { header: "מצביעה על", width: 22 },
      { header: "מחכה ל", width: 24 },
      { header: "טקסט מקור (בעברית)", width: 58 },
      { header: "טקסט חדש עברית", width: 58, edit: true },
      { header: "טקסט חדש אנגלית", width: 58, edit: true },
      { header: "הערה שלך", width: 34, edit: true },
    ],
    rows: counterRows,
  },
  {
    name: "קבוע בממשק",
    columns: [
      /*
       * These three carry their ids like every other row, because a sheet
       * whose edits cannot be applied is a sheet whose edits get lost — and
       * `copy-back` only reads a sheet that has a "מזהה" column at all.
       * Looked up rather than typed: a wrong id writes the right words into
       * the wrong string.
       */
      { header: "מזהה", width: 11 },
      { header: "איפה", width: 34 },
      { header: "טקסט מקור (בעברית)", width: 34 },
      { header: "טקסט חדש עברית", width: 44, edit: true },
      { header: "טקסט חדש אנגלית", width: 44, edit: true },
    ],
    rows: [
      ["כפתור ההמשך בבועה", "המשך ←"],
      ["הכפתור שמדלג על הכול", "אני יודע לשחק"],
      ["הכניסה מהבית", "איך משחקים"],
    ].map(([where, he]) => {
      const id = byText.get(he) ?? "";
      return [id, where, he, "", english(id)];
    }),
  },
]);
console.log(`docs/TUTORIAL.xlsx — ${sheetRows.length + counterRows.length} lines`);
