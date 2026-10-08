import { Component, type ReactNode } from "react";
import { track } from "../game/track";

interface Props {
  children: ReactNode;
  /**
   * What to show instead. A function gets the error, so a screen can say what
   * went wrong rather than only that something did.
   */
  fallback: ReactNode | ((error: string) => ReactNode);
}
interface State {
  hasError: boolean;
  message: string;
}

/**
 * The last thing that crashed a boundary, for the bug report to pick up.
 *
 * Module-level rather than state: whatever crashed is by definition not
 * rendering any more, and the report form is somewhere else entirely.
 */
let last: { at: string; message: string } | null = null;
export function lastCrash(): { at: string; message: string } | null {
  return last;
}

/**
 * Keeps a renderer error from blanking the whole app.
 *
 * ═══ IT SAYS WHAT HAPPENED NOW ═══
 *
 * Or, twice: *"it gave me the error showing the battle again."* Twice, and
 * both times all anybody had was the sentence "error showing the battle" —
 * the actual error went to `console.error`, which on the phone he is playing
 * on is nowhere at all. An intermittent crash that destroys its own evidence
 * is one that has to be reproduced before it can be read, and I could not
 * reproduce it in a run of matches.
 *
 * So the message comes out with the fallback. It is ugly and it is English
 * and it is EXACTLY one line, which is a fair price for a screenshot that
 * answers the question instead of asking it.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error ?? "unknown error");
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown): void {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    last = { at: new Date().toISOString(), message: detail };
    console.error("render error:", error);
    /*
     * And tell the server, so it lands on a screen Or can read.
     *
     * A console message on a child's phone is not a bug report — it is why
     * the same crash has now been described to me twice as "it did the thing
     * again" with nothing else to go on.
     *
     * Trimmed, because the event bag is capped at 800 bytes and the useful
     * part of a stack is the top of it. `where` is the screen, which is the
     * first thing anybody wants to know.
     */
    track("crash", {
      where: window.location.hash || "app",
      message: detail.slice(0, 500),
      screen: `${window.innerWidth}x${window.innerHeight}`,
    });
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === "function" ? fallback(this.state.message) : fallback;
  }
}
