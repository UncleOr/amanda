/**
 * How tall the part of the screen you can actually SEE is.
 *
 * Or, three times now and with arrows drawn on the screenshots: *"how
 * annoyinggg that Asulins still isn't in the middle, eh? And Amanda too."*
 *
 * ═══ WHY THE CSS ANSWER WAS NOT ENOUGH ═══
 *
 * The overlay was `inset: 0`, which is the LAYOUT viewport. Measured off his
 * photograph: the mark sat 10.8% below the middle, because the layout
 * viewport was 2000x1127 while 2000x923 could be looked at — `contain`
 * fitted the film to the taller box and centred it in a rectangle whose
 * bottom fifth he could not see.
 *
 * So I moved it to `100dvh`, which is the documented answer, and shipped it,
 * and the number came back **unchanged at 10.7%**. `dvh` is the viewport as
 * it changes when browser chrome hides — and where there is no browser
 * chrome, because this is an installed app, `dvh` is simply the whole screen
 * again. It describes a thing that was never the problem here.
 *
 * `visualViewport` is the thing that is: the rectangle the user is actually
 * looking at, after every bar, cutout and keyboard. It is not a heuristic
 * and it is not a unit whose meaning depends on the browser's furniture — it
 * is a number, and it can be read back and checked, which is the whole
 * reason to prefer it after two wrong guesses.
 *
 * Written onto <html> as a custom property so the CSS stays CSS, and so one
 * subscription serves the ident, the opening film and anything else that has
 * to fill the screen exactly.
 */
const VAR = "--seen-h";

function write(): void {
  const h = window.visualViewport?.height ?? window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty(VAR, `${Math.round(h)}px`);
}

/**
 * Keep it true, for as long as the page lives.
 *
 * `resize` on visualViewport fires for the bars appearing and disappearing;
 * the window's own covers a rotation. Neither is frequent and both are a
 * single property write, so there is nothing here worth throttling.
 */
export function watchViewport(): void {
  write();
  window.visualViewport?.addEventListener("resize", write);
  window.addEventListener("resize", write);
  window.addEventListener("orientationchange", write);
}
