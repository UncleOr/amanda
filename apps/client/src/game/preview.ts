/**
 * ═══ THE CARD BEING EDITED, BEFORE IT IS A CARD ═══
 *
 * The admin panel's stage shows a real card with the game's real code — the
 * same <CardView>, the same <DragGhost>, the same spring and the same sounds.
 * All of those look the card up in CATALOG by id, and CATALOG holds what the
 * build shipped with. So the workbench was showing the SHIPPED card while Or
 * edited a draft of it.
 *
 * It did not matter much while the only things being edited were numbers on a
 * form. It matters now: Or asked to choose a card's movement, sound and
 * animation in the hand, and a dropdown whose effect you cannot feel until
 * you save, reload the panel and come back is a dropdown nobody trusts.
 *
 * ⚠ AND SAVING IS NOT ENOUGH ON ITS OWN. The panel's save writes the row to
 * the server; it does not put the card into this tab's CATALOG (the game
 * reloads overrides at boot, see cardOverrides.ts). So without this seam the
 * stage would disagree with the form even after a successful save, which is
 * the worst of the three states — it looks like the save did nothing.
 *
 * One card at a time, set by the editor and cleared when it closes. In the
 * game nothing ever sets it, so `cardFor` is `CATALOG.get` with a null check
 * in front of it.
 */
import type { Card } from "@amanda/shared";
import { CATALOG } from "../data/catalog";

let previewed: Card | null = null;

/** The editor's draft, or null. Nothing in the game calls this. */
export function setPreviewCard(card: Card | null): void {
  previewed = card;
}

/** The card with this id — the draft if it is the one being edited. */
export function cardFor(id: string): Card | undefined {
  return previewed && previewed.id === id ? previewed : CATALOG.get(id);
}
