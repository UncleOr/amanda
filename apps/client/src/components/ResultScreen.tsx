import { useEffect, useMemo, useRef, useState } from "react";
import { buildReport } from "@amanda/engine";
import { Icon } from "./Icon";
import { BattleLog } from "./BattleLog";
import { Payout } from "./Payout";
import { SayButton, SaidBubble } from "./Say";
import * as V from "../data/voice";
import { CATALOG } from "../data/catalog";
import { gradeBand, verdictText } from "../game/verdict";
import type { MatchApi } from "../game/useMatch";
import type { Overlays } from "../game/useOverlay";
import { line as t, lineF as tf } from "../game/copy";

/**
 * How it went, and what to do next.
 *
 * Pulled out of App.tsx along with the four pieces of state that only this
 * screen has ever read: whether the battle report is showing, and the three
 * headlines. The headlines are picked ONCE when the result arrives rather
 * than on every render — Amanda has several ways of saying "you lost", and
 * re-picking would make her change her mind while you read it.
 */
export function ResultScreen({
  m,
  panel,
  signedIn,
  onOpenChest,
}: {
  m: MatchApi;
  panel: Overlays;
  /** Reporting a person needs an account; the server refuses otherwise. */
  signedIn: boolean;
  /** Open the chest this match just won, from the line that announces it. */
  onOpenChest?: () => void;
}) {
  const [showLog, setShowLog] = useState(false);
  /*
   * The report opens BELOW the buttons, and on a phone that is below the
   * screen: tapping "shall I explain what happened?" left the screen looking
   * exactly as it had, with the answer out of sight. It is brought into view
   * instead of being left to be found.
   *
   * `block: "start"` rather than "center" because the report is taller than
   * the window — centring it would start the reader in the middle of it.
   */
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showLog) return;
    logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showLog]);
  /*
   * The mark out of ten, on the card itself.
   *
   * Or: *"let's show the match score too, without having to go into the
   * explanation."* It was the first thing in the report and the report was
   * behind a button that asks a question — so the one number that says how
   * the board did was the one number nobody saw. A child who played well and
   * lost on the clock deserves to be told so on the screen that says he lost.
   *
   * ⚠ THE WHOLE REPORT IS BUILT FOR ONE NUMBER, and that is on purpose: the
   * grade is weighed from damage, participation and survival across every
   * unit, so there is no cheaper way to it than the pass that already exists.
   * It is one walk over a finished battle's events, memoised on the result,
   * and the same call is made again by the report below when it opens.
   */
  const grade = useMemo(
    () => (m.result ? buildReport(m.result, CATALOG).grades[m.mySide].score : null),
    [m.result, m.mySide],
  );
  const [winTitle, setWinTitle] = useState("");
  const [loseTitle, setLoseTitle] = useState("");
  const [leftTitle, setLeftTitle] = useState("");
  useEffect(() => {
    setWinTitle(V.pick(V.WIN_TITLE));
    setLoseTitle(V.pick(V.LOSE_TITLE));
    setLeftTitle(V.pick(V.OPPONENT_LEFT));
  }, []);
  const winnerText = m.oppLeft && !m.result ? leftTitle : m.iWon ? winTitle : loseTitle;

  return (
      <main className="result">
        <div className={`result__card result__card--${m.iWon ? "win" : "lose"}`}>
          {/*
            The picture first, and it is the whole top of the screen.
            Or: "gaming. Fun. Illustrations." This used to be a 96px icon
            over a flat panel — a dialog box reporting an outcome. A child
            who just won should be looking at something, not reading a
            notice. The headline and buttons sit over the lower third,
            which the illustration leaves quiet for them.
          */}
          <div className="result__scene" aria-hidden="true" />
          <div className="result__body">
          {/* In the lab there is no winner, only a reading. Crowning the
              player for a board they also built for the other side would be
              nonsense, and the taunts are aimed at an opponent who is them. */}
          <h1>{m.playground ? (m.iWon ? t("sb73e6cd", "הצד שלך החזיק") : t("sb66c1e6", "הצד שמולך החזיק")) : winnerText}</h1>
          {m.result && (
            <>
              <p className="result__verdict">{verdictText(m.result, m.iWon)}</p>
              <p className="result__tally">
                {/*
                  The score leads the row, and pressing it opens the report
                  it is the headline of. This screen's own rule by now — the
                  chest line opens the chest, the challenges line opens the
                  challenges — and here it costs nothing: the number was
                  always the first thing in the analysis, so the short answer
                  is now on the card and the long one is one press behind it.
                */}
                {grade !== null && (
                  <button
                    type="button"
                    className={`result__grade result__grade--${gradeBand(grade)}`}
                    onClick={() => setShowLog(true)}
                  >
                    {t("sdf00f7b", "ציון")} <b>{grade}</b>
                    <small>/10</small>
                  </button>
                )}
                <span>
                  <Icon name="timer" size={15} />{" "}
                  {tf("s6832cda", "{0}ש׳", (m.result.ticks / 30).toFixed(1))}
                </span>
                <span>
                  <Icon name="skull" size={15} />{" "}
                  {tf("sb4b2aa8", "{0} נפלו", m.result.events.filter((e) => e.type === "death").length)}
                </span>
              </p>
            </>
          )}
          {/* And what it was worth. Arrives a round trip after the result,
              because the server re-runs the battle before paying anything —
              and draws nothing at all until it does. */}
          {/*
            The challenges open from here through the same `panel` the rest
            of this screen already uses for the report dialog — it is
            rendered at the top of App, outside every phase, so it opens
            over the result exactly as it opens over the home screen.
          */}
          <Payout
            award={m.award}
            onOpenChest={onOpenChest}
            onChallenges={() => panel.show("challenges")}
            /* And the tunnel, through the same panel as the challenges —
               rendered at the top of App, outside every phase, so it opens
               over the result exactly as it opens over the home screen. */
            onTunnel={() => panel.show("tunnel")}
          />
          {/* The two of you, after the fact. The end-of-match lines unlock
              here — "good game" means nothing during the build phase. */}
          {m.online && !m.playground && (
            <div className="result__say">
              <SaidBubble said={m.heard} />
              <SaidBubble said={m.spoke} mine />
              <SayButton
                onSay={m.say}
                atEnd
                hearing={m.hearing}
                onToggleHearing={m.toggleHearing}
              />
            </div>
          )}
          <div className="result__buttons">
            {/*
             * "Again?" with the same person — offered before "new game",
             * because after a close match that is the thing you want, and
             * the other button quietly swaps your opponent for a stranger.
             * Gone the moment they leave: there is nobody to ask.
             */}
            {m.online && !m.playground && !m.oppLeft && (
              <button
                className={`btn-fight${m.rematchOffered && !m.rematchAsked ? "" : " btn-online"}`}
                onClick={m.askRematch}
                disabled={m.rematchAsked}
              >
                <Icon name="again" size={17} />{" "}
                {m.rematchAsked
                  ? m.rematchOffered
                    ? t("s6052ae4", "מתחילים…")
                    : t("s30a40da", "מחכה ליריב…")
                  : m.rematchOffered
                    ? t("s21914e7", "רוצים עוד אחד! קדימה")
                    : t("sab50205", "קרב חוזר")}
              </button>
            )}
            {m.playground ? (
              <button className="btn-fight" onClick={m.backToPlayground}>
                {t("s2d822f4", "← חזרה ללוח")}
              </button>
            ) : (
              <button
                // Against a bot this is still the main button. It only steps
                // back when there is a person to ask for another round.
                className={`btn-fight${m.online && !m.oppLeft ? " btn-ghost" : ""}`}
                onClick={m.playAgain}
              >
                <Icon name="again" size={17} /> {t("se3da978", "משחק חדש")}
              </button>
            )}
            {/*
              Or: *"on the result screen, instead of "menu" and a drawing of a
              hamburger menu, write "back" and a house or an arrow."*
              A hamburger is a promise of a list of options, and this button
              opens no list — it goes back to where you came from.
            */}
            <button className="btn-fight btn-ghost" onClick={m.reset}>
              <Icon name="back" size={16} /> {t("s28e9a18", "חזרה")}
            </button>
            {/* Where a complaint about a person actually occurs to somebody:
                right after playing them, not buried in a settings page. */}
            {m.online && !m.playground && signedIn && (
              <button className="btn-fight btn-ghost" onClick={() => panel.show({ kind: "report", about: "player" })}>
                <Icon name="warning" size={15} /> {t("seb359d8", "דיווח על היריב")}
              </button>
            )}
            {/*
              A quiet button, not a blue gradient across the whole card.
              Measured: it was 442x46 against "משחק חדש" at 216x48 — twice
              the area, and both of them gradients — so the loudest thing on
              the screen after a match was "shall I explain what happened?"
              rather than "play again". Curiosity is secondary to carrying on.
            */}
            {m.result && (
              <button className="btn-fight btn-ghost" onClick={() => setShowLog((v) => !v)}>
                {showLog ? (
                  t("s18fbbed", "מספיק, הבנתי")
                ) : (
                  <>
                    <Icon name="report" size={16} /> {t("se664893", "שאסביר לך מה קרה?")}
                  </>
                )}
              </button>
            )}
          </div>
          {showLog && m.result && (
            <div ref={logRef}>
              <BattleLog result={m.result} mySide={m.mySide} />
            </div>
          )}
          </div>
        </div>
      </main>
  );
}
