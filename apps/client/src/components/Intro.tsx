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
import { Ident } from "./Ident";
import {
  identJustPlayed,
  markIdentPlayed,
  markIntroSeen,
  onIntroRequest,
  shouldPlayIntro,
} from "../game/intro";
import { line as t } from "../game/copy";

/*
 * One film per language.
 *
 * Eight of its ten seconds are four monsters in a petrol station with not a
 * word in them. The last two are the name — Or: *"let's add at the end there
 * Amanda - monster card game, like a title card at the end of the film"* —
 * and a title card has words, so there are two files. They are built by
 * scripts/make-intro.sh and weigh 1.5MB each.
 */
/*
 * ═══ ONE FILM, IN ENGLISH ═══
 *
 * Or: *"make sure it works in English too. In general I'd rather all the
 * videos and so on were only in English and not in Hebrew."*
 *
 * So there is one. The eight seconds before the title card have not a word
 * in them in any language, and the card itself now says AMANDA the way the
 * store listing, the trailer and the studio ident already do — which is also
 * the end of a whole class of bug, because the Hebrew card was the one whose
 * wordmark kept coming out in the wrong place.
 *
 * `intro-he.mp4` is left in the repo rather than deleted: it is 1.5MB of
 * finished work and the decision is a preference, not a fault.
 */
const SRC = `${import.meta.env.BASE_URL}brand/intro-en.mp4`;
/** The loading mark both openings show. See opening.css. */
const MARK = `${import.meta.env.BASE_URL}icon-512.png`;

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
  /*
   * The studio ident runs first, on EVERY launch — see Ident.tsx.
   *
   * On a first visit that is two films in a row: three seconds of Asulins and
   * then ten of monsters. They must not play over each other, so the film
   * does not start until the ident says it has finished. On every later
   * launch the ident plays and nothing follows it.
   *
   * A REPLAY skips the ident: "watch the opening again" is a request for the
   * film, and nobody asking for it wants the studio logo first.
   */
  /*
    * Already true when this page is a RELOAD of one that just played it —
    * the game restarts itself to pick up a new version, and that is not an
    * opening. See identJustPlayed.
    */
  const [identDone, setIdentDone] = useState(identJustPlayed);
  const [mode, setMode] = useState<"auto" | "replay" | null>(() =>
    shouldPlayIntro() ? "auto" : null,
  );
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => onIntroRequest(() => setMode("replay")), []);

  useEffect(() => {
    if (!mode || (mode === "auto" && !identDone)) return;
    markIntroSeen();

    const give = window.setTimeout(() => {
      if (!video.current || video.current.currentTime === 0) setMode(null);
    }, START_BY);

    // play() rejects when autoplay is blocked. Nothing to recover: leave.
    void video.current?.play().catch(() => setMode(null));

    return () => window.clearTimeout(give);
  }, [mode, identDone]);

  if (!identDone && mode !== "replay")
    return (
      <Ident
        onDone={() => {
          markIdentPlayed();
          setIdentDone(true);
        }}
      />
    );
  if (!mode) return null;

  return (
    <div className="opening" onClick={() => setMode(null)}>
      {/* Amanda, small and in the middle, while the film has nothing to
          show yet. See .opening__mark in opening.css. */}
      <img className="opening__mark" src={MARK} alt="" />
      <video
        ref={video}
        className="opening__film"
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
      <button className="opening__skip">{t("s7bf4370", "דלג")}</button>
    </div>
  );
}
