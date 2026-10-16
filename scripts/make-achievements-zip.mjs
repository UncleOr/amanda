/**
 * The ZIP the Play Console imports the eighteen achievements from.
 *
 *   node scripts/make-achievements-zip.mjs
 *   → store/achievements/play-import/ (the CSVs and the icons)
 *
 * and then zipped by the caller, because Node has no zip of its own.
 *
 * ═══ WHY THIS IS A SCRIPT AND NOT EIGHTEEN FORMS ═══
 *
 * Or: *"you do the achievements in the console."* The Console will take
 * them one at a time or as a ZIP, and the ZIP is the one that can be
 * checked: eighteen hand-typed forms is eighteen chances to put 40 where 60
 * belongs, and no way to see afterwards that you did.
 *
 * It also means the Console and the game agree BY CONSTRUCTION. The ids
 * below are the same strings `achievements.ts` reports, in the same order,
 * and the script refuses to run if the two lists have drifted apart — which
 * they will, the first time somebody adds a nineteenth.
 *
 * ═══ THE FORMAT ═══
 *
 * Verified against Play Console Help, not guessed:
 *
 *   AchievementsMetadata.csv      Name,Description,Incremental value,
 *                                 Steps Needed,Initial State,Points,List Order
 *   AchievementsLocalizations.csv Name,Localized name,Localized description,locale
 *   AchievementsIconsMappings.csv Name,icon filename
 *
 * **No header row** in any of them, no commas inside a field, names unique,
 * no subdirectories in the ZIP, each file under 1MB.
 *
 * ═══ WHICH LANGUAGE IS THE DEFAULT ═══
 *
 * ENGLISH, and not by choice. The first build of this made Hebrew the
 * default to match the game — `say()` returns Hebrew unless the player has
 * chosen otherwise — and listed English as a localization. The Console
 * refused it: *"Wrong locale — choose a locale that is different than the
 * game's default."* The Play Games project's default is en-US, and a
 * localization may not repeat the default.
 *
 * It is the better arrangement anyway: English is the fallback for every
 * locale the list does not name, which is all of them but one.
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

/**
 * The eighteen, as approved in docs/ACHIEVEMENTS.md.
 *
 * `steps` is present only on the three the game reports with `step()` —
 * wins_10, wins_50 and chests_10. The other three the document calls
 * "cumulative" are decided by `earned()` and unlocked outright, so in the
 * Console they are standard achievements. The document and the code
 * disagreed on that and the CODE is what runs.
 */
const LIST = [
  { id: "taught", he: "אמנדה לימדה אותי", en: "Taught by Amanda",
    heDesc: "לסיים את שני משחקי הטוטוריאל", enDesc: "Finish both tutorial matches", points: 20 },
  { id: "first_win", he: "הניצחון הראשון", en: "First Win",
    heDesc: "לנצח קרב בפעם הראשונה", enDesc: "Win your first battle", points: 20 },
  { id: "arena_court", he: "המגרש", en: "The Court",
    heDesc: "להגיע ל-150 גביעים", enDesc: "Reach 150 trophies", points: 30 },
  { id: "arena_station", he: "תחנת הרכבת", en: "The Station",
    heDesc: "להגיע ל-450 גביעים", enDesc: "Reach 450 trophies", points: 50 },
  { id: "arena_alley", he: "סמטת האימה", en: "Fright Alley",
    heDesc: "להגיע ל-900 גביעים", enDesc: "Reach 900 trophies", points: 70 },
  { id: "arena_fuel", he: "תחנת הדלק", en: "The Fuel Stop",
    heDesc: "להגיע ל-1600 גביעים", enDesc: "Reach 1600 trophies", points: 120 },
  { id: "cards_10", he: "עשרה קלפים", en: "Ten Cards",
    heDesc: "לאסוף עשרה קלפים לאלבום", enDesc: "Collect ten cards", points: 30 },
  { id: "album_half", he: "חצי אלבום", en: "Half the Album",
    heDesc: "לאסוף חצי מהאלבום", enDesc: "Collect half the album", points: 50 },
  { id: "album_full", he: "האלבום המלא", en: "The Whole Album",
    heDesc: "לאסוף את כל 51 הקלפים", enDesc: "Collect all 51 cards", points: 180 },
  { id: "family", he: "משפחה שלמה", en: "A Whole Family",
    heDesc: "להשלים משפחה שלמה של קלפים", enDesc: "Complete a whole family of cards", points: 60 },
  { id: "chuppy", he: "צ'ופי", en: "Chuppy",
    heDesc: "להשיג את צ'ופי", enDesc: "Get Chuppy", points: 20 },
  { id: "legend", he: "מפלצת אגדית", en: "Legendary Monster",
    heDesc: "להשיג מפלצת אגדית", enDesc: "Get a legendary monster", points: 60 },
  { id: "trio", he: "שלושה צמודים", en: "Three in a Row",
    heDesc: "להדליק שלישייה של משפחה אחת בקרב", enDesc: "Light up a trio of one family in battle", points: 30 },
  { id: "untouched_king", he: "המלך לא נגוע", en: "Untouched King",
    heDesc: "לנצח בלי שהמלך שלך ספג נזק", enDesc: "Win without your King taking damage", points: 60 },
  { id: "wins_10", he: "עשרה ניצחונות", en: "Ten Wins",
    heDesc: "לנצח עשרה קרבות", enDesc: "Win ten battles", points: 40, steps: 10 },
  { id: "wins_50", he: "חמישים ניצחונות", en: "Fifty Wins",
    heDesc: "לנצח חמישים קרבות", enDesc: "Win fifty battles", points: 80, steps: 50 },
  { id: "chests_10", he: "עשר תיבות", en: "Ten Chests",
    heDesc: "לפתוח עשר תיבות", enDesc: "Open ten chests", points: 40, steps: 10 },
  { id: "friend", he: "חבר", en: "A Friend",
    heDesc: "לשחק קרב מול חבר", enDesc: "Play a battle against a friend", points: 40 },
];

/* ───────────── the checks, before anything is written ───────────── */

const source = readFileSync("apps/client/src/game/achievements.ts", "utf8");
const inCode = [...source.match(/export const ACHIEVEMENTS = \[([\s\S]*?)\] as const;/)[1]
  .matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
const mine = LIST.map((a) => a.id);
if (inCode.join() !== mine.join()) {
  console.error("The list here and ACHIEVEMENTS in the game have drifted apart.");
  console.error("  game:", inCode.join(", "));
  console.error("  here:", mine.join(", "));
  process.exit(1);
}

/*
 * Which ones the game INCREMENTS. Read out of the source rather than
 * trusted: a `step()` call added to the game without a Steps Needed in the
 * Console is an achievement that can never complete, and nothing would say
 * so until a player did not get it.
 *
 * Across the whole client, because the calls are not where the list is —
 * two sit in useAchievements.ts and the third in account.ts beside the code
 * that opens a chest. Scanning achievements.ts alone found none of them and
 * called all three wrong, which is how I know this is worth doing properly.
 */
const stepped = new Set();
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name))
      for (const m of readFileSync(p, "utf8").matchAll(/\bstep\("([a-z0-9_]+)"/g)) stepped.add(m[1]);
  }
})("apps/client/src");
for (const a of LIST) {
  const should = stepped.has(a.id);
  if (should !== Boolean(a.steps)) {
    console.error(
      `${a.id}: the game ${should ? "does" : "does not"} call step() for it, ` +
        `but it is ${a.steps ? "" : "not "}incremental here.`,
    );
    process.exit(1);
  }
}

const total = LIST.reduce((n, a) => n + a.points, 0);
const problems = [];
if (total > 2000) problems.push(`points total ${total}, over Google's 2000`);
for (const a of LIST) {
  if (a.points % 5) problems.push(`${a.id}: ${a.points} is not a multiple of 5`);
  if (a.points > 200) problems.push(`${a.id}: ${a.points} is over the 200 ceiling`);
  for (const [what, s] of [["he", a.he], ["en", a.en], ["heDesc", a.heDesc], ["enDesc", a.enDesc]]) {
    if (s.includes(",")) problems.push(`${a.id} ${what}: contains a comma, which the CSV cannot carry`);
  }
  if (a.he.length > 100 || a.en.length > 100) problems.push(`${a.id}: name over 100 characters`);
  if (a.heDesc.length > 500 || a.enDesc.length > 500) problems.push(`${a.id}: description over 500`);
}
const names = new Set(LIST.map((a) => a.en));
if (names.size !== LIST.length) problems.push("two achievements share a name");
if (problems.length) {
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}

/* ───────────── the files ───────────── */

const out = "store/achievements/play-import";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const metadata = LIST.map((a, i) =>
  [a.en, a.enDesc, a.steps ? "True" : "False", a.steps ?? "", "Revealed", a.points, i + 1].join(","),
).join("\n");

/*
 * `iw-IL`, which is what the Console's own language picker calls Hebrew —
 * `iw` is Android's old code for the language, and Play wants the region
 * with it. Plain `iw` came back as "Locale not supported".
 *
 * And the language has to be ON the project before any of this imports:
 * Configuration → Edit properties → Manage translations → Select languages.
 */
const localizations = LIST.map((a) => [a.en, a.he, a.heDesc, "iw-IL"].join(",")).join("\n");

/* Keyed by the DEFAULT name, which is the English one. */
const icons = LIST.map((a) => [a.en, `${a.id}.png`].join(",")).join("\n");

writeFileSync(join(out, "AchievementsMetadata.csv"), metadata + "\n", "utf8");
writeFileSync(join(out, "AchievementsLocalizations.csv"), localizations + "\n", "utf8");
writeFileSync(join(out, "AchievementsIconsMappings.csv"), icons + "\n", "utf8");
for (const a of LIST) copyFileSync(`store/achievements/${a.id}.png`, join(out, `${a.id}.png`));

console.log(`${LIST.length} achievements, ${total} points, ${stepped.size} incremental`);
console.log(`→ ${out}`);
