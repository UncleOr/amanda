import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The file the Android app is verified against.
 *
 * `https://<domain>/.well-known/assetlinks.json` is what tells Chrome that the
 * app with this package name is allowed to be this website without a browser
 * address bar across the top. Nothing in the game reads it, nothing fails to
 * build without it, and no screen looks wrong when it is broken — the app
 * simply stops being an app and becomes a web page in a frame.
 *
 * So it is pinned here instead. The one thing a test can genuinely protect is
 * that the file is still THERE, still parses, and still names the package the
 * bundle was uploaded under: a mismatch between these two strings is the most
 * common way a TWA fails verification, and the symptom is a toolbar rather
 * than an error.
 *
 * The fingerprint cannot be checked, because it does not exist until Play App
 * Signing has seen the first upload. See docs/PLAY.md.
 */
const PACKAGE_ID = "com.asulins.amanda";

/*
 * At the ORIGIN root, not inside the app.
 *
 * It used to live in the client's public/ folder, which was right while the
 * game was the whole site. The game is under /play/ now, and from there this
 * file would be published at /play/.well-known/assetlinks.json — a path
 * Chrome never looks at. It verifies nothing and says nothing; the app just
 * quietly grows a browser toolbar. So it lives with the landing page, and the
 * deploy workflow asserts it reaches the root.
 */
const file = fileURLToPath(new URL("../../../web/.well-known/assetlinks.json", import.meta.url));

describe("digital asset links", () => {
  const links = JSON.parse(readFileSync(file, "utf8")) as Array<{
    relation: string[];
    target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
  }>;

  it("delegates url handling to the Android app", () => {
    expect(links).toHaveLength(1);
    expect(links[0]!.relation).toContain("delegate_permission/common.handle_all_urls");
    expect(links[0]!.target.namespace).toBe("android_app");
  });

  it("names the package the bundle is uploaded under", () => {
    expect(links[0]!.target.package_name).toBe(PACKAGE_ID);
  });

  it("carries exactly one fingerprint slot", () => {
    // One upload, one signing certificate. More than one here is usually a
    // half-finished key rotation, which is worth stopping to look at.
    expect(links[0]!.target.sha256_cert_fingerprints).toHaveLength(1);
  });
});
