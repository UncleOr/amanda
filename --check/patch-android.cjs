/*
 * Patch the project `cap add android` just generated.
 *
 * Capacitor generates a debuggable app with its own version numbers and no
 * knowledge of Play Games. These are the four things that make it OUR app:
 * the version, the signing config, the Play Games id, and the launcher name.
 */
const fs = require("node:fs");
const path = require("node:path");

const cfg = {
  "versionCode": 9,
  "versionName": "1.2.0",
  "appName": "אמנדה",
  "playGamesAppId": "717344155977",
  "keyAlias": "amanda",
  "fullscreenItems": "\n        <!-- Full screen, as the TWA was. See android-capacitor.cjs. -->\n        <item name=\"android:windowFullscreen\">true</item>\n        <item name=\"android:windowLayoutInDisplayCutoutMode\">shortEdges</item>",
  "mainActivity": "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        hideSystemBars();\n    }\n\n    /**\n     * Android puts the bars back whenever focus returns -- a permission\n     * dialog, the notification shade, coming back from the browser after\n     * signing in. Without this the game is full screen exactly once.\n     */\n    @Override\n    public void onWindowFocusChanged(boolean hasFocus) {\n        super.onWindowFocusChanged(hasFocus);\n        if (hasFocus) hideSystemBars();\n    }\n\n    private void hideSystemBars() {\n        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);\n        androidx.core.view.WindowInsetsControllerCompat bars =\n            androidx.core.view.WindowCompat.getInsetsController(\n                getWindow(), getWindow().getDecorView());\n        bars.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars());\n        bars.setSystemBarsBehavior(\n            androidx.core.view.WindowInsetsControllerCompat\n                .BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);\n    }\n}",
  "orientationAttr": "\n            android:screenOrientation=\"sensorLandscape\"",
  "blankLine": "\n\n",
  "vibratePermission": "\n    <!-- The game buzzes: see apps/client/src/game/haptics.ts.\n         A WebView without this fails silently. -->\n    <uses-permission android:name=\"android.permission.VIBRATE\" />",
  "landscapeFeature": "\n    <!-- The game is DRAWN landscape; it does not need landscape hardware.\n         Overrides the requirement Android implies from\n         android:screenOrientation. See android-capacitor.cjs. -->\n    <uses-feature android:name=\"android.hardware.screen.landscape\" android:required=\"false\" />",
  "schemeFilter": "\n\n            <intent-filter>\n                <action android:name=\"android.intent.action.VIEW\" />\n                <category android:name=\"android.intent.category.DEFAULT\" />\n                <category android:name=\"android.intent.category.BROWSABLE\" />\n                <data android:scheme=\"com.asulins.amanda\" />\n            </intent-filter>",
  "deepLinkFilter": "\n\n            <intent-filter android:autoVerify=\"true\">\n                <action android:name=\"android.intent.action.VIEW\" />\n                <category android:name=\"android.intent.category.DEFAULT\" />\n                <category android:name=\"android.intent.category.BROWSABLE\" />\n                <data android:scheme=\"https\" android:host=\"playamanda.com\" android:pathPrefix=\"/play/\" />\n            </intent-filter>"
};

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
    .replace(/versionCode \d+/, "versionCode " + cfg.versionCode)
    .replace(/versionName "[^"]*"/, 'versionName "' + cfg.versionName + '"');
  if (!out.includes("signingConfigs")) {
    out = out.replace(
      /(\n\s*buildTypes\s*\{)/,
      `
    signingConfigs {
        release {
            storeFile file(System.getenv("AMANDA_KEYSTORE"))
            storePassword System.getenv("AMANDA_KEYPASS")
            keyAlias "${cfg.keyAlias}"
            keyPassword System.getenv("AMANDA_KEYPASS")
        }
    }
$1`,
    );
  }
  /*
   * The release BUILD TYPE must actually use it; Capacitor leaves it
   * unsigned.
   *
   * Anchored on `buildTypes { release {` and not on the first `release {`
   * in the file, which is the bug this replaces: by the time this line ran,
   * the block above had already inserted a `signingConfigs { release {`
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
      /(buildTypes\s*\{\s*release\s*\{)/,
      "$1\n            signingConfig signingConfigs.release",
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
    /<\/resources>/,
    '    <string name="game_services_project_id">' + cfg.playGamesAppId + "</string>\n</resources>",
  ),
);

/*
 * ═══ COMING BACK FROM GOOGLE HAS TO COME BACK HERE ═══
 *
 * Or: *"when I tried to sign in to my Google account it moved to the browser,
 * and the game carried on signed in IN THE BROWSER. In the app it stayed
 * signed out."*
 *
 * Every step of that is working as designed, which is why it is confusing.
 * Google refuses OAuth inside an embedded WebView, so Capacitor hands
 * accounts.google.com to the real browser. The user signs in there. Google
 * redirects to the site -- and the browser is the thing holding that page, so
 * the browser is the thing that exchanges the code and ends up with the
 * session. The app is never told.
 *
 * This brings it home. The domain already proves it owns this package:
 * /.well-known/assetlinks.json has been live since the TWA, carrying this
 * package name and this signing fingerprint. So Android will hand a verified
 * https link straight to the app instead of the browser -- it only has to be
 * told which links.
 *
 * autoVerify asks Android to check assetlinks at install time. If that ever
 * fails the link opens in the browser again, which is today's behaviour: this
 * cannot be worse than not having it.
 *
 * The XML is built HERE, outside the template literal, and carried across in
 * the JSON blob. Writing it inline cost four rounds of escaping -- every
 * backslash in a regex and every 
 in a string has to survive being
 * generated, and three separate attempts produced a patch script that did not
 * parse. JSON.stringify already knows how to do that.
 *
 * The app also has to DO something when it arrives, which it does not get for
 * free: Capacitor fires a JS event and navigates nowhere. See the web side in
 * apps/client/src/game/nativeAuth.ts.
 */
/*
 * ═══ FULL SCREEN, WHICH IS WHAT VERSION TWO LOOKED LIKE ═══
 *
 * Or: *"yes, put it back to full screen like version 2."*
 *
 * The third thing the TWA got for free. android/twa-manifest.json says
 * display: fullscreen, and Chrome honours that by hiding both system bars
 * -- so the game had the whole panel and nothing was ever drawn underneath
 * anything. A Capacitor activity shows both bars unless told otherwise.
 *
 * On a landscape phone that is 384px tall, a status bar is not a detail: it
 * is five percent of the height of a screen every layout in this game was
 * measured against.
 *
 * Two halves, and both are needed. The THEME hides the status bar from the
 * first frame, before any Java runs, so there is no bar during the splash
 * that then disappears. The CONTROLLER hides the navigation bar too and says
 * what a swipe does -- transient bars, exactly as Chrome's fullscreen
 * behaves, so a player can always get to the back gesture and the bars go
 * away again on their own.
 *
 * onWindowFocusChanged as well as onCreate, because Android brings the
 * bars back whenever the window loses and regains focus -- which is every
 * permission dialog, every notification shade, and every return from the
 * browser after signing in to Google.
 */
/*
 * ═══ ON THE THEME THE ACTIVITY ACTUALLY USES ═══
 *
 * This first went onto AppTheme.NoActionBar alone, by matching the only line
 * in styles.xml that looked like the right place. The manifest says
 *
 *     android:theme="@style/AppTheme.NoActionBarLaunch"
 *
 * so AppTheme.NoActionBar is a style nothing on screen has ever used, and
 * every item written into it did nothing at all. Or sent a photograph of the
 * game with the status bar still across the top of his player name, which is
 * what a full-screen flag on an unused theme looks like from outside.
 *
 * Nothing in the build could have caught it: a theme item in the wrong style
 * compiles, ships, and is simply never read.
 *
 * Both styles now. The launch theme is the one that matters; the other is
 * kept in step so that if Capacitor ever adds a postSplashScreenTheme the
 * answer does not quietly move again.
 */
edit("src/main/res/values/styles.xml", (s) =>
  s
    .replace(
      '<item name="android:background">@null</item>',
      '<item name="android:background">@null</item>' + cfg.fullscreenItems,
    )
    .replace(
      '<item name="android:background">@drawable/splash</item>',
      '<item name="android:background">@drawable/splash</item>' + cfg.fullscreenItems,
    ),
);

/*
 * ═══ AND PROVE IT LANDED ON THE RIGHT ONE ═══
 *
 * The full-screen flags were written into AppTheme.NoActionBar while the
 * manifest gives MainActivity AppTheme.NoActionBarLaunch, so they sat in a
 * style nothing uses and did nothing. It shipped, and the only thing that
 * found it was Or photographing the status bar lying across his own name.
 *
 * edit cannot catch this: the patch DID change the file, just the wrong
 * part of it. So this reads the theme name back out of the manifest and
 * checks that the style of that name is one of the ones carrying the flag.
 * Plain string searching rather than a regex, because this file is generated
 * from a template literal and a regex here is one more layer of escaping.
 */
{
  const man = fs.readFileSync(path.join(APP, 'src/main/AndroidManifest.xml'), 'utf8');
  const at = man.indexOf('.MainActivity');
  if (at < 0) throw new Error('no MainActivity in the manifest');
  const key = 'android:theme="@style/';
  // The activity's own theme is the first one declared after its name.
  const from = man.indexOf(key, at);
  if (from < 0) throw new Error('MainActivity has no theme');
  const start = from + key.length;
  const theme = man.slice(start, man.indexOf('"', start));

  const files = ['src/main/res/values/styles.xml', 'src/main/res/values-v35/styles.xml'];
  const lit = 'android:windowFullscreen';
  const ok = files.some((rel) => {
    const xml = fs.readFileSync(path.join(APP, rel), 'utf8');
    const decl = xml.indexOf('<style name="' + theme + '"');
    if (decl < 0) return false;
    const end = xml.indexOf('</style>', decl);
    return xml.slice(decl, end).includes(lit);
  });
  if (!ok) {
    throw new Error(
      'MainActivity uses @style/' + theme + ', and no styles file gives that ' +
        'style ' + lit + '. The flag would be ignored and the status bar would ' +
        'sit on the game. See the note above this check.',
    );
  }
  console.log('   full screen confirmed on @style/' + theme);
}

edit("src/main/java/com/asulins/amanda/MainActivity.java", (s) =>
  s.replace("public class MainActivity extends BridgeActivity {}", cfg.mainActivity),
);

/*
 * ═══ THE GAME IS LANDSCAPE, AND THE WEBVIEW HAD TO BE TOLD ═══
 *
 * Or: *"when the phone is not landscape it gives a message to rotate the
 * phone instead of just showing the game landscape. Before version two
 * everything already worked."*
 *
 * It did. android/twa-manifest.json says orientation: landscape, and
 * bubblewrap turned that into a locked activity -- so the game could not BE
 * in portrait and the rotate-hint screen was unreachable. Capacitor generates
 * no screenOrientation, the activity follows the phone, and the hint is what
 * the player gets.
 *
 * manifest.webmanifest says landscape too and is no help at all: this is a
 * native activity and nothing reads a web manifest.
 *
 * Anchored on launchMode, which Capacitor writes exactly once and which this
 * app needs anyway -- singleTask is what lets the sign-in deep link wake the
 * running app instead of starting a second copy of it.
 */
// Before <application>, which is where uses-feature belongs.
//
// APP_TAG carries the blank line before it. Writing that as an escape on the
// line below would be a newline inside this template literal, which is the
// mistake this file has now made five times.
const APP_TAG = cfg.blankLine + '    <application';
edit("src/main/AndroidManifest.xml", (s) =>
  s.replace("    <application", cfg.vibratePermission + cfg.landscapeFeature + APP_TAG),
);

edit("src/main/AndroidManifest.xml", (s) =>
  s.replace(
    'android:launchMode="singleTask"',
    'android:launchMode="singleTask"' + cfg.orientationAttr,
  ),
);

// The first </intent-filter> in the manifest closes the LAUNCHER one, which
// is the activity a link should open. A plain string replace, because the
// thing being matched is a literal tag and a regex here would be one more
// layer of escaping for nothing.
edit("src/main/AndroidManifest.xml", (s) =>
  s.replace(
    "</intent-filter>",
    "</intent-filter>" + cfg.deepLinkFilter + cfg.schemeFilter,
  ),
);

edit("src/main/AndroidManifest.xml", (s) =>
  s.replace(
    /(\s*)<\/application>/,
    '$1    <meta-data android:name="com.google.android.gms.games.APP_ID" ' +
      'android:value="@string/game_services_project_id" />$1</application>',
  ),
);

/*
 * ── what it is called under the icon ──
 *
 * ═══ TWO STRINGS, AND THE ONE THAT SHOWS IS NOT app_name ═══
 *
 * Capacitor generates both, from the same appName:
 *
 *     <application android:label="@string/app_name">
 *     <activity    android:label="@string/title_activity_main">
 *
 * Android labels a launcher entry from the ACTIVITY when the activity
 * declares one, and MainActivity does. So title_activity_main is the name
 * under the icon and in Recents, and app_name is the fallback almost
 * nothing reads.
 *
 * Only app_name was checked here. That was luck, not design: both come from
 * the same place, so both were right — but the string nobody was watching
 * was the only one that mattered, and the name on this app has already cost
 * a release once (see the mojibake warning in android/capacitor.json). The
 * next Capacitor upgrade that renames or drops one of these would ship an
 * app called "Amanda" in English, or whatever its template says, and the
 * build would be perfectly happy.
 *
 * Both now, from one list.
 */
for (const key of ["app_name", "title_activity_main"]) {
  /*
   * Built with indexOf rather than a regular expression on purpose. The
   * pattern needs a literal "</string>", and a slash inside a regex in this
   * file has already been written three different ways; the name on this app
   * has cost one release and is not worth a fourth. There is nothing here a
   * regex does better.
   */
  const open = '<string name="' + key + '">';
  const want = open + cfg.appName + "</string>";
  edit(
    "src/main/res/values/strings.xml",
    (s) => {
      const at = s.indexOf(open);
      if (at < 0) return s;
      const end = s.indexOf("</string>", at);
      if (end < 0) return s;
      return s.slice(0, at) + want + s.slice(end + "</string>".length);
    },
    // Capacitor writes them from capacitor.config.json, so by the time this
    // runs they are usually already the Hebrew name. That is the patch being
    // unnecessary, not the patch failing — and edit() throws on the latter,
    // which is what catches a string Capacitor has stopped generating.
    //
    // (No backticks in this file. Everything below the CFG block is inside a
    // template literal that gets written out as the patch script, and one
    // backtick in a comment ends it. That is now six times.)
    (s) => s.includes(want),
  );
}

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
 * ═══ AND IT IS THE SECOND LINE OF DEFENCE, NOT THE FIRST ═══
 *
 * The app hides both system bars outright now (see the full-screen patch
 * above), which is what version two did and what Or asked for back. With no
 * bars there is nothing to be drawn underneath, so this attribute decides
 * nothing on a working device.
 *
 * It stays because the two work at different levels and fail differently.
 * Hiding the bars is done by WindowInsetsController, at runtime, from Java;
 * this is a theme attribute read before any of our code runs. If the hiding
 * ever stops working — a launcher that forces bars, an Android release that
 * changes the rules again — this is what still keeps the game out from under
 * the status bar, which is the thing Or actually reported.
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
    '    <!-- NoActionBarLaunch, because that is the theme the manifest gives',
    '         MainActivity. The first version of this wrote AppTheme.NoActionBar,',
    '         which nothing uses, so every item in it was ignored. -->',
    '    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">',
    '        <item name="android:background">@drawable/splash</item>',
    '        <item name="android:windowFullscreen">true</item>',
    '        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>',
    '        <!-- Keep the app below the status bar if it is ever shown anyway. -->',
    '        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>',
    '    </style>',
    '</resources>',
    '',
  ].join('\n'),
  'utf8',
);
console.log('   wrote values-v35/styles.xml (edge-to-edge opt-out)');

/*
 * ═══ THE LOOPBACK FAILURE, AND WHAT IT ACTUALLY WAS ═══
 *
 * For weeks the Android build was "a command only Or can run": Gradle died
 * with `java.io.IOException: Unable to establish loopback connection` before
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
 * that socket's file in `jdk.net.unixdomain.tmpdir`, which defaults to
 * java.io.tmpdir. Here that is C:\\Users\\E958~1\\AppData\\Local\\Temp — the
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
      before.replace(/^(org\.gradle\.jvmargs=.*)$/m, "$1 " + unix),
      "utf8",
    );
    console.log("   patched gradle.properties");
  }
}

console.log("\n   android project patched\n");
