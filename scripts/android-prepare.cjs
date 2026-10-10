/*
 * Put the Android project somewhere Gradle will agree to build it.
 *
 * The Android Gradle Plugin refuses outright:
 *
 *   Your project path contains non-ASCII characters. This will most likely
 *   cause the build to fail on Windows. Please move your project.
 *
 * The repository lives at C:\Users\אור\Downloads\Amanda. The א is the whole
 * problem, there is no fixing it in place, and `android.overridePathCheck`
 * only silences the warning — the tools underneath it (aapt2 especially) are
 * the ones that actually break, later and less clearly.
 *
 * So the wrapper is built OUTSIDE the repository, at an ASCII path, from the
 * one file that is committed: android/twa-manifest.json. Nothing of value
 * lives in the build directory — it is regenerated from scratch every time —
 * and the .aab comes back when it is done.
 *
 * GRADLE_USER_HOME has to move too, and that one is easy to miss: it defaults
 * to ~/.gradle, which on this machine is also behind the א.
 */
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..");
const SRC = path.join(REPO, "android");
const OUT = process.argv[2] || "C:\\Users\\Public\\amanda-android";
/** The 8.3 short form of JAVA_HOME, computed by the .cmd. See writeBubblewrapConfig. */
const JDK = process.argv[3];

/**
 * Point bubblewrap's own config at a JDK path with no spaces in it.
 *
 * ═══ BUBBLEWRAP DOES NOT READ JAVA_HOME ═══
 *
 * It keeps its own ~/.bubblewrap/config.json, written once by `doctor`, and
 * every java it launches comes from the jdkPath in there. Setting JAVA_HOME
 * in the build script changed nothing at all — the second run failed with
 * the identical message as the first:
 *
 *   'C:\Program' is not recognized as an internal or external command
 *
 * because bubblewrap concatenates that path into a command string and hands
 * it to a shell unquoted, and "C:\Program Files" loses everything after the
 * space. The short name is the same JDK with no space to lose.
 *
 * This is rewritten on every prepare rather than fixed once by hand: running
 * `bubblewrap doctor` puts the long path straight back.
 */
function writeBubblewrapConfig() {
  if (!JDK) return;
  const dir = path.join(require("node:os").homedir(), ".bubblewrap");
  const file = path.join(dir, "config.json");
  const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  if (current.jdkPath === JDK) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({ ...current, jdkPath: JDK }, null, 2) + "\n",
  );
  console.log(`   bubblewrap jdkPath -> ${JDK}`);
}

/** Where npx unpacked @bubblewrap/core, whatever hash it chose this time. */
function findCore() {
  const cache = path.join(
    process.env.LOCALAPPDATA || path.join(require("node:os").homedir(), "AppData", "Local"),
    "npm-cache",
    "_npx",
  );
  if (!fs.existsSync(cache)) return null;
  for (const dir of fs.readdirSync(cache)) {
    const candidate = path.join(cache, dir, "node_modules", "@bubblewrap", "core");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const core = findCore();
if (!core) {
  console.error("Could not find @bubblewrap/core. Run `npx @bubblewrap/cli doctor` once first.");
  process.exit(1);
}
const { TwaGenerator, TwaManifest, ConsoleLog } = require(core);

(async () => {
  writeBubblewrapConfig();

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // The signing key and its password travel with it, and the manifest is
  // rewritten to point at the copies — jarsigner reads that path too, and it
  // is a Java tool on Windows, which is exactly the combination that chokes.
  for (const file of ["android.keystore", "keystore-password.txt"]) {
    const from = path.join(SRC, file);
    if (!fs.existsSync(from)) {
      console.error(`Missing ${file}. It is gitignored on purpose — restore it from your backup.`);
      process.exit(1);
    }
    fs.copyFileSync(from, path.join(OUT, file));
  }

  const manifestPath = path.join(OUT, "twa-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "twa-manifest.json"), "utf8"));
  manifest.signingKey = { path: path.join(OUT, "android.keystore"), alias: manifest.signingKey?.alias ?? "amanda" };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const twaManifest = await TwaManifest.fromFile(manifestPath);
  await new TwaGenerator().createTwaProject(OUT, twaManifest, new ConsoleLog("prepare"));

  // The checksum bubblewrap compares against, so `build` goes straight to
  // Gradle instead of stopping to ask whether to regenerate. sha1, which is
  // what the CLI uses — md5 here cost an afternoon.
  const sha1 = require("node:crypto")
    .createHash("sha1")
    .update(fs.readFileSync(manifestPath, "utf-8"))
    .digest("hex");
  fs.writeFileSync(path.join(OUT, "manifest-checksum.txt"), sha1);

  console.log(OUT);
})().catch((e) => {
  console.error("PREPARE FAILED:", e.stack || e.message);
  process.exit(1);
});
