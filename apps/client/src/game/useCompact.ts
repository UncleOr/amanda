import { useEffect, useState } from "react";

/**
 * Is there too little room for the home screen's full arrangement?
 *
 * Or, looking at the game on his phone: *"on mobile it does not look
 * inviting at all. The whole layout needs rethinking so that nobody has to
 * scroll. Maybe more menus and popups so that everything fits."*
 *
 * ═══ WHY THIS IS A HOOK AND NOT A MEDIA QUERY ═══
 *
 * Almost all of that answer IS a media query: the same markup, arranged
 * differently. One part is not. "More menus and popups" means something that
 * is a panel on a phone and a block on a desktop, and CSS cannot move a
 * component into an overlay — only hide it in one place and show it in
 * another, which renders it twice and runs its fetch twice.
 *
 * So this is the ONE thing the markup is allowed to branch on, and it stays
 * one thing: everything else about the phone layout lives in CSS, where it
 * belongs.
 *
 * ═══ THE TWO LIMITS ═══
 *
 * WIDTH, because below this the grid is one column anyway (home-layout.css
 * uses the same 860). HEIGHT, because a landscape phone is 832 wide and 384
 * tall — wide enough to pass any width test and far too short to hold the
 * screen. Measured on Or's: the purse ended up 989px down a 384px screen.
 */
const TIGHT = "(max-width: 860px), (max-height: 560px)";

export function useCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(TIGHT).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(TIGHT);
    const onChange = () => setCompact(mq.matches);
    // Turning a phone sideways changes the answer, and so does dragging a
    // desktop window — this has to follow, not be read once at boot.
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return compact;
}
