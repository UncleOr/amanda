/**
 * Art generation CLI.
 *
 *   pnpm art:style          bake-off: 4 style directions × 3 test monsters (12 images)
 *   pnpm art:anchor <dir>   generate the style anchor for the chosen direction
 *   pnpm art:cards [series] generate every monster, anchored to the style anchor
 *   pnpm art:card <cardId>  regenerate a single monster (for revision rounds)
 *
 * Output goes to assets/raw/… ; run `pnpm art:process` afterwards to compress
 * the approved images into the client.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CARDS, REPO_ROOT, SERIES, launchCards } from "./catalog.js";
import { buildAnchoredPrompt, buildPrompt } from "./prompt.js";
import { STYLE_DIRECTIONS, TEST_MONSTERS } from "./styles.js";
import { download, generate, generateWithReference, uploadFile } from "./fal.js";

const RAW = join(REPO_ROOT, "assets", "raw");
const ANCHOR_PATH = join(RAW, "_anchor.png");

function dirById(id: string) {
  const d = STYLE_DIRECTIONS.find((s) => s.id === id);
  if (!d) {
    console.error(`Unknown style "${id}". Options: ${STYLE_DIRECTIONS.map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
  return d;
}

/** Round 1: every style direction × every test monster. */
async function cmdStyle(): Promise<void> {
  console.log(`\n🎨 Style bake-off — ${STYLE_DIRECTIONS.length} directions × ${TEST_MONSTERS.length} monsters\n`);
  for (const dir of STYLE_DIRECTIONS) {
    for (const cardId of TEST_MONSTERS) {
      const card = CARDS.get(cardId);
      if (!card) continue;
      const dest = join(RAW, "_style", dir.id, `${cardId}.png`);
      process.stdout.write(`  ${dir.id.padEnd(10)} ${card.name.en.padEnd(24)} … `);
      try {
        const [img] = await generate(buildPrompt(card, dir));
        if (!img) throw new Error("no image returned");
        await download(img.url, dest);
        console.log("✓");
      } catch (err) {
        console.log(`✗ ${(err as Error).message}`);
      }
    }
  }
  console.log(`\nDone → assets/raw/_style/<direction>/\n`);
}

/** Round 2: lock the look with one high-quality anchor image. */
async function cmdAnchor(styleId?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  const card = CARDS.get(TEST_MONSTERS[0]!)!;
  console.log(`\n⚓ Generating style anchor (${dir.id}) from ${card.name.en} …`);
  const [img] = await generate(buildPrompt(card, dir));
  if (!img) throw new Error("no image returned");
  await download(img.url, ANCHOR_PATH);
  console.log(`✓ saved → assets/raw/_anchor.png\n`);
}

/** Round 3: generate the whole set, each anchored to the approved style. */
async function cmdCards(styleId?: string, seriesFilter?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  if (!existsSync(ANCHOR_PATH)) {
    console.error("❌ No style anchor. Run `pnpm art:anchor <style>` first.");
    process.exit(1);
  }
  console.log("\n⬆️  Uploading style anchor …");
  const anchorUrl = await uploadFile(ANCHOR_PATH);

  const list = SERIES.filter((s) => !seriesFilter || s.id === seriesFilter);
  console.log(`🖼️  Generating ${list.reduce((n, s) => n + s.cards.length, 0)} cards (style: ${dir.id})\n`);

  for (const series of list) {
    console.log(`── ${series.name.he} (${series.id})`);
    for (const card of launchCards(series)) {
      const dest = join(RAW, series.id, `${card.id}.png`);
      if (existsSync(dest)) {
        console.log(`   ⏭  ${card.name.en} (exists)`);
        continue;
      }
      process.stdout.write(`   ${card.name.en.padEnd(26)} … `);
      try {
        const [img] = await generateWithReference(buildAnchoredPrompt(card, dir), [anchorUrl]);
        if (!img) throw new Error("no image returned");
        await download(img.url, dest);
        console.log("✓");
      } catch (err) {
        console.log(`✗ ${(err as Error).message}`);
      }
    }
  }
  console.log("\nDone → assets/raw/<series>/\n");
}

/** Revision round: regenerate one card (optionally with extra instructions). */
async function cmdCard(cardId?: string, styleId?: string, ...notes: string[]): Promise<void> {
  const card = cardId ? CARDS.get(cardId) : undefined;
  if (!card) {
    console.error(`❌ Unknown card id "${cardId}"`);
    process.exit(1);
  }
  const dir = dirById(styleId ?? "");
  const anchorUrl = existsSync(ANCHOR_PATH) ? await uploadFile(ANCHOR_PATH) : null;
  let prompt = anchorUrl ? buildAnchoredPrompt(card, dir) : buildPrompt(card, dir);
  if (notes.length) prompt += ` Additional art direction: ${notes.join(" ")}`;

  console.log(`\n🔁 Regenerating ${card.name.en} …`);
  const [img] = anchorUrl
    ? await generateWithReference(prompt, [anchorUrl], { numImages: 2 })
    : await generate(prompt, { numImages: 2 });
  if (!img) throw new Error("no image returned");
  await download(img.url, join(RAW, card.seriesId, `${card.id}.png`));
  console.log(`✓ saved → assets/raw/${card.seriesId}/${card.id}.png\n`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = async () => {
  switch (cmd) {
    case "style":
      return cmdStyle();
    case "anchor":
      return cmdAnchor(args[0]);
    case "cards":
      return cmdCards(args[0], args[1]);
    case "card":
      return cmdCard(args[0], args[1], ...args.slice(2));
    default:
      console.log("Usage: style | anchor <style> | cards <style> [series] | card <cardId> <style> [notes…]");
  }
};
run().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
