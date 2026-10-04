import { useEffect, useRef, useState } from "react";
import { PHASES } from "@amanda/shared";
import { useMatch } from "./game/useMatch";
import { useDrag } from "./game/useDrag";
import { sfx } from "./game/sfx";
import { music } from "./game/music";
import { ACTIONS } from "./data/catalog";
import { BoardGrid } from "./components/BoardGrid";
import { CardView } from "./components/CardView";
import { CardDetailModal } from "./components/CardDetailModal";
import { ActionCardView } from "./components/ActionCardView";
import { ActionDetailModal } from "./components/ActionDetailModal";
import { Arena } from "./components/Arena";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CardGallery } from "./components/CardGallery";
import { ArenaPreview } from "./components/ArenaPreview";
import { BattleLog } from "./components/BattleLog";


const PHASE_LABEL: Record<string, string> = {
  countdown: "מתכוננים…",
  waiting: "מחפש יריב…",
  build: PHASES.build.label.he,
  panic: PHASES.panic.label.he + "!",
  prebattle: "נועלים לוחות…",
  battle: PHASES.battle.label.he,
  result: "סיום",
};

/** Phases where leaving means abandoning a match in progress. */
const IN_MATCH = ["countdown", "build", "panic", "prebattle", "battle"];

/**
 * Review views, chosen once at module load: ?gallery for the card art, ?arena
 * for the battle effects. Reading this inside App would mean returning before
 * its hooks run, which breaks the rules of hooks (and Fast Refresh with it).
 */
const REVIEW = new URLSearchParams(location.search).has("gallery")
  ? "gallery"
  : new URLSearchParams(location.search).has("arena")
    ? "arena"
    : null;

export default function App() {
  if (REVIEW === "gallery") return <CardGallery />;
  if (REVIEW === "arena") return <ArenaPreview />;
  return <Game />;
}

function Game() {
  const m = useMatch();
  const [detail, setDetail] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const openInfo = (cardId: string) => setDetail(cardId);

  const showBoards = m.phase === "build" || m.phase === "panic" || m.phase === "prebattle";
  const interactive = m.phase === "build" || m.phase === "panic";

  // Drag a card from the hand onto a board slot (mouse + touch).
  const { drag, start: startDrag, dragging } = useDrag((_cardId, target) => {
    if (target === "king") m.placeKing();
    else {
      const [x, y] = target.split("-").map(Number);
      if (x !== undefined && y !== undefined) m.placeAt(x, y);
    }
  });

  // Background music follows the phase (crossfading between clips).
  useEffect(() => {
    if (m.phase === "intro" || m.phase === "countdown" || m.phase === "waiting")
      music.play("menu");
    else if (m.phase === "build") music.play("build");
    else if (m.phase === "panic") music.play("panic");
    else if (m.phase === "battle") music.play("battle");
    else if (m.phase === "result")
      music.play(m.result?.winner === "A" ? "win" : "lose", { loop: false });
  }, [m.phase, m.result]);

  // Countdown beeps for the timed overlays.
  const secRef = useRef(-1);
  useEffect(() => {
    if (m.phase === "countdown" || m.phase === "prebattle") {
      const s = Math.ceil(m.timeLeft);
      if (s !== secRef.current && s > 0) {
        secRef.current = s;
        sfx.play("beep");
      }
    } else {
      secRef.current = -1;
    }
  }, [m.timeLeft, m.phase]);

  const winnerText =
    m.oppLeft && !m.result ? "🎉 היריב עזב — ניצחת!" : m.iWon ? "🎉 ניצחת!" : "😢 הפסדת";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__title">אמנדה — המשחקון</div>
        {PHASE_LABEL[m.phase] && (
          <div className={`topbar__phase phase--${m.phase}`}>{PHASE_LABEL[m.phase]}</div>
        )}
        {(m.phase === "build" || m.phase === "panic") && (
          <div className="topbar__timer">⏱️ {Math.ceil(m.timeLeft)}s</div>
        )}
        <div className="topbar__right">
          {m.phase !== "intro" && (
            <button
              className="topbar__exit"
              title="חזרה לתפריט"
              onClick={() => {
                sfx.play("click");
                // Leaving mid-match throws the board away, so ask first.
                if (IN_MATCH.includes(m.phase)) setConfirmExit(true);
                else m.reset();
              }}
            >
              ✕ יציאה
            </button>
          )}
          <button
            className="mute"
            title={muted ? "הפעלת צליל" : "השתקה"}
            onClick={() => {
              const nowMuted = sfx.toggleMute();
              music.setMuted(nowMuted);
              setMuted(nowMuted);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {/* ---- intro / start screen ---- */}
      {m.phase === "intro" && (
        <main className="intro">
          <div className="intro__card">
            <h1>אמנדה</h1>
            <p className="intro__tag">קרב מדבקות מהיר · 4×4</p>
            <div className="versus">
              <div className="who who--me">
                <div className="who__avatar">🧑</div>
                <div className="who__name">אתה</div>
              </div>
              <div className="versus__x">VS</div>
              <div className="who who--enemy">
                <div className="who__avatar">🤖</div>
                <div className="who__name">היריב</div>
              </div>
            </div>
            <div className="intro__buttons">
              <button className="btn-fight" onClick={m.startMatch}>
                🤖 נגד המחשב
              </button>
              <button
                className="btn-fight btn-online"
                onClick={m.startOnline}
                disabled={!m.onlineAvailable}
                title={m.onlineAvailable ? "" : "לא זמין בבנייה הזו (צריך שרת)"}
              >
                🌐 אונליין
              </button>
            </div>
            <p className="intro__hint">
              דקה וחצי לבנות את הלוח · 15 שניות פאניקה · 15 שניות קרב
              {!m.onlineAvailable && (
                <>
                  <br />
                  (מצב אונליין דורש שרת פעיל)
                </>
              )}
            </p>
          </div>
        </main>
      )}

      {/* ---- waiting for an online opponent ---- */}
      {m.phase === "waiting" && (
        <main className="intro">
          <div className="intro__card">
            <div className="overlay__count" style={{ fontSize: 60 }}>
              {m.netError ? "🔌" : "🌐"}
            </div>
            <h2>{m.netError ? "אין חיבור לשרת" : "מחפש יריב…"}</h2>
            <p className="intro__tag">
              {m.netError
                ? "לא הצלחנו להתחבר לשרת המשחק. אפשר לשחק נגד המחשב בינתיים."
                : "פתחו את המשחק בטאב/מכשיר נוסף כדי לשחק אחד נגד השני"}
            </p>
            <div className="intro__buttons">
              {m.netError && (
                <button className="btn-fight" onClick={m.startMatch}>
                  🤖 נגד המחשב
                </button>
              )}
              <button className="btn-fight btn-online" onClick={m.reset}>
                {m.netError ? "חזרה" : "ביטול"}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ---- build / panic / prebattle: two facing boards ---- */}
      {showBoards && (
        <main className={`build${m.phase === "panic" ? " build--panic" : ""}`}>
          <div className="boards">
            <section className="side side--me">
              <div className="side__label">🧑 אתה · חזית ⟶</div>
              <BoardGrid
                placements={m.placements}
                king={m.king}
                side="left"
                interactive={interactive}
                handActive={m.hand !== null}
                mods={m.mods}
                targeting={m.targeting !== null}
                onTarget={m.applyTargetCell}
                onTargetKing={m.applyTargetKing}
                dragging={dragging}
                dragOver={drag.over}
                onCellClick={(x, y) => m.placeAt(x, y)}
                onKingClick={m.placeKing}
                onCardInfo={openInfo}
              />
            </section>

            <div className="midline">
              <span>⚔️</span>
            </div>

            <section className="side side--enemy">
              <div className="side__label">
                🤖 היריב {m.phase === "build" ? "· ערפל" : "· נחשף!"} ⟵ חזית
              </div>
              <BoardGrid
                placements={m.opponent.placements}
                king={m.opponent.king}
                side="right"
                reveal={m.revealOpponentCell}
                revealKing={m.revealOpponentKing}
                onCardInfo={openInfo}
              />
            </section>
          </div>

          {m.targeting && (
            <div className="targeting-bar">
              🎯 בחרו קלף על הלוח שלכם עבור "{ACTIONS.get(m.targeting)?.name.he}"
              <button onClick={m.cancelTargeting}>ביטול</button>
            </div>
          )}

          {interactive && (
            <div className="actions">
              <span className="actions__title">
                קלפי פעולה {m.actionBar.length}/3:
              </span>
              {m.actionBar.length === 0 && (
                <span className="actions__empty">שלוף קלפי פעולה מהחפיסה וקח אותם לכאן</span>
              )}
              {m.actionBar.map((a) => (
                <div key={a.id} className="action-chip">
                  <div className="action-chip__card">
                    <ActionCardView
                      actionId={a.id}
                      size="small"
                      used={a.used}
                      onClick={() => setActionDetail(a.id)}
                    />
                  </div>
                  <div className="action-chip__row">
                    <button
                      className="action-chip__main"
                      disabled={a.passive || a.used}
                      onClick={() => m.activateAction(a.id)}
                    >
                      {a.passive ? "♾️ פעיל" : a.used ? "✔ נוצל" : "▶ הפעל"}
                    </button>
                    <button
                      className="action-chip__info"
                      title="הסבר"
                      onClick={() => setActionDetail(a.id)}
                    >
                      ℹ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {interactive && (
            <aside className="hand">
              <div className="hand__current">
                {!m.hand ? (
                  <div className="hand__empty">אין קלף</div>
                ) : m.handIsAction ? (
                  <div className="action-hand">
                    <ActionCardView
                      actionId={m.hand}
                      size="large"
                      onClick={() => setActionDetail(m.hand!)}
                      onInfo={() => setActionDetail(m.hand!)}
                    />
                  </div>
                ) : (
                  <div
                    className={`hand__draggable${dragging ? " hand__draggable--dragging" : ""}`}
                    onPointerDown={(e) => startDrag(m.hand!, e)}
                    title="גררו ללוח או לחצו לפרטים"
                  >
                    <CardView
                      cardId={m.hand}
                      size="large"
                      onClick={() => !dragging && openInfo(m.hand!)}
                      onInfo={() => openInfo(m.hand!)}
                    />
                  </div>
                )}
              </div>
              <div className="hand__counts">
                <span
                  className={`count count--deck${m.deckLeft <= 3 ? " count--low" : ""}`}
                  title="קלפים שנשארו בחפיסה"
                >
                  🃏 {m.deckLeft}
                </span>
                <span className="count count--discard" title="קלפים בפח">
                  🗑️ {m.discardCount}
                </span>
              </div>
              <div className="hand__buttons">
                {m.handIsAction && (
                  <button className="take-action" onClick={m.takeAction} disabled={m.barFull}>
                    {m.barFull ? "הבר מלא" : "➕ קח לפעולה"}
                  </button>
                )}
                <button onClick={m.discardHand} disabled={m.hand === null}>
                  זרוק 🗑️
                </button>
                <button onClick={m.takeDiscard} disabled={!m.discardTop}>
                  קח מהפח {m.discardTop ? "♻️" : ""}
                </button>
              </div>
              <p className="hand__hint">
                מפלצת: הנחה על משבצת (קבוע!) · קלף פעולה: "קח לפעולה" (עד 3) · 👑 = מלך
              </p>
              {!m.hasKing && <p className="warn">⚠️ עדיין לא מיניתם מלך!</p>}
              <button className="btn-fight" onClick={m.toBattle}>
                ⚔️ התחל קרב!
              </button>
            </aside>
          )}

          {m.phase === "prebattle" && (
            <div className="overlay">
              <div className="overlay__mini">ממלאים את המשבצות הריקות…</div>
              <div className="overlay__count">{Math.ceil(m.timeLeft)}</div>
              <div className="overlay__label">הקרב מתחיל!</div>
            </div>
          )}
        </main>
      )}

      {/* ---- countdown before build ---- */}
      {m.phase === "countdown" && (
        <main className="build">
          <div className="overlay">
            <div className="overlay__count">{Math.ceil(m.timeLeft)}</div>
            <div className="overlay__label">מתכוננים לבנייה…</div>
          </div>
        </main>
      )}

      {/* ---- battle ---- */}
      {m.phase === "battle" && m.result && (
        <main className="battle">
          <ErrorBoundary
            fallback={
              <div className="result__card">
                <h1>💥</h1>
                <p>שגיאה בהצגת הקרב</p>
                <button className="btn-fight" onClick={m.finishBattle}>
                  המשך לתוצאה
                </button>
              </div>
            }
          >
            <Arena result={m.result} onFinish={m.finishBattle} flip={m.mySide === "B"} />
          </ErrorBoundary>
        </main>
      )}

      {/* ---- result ---- */}
      {m.phase === "result" && (
        <main className="result">
          <div className="result__card">
            <h1>{winnerText}</h1>
            {m.result && (
              <p>
                הקרב נמשך {(m.result.ticks / 30).toFixed(1)} שניות ·{" "}
                {m.result.events.filter((e) => e.type === "death").length} מפלצות נפלו
              </p>
            )}
            <div className="result__buttons">
              <button className="btn-fight" onClick={m.reset}>
                🔄 משחק חדש
              </button>
              {m.result && (
                <button className="btn-fight btn-online" onClick={() => setShowLog((v) => !v)}>
                  {showLog ? "הסתר דוח" : "📋 מה קרה בקרב?"}
                </button>
              )}
            </div>
            {showLog && m.result && <BattleLog result={m.result} mySide={m.mySide} />}
          </div>
        </main>
      )}

      {/* floating card that follows the pointer while dragging */}
      {drag.cardId && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardView cardId={drag.cardId} size="medium" />
        </div>
      )}

      {confirmExit && (
        <div className="modal-overlay" onClick={() => setConfirmExit(false)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <h2>לצאת מהמשחק?</h2>
            <p className="modal__role">הלוח שבנית יימחק והקרב לא יתקיים.</p>
            <div className="modal__actions">
              <button
                className="btn-fight btn-danger"
                onClick={() => {
                  setConfirmExit(false);
                  m.reset();
                }}
              >
                צא מהמשחק
              </button>
              <button className="btn-fight btn-online" onClick={() => setConfirmExit(false)}>
                המשך לשחק
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && <CardDetailModal cardId={detail} onClose={() => setDetail(null)} />}
      {actionDetail && (
        <ActionDetailModal actionId={actionDetail} onClose={() => setActionDetail(null)} />
      )}
    </div>
  );
}
