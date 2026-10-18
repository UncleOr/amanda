/**
 * **A film, and something of Amanda for as long as it has nothing to show.**
 *
 * Or: *"just before the Asulins ident there's an ugly video loading symbol.
 * Let's replace it with something of Amanda"* — then *"small, in the middle.
 * And have it show while the opening is loading too"* — then *"you can still
 * see a grey square."*
 *
 * ═══ WHY THIS IS ONE COMPONENT AND NOT TWO COPIES ═══
 *
 * There are two openings, the studio ident and the film, and they had the
 * same six lines of markup pasted into each. That is how the grey square
 * happened twice: one wrong `MARK` was written, copied, and shipped in both.
 *
 * So the mark, the picture it points at, and the rule about when the video
 * may be seen live here, once. Ident.tsx and Intro.tsx keep what genuinely
 * differs between them — which film, whether it has sound, what happens when
 * it ends — and nothing else.
 *
 * ═══ THE VIDEO IS INVISIBLE UNTIL IT HAS A FRAME ═══
 *
 * This is the part that cannot be checked in a desktop browser, which is why
 * it kept coming back.
 *
 * A `<video>` with no data yet is painted by the platform however it likes.
 * Desktop Chrome paints nothing at all — so the mark underneath shows, and
 * every local check looks right. The Android WebView paints its own idea of
 * a video: a flat plate with a spinner turning in the middle of it. That is
 * Or's *"grey circle"*, and it sits ON TOP of the mark, because the film is
 * the later element.
 *
 * Hiding the mark behind the film and hoping the film is transparent is a
 * guess about a platform. Holding the film at `opacity: 0` until it reports
 * a frame is not: `loadeddata` means there is a picture to draw, and until
 * then there is provably nothing worth looking at.
 *
 * Three events rather than one, because exactly one of them has to be right:
 *
 *   loadeddata   the first frame is decoded — the honest signal
 *   playing      playback started, in case the first was missed
 *   timeupdate   the clock moved, so there is certainly a picture
 *
 * A film that somehow never fires any of them stays invisible, and the mark
 * stays — which is the same thing the player sees while it loads, and the
 * openings all dismiss themselves on a stall anyway.
 */
import { forwardRef, useCallback, useState } from "react";

/**
 * The little Amanda, and NOT `icon-512.png`, which is what it was and what
 * Or photographed.
 *
 * A launcher icon is an opaque square by definition — Android masks it to
 * whatever shape each phone wants, so the art is painted onto a filled
 * plate. Measured, that file is 512x512 with no alpha channel at all and
 * corners at rgb(5,16,42), against a screen of rgb(7,10,18): a navy tile in
 * the middle of the dark, with the breathing animation in opening.css
 * drawing the eye straight to its edges.
 *
 * `brand/mark.webp` is the round badge: 52% transparent, 13.9KB. The weight
 * matters on its own — the ident it covers is 69KB, so the old mark arrived
 * after the thing it was there to wait for. Built by
 * scripts/make-loading-mark.mjs, which refuses a source with no alpha.
 */
const MARK = `${import.meta.env.BASE_URL}brand/mark.webp`;

type Props = {
  /** The film to play. */
  src: string;
  /** Muted films are the ones a browser will autoplay without a gesture. */
  muted?: boolean;
  onEnded: () => void;
  onError: () => void;
  /**
   * Data stopped arriving. Fatal before the film has started and merely rude
   * once it is running, so the callers decide — they are the ones holding a
   * ref to the element and can ask what its clock says.
   */
  onStalled: () => void;
};

export const OpeningFilm = forwardRef<HTMLVideoElement, Props>(function OpeningFilm(
  { src, muted, onEnded, onError, onStalled },
  ref,
) {
  const [hasFrame, setHasFrame] = useState(false);
  const frame = useCallback(() => setHasFrame(true), []);

  return (
    <>
      {/* Amanda, small and in the middle, while the film has nothing to
          show. See .opening__mark in opening.css. */}
      <img className="opening__mark" src={MARK} alt="" />
      <video
        ref={ref}
        className={`opening__film${hasFrame ? " opening__film--on" : ""}`}
        src={src}
        muted={muted}
        playsInline
        autoPlay
        preload="auto"
        onLoadedData={frame}
        onPlaying={frame}
        onTimeUpdate={frame}
        onEnded={onEnded}
        onError={onError}
        onStalled={onStalled}
      />
    </>
  );
});
