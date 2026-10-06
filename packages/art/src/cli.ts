/**
 * Art generation CLI.
 *
 *   pnpm art:style          bake-off: 4 style directions × 3 test monsters (12 images)
 *   pnpm art:anchor <dir>   generate the style anchor for the chosen direction
 *   pnpm art:cards [series] generate every monster, anchored to the style anchor
 *                           pass "all" instead of a series to include cards
 *                           that have not launched (the playground shows them)
 *   pnpm art:card <cardId>  regenerate a single monster (for revision rounds)
 *   pnpm art:sounds         generate the game's sound effects
 *   pnpm art:sounds-process trim and level them into the client
 *
 * Output goes to assets/raw/… ; run `pnpm art:process` afterwards to compress
 * the approved images into the client.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CARDS, REPO_ROOT, SERIES, launchCards } from "./catalog.js";
import { buildActionPrompt, buildAnchoredPrompt, buildPrompt } from "./prompt.js";
import { STYLE_DIRECTIONS, TEST_MONSTERS } from "./styles.js";
import { ARENA_LOOKS, buildArenaPrompt } from "./arenaLooks.js";
import { BRAND_ASPECT, BRAND_LOOK, buildBrandPrompt } from "./brandLooks.js";
import { ICON_LOOK, buildIconPrompt } from "./iconLooks.js";
import { generateSounds, processSounds } from "./sounds.js";
import { SURFACE_ASPECT, SURFACE_LOOK, buildSurfacePrompt } from "./surfaceLooks.js";
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

  /*
   * "all" means every card in the data, launched or not. The playground shows
   * the whole catalogue, so a card held back from launch is still a card a
   * player can look at — and an empty frame there reads as a bug.
   */
  const everything = seriesFilter === "all";
  const list = SERIES.filter((s) => everything || !seriesFilter || s.id === seriesFilter);
  console.log(`🖼️  Generating ${list.reduce((n, s) => n + s.cards.length, 0)} cards (style: ${dir.id})\n`);

  for (const series of list) {
    console.log(`── ${series.name.he} (${series.id})`);
    for (const card of everything ? series.cards : launchCards(series)) {
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

/** Generate artwork for every Action Card. */
async function cmdActions(styleId?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  const { readFileSync } = await import("node:fs");
  const actions = JSON.parse(
    readFileSync(join(REPO_ROOT, "data", "action-cards.json"), "utf8"),
  ) as Array<{ id: string; name: { en: string }; description: { he: string }; rarity: string }>;

  console.log(`\nGenerating ${actions.length} action cards (style: ${dir.id})\n`);
  for (const a of actions) {
    const dest = join(RAW, "actions", `${a.id}.png`);
    if (existsSync(dest)) {
      console.log(`   skip  ${a.name.en} (exists)`);
      continue;
    }
    process.stdout.write(`   ${a.name.en.padEnd(24)} ... `);
    try {
      const [img] = await generate(
        buildActionPrompt(a.id, a.name.en, a.description.he, a.rarity, dir),
      );
      if (!img) throw new Error("no image returned");
      await download(img.url, dest);
      console.log("OK");
    } catch (err) {
      console.log(`FAIL ${(err as Error).message}`);
    }
  }
  console.log("\nDone -> assets/raw/actions/\n");
}

/** Battlefield backdrops for the battle arena (one per candidate look). */
async function cmdArena(styleId?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  console.log(`\nGenerating ${ARENA_LOOKS.length} arena backdrops (style: ${dir.id})\n`);
  for (const look of ARENA_LOOKS) {
    const dest = join(RAW, "arena", `${look.id}.png`);
    if (existsSync(dest)) {
      console.log(`   skip  ${look.id} (exists)`);
      continue;
    }
    process.stdout.write(`   ${look.id.padEnd(14)} ... `);
    try {
      // 16:9 - the arena is a wide strip, nothing like the portrait cards.
      const [img] = await generate(buildArenaPrompt(look, dir.style), {
        aspectRatio: "16:9",
      });
      if (!img) throw new Error("no image returned");
      await download(img.url, dest);
      console.log("OK");
    } catch (err) {
      console.log(`FAIL ${(err as Error).message}`);
    }
  }
  console.log("\nDone -> assets/raw/arena/\n");
}

/** Amanda's own likeness: the logo, the portrait and the menu banner. */
async function cmdBrand(styleId?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  const ids = Object.keys(BRAND_LOOK);
  console.log(`\nGenerating ${ids.length} brand images (style: ${dir.id})\n`);
  for (const id of ids) {
    const dest = join(RAW, "brand", `${id}.png`);
    if (existsSync(dest)) {
      console.log(`   skip  ${id} (exists)`);
      continue;
    }
    process.stdout.write(`   ${id.padEnd(18)} ... `);
    try {
      const [img] = await generate(buildBrandPrompt(id, dir.style), {
        aspectRatio: BRAND_ASPECT[id] ?? "1:1",
      });
      if (!img) throw new Error("no image returned");
      await download(img.url, dest);
      console.log("OK");
    } catch (err) {
      console.log(`FAIL ${(err as Error).message}`);
    }
  }
  console.log("\nDone -> assets/raw/brand/\n");
}

/** The game's own icon set, one flat icon per id. */
async function cmdIconSet(styleId?: string, only?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  const ids = Object.keys(ICON_LOOK).filter((id) => !only || id === only);
  console.log(`\nGenerating ${ids.length} icons (style: ${dir.id})\n`);
  for (const id of ids) {
    const dest = join(RAW, "icons", `${id}.png`);
    if (existsSync(dest)) {
      console.log(`   skip  ${id} (exists)`);
      continue;
    }
    process.stdout.write(`   ${id.padEnd(12)} ... `);
    try {
      const [img] = await generate(buildIconPrompt(id, dir.style), { aspectRatio: "1:1" });
      if (!img) throw new Error("no image returned");
      await download(img.url, dest);
      console.log("OK");
    } catch (err) {
      console.log(`FAIL ${(err as Error).message}`);
    }
  }
  console.log("\nDone -> assets/raw/icons/  (run `pnpm art:process` to cut and compress)\n");
}

/** The paper, the table and the walls — the things everything else sits on. */
async function cmdSurfaces(styleId?: string): Promise<void> {
  const dir = dirById(styleId ?? "");
  const ids = Object.keys(SURFACE_LOOK);
  console.log(`\nGenerating ${ids.length} surfaces (style: ${dir.id})\n`);
  for (const id of ids) {
    const dest = join(RAW, "surfaces", `${id}.png`);
    if (existsSync(dest)) {
      console.log(`   skip  ${id} (exists)`);
      continue;
    }
    process.stdout.write(`   ${id.padEnd(16)} ... `);
    try {
      const [img] = await generate(buildSurfacePrompt(id, dir.style), {
        aspectRatio: SURFACE_ASPECT[id] ?? "16:9",
      });
      if (!img) throw new Error("no image returned");
      await download(img.url, dest);
      console.log("OK");
    } catch (err) {
      console.log(`FAIL ${(err as Error).message}`);
    }
  }
  console.log("\nDone -> assets/raw/surfaces/  (run `pnpm art:process`)\n");
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
    case "actions":
      return cmdActions(args[0]);
    case "arena":
      return cmdArena(args[0]);
    case "brand":
      return cmdBrand(args[0]);
    case "icons-set":
      return cmdIconSet(args[0], args[1]);
    case "card":
      return cmdCard(args[0], args[1], ...args.slice(2));
    case "surfaces":
      return cmdSurfaces(args[0]);
    case "sounds":
      return generateSounds(args);
    case "sounds-process":
      return processSounds();
    default:
      console.log(
        "Usage: style | anchor <style> | cards <style> [series|all] | card <cardId> <style> [notes…] | actions <style> | arena <style> | brand <style> | sounds [ids…] | sounds-process",
      );
  }
};
run().catch((err) => {
  console.error("\n❌", err);
  process.exit(1);
});
