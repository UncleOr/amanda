/**
 * Three seconds of Asulins, before anything else.
 *
 * Or: *"make me the Asulins ident that should appear every time the game
 * opens (not only the first time)."*
 *
 * ═══ EVERY TIME, WHICH THE FILM IS NOT ═══
 *
 * The opening FILM plays once ever, and the reasoning in game/intro.ts still
 * holds: ten seconds in front of every launch is not an opening, it is an
 * obstacle. This is three, and three is the length every studio ident in the
 * world has settled on for exactly that reason — long enough to be a
 * signature, short enough that nobody reaches for the skip.
 *
 * It is also the only thing in the app with Hod's name on it, which is the
 * actual reason it plays every time.
 *
 * ═══ IT ASKS FOR SOUND AND SETTLES FOR SILENCE ═══
 *
 * Half of what was chosen here is the sting — Or picked it separately from
 * the mark. But a browser blocks autoplay WITH SOUND until it trusts the
 * page, so demanding sound would mean the ident simply does not play.
 *
 * So it tries unmuted first and falls back to muted on rejection. Chrome
 * grants autoplay by media engagement, which a game opened every day
 * accumulates — so it gets its sound most of the time, and on the days it
 * does not, the picture is still there. Never the other way round.
 */
import { useEffect, useRef, useState } from "react";
import { markIdentPlayed } from "../game/intro";

const SRC = `${import.meta.env.BASE_URL}brand/ident.mp4`;
/** The loading mark both openings show. See opening.css. */
const MARK = `${import.meta.env.BASE_URL}icon-512.png`;

/**
 * If it has not started by now, go.
 *
 * Shorter than the film's 2.5s, because this is in front of EVERY launch:
 * a second and a half of black while a 75KB file fails to start is already
 * longer than the thing it is waiting for deserves.
 */
const START_BY = 1500;

export function Ident({ onDone }: { onDone: () => void }) {
  const [gone, setGone] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const finish = useRef(onDone);
  finish.current = onDone;

  useEffect(() => {
    /*
     * Marked on MOUNT, not on finish. The reload this guards against can
     * land halfway through, and half an ident is still an ident the player
     * watched — finishing is not what makes the second one unwanted.
     */
    markIdentPlayed();

    const leave = () => {
      setGone(true);
      finish.current();
    };

    const give = window.setTimeout(() => {
      if (!video.current || video.current.currentTime === 0) leave();
    }, START_BY);

    const el = video.current;
    if (el) {
      // Sound first. A rejection is the browser saying "not yet", not an
      // error — so the same film plays again, silently, rather than nothing.
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(leave);
      });
    }
    return () => window.clearTimeout(give);
  }, []);

  if (gone) return null;

  const leave = () => {
    setGone(true);
    finish.current();
  };

  return (
    <div className="opening opening--ident" onClick={leave}>
      {/* Amanda, small and in the middle, while the film has nothing to
          show yet. See .opening__mark in opening.css. */}
      <img className="opening__mark" src={MARK} alt="" />
      <video
        ref={video}
        className="opening__film"
        src={SRC}
        playsInline
        autoPlay
        preload="auto"
        onEnded={leave}
        onError={leave}
        onStalled={() => {
          if (!video.current?.currentTime) leave();
        }}
      />
    </div>
  );
}
