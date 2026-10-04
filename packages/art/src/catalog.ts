import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSeries, type Card, type Series } from "@amanda/shared";

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, "..", "..", "..");
const seriesDir = join(REPO_ROOT, "data", "series");

export const SERIES: Series[] = readdirSync(seriesDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => parseSeries(JSON.parse(readFileSync(join(seriesDir, f), "utf8"))));

export const CARDS = new Map<string, Card>();
for (const s of SERIES) for (const c of s.cards) CARDS.set(c.id, c);

/** Only the curated launch roster gets artwork generated. */
export function launchCards(series: Series): Card[] {
  return series.cards.filter((c) => c.launch);
}

export function seriesOf(card: Card): Series | undefined {
  return SERIES.find((s) => s.id === card.seriesId);
}
