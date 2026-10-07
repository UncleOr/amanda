import { useCallback, useState } from "react";

/**
 * Which full-screen panel is open, as ONE piece of state.
 *
 * ═══ WHY THIS IS NOT NINE BOOLEANS ═══
 *
 * It was: `albumOpen`, `profileOpen`, `modesOpen`, `friendsOpen`, `shopOpen`,
 * `whyOpen`, `inboxOpen`, `aboutOpen` and `reportOpen`. Every one of them is
 * a modal that covers the screen, so at most one can mean anything — and with
 * nine independent booleans, two being true at once is a state the type system
 * cheerfully allows and the screen renders as a mess. It had already started:
 * the sign-in prompt opens the profile, and the inbox opens the shop.
 *
 * One value means "two open at once" cannot be represented, and closing is one
 * call rather than remembering which of nine to clear.
 *
 * ═══ WHY A TAGGED OBJECT AND NOT A STRING ═══
 *
 * Because one of them carries something. A report is about a bug or about a
 * person, and that is not a second piece of state to keep in step — it rides
 * along with the thing it belongs to and disappears with it.
 */
export type Overlay =
  | { kind: "album" }
  | { kind: "profile" }
  | { kind: "modes" }
  | { kind: "friends" }
  | { kind: "shop" }
  | { kind: "inbox" }
  | { kind: "about" }
  /** "What's new" — see data/updates.ts. */
  | { kind: "updates" }
  /** The "what an account gives you" prompt, shown at a locked door. */
  | { kind: "why" }
  | { kind: "report"; about: "bug" | "player" };

export type OverlayKind = Overlay["kind"];

export interface Overlays {
  /** What is open, or null. */
  open: Overlay | null;
  /** Is this one open? `is("report")` ignores which kind of report it is. */
  is: (kind: OverlayKind) => boolean;
  /** Open one. Anything already open closes, because it had to anyway. */
  show: (overlay: Overlay | OverlayKind) => void;
  close: () => void;
}

export function useOverlay(): Overlays {
  const [open, setOpen] = useState<Overlay | null>(null);

  const show = useCallback((overlay: Overlay | OverlayKind) => {
    setOpen(typeof overlay === "string" ? ({ kind: overlay } as Overlay) : overlay);
  }, []);

  const close = useCallback(() => setOpen(null), []);

  const is = useCallback((kind: OverlayKind) => open?.kind === kind, [open]);

  return { open, is, show, close };
}
