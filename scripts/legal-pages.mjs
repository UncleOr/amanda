/**
 * The legal documents as static HTML, generated from the ones in the game.
 *
 *   node scripts/legal-pages.mjs      → web/privacy/index.html
 *
 * ═══ WHY THIS EXISTS ═══
 *
 * Play Console refused the privacy policy:
 *
 *   Failed to validate your privacy policy page's SSL certificate
 *
 * The certificate is fine — `curl` verifies it and the page answers 200. What
 * Google's checker actually found was nothing at all: `?legal=privacy` is a
 * React route, so the HTML it fetches is an empty app shell and the policy
 * only exists after JavaScript has run. A crawler that does not run scripts
 * sees a blank document and reports it as whatever it can.
 *
 * Play's own wording is the giveaway — a policy must be "Active", "Not
 * editable" and "Accessible from anywhere in the world". A single-page app
 * behind a query parameter is none of those to a machine.
 *
 * ═══ WHY IT IS GENERATED AND NOT WRITTEN ═══
 *
 * App.tsx already argued against the obvious fix, and was right:
 *
 *   "Rather than keeping a second copy on a static page — which is a copy
 *    that will one day disagree with the first"
 *
 * A privacy policy that disagrees with itself in two places is worse than one
 * that renders slowly. So the words still live in exactly one place,
 * components/About.tsx, and this turns that component into HTML. Change the
 * policy in the game, run this, and the static page follows.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = readFileSync("apps/client/src/components/About.tsx", "utf8");

/** The body of one `function Name() { return ( … ); }` in About.tsx. */
function section(name) {
  const at = SRC.indexOf(`function ${name}()`);
  if (at < 0) throw new Error(`About.tsx has no ${name}()`);
  const open = SRC.indexOf("<>", at);
  const close = SRC.indexOf("</>", open);
  if (open < 0 || close < 0) throw new Error(`${name}() is not a fragment`);
  return SRC.slice(open + 2, close);
}

/**
 * JSX → HTML.
 *
 * Narrow on purpose: it understands the handful of shapes these documents
 * actually use and THROWS on anything else, rather than quietly dropping a
 * paragraph. A privacy page missing a clause because a regex did not match is
 * the failure this is supposed to prevent.
 */
function toHtml(jsx) {
  let s = jsx;

  // `{t("id", "text")}` and `{t(\n  "id",\n  "text",\n)}` → the text itself.
  const CALL = /\{\s*t\(\s*"[a-z][0-9a-f]{7}"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,?\s*\)\s*\}/g;
  s = s.replace(CALL, (_, text) => JSON.parse(`"${text}"`));

  // `{/* … */}` — notes to us, not to a reader.
  s = s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

  // className is the game's styling; this page has its own.
  s = s.replace(/\s+className="[^"]*"/g, "");

  const leftover = s.match(/\{[^}]*\}/g);
  if (leftover) {
    throw new Error(
      "unconverted JSX expression(s), so the page would be missing text:\n  " +
        leftover.slice(0, 5).join("\n  "),
    );
  }

  // Tidy the whitespace React would have collapsed anyway.
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n(?=[^<])/g, " ");
}

const PAGES = [
  {
    dir: "web/privacy",
    fn: "Privacy",
    title: "מדיניות פרטיות | אמנדה",
    description: "מה נשמר, מה לא, איפה זה יושב ואיך מוחקים — במשחק אמנדה.",
    heading: "אמנדה — משחק קלפים מפלצתי",
  },
];

const SHELL = (p, body) => `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${p.title}</title>
    <meta name="description" content="${p.description}" />
    <link rel="icon" href="/play/favicon-32.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;700;900&display=swap" rel="stylesheet" />
    <!--
      GENERATED — do not edit. \`node scripts/legal-pages.mjs\`

      The words live in apps/client/src/components/About.tsx and are shown
      inside the game from there. This is the same document as plain HTML,
      because Play Console's checker does not run JavaScript: handed the
      React route it fetched an empty app shell, found no policy, and
      reported a certificate failure.

      Static, no build step, no JavaScript. A policy that needs a framework
      to render is a policy that can be down.
    -->
    <style>
      :root {
        --bg: #070a12;
        --text: #e7ecf5;
        --muted: #93a0bd;
        --accent: #ffb020;
        --line: rgba(255, 255, 255, 0.12);
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      body {
        min-height: 100dvh;
        background: var(--bg);
        color: var(--text);
        font-family: Rubik, system-ui, sans-serif;
        line-height: 1.65;
        padding: 28px 18px 48px;
      }
      main { width: min(680px, 100%); margin: 0 auto; }
      h1 { font-size: clamp(24px, 6vw, 34px); margin: 0 0 4px; color: var(--accent); }
      .sub { margin: 0 0 26px; color: var(--muted); }
      h2 { font-size: clamp(20px, 5vw, 26px); margin: 0 0 2px; }
      h3 { font-size: clamp(16px, 4.2vw, 19px); margin: 26px 0 6px; color: var(--accent); }
      p { margin: 0 0 12px; }
      ul { padding-inline-start: 22px; margin: 0 0 12px; }
      li { margin-bottom: 8px; }
      a { color: var(--accent); }
      .back {
        display: inline-block;
        margin-top: 32px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${p.heading}</h1>
${body
  .split("\n")
  .map((l) => "      " + l)
  .join("\n")}
      <a class="back" href="/play/">← למשחק</a>
    </main>
  </body>
</html>
`;

for (const p of PAGES) {
  const body = toHtml(section(p.fn));
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(`${p.dir}/index.html`, SHELL(p, body), "utf8");
  const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  console.log(`${p.dir}/index.html — ${words} words from ${p.fn}()`);
}
