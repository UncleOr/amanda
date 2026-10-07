import type { Catchphrase } from "@amanda/shared";

/**
 * A catchphrase, on the plaque it always sits on.
 *
 * Or: *"the phrases need to be on a designed sort of plaque — in the shop, in
 * the settings screen, and when they appear."* One component for all three,
 * which is the point of him saying all three: a line that looks like a banner
 * when you buy it and like a paragraph when it is shown is two different
 * things with the same words. This way the thing on the versus screen IS the
 * thing you chose in the profile IS the thing you saw in the shop.
 *
 * ═══ IT IS NARROW ON PURPOSE ═══
 *
 * Or again: *"and they need to be much narrower. Not taking up the whole
 * width of the screen like that."* The plaque sizes to its words and stops —
 * a banner that stretches edge to edge is a table row, and the shape is half
 * of what makes it read as a trophy rather than as text.
 *
 * The treatment comes from the phrase itself (`style`), so a gold one looks
 * gold wherever it turns up, and adding a style is a token rather than a
 * component.
 */
export function Plaque({
  phrase,
  size = "normal",
}: {
  phrase: Catchphrase;
  /** `big` on the versus screen, where it is the loudest thing on display. */
  size?: "normal" | "big";
}) {
  return (
    <span className={`plaque plaque--${phrase.style}${size === "big" ? " plaque--big" : ""}`}>
      {/* The two ends. Drawn as elements rather than ::before/::after so the
          notch can be given the style's own colour without repeating every
          treatment twice in CSS. */}
      <i className="plaque__end" aria-hidden="true" />
      <span className="plaque__words">{phrase.he}</span>
      <i className="plaque__end" aria-hidden="true" />
    </span>
  );
}
