import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { BattleLog } from "./BattleLog";
import { SayButton, SaidBubble } from "./Say";
import * as V from "../data/voice";
import { verdictText } from "../game/verdict";
import type { MatchApi } from "../game/useMatch";
import type { Overlays } from "../game/useOverlay";

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
}: {
  m: MatchApi;
  panel: Overlays;
  /** Reporting a person needs an account; the server refuses otherwise. */
  signedIn: boolean;
}) {
  const [showLog, setShowLog] = useState(false);
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
          <h1>{m.playground ? (m.iWon ? "הצד שלך החזיק" : "הצד שמולך החזיק") : winnerText}</h1>
          {m.result && (
            <>
              <p className="result__verdict">{verdictText(m.result, m.iWon)}</p>
              <p className="result__tally">
                <span>
                  <Icon name="timer" size={15} /> {(m.result.ticks / 30).toFixed(1)}ש׳
                </span>
                <span>
                  <Icon name="skull" size={15} />{" "}
                  {m.result.events.filter((e) => e.type === "death").length} נפלו
                </span>
              </p>
            </>
          )}
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
                    ? "מתחילים…"
                    : "מחכה ליריב…"
                  : m.rematchOffered
                    ? "רוצים עוד אחד! קדימה"
                    : "קרב חוזר"}
              </button>
            )}
            {m.playground ? (
              <button className="btn-fight" onClick={m.backToPlayground}>
                ← חזרה ללוח
              </button>
            ) : (
              <button
                // Against a bot this is still the main button. It only steps
                // back when there is a person to ask for another round.
                className={`btn-fight${m.online && !m.oppLeft ? " btn-ghost" : ""}`}
                onClick={m.playAgain}
              >
                <Icon name="again" size={17} /> משחק חדש
              </button>
            )}
            <button className="btn-fight btn-ghost" onClick={m.reset}>
              <Icon name="menu" size={16} /> תפריט
            </button>
            {/* Where a complaint about a person actually occurs to somebody:
                right after playing them, not buried in a settings page. */}
            {m.online && !m.playground && signedIn && (
              <button className="btn-fight btn-ghost" onClick={() => panel.show({ kind: "report", about: "player" })}>
                <Icon name="warning" size={15} /> דיווח על היריב
              </button>
            )}
            {m.result && (
              <button className="btn-fight btn-online" onClick={() => setShowLog((v) => !v)}>
                {showLog ? (
                  "מספיק, הבנתי"
                ) : (
                  <>
                    <Icon name="report" size={16} /> שאסביר לך מה קרה?
                  </>
                )}
              </button>
            )}
          </div>
          {showLog && m.result && <BattleLog result={m.result} mySide={m.mySide} />}
          </div>
        </div>
      </main>
  );
}
