/**
 * The opening film.
 *
 * Ten seconds in a dark petrol station, over the top of the game while the
 * game loads behind it. Tap anywhere to leave, or wait and it leaves itself.
 *
 * ═══ IT MUST NEVER BE IN THE WAY ═══
 *
 * Three rules, and all three exist because a splash screen that gets them
 * wrong is worse than no splash screen at all:
 *
 *   1. NOTHING WAITS FOR IT. It is a layer above a game that is already
 *      booting. The film finishing does not start anything.
 *   2. ANY TAP LEAVES. Not just the button — the whole surface. A child who
 *      wants to play does not read, they press.
 *   3. IT GIVES UP EASILY. A video that errors, stalls or is blocked from
 *      playing dismisses itself. There is no state in which this sits on
 *      top of the game showing nothing.
 *
 * Muted on the first launch, because a browser will not autoplay sound
 * without a gesture and the game's own music is off by default anyway. The
 * replay from the About screen IS a gesture, so that one has sound.
 */
import { useEffect, useRef, useState } from "react";
import { markIntroSeen, onIntroRequest, shouldPlayIntro } from "../game/intro";

const SRC = `${import.meta.env.BASE_URL}brand/intro.mp4`;

/**
 * If the video has not started within this long, leave.
 *
 * A slow connection is the case that matters: the file is 1.3MB and a child
 * on a bad phone should be playing, not watching a black rectangle. Starting
 * is what is measured, not finishing — once it is playing it can take as long
 * as it likes.
 */
const START_BY = 2500;

export function Intro() {
  // `auto` is the first-launch play (muted, by the browser's rules);
  // `replay` came from a tap and may have sound.
  const [mode, setMode] = useState<"auto" | "replay" | null>(() =>
    shouldPlayIntro() ? "auto" : null,
  );
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => onIntroRequest(() => setMode("replay")), []);

  useEffect(() => {
    if (!mode) return;
    markIntroSeen();

    const give = window.setTimeout(() => {
      if (!video.current || video.current.currentTime === 0) setMode(null);
    }, START_BY);

    // play() rejects when autoplay is blocked. Nothing to recover: leave.
    void video.current?.play().catch(() => setMode(null));

    return () => window.clearTimeout(give);
  }, [mode]);

  if (!mode) return null;

  return (
    <div className="intro" onClick={() => setMode(null)}>
      <video
        ref={video}
        className="intro__film"
        src={SRC}
        muted={mode === "auto"}
        playsInline
        autoPlay
        preload="auto"
        onEnded={() => setMode(null)}
        onError={() => setMode(null)}
        /*
         * `stalled` means data stopped arriving — which is fatal before the
         * film has started and merely rude once it is running. A phone that
         * hiccups four seconds in should buffer and carry on, not have the
         * picture vanish; the browser recovers from this on its own.
         */
        onStalled={() => {
          if (!video.current?.currentTime) setMode(null);
        }}
      />
      <button className="intro__skip">דלג</button>
    </div>
  );
}
