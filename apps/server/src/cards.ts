/**
 * Cards Or has changed, applied to the catalogue this process fights with.
 *
 * The server is the authority on a battle — it decides who won and both
 * clients replay its answer — so if a card's numbers change in the admin
 * panel, THIS process has to know, or the replay in the browser disagrees with
 * the result on the wire and the game lies to somebody.
 *
 * OVERRIDES, not a catalogue. data/series/*.json is still where the cards
 * come from; a row in card_overrides means one was edited or invented. With
 * the table empty the game is exactly what it ships as, which is the same
 * promise everything else here makes about the database.
 *
 * Refreshed at boot and again whenever the admin saves. Not polled: an edit
 * is a thing somebody did, and we are told about it.
 */
import { CardSchema, type Card } from "@amanda/shared";
import { CATALOG } from "./content.js";
import { db } from "./supabase.js";

/** ids that came from the database rather than from the files. */
const fromDb = new Set<string>();
/** The file version of anything an override replaced, so it can be put back. */
const original = new Map<string, Card>();

export const cardState = {
  applied: 0,
  hidden: 0,
  lastError: null as string | null,
  loadedAt: null as string | null,
};

/**
 * Pull every override and apply it.
 *
 * Deliberately rebuilds from the files each time rather than layering: an
 * override that is deleted has to come BACK to what it was, and a layer that
 * only ever adds cannot do that.
 */
export async function refreshCards(): Promise<void> {
  const sb = db();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from("card_overrides")
      .select("id, series_id, active, data");
    if (error) throw new Error(error.message);

    // Put the file versions back before applying the new set.
    for (const [id, card] of original) CATALOG.set(id, card);
    original.clear();
    for (const id of fromDb) CATALOG.delete(id);
    fromDb.clear();

    let applied = 0;
    let hidden = 0;
    for (const row of data ?? []) {
      if (!row.active) {
        // Hidden rather than deleted: a card that ships in the files cannot be
        // removed, and this is what "delete" means for one of those.
        if (CATALOG.has(row.id)) {
          original.set(row.id, CATALOG.get(row.id)!);
          CATALOG.delete(row.id);
        }
        hidden++;
        continue;
      }
      /*
       * Validated with the very schema the engine reads. A card saved with a
       * field the engine does not understand is worse than no card: it would
       * be accepted here and then behave as a blank in a battle somebody is
       * playing. A row that does not parse is skipped and said out loud.
       */
      const parsed = CardSchema.safeParse(row.data);
      if (!parsed.success) {
        cardState.lastError = `${row.id}: ${parsed.error.issues[0]?.message ?? "invalid"}`;
        continue;
      }
      if (CATALOG.has(row.id)) original.set(row.id, CATALOG.get(row.id)!);
      else fromDb.add(row.id);
      CATALOG.set(row.id, parsed.data);
      applied++;
    }
    cardState.applied = applied;
    cardState.hidden = hidden;
    cardState.loadedAt = new Date().toISOString();
    if (applied || hidden) console.log(`[cards] ${applied} overridden, ${hidden} hidden`);
  } catch (err) {
    // The game keeps the cards it shipped with. Never a reason to stop.
    cardState.lastError = (err as Error).message.slice(0, 300);
    console.error("[cards] could not load overrides", err);
  }
}
