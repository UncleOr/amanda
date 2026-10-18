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
 * ═══ THE LAUNCHER ICON COMES ALONG ═══
 *
 * Or, with a screenshot of his app switcher showing Capacitor's blue logo:
 * *"the app's logo is not the Amanda logo!! Fix it so we can send it to the
 * testers."*
 *
 * It never was ours. `cap add android` generates a complete res/ tree with
 * its own ic_launcher, and this script patched the four things that make the
 * app ours — version, signing, the Play Games id, the name under the icon —
 * and not the picture above the name. The TWA before it took its icon from
 * the web manifest, so this had never been anybody's job.
 *
 * The PNGs are generated by scripts/make-android-icons.mjs and COMMITTED,
 * because that script needs sharp and this build deliberately has no
 * dependencies beyond the Capacitor CLI. Re-run it if the icon changes.
 */
const ICONS = path.join(REPO, "android", "icons");
if (!fs.existsSync(ICONS)) {
  console.error("");
  console.error("  No android/icons — run: node scripts/make-android-icons.mjs");
  console.error("");
  process.exit(1);
}
const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
};
copyDir(ICONS, path.join(OUT, "icons"));

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

/*
 * Apply one patch, and refuse to be quiet about one that missed.
 *
 * A patch that changes nothing is nearly always a regular expression that
 * stopped matching after a Capacitor upgrade. The build then succeeds and
 * ships an app with no Play Games id in it, which crashes on launch — so
 * the default is to throw.
 *
 * The third argument is the exception, and it earns its place: setting
 * app_name to the Hebrew name does nothing because Capacitor ALREADY writes
 * it there from capacitor.config.json. That is the patch being unnecessary,
 * not the patch failing, and the two have to be told apart. The first real
 * build of this wrapper died on exactly that.
 */
const edit = (file, fn, already) => {
  const p = path.join(APP, file);
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  if (after === before) {
    if (already && already(before)) {
      console.log("   already right: " + file);
      return;
    }
    throw new Error("patch did nothing: " + file);
  }
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
  /*
   * The release BUILD TYPE must actually use it; Capacitor leaves it
   * unsigned.
   *
   * Anchored on \`buildTypes { release {\` and not on the first \`release {\`
   * in the file, which is the bug this replaces: by the time this line ran,
   * the block above had already inserted a \`signingConfigs { release {\`
   * ABOVE buildTypes, so the first match was that one. The result was
   *
   *     signingConfigs {
   *         release {
   *             signingConfig signingConfigs.release   <- here
   *
   * — a signing config that refers to itself while it is being defined, and
   * a release build type with no signing at all. Gradle never got far enough
   * on this machine to complain, which is exactly why it survived.
   */
  if (!out.includes("signingConfig signingConfigs.release")) {
    out = out.replace(
      /(buildTypes\\s*\\{\\s*release\\s*\\{)/,
      "$1\\n            signingConfig signingConfigs.release",
    );
  }
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
edit(
  "src/main/res/values/strings.xml",
  (s) => s.replace(/(<string name="app_name">)[^<]*(<\\/string>)/, "$1" + cfg.appName + "$2"),
  // Capacitor writes it from capacitor.config.json, so by the time this runs
  // it is usually already the Hebrew name.
  (s) => s.includes('<string name="app_name">' + cfg.appName + "</string>"),
);

/*
 * ═══ THE STATUS BAR WAS SITTING ON THE GAME ═══
 *
 * Or, with a photograph of the home screen and an arrow drawn across the top
 * of it: *"the top part isn't clickable, probably covered by another layer."*
 * In the same shot his player badge is half behind the battery and the wifi
 * icons.
 *
 * Two layers, and this is the second one. The first was ours — two
 * decorative background elements taking taps, fixed in CSS. This one is
 * Android's: from Android 15, an app targeting SDK 35 is forced edge-to-edge,
 * so the WebView is laid out UNDER the system bars.
 *
 * The web side is already dressed for that. index.html asks for
 * viewport-fit=cover and .app is padded by env(safe-area-inset-*) — but those
 * values arrive only if the native side passes the insets through, and a
 * plain Capacitor activity does not. So they are all zero, the app draws from
 * pixel row zero, and the status bar owns the top of it: the pixels are drawn
 * and the taps are not ours.
 *
 * The opt-out is one attribute and no new dependency. The alternative was a
 * safe-area plugin, which is a third-party package and a bigger change on the
 * morning of a release.
 *
 * values-v35, because the attribute does not exist before API 35; older
 * phones go on using the theme they already use. Android 16 deprecates the
 * opt-out, so when the target moves to 36 this stops working and the real
 * answer — passing the insets into the WebView, so the CSS already in place
 * does its job — becomes the thing to do.
 *
 * (No backticks anywhere in this comment on purpose: it is generated from
 * inside a template literal, and one would end it. That is exactly how the
 * first version of this broke.)
 */
/*
 * The launcher icon, over the top of the one Capacitor generated.
 *
 * Copied rather than generated: these PNGs were made by
 * scripts/make-android-icons.mjs from the same icon the website uses, and
 * committed, so this step needs nothing but fs.
 *
 * It replaces every density, both shapes, the adaptive foreground and the
 * colour behind it. Leaving any one of them would show Capacitor's logo on
 * whichever phone happened to ask for that one.
 */
const copyInto = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyInto(src, dst);
    else fs.copyFileSync(src, dst);
  }
};
copyInto(path.join(__dirname, 'icons'), path.join(APP, 'src/main/res'));
console.log('   wrote the Amanda launcher icon');

fs.mkdirSync(path.join(APP, 'src/main/res/values-v35'), { recursive: true });
fs.writeFileSync(
  path.join(APP, 'src/main/res/values-v35/styles.xml'),
  [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<resources>',
    '    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">',
    '        <item name="android:background">@null</item>',
    '        <!-- Keep the app below the status bar: see the note in',
    '             scripts/android-capacitor.cjs. -->',
    '        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>',
    '    </style>',
    '</resources>',
    '',
  ].join('\\n'),
  'utf8',
);
console.log('   wrote values-v35/styles.xml (edge-to-edge opt-out)');

/*
 * ═══ THE LOOPBACK FAILURE, AND WHAT IT ACTUALLY WAS ═══
 *
 * For weeks the Android build was "a command only Or can run": Gradle died
 * with \`java.io.IOException: Unable to establish loopback connection\` before
 * it compiled a line, and docs/TODO-OPS.md blamed the sandbox for blocking
 * local sockets.
 *
 * That was wrong, and wrong in a way that was easy to check and never
 * checked. Run unsandboxed: identical failure. A plain Java socket binding
 * and connecting to 127.0.0.1: works.
 *
 * The daemon log had the real answer under two layers of wrapping:
 *
 *     Selector.open() -> WEPollSelectorProvider -> PipeImpl
 *       -> UnixDomainSockets.connect
 *       -> java.net.SocketException: Invalid argument: connect
 *
 * Java on Windows opens its NIO wakeup pipe over an AF_UNIX socket, and puts
 * that socket's file in \`jdk.net.unixdomain.tmpdir\`, which defaults to
 * java.io.tmpdir. Here that is C:\\\\Users\\\\E958~1\\\\AppData\\\\Local\\\\Temp — the
 * 8.3 short name Windows generates for the Hebrew user folder. AF_UNIX
 * cannot use it, so EVERY Selector.open() in every JVM on this machine
 * fails, and Gradle reports it as a loopback problem because that is the
 * layer Gradle can see.
 *
 * Proven by one line: with this property pointed at an ASCII path,
 * Selector.open() succeeds and Gradle runs its fifty tasks.
 *
 * The same Hebrew letter that forces this whole project to be built outside
 * the repository in the first place. Written into gradle.properties so the
 * build does not depend on anybody remembering it.
 */
const props = path.join(__dirname, "android", "gradle.properties");
const unix = "-Djdk.net.unixdomain.tmpdir=C:/Users/Public/amanda-tmp";
fs.mkdirSync("C:/Users/Public/amanda-tmp", { recursive: true });
{
  const before = fs.readFileSync(props, "utf8");
  if (!before.includes("unixdomain.tmpdir")) {
    fs.writeFileSync(
      props,
      before.replace(/^(org\\.gradle\\.jvmargs=.*)$/m, "$1 " + unix),
      "utf8",
    );
    console.log("   patched gradle.properties");
  }
}

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
