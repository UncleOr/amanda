import { useEffect, useRef, useState } from "react";
import { pressed } from "../game/press";
import { line as t } from "../game/copy";

/**
 * A code, and pressing it puts it on the clipboard.
 *
 * ═══ WHY THIS EXISTS AT ALL ═══
 *
 * Or: *"when you press and hold, the text gets selected. Can we turn that
 * off? The only case you need it is if there is a code, and then you can
 * have a copy button. Or inside a text box."*
 *
 * So the selection goes off everywhere (see styles/tokens.css) and the three
 * places that were the reason to keep it get this instead: the room code, a
 * friend code and a club invite. All three are short, all three are typed
 * into somebody else's phone, and long-press-and-drag-the-handles was never
 * how a seven-year-old was going to do that anyway.
 *
 * ⚠ THE WHOLE CODE IS THE BUTTON, not a button beside it. That is this
 * project's own rule by now — the chest line on the result screen, the
 * challenges line beside it — and it is the right one twice over here: the
 * code is already the biggest thing on the screen, so making it the target
 * costs nothing and gives a child a 44-point hit area instead of a 20-point
 * icon.
 *
 * ═══ AND IT CAN FAIL, SO IT SAYS SO ═══
 *
 * `navigator.clipboard` is refused outright in some webviews and on any
 * page that is not a secure origin. A copy button that silently does nothing
 * is worse than no copy button, because the child walks away believing the
 * code is on the clipboard. There is a second way — a throwaway textarea
 * and `execCommand` — and if both go, the press says so rather than
 * celebrating.
 */
export function CopyCode({
  code,
  className,
  title,
}: {
  /** The code itself. Rendered exactly as given. */
  code: string;
  /** The class the code already had, so nothing about it looks different. */
  className: string;
  /** What it is, for a screen reader, since the digits say nothing. */
  title?: string;
}) {
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy(el: HTMLElement) {
    pressed(el, { sound: "click", buzz: "tap" });
    let ok = false;
    try {
      await navigator.clipboard.writeText(code);
      ok = true;
    } catch {
      /*
       * The old way, which still works where the new one is refused. The
       * textarea has to be IN the document and visible enough to focus, so
       * it is placed off-screen rather than hidden — `display: none` cannot
       * be selected and the copy silently does nothing.
       */
      try {
        const pad = document.createElement("textarea");
        pad.value = code;
        pad.setAttribute("readonly", "");
        pad.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(pad);
        pad.select();
        ok = document.execCommand("copy");
        pad.remove();
      } catch {
        ok = false;
      }
    }
    setSaid(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), 1400);
  }

  return (
    <button
      type="button"
      className={`${className} copycode${said ? " copycode--said" : ""}`}
      onClick={(e) => void copy(e.currentTarget)}
      title={title}
    >
      {said === "copied"
        ? t("sfb9a580", "הועתק!")
        : said === "failed"
          ? t("se5dcd9e", "לא הלך — תקריא אותו")
          : code}
    </button>
  );
}
