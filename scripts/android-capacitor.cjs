/*
 * Build the Capacitor Android project, outside the repository.
 *
 *   node scripts/android-capacitor.cjs [workdir]
 *
 * ═══ WHY OUTSIDE ═══
 *
 * The Android Gradle Plugin refuses a project path with non-ASCII characters
 * in it, and this repository lives at C:\Users\אור\Downloads\Amanda. The א is
 * the whole problem; `android.overridePathCheck` only silences the warning
 * and the tools underneath it break later and less clearly. Same reasoning,
 * same conclusion and same workdir as android-prepare.cjs, which did this for
 * bubblewrap — see the long note at the top of that file.
 *
 * ═══ WHAT THIS GENERATES ═══
 *
 * A tiny npm project with @capacitor/cli, @capacitor/android and the Play
 * Games plugin, pointed at the live site. Nothing of value lives there: it is
 * regenerated from android/capacitor.json every run, and the only outputs
 * that matter are the .aab and the fingerprint.
 *
 * ═══ WHAT IT WILL NOT DO ═══
 *
 * It refuses to generate an app with no Play Games application id. Without
 * that number in the manifest, the Play Games SDK does not warn — it crashes
 * the app on launch. An unbuildable project is a far better outcome than a
 * build that a tester installs and watches die.
 */
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..");
const CONFIG = path.join(REPO, "android", "capacitor.json");
const OUT = process.argv[2] || "C:\\Users\\Public\\amanda-android-cap";

const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));

/* ── the refusals, before anything is written ────────────────────────── */

const missing = [];
if (!cfg.playGamesAppId) missing.push("playGamesAppId");
if (!cfg.serverUrl) missing.push("serverUrl");
if (!cfg.packageId) missing.push("packageId");
if (missing.length) {
  console.error(`\n  android/capacitor.json is missing: ${missing.join(", ")}\n`);
  if (missing.includes("playGamesAppId")) {
    console.error("  The Play Games application id is the number Play Console issues when");
    console.error("  the game is linked to Play Games Services:");
    console.error("    Grow users -> Play Games services -> Setup and management -> Configuration");
    console.error("");
    console.error("  Without it in the manifest the app crashes the moment it opens.\n");
  }
  process.exit(1);
}

const keystore = path.join(REPO, cfg.keystore.replace(/\//g, path.sep));
if (!fs.existsSync(keystore)) {
  console.error(`\n  No keystore at ${keystore}`);
  console.error("  It is deliberately not in git. Without it this would be a different app\n");
  console.error("  to Google, however much the package id matches.\n");
  process.exit(1);
}

/* ── the project ─────────────────────────────────────────────────────── */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const write = (rel, body) => {
  const abs = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, "utf8");
};

write(
  "package.json",
  JSON.stringify(
    {
      name: "amanda-android",
      private: true,
      version: cfg.versionName,
      devDependencies: { "@capacitor/cli": "^8.0.0" },
      dependencies: {
        "@capacitor/core": "^8.0.0",
        "@capacitor/android": "^8.0.0",
        ...cfg.plugins,
      },
    },
    null,
    2,
  ) + "\n",
);

/*
 * `webDir` has to exist and has to contain an index.html, even though not one
 * byte of it is ever shown: `server.url` wins at runtime. Capacitor copies
 * this directory during `cap sync` and fails the sync if it is missing, so it
 * is a single file that says what it is, for whoever finds it in a crash
 * report one day and wonders.
 */
write(
  "www/index.html",
  [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><title>Amanda</title></head>',
    "<body><!--",
    "  Never shown. capacitor.config.json points the WebView at the live site;",
    "  this file exists because Capacitor requires webDir to contain one.",
    '--></body></html>',
    "",
  ].join("\n"),
);

write(
  "capacitor.config.json",
  JSON.stringify(
    {
      appId: cfg.packageId,
      appName: cfg.appName,
      webDir: "www",
      server: {
        url: cfg.serverUrl,
        // The live site is https; nothing here needs cleartext, and saying so
        // keeps the manifest from asking for a permission it does not use.
        cleartext: false,
      },
      android: {
        backgroundColor: cfg.backgroundColor,
      },
    },
    null,
    2,
  ) + "\n",
);

/*
 * Everything that has to be patched INTO the generated Android project, after
 * `cap add android` has made it. Kept here as data so the .cmd stays a list
 * of commands and the decisions stay in one file.
 */
write(
  "patch-android.cjs",
  `/*
 * Patch the project \`cap add android\` just generated.
 *
 * Capacitor generates a debuggable app with its own version numbers and no
 * knowledge of Play Games. These are the four things that make it OUR app:
 * the version, the signing config, the Play Games id, and the launcher name.
 */
const fs = require("node:fs");
const path = require("node:path");

const cfg = ${JSON.stringify(
    {
      versionCode: cfg.versionCode,
      versionName: cfg.versionName,
      appName: cfg.appName,
      playGamesAppId: cfg.playGamesAppId,
      keyAlias: cfg.keyAlias,
    },
    null,
    2,
  )};

const APP = path.join(__dirname, "android", "app");
const edit = (file, fn) => {
  const p = path.join(APP, file);
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  if (after === before) throw new Error("patch did nothing: " + file);
  fs.writeFileSync(p, after, "utf8");
  console.log("   patched " + file);
};

// ── versions, and the signing config ──
edit("build.gradle", (s) => {
  let out = s
    .replace(/versionCode \\d+/, "versionCode " + cfg.versionCode)
    .replace(/versionName "[^"]*"/, 'versionName "' + cfg.versionName + '"');
  if (!out.includes("signingConfigs")) {
    out = out.replace(
      /(\\n\\s*buildTypes\\s*\\{)/,
      \`
    signingConfigs {
        release {
            storeFile file(System.getenv("AMANDA_KEYSTORE"))
            storePassword System.getenv("AMANDA_KEYPASS")
            keyAlias "\${cfg.keyAlias}"
            keyPassword System.getenv("AMANDA_KEYPASS")
        }
    }
\$1\`,
    );
  }
  // The release build type must actually USE it; Capacitor leaves it unsigned.
  out = out.replace(
    /(release\\s*\\{)/,
    "$1\\n            signingConfig signingConfigs.release",
  );
  return out;
});

// ── the Play Games application id ──
//
// Declared as a string resource and referenced from the manifest, which is
// how Google's own documentation does it. Without this meta-data the SDK
// crashes the app on launch rather than warning.
edit("src/main/res/values/strings.xml", (s) =>
  s.replace(
    /<\\/resources>/,
    '    <string name="game_services_project_id">' + cfg.playGamesAppId + "</string>\\n</resources>",
  ),
);

edit("src/main/AndroidManifest.xml", (s) =>
  s.replace(
    /(\\s*)<\\/application>/,
    '$1    <meta-data android:name="com.google.android.gms.games.APP_ID" ' +
      'android:value="@string/game_services_project_id" />$1</application>',
  ),
);

// ── what it is called under the icon ──
edit("src/main/res/values/strings.xml", (s) =>
  s.replace(/(<string name="app_name">)[^<]*(<\\/string>)/, "$1" + cfg.appName + "$2"),
);

console.log("\\n   android project patched\\n");
`,
);

console.log(`
  Generated ${OUT}

    package   ${cfg.packageId}
    version   ${cfg.versionName} (${cfg.versionCode})
    loads     ${cfg.serverUrl}
    games id  ${cfg.playGamesAppId}

  Next: scripts\\build-android-cap.cmd runs the install, the add and the patch.
`);
