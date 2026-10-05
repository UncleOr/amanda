import { useEffect, useRef, useState } from "react";
import { Icon } from "./components/Icon";
import { Album } from "./components/Album";
import { PHASES } from "@amanda/shared";
import type { BattleResult } from "@amanda/engine";
import { useMatch } from "./game/useMatch";
import { useDrag } from "./game/useDrag";
import { sfx } from "./game/sfx";
import { music } from "./game/music";
import { hardRefresh } from "./game/refresh";
import { ACTIONS, isEnemyTargeted } from "./data/catalog";
import * as V from "./data/voice";
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


/**
 * Why the match ended. A battle that runs the full 15 seconds with both Kings
 * standing is settled by a tiebreak chain — and a player who sees their King
 * and half their board alive deserves to be told which link decided it.
 */
function verdictText(result: BattleResult, iWon: boolean): string {
  const whose = iWon ? "של היריב" : "שלך";
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  switch (result.winReason) {
    case "kingDown":
      return `המלך ${whose} נפל — זה מסיים את הקרב מיד.`;
    case "kingHp": {
      const t = result.tiebreak!;
      const mine = result.winner === "A" ? t.b : t.a;
      const theirs = result.winner === "A" ? t.a : t.b;
      return `נגמר הזמן ושני המלכים שרדו — הוכרע לפי חיי המלך: ${pct(
        iWon ? theirs : mine,
      )} שלך מול ${pct(iWon ? mine : theirs)} של היריב.`;
    }
    case "totalHp":
      return "נגמר הזמן והמלכים שרדו עם אותו אחוז חיים — הוכרע לפי סך החיים על הלוח.";
    case "aliveCount":
      return "נגמר הזמן והחיים היו שווים — הוכרע לפי מספר הקלפים ששרדו.";
    case "coinFlip":
      return "נגמר הזמן והכול יצא שווה לחלוטין — הוכרע בהטלת מטבע.";
  }
}

/** Vite serves the app under /amanda/ on Pages and / in dev. */
const BASE = import.meta.env.BASE_URL;

/**
 * One line out of each set, chosen when the screen appears and held still
 * while it is on screen. Re-rolling on every render would change the words
 * under the player's eyes mid-sentence.
 */
function useLine(lines: readonly string[]): string {
  const [line] = useState(() => V.pick(lines));
  return line;
}

const PHASE_LABEL: Record<string, string> = {
  countdown: "מתארגנת…",
  waiting: "מחפשת לך יריב…",
  build: PHASES.build.label.he,
  panic: PHASES.panic.label.he + "!",
  prebattle: "נועלת לוחות…",
  battle: PHASES.battle.label.he,
  result: "זהו",
};

/** Phases where leaving means abandoning a match in progress. */
const IN_MATCH = ["countdown", "build", "panic", "prebattle", "battle"];

/**
 * Review views, chosen once at module load: ?gallery for the card art, ?arena
 * for the battle effects. Reading this inside App would mean returning before
 * its hooks run, which breaks the rules of hooks (and Fast Refresh with it).
 */
/** A room code from an invite link (?join=XXXX), used once on first load. */
const INVITE_CODE = new URLSearchParams(location.search).get("join");
/*
 * Take it out of the address bar the moment it is read.
 *
 * It used to stay there for good, so every reload silently rejoined a room
 * that had long since closed: the game started a match nobody asked for, and
 * the in-app ⟳ button reloaded the same address and did it again. "Used once
 * on first load" is only true if the address stops saying it.
 */
if (INVITE_CODE) {
  const url = new URL(location.href);
  url.searchParams.delete("join");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

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
  const [musicOn, setMusicOn] = useState(music.isEnabled());
  const [confirmExit, setConfirmExit] = useState(false);
  const [joining, setJoining] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  // On a phone the action cards are a drawer, so the board keeps its height.
  const [actionsOpen, setActionsOpen] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);
  // Shown next to the build id: a screenshot of a layout problem is only
  // useful if it says what size screen the layout was solving for.
  const [viewport, setViewport] = useState(() => `${window.innerWidth}×${window.innerHeight}`);
  useEffect(() => {
    const onResize = () => setViewport(`${window.innerWidth}×${window.innerHeight}`);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [showLog, setShowLog] = useState(false);
  const openInfo = (cardId: string) => setDetail(cardId);

  const showBoards = m.phase === "build" || m.phase === "panic" || m.phase === "prebattle";
  const interactive = m.phase === "build" || m.phase === "panic";

  // One line per moment, settled when the screen appears (see useLine).
  const exitTitle = useLine(V.EXIT_TITLE);
  const exitBody = useLine(V.EXIT_BODY);
  const exitConfirm = useLine(V.EXIT_CONFIRM);
  const exitCancel = useLine(V.EXIT_CANCEL);
  const countdownLabel = useLine(V.COUNTDOWN_LABEL);
  const battleStart = useLine(V.BATTLE_START);
  const noKing = useLine(V.NO_KING);
  const searching = useLine(V.SEARCHING);

  // Drag a card from the hand onto a board slot (mouse + touch).
  const { drag, start: startDrag, dragging } = useDrag((_cardId, target) => {
    if (target === "king") m.placeKing();
    else {
      const [x, y] = target.split("-").map(Number);
      if (x !== undefined && y !== undefined) m.placeAt(x, y);
    }
  });

  // An invite link (?join=XXXX) joins that room on its own, so the person you
  // sent it to only has to open it.
  const invitedRef = useRef(false);
  useEffect(() => {
    if (invitedRef.current || !INVITE_CODE || !m.onlineAvailable) return;
    invitedRef.current = true;
    m.joinRoom(INVITE_CODE);
  }, [m]);

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

  // The clock, out loud. Building is a race against a timer you cannot see
  // while you are looking at your board, so the last seconds have to be heard.
  const secRef = useRef(-1);
  useEffect(() => {
    const s = Math.ceil(m.timeLeft);
    if (s === secRef.current || s <= 0) return;

    if (m.phase === "countdown" || m.phase === "prebattle") {
      secRef.current = s;
      sfx.play("beep");
      return;
    }
    // Running out of build time: a quiet tick from ten seconds, urgent at three.
    if (m.phase === "build" || m.phase === "panic") {
      secRef.current = s;
      if (s <= 3) sfx.play("tickUrgent");
      else if (s <= 10) sfx.play("tick");
      return;
    }
    secRef.current = -1;
  }, [m.timeLeft, m.phase]);

  // Settled when the result arrives, not on every render — the headline must
  // not reshuffle itself while the player is reading it.
  const [winTitle, setWinTitle] = useState("");
  const [loseTitle, setLoseTitle] = useState("");
  const [leftTitle, setLeftTitle] = useState("");
  useEffect(() => {
    if (m.phase !== "result") return;
    setWinTitle(V.pick(V.WIN_TITLE));
    setLoseTitle(V.pick(V.LOSE_TITLE));
    setLeftTitle(V.pick(V.OPPONENT_LEFT));
  }, [m.phase]);
  const winnerText = m.oppLeft && !m.result ? leftTitle : m.iWon ? winTitle : loseTitle;

  return (
    <div className="app">
      {/* Two 4x4 boards of portrait cards only fit side by side in landscape,
          so on a phone held upright we ask for a turn instead of squashing. */}
      <div className="rotate-hint">
        <div className="rotate-hint__icon">📱</div>
        <h2>סובב את המכשיר</h2>
        <p>אני משוחקת לרוחב, ילד. ככה אני רואה את שניכם.</p>
      </div>
      <header className={`topbar${m.phase === "intro" ? " topbar--ghost" : ""}`}>
        <div className="topbar__title">
          <img className="topbar__mark" src={`${BASE}brand/amanda_logo.png`} alt="" />
          אמנדה | משחק קלפים מפלצתי
        </div>
        {PHASE_LABEL[m.phase] && (
          <div className={`topbar__phase phase--${m.phase}`}>
            {/* holding a room is waiting for one person, not hunting for anyone */}
            {m.phase === "waiting" && m.roomCode ? "מחכה לחבר שלך…" : PHASE_LABEL[m.phase]}
          </div>
        )}
        {(m.phase === "build" || m.phase === "panic") && (
          <div className="topbar__timer">
            <Icon name="timer" size={15} /> {Math.ceil(m.timeLeft)}s
          </div>
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
            className={`mute${musicOn ? "" : " mute--off"}`}
            title={musicOn ? "כיבוי מוזיקה" : "הפעלת מוזיקה"}
            onClick={() => setMusicOn(music.toggleEnabled())}
          >
            {musicOn ? "🎵" : "🎵̸"}
          </button>
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
        <main className="intro intro--hero">
          {/*
            She is the background, not a picture inside a box. The banner was
            generated with its left half deliberately empty, which is where
            everything below sits.
          */}
          <div
            className="intro__art"
            style={{ backgroundImage: `url("${BASE}brand/amanda_banner.webp")` }}
            aria-hidden="true"
          />
          <div className="intro__card">
            <img
              className="intro__logo"
              src={`${BASE}brand/amanda_logo.png`}
              alt="אמנדה"
              width={512}
              height={512}
            />
            <h1 className="sr-only">אמנדה</h1>
            <p className="intro__tag">קרב מדבקות · 4×4</p>
            <div className="intro__main">
            <div className="versus">
              <div className="who who--me">
                <div className="who__avatar who__avatar--art">
                  <img src={`${BASE}brand/versus_player.webp`} alt="" />
                </div>
                <div className="who__name">אתה</div>
              </div>
              <div className="versus__x">VS</div>
              <div className="who who--enemy">
                <div className="who__avatar who__avatar--art">
                  <img src={`${BASE}brand/versus_robot.webp`} alt="" />
                </div>
                <div className="who__name">היריב</div>
              </div>
            </div>
            <div className="intro__choices">
            <div className="intro__buttons">
              <button className="btn-fight" onClick={m.startMatch}>
                🤖 שחק נגדי
              </button>
              <button
                className="btn-fight btn-online"
                onClick={() => m.hostRoom()}
                disabled={!m.onlineAvailable}
                title={m.onlineAvailable ? "" : "לא בגרסה הזאת"}
              >
                👥 תביא חבר
              </button>
            </div>
            <div className="intro__secondary">
              <button
                className="btn-link"
                onClick={() => m.startOnline()}
                disabled={!m.onlineAvailable}
              >
                🌐 אמצא לך מישהו
              </button>
              <button
                className="btn-link"
                onClick={() => setJoining(true)}
                disabled={!m.onlineAvailable}
              >
                🔑 יש לי קוד
              </button>
              <button className="btn-link" onClick={() => setAlbumOpen(true)}>
                <Icon name="deck" size={15} /> האלבום שלי
              </button>
            </div>
            {joining && (
              <form
                className="join"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (codeInput.trim().length >= 3) m.joinRoom(codeInput);
                }}
              >
                <input
                  className="join__input"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="קוד החדר"
                  maxLength={6}
                  autoFocus
                  inputMode="text"
                />
                <button className="btn-fight" type="submit">
                  הצטרף
                </button>
              </form>
            )}
            </div>
            </div>
            {m.roomError && (
              <p className="warn">
                {m.roomError === "notFound"
                  ? "אין חדר כזה. אולי המצאת אותו."
                  : m.roomError === "self"
                    ? "זה הקוד שלך. אתה לא יכול לאכול את עצמך."
                    : "החדר מלא. שניים מספיקים לי."}
              </p>
            )}
            <p className="intro__version">
              גרסה {__BUILD_ID__} · מסך {viewport}
              <button
                className="btn-link"
                title="מוריד אותי מחדש ומנקה גרסאות ישנות"
                onClick={() => void hardRefresh()}
              >
                ⟳ רענן
              </button>
            </p>
            {!m.onlineAvailable && (
              <p className="intro__hint">(מצב אונליין דורש שרת פעיל)</p>
            )}
          </div>
        </main>
      )}

      {/* ---- waiting for an online opponent ---- */}
      {m.phase === "waiting" && (
        <main className="intro">
          <div className="intro__card">
            <div className="overlay__count" style={{ fontSize: 60 }}>
              {m.netError ? "🔌" : m.roomCode ? "👥" : "🌐"}
            </div>
            <h2>
              {m.netError ? "השרת לא עונה" : m.roomCode ? "מחכה לחבר שלך…" : "מחפשת לך יריב…"}
            </h2>
            {m.roomCode ? (
              <>
                <p className="intro__tag">שלח את הקוד למי שבא לך לאכול:</p>
                <div className="room-code">{m.roomCode}</div>
                <button
                  className="btn-link"
                  onClick={() => {
                    const link = `${location.origin}${location.pathname}?join=${m.roomCode}`;
                    void navigator.clipboard?.writeText(link).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                >
                  {copied ? "✔ העתקתי" : "⧉ העתק הזמנה"}
                </button>
              </>
            ) : (
              <p className="intro__tag">
                {m.netError
                  ? "השרת לא עונה. אני פנויה."
                  : searching}
              </p>
            )}
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
        <main
          className={`build${m.phase === "panic" ? " build--panic" : ""}${
            m.targeting ? " build--targeting" : ""
          }${actionsOpen ? " build--drawer" : ""}`}
        >
          <div className="boards">
            <section className={`side side--me${m.frozenFor > 0 ? " side--frozen" : ""}`}>
              <div className="side__label">🧑 אתה · חזית ⟶</div>
              {m.frozenFor > 0 && (
                <div className="frozen" role="status">
                  <span className="frozen__icon">🧊</span>
                  <strong>הידיים שלך קפואות</strong>
                  <span className="frozen__count">{m.frozenFor.toFixed(1)}</span>
                  <span className="frozen__note">לשלוף ולזרוק אפשר. להדביק — לא.</span>
                </div>
              )}
              <BoardGrid
                placements={m.placements}
                king={m.king}
                side="left"
                interactive={interactive}
                handActive={m.hand !== null}
                mods={m.mods}
                targeting={m.targeting !== null && !isEnemyTargeted(m.targeting)}
                onTarget={m.applyTargetCell}
                onTargetKing={m.applyTargetKing}
                stacked={m.stacked}
                stackSlots={m.stackSlots}
                stackCorners={m.stackCorners}
                dragging={dragging}
                dragOver={drag.over}
                onCellClick={(x, y) => m.placeAt(x, y)}
                onKingClick={m.placeKing}
                onCardInfo={openInfo}
              />
            </section>

            <div className="midline">
              <Icon name="power" size={22} />
            </div>

            <section className="side side--enemy">
              <div className="side__label">
                🤖 היריב {m.phase === "build" ? "" : "· נחשף!"} ⟵ חזית
              </div>
              <BoardGrid
                placements={m.opponent.placements}
                king={m.opponent.king}
                side="right"
                reveal={m.revealOpponentCell}
                revealKing={m.revealOpponentKing}
                onCardInfo={openInfo}
                targeting={m.targeting !== null && isEnemyTargeted(m.targeting)}
                interactive={m.targeting !== null && isEnemyTargeted(m.targeting)}
                onTarget={m.applyTargetCell}
                onTargetKing={m.applyTargetKing}
              />
            </section>
          </div>

          {m.targeting && (
            <div className="targeting-bar">
              <span className="targeting-bar__text">
                🎯{" "}
                {isEnemyTargeted(m.targeting)
                  ? "בחר קלף אצל היריב"
                  : m.firstPick
                    ? "ועכשיו את השני"
                    : "בחר קלף על הלוח שלך"}{" "}
                עבור "{ACTIONS.get(m.targeting)?.name.he}"
              </span>
              <button className="targeting-bar__cancel" onClick={m.cancelTargeting}>
                ✕ ביטול
              </button>
            </div>
          )}

          {interactive && (
            <div className={`actions${actionsOpen ? " actions--open" : ""}`}>
              <button
                className={`actions__handle${m.actionBar.length ? " actions__handle--full" : ""}`}
                onClick={() => setActionsOpen((v) => !v)}
                aria-expanded={actionsOpen}
              >
                {actionsOpen ? "▾" : "▴"} קלפי פעולה
                <b className="actions__handle-count">{m.actionBar.length}/3</b>
              </button>
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
                      disabled={a.passive || a.used || !m.canPlayAction(a.id)}
                      title={!m.canPlayAction(a.id) ? "מאוחר. תכננת גרוע." : undefined}
                      onClick={() => m.activateAction(a.id)}
                    >
                      {a.passive
                        ? "♾️ פעיל"
                        : a.used
                          ? "✔ נוצל"
                          : !m.canPlayAction(a.id)
                            ? "⏳ מאוחר מדי"
                            : "▶ הפעל"}
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
                    title=""
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
                  <Icon name="deck" size={15} /> {m.deckLeft}
                </span>
                <span className="count count--discard" title="קלפים בפח">
                  <Icon name="discard" size={15} /> {m.discardCount}
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
              {m.stackSlots > 0 && (
                <p className="hand__hint hand__hint--stack">
                  🏗️ אפשר להניח קלף על קלף שכבר הנחתם — נשארו {m.stackSlots}
                </p>
              )}
              {m.stackCorners && (
                <p className="hand__hint hand__hint--stack">
                  🏗️ ארבע הפינות פתוחות להנחה כפולה
                </p>
              )}
              {!m.hasKing && <p className="warn">{noKing}</p>}
              <button
                className={`btn-fight${m.ready ? " btn-fight--ready" : ""}`}
                onClick={m.online ? m.toggleReady : m.toBattle}
              >
                {!m.online
                  ? "⚔️ התחל קרב!"
                  : m.ready
                    ? "✔ מוכן — לחץ לביטול"
                    : "⚔️ אני מוכן"}
              </button>
              {m.online && (m.ready || m.oppReady) && (
                <p className="hand__hint hand__hint--ready">
                  {m.ready && m.oppReady
                    ? "שניכם מוכנים — מתחילים"
                    : m.ready
                      ? "אתה מוכן. אפשר להמשיך לבנות עד שגם הוא יהיה."
                      : "היריב מוכן. אתה עדיין יכול לבנות."}
                </p>
              )}
            </aside>
          )}

          {m.phase === "prebattle" && (
            <div className="overlay">
              {/*
                Online the server starts the battle, not this countdown — so
                counting down to zero here promised something that never came
                and left the screen frozen on "0". Say what is actually
                happening instead: the board is locked and we are waiting.
              */}
              {m.online ? (
                <>
                  <div className="overlay__mini">הלוח שלך נעול</div>
                  <div className="overlay__wait" aria-hidden="true">⏳</div>
                  <div className="overlay__label">מחכה שהיריב יסיים…</div>
                </>
              ) : (
                <>
                  <div className="overlay__mini">ממלאת לך את החורים…</div>
                  <div className="overlay__count">{Math.ceil(m.timeLeft)}</div>
                  <div className="overlay__label">{battleStart}</div>
                </>
              )}
            </div>
          )}
        </main>
      )}

      {/* ---- countdown before build ---- */}
      {m.phase === "countdown" && (
        <main className="build">
          <div className="overlay">
            <div className="overlay__count">{Math.ceil(m.timeLeft)}</div>
            <div className="overlay__label">{countdownLabel}</div>
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
            <Arena
              result={m.result}
              onFinish={m.finishBattle}
              flip={m.mySide === "B"}
              verdict={verdictText(m.result, m.iWon)}
            />
          </ErrorBoundary>
        </main>
      )}

      {/* ---- result ---- */}
      {m.phase === "result" && (
        <main className="result">
          <div className="result__card">
            <h1>{winnerText}</h1>
            {m.result && (
              <>
                <p className="result__verdict">{verdictText(m.result, m.iWon)}</p>
                <p>
                  הקרב נמשך {(m.result.ticks / 30).toFixed(1)} שניות ·{" "}
                  {m.result.events.filter((e) => e.type === "death").length} מפלצות נפלו
                </p>
              </>
            )}
            <div className="result__buttons">
              <button className="btn-fight" onClick={m.playAgain}>
                🔄 משחק חדש
              </button>
              <button className="btn-fight btn-ghost" onClick={m.reset}>
                ☰ תפריט
              </button>
              {m.result && (
                <button className="btn-fight btn-online" onClick={() => setShowLog((v) => !v)}>
                  {showLog ? "מספיק, הבנתי" : "📋 שאסביר לך מה קרה?"}
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
            <h2>{exitTitle}</h2>
            <p className="modal__role">{exitBody}</p>
            <div className="modal__actions">
              <button
                className="btn-fight btn-danger"
                onClick={() => {
                  setConfirmExit(false);
                  m.reset();
                }}
              >
                {exitConfirm}
              </button>
              <button className="btn-fight btn-online" onClick={() => setConfirmExit(false)}>
                {exitCancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {albumOpen && (
        <Album
          account={m.account}
          onClose={() => setAlbumOpen(false)}
          onCardInfo={(id) => setDetail(id)}
        />
      )}

      {detail && <CardDetailModal cardId={detail} onClose={() => setDetail(null)} />}
      {actionDetail &&
        (() => {
          const inBar = m.actionBar.find((a) => a.id === actionDetail);
          const playable = inBar && !inBar.passive && !inBar.used;
          return (
            <ActionDetailModal
              actionId={actionDetail}
              onClose={() => setActionDetail(null)}
              state={inBar ? (inBar.used ? "used" : inBar.passive ? "passive" : null) : undefined}
              onActivate={
                playable
                  ? () => {
                      setActionDetail(null);
                      m.activateAction(actionDetail);
                    }
                  : undefined
              }
            />
          );
        })()}
    </div>
  );
}
