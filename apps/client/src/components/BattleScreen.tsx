import { Suspense, lazy } from "react";
import { Icon } from "./Icon";
import { ErrorBoundary } from "./ErrorBoundary";
import { SayButton, SaidBubble } from "./Say";
import { verdictText } from "../game/verdict";
import type { MatchApi } from "../game/useMatch";

/**
 * The battle, and PixiJS with it, fetched only when there is one.
 *
 * It was in the main bundle, so every child downloaded a WebGL renderer
 * before the home screen could draw. The chunk is prefetched the moment the
 * build phase starts (see App.tsx), which is a minute and a half before
 * anybody needs it, so the lazy boundary effectively never renders.
 */
const Arena = lazy(() => import("./Arena").then((mod) => ({ default: mod.Arena })));

export function BattleScreen({
  m,
  result,
  backdrop,
}: {
  m: MatchApi;
  /**
   * The battle to replay. Passed separately from `m` because the caller has
   * already established it is not null — doing that check here as well would
   * be a second place that could disagree about whether there is a battle.
   */
  result: NonNullable<MatchApi["result"]>;
  /** Which arena you have climbed to — it is the floor you fight on. */
  backdrop: string;
}) {
  return (
      <main className="battle">
        <ErrorBoundary
          fallback={(why) => (
            <div className="result__card">
              <h1><Icon name="explode" size={64} /></h1>
              <p>שגיאה בהצגת הקרב</p>
              {/*
                The actual error, in English, in small grey type.
                
                Or has hit this twice and both times all either of us had was
                the Hebrew sentence above — the real message went to the
                console, which on a phone is nowhere. One line is enough to
                turn his next screenshot into a diagnosis.
              */}
              <p className="battle__why">{why}</p>
              <button className="btn-fight" onClick={m.finishBattle}>
                המשך לתוצאה
              </button>
            </div>
          )}
        >
          {/*
            The fallback is a line of text, not a spinner, and it should
            almost never be seen: the chunk is prefetched the moment the
            build phase starts. If it IS seen, the battle is already decided
            — the result was computed before this screen mounted — so the
            only thing waiting costs is the animation.
          */}
          <Suspense fallback={<div className="arena arena--loading">רגע…</div>}>
            <Arena
              result={result}
              onFinish={m.finishBattle}
              flip={m.mySide === "B"}
              verdict={verdictText(result, m.iWon)}
              // Where you fight is where you have climbed to. A guest with
              // no account fights in the first one, which is right.
              backdrop={backdrop}
            />
          </Suspense>
        </ErrorBoundary>
        {/* "ולעצור את הקרב בכל רגע נתון" — straight back to the boards you
            built, mid-blow if you like. A lab you cannot interrupt is just a
            slow match. */}
        {m.playground && (
          <button className="lab__stop" onClick={m.backToPlayground}>
            <Icon name="stop" size={14} /> עצור וחזור ללוח
          </button>
        )}
        {/* The battle is forty-five seconds of the two of you watching the
            same thing happen. That is the moment people want to say "whoa". */}
        {m.online && !m.playground && (
          <>
            <SaidBubble said={m.heard} />
            <SaidBubble said={m.spoke} mine />
            <SayButton onSay={m.say} hearing={m.hearing} onToggleHearing={m.toggleHearing} />
          </>
        )}
      </main>
  );
}
