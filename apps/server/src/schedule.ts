/**
 * Gifts that go out on their own.
 *
 * Or: "including scheduling it — say if it is a present for a certain
 * holiday." A present that needs somebody awake at midnight to press a button
 * is not scheduled, it is remembered.
 *
 * ═══ A LOOP, NOT A TIMER PER GIFT ═══
 *
 * The obvious shape is setTimeout(when - now) as each gift is saved. It is
 * also wrong here: this process restarts on every deploy, and every pending
 * timer dies with it — silently, with the gift still saying it is scheduled.
 * A gift set for next Friday would simply never arrive, and nothing would say
 * so.
 *
 * So nothing is held in memory. Every minute this asks the database "is
 * anything due", which survives a restart, two instances, and a clock that
 * was wrong. Running twice is safe by construction: delivery writes receipts
 * (see shop.ts) and the second run gives nothing.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { runGrant } from "./shop.js";
import { notify } from "./notify.js";

/** How often to look. A present is not late by a minute. */
const EVERY_MS = 60_000;

/** Tell the recipient something arrived — see notify.ts. */
async function announce(sb: SupabaseClient, playerId: string, name: string): Promise<void> {
  await notify(
    sb,
    playerId,
    "gift",
    { he: "יש לך מתנה", en: "You have a gift" },
    { he: name, en: name },
    "album",
  );
}

/** Everything whose time has come. Returns what it did, for the log. */
export async function runDueGrants(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb
    .from("grants")
    .select("id, name")
    .eq("active", true)
    .is("executed_at", null)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  const done: string[] = [];
  for (const g of data ?? []) {
    const report = await runGrant(sb, g.id as string, (playerId, name) =>
      announce(sb, playerId, name),
    );
    done.push(
      `${g.name}: ${report.sent} sent${report.skipped ? `, ${report.skipped} already had it` : ""}${
        report.error ? ` (${report.error})` : ""
      }`,
    );
  }
  return done;
}

/** Start looking. Called once at boot. */
export function startScheduler(db: () => SupabaseClient | null): void {
  const tick = async () => {
    const sb = db();
    if (!sb) return;
    try {
      for (const line of await runDueGrants(sb)) console.log(`[gift] ${line}`);
    } catch (err) {
      // A scheduler that dies on one bad row stops every future gift too.
      console.error("[gift] scheduler", (err as Error).message);
    }
  };
  setInterval(() => void tick(), EVERY_MS).unref?.();
  // And once at boot, for anything that came due while the process was down.
  void tick();
}
