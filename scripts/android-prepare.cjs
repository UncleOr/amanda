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

/**
 * Ask the Gradle daemon to go away before deleting the tree it sits in.
 *
 * The build after the first successful one failed here, not in Gradle:
 *
 *   PREPARE FAILED: EPERM, Permission denied: C:\Users\Public\amanda-android
 *     at Object.rmSync
 *
 * A successful build leaves a daemon running — that is what a daemon is for,
 * it stays warm for the next build — and on Windows a process holding open
 * handles inside a directory makes that directory undeletable. It is not a
 * permissions problem despite what the error says, which is the reason to
 * translate it here instead of leaving somebody to read EPERM and start
 * changing ACLs.
 *
 * `--stop` is the polite version and is usually enough. It is allowed to
 * fail: with no wrapper yet, or no daemon, there is nothing to stop and the
 * retry below covers what is left.
 */
function stopGradleDaemon() {
  const wrapper = path.join(OUT, "gradlew.bat");
  if (!fs.existsSync(wrapper)) return;
  try {
    // `shell: true` because gradlew.bat is a BATCH file: without a shell,
    // execFileSync cannot run it at all and throws straight into the catch
    // below, so the stop never happened and the error said nothing.
    //
    // cwd is the PARENT, never OUT — a process whose working directory is
    // the folder is one of the things that makes it undeletable, and this
    // one exists to remove that problem rather than add to it.
    require("node:child_process").execFileSync(wrapper, ["--stop"], {
      cwd: path.dirname(OUT),
      shell: true,
      stdio: "ignore",
      env: {
        ...process.env,
        JAVA_HOME: process.argv[3] || process.env.JAVA_HOME,
        // Daemons are registered per GRADLE_USER_HOME. Asking the wrong one
        // finds nothing to stop and reports success.
        GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || "C:\\Users\\Public\\.gradle",
      },
    });
    // Stopping is asynchronous on the daemon's side.
    pause(1200);
  } catch {
    /*
     * No daemon, no java to ask with — or no loopback.
     *
     * `--stop` talks to the daemon over a local socket, which is the same
     * connection a build needs, so in an environment where Gradle cannot run
     * neither can this: it fails with "Unable to establish loopback
     * connection". That is why this was written but never proven here; it
     * works in a terminal where the build itself works.
     *
     * The wipe below reports what to do when it cannot clear the way.
     */
  }
}

/** Sleep without pulling in a promise, since everything here is synchronous. */
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Delete the work tree, allowing for Windows letting go slowly.
 *
 * A daemon that has been asked to stop does not drop its handles the instant
 * it is asked, and a virus scanner can hold a file it has just watched being
 * written. Both clear in well under a second, so this retries instead of
 * failing on the first attempt — and when it genuinely cannot, it says what
 * is actually wrong rather than repeating "permission denied".
 */
function wipe(dir) {
  if (!fs.existsSync(dir)) return;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      /*
       * The CONTENTS, not the directory.
       *
       * The EPERM was on `C:\Users\Public\amanda-android` itself rather
       * than on anything inside it, which is what Windows reports when a
       * process is sitting in the folder — a daemon started there keeps it
       * as its working directory even after its files are closed. The folder
       * cannot be removed; everything in it can, and an empty folder is all
       * the next step wants.
       */
      for (const entry of fs.readdirSync(dir))
        fs.rmSync(path.join(dir, entry), {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 200,
        });
      return;
    } catch (err) {
      if (attempt === 6) {
        console.error(
          "\nCould not empty " + dir + ".\n\n" +
            "Something still has files open in there — almost always a Gradle\n" +
            "daemon from the last build. Close any terminal running one, or:\n\n" +
            "    taskkill /IM java.exe /F\n\n" +
            "and run this again.\n",
        );
        throw err;
      }
      pause(400);
    }
  }
}

(async () => {
  writeBubblewrapConfig();

  stopGradleDaemon();
  wipe(OUT);
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
