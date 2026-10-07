import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./components/Icon";
import { Album } from "./components/Album";
import { Tutorial, type Step } from "./components/Tutorial";
import { nextCue } from "./game/coach";
import { LESSONS } from "./game/lessons";
import { Profile } from "./components/Profile";
import { Onboarding } from "./components/Onboarding";
import { ChestReveal } from "./components/ChestReveal";
import { loadInbox, loadShop, markChestSeen, type Chest, type ShopItem } from "./game/account";
import { markTutorialDone, tutorialSeenLocally } from "./game/account";
import { COOP_LANES, PHASES, arenaFor } from "@amanda/shared";
import type { BattleResult } from "@amanda/engine";
import { useMatch } from "./game/useMatch";
import { useDrag } from "./game/useDrag";
import { sfx } from "./game/sfx";
import { music } from "./game/music";
import { hardRefresh } from "./game/refresh";
import { ACTIONS, cardPool, isEnemyTargeted, synergyGroups } from "./data/catalog";
import * as V from "./data/voice";
import { BoardGrid } from "./components/BoardGrid";
import { CardView } from "./components/CardView";
import { CardDetailModal } from "./components/CardDetailModal";
import { ActionCardView } from "./components/ActionCardView";
import { ActionDetailModal } from "./components/ActionDetailModal";
/*
 * The arena, and PixiJS with it, fetched only when there is a battle.
 *
 * It was in the main bundle, so every child downloaded a WebGL renderer
 * before the home screen could draw — a quarter of a megabyte for a screen
 * with four buttons on it. Nothing needs it until a battle starts, and a
 * battle is at least ninety seconds of building away.
 *
 * Prefetched the moment that building begins (see below), so the chunk is on
 * the device long before it is wanted and the lazy boundary never shows.
 */
const Arena = lazy(() => import("./components/Arena").then((m) => ({ default: m.Arena })));
const prefetchArena = () => void import("./components/Arena");
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CardPicker } from "./components/CardPicker";
import { ArenaTrack } from "./components/ArenaTrack";
import { ChestShelf } from "./components/ChestShelf";
import { About } from "./components/About";
import { Report } from "./components/Report";
import { Friends } from "./components/Friends";
import { Shop } from "./components/Shop";
import { Lock, WhySignIn } from "./components/SignedInOnly";
import { Inbox } from "./components/Inbox";
import { SayButton, SaidBubble } from "./components/Say";
const Admin = lazy(() => import("./components/Admin").then((m) => ({ default: m.Admin })));
/*
 * The two review workbenches, behind `?gallery` and `?arena`.
 *
 * Lazy for the same reason as the panel — nobody playing the game opens them
 * — and, in the arena workbench's case, for a second one: it imports the
 * Arena statically, so while IT was in the main bundle the Arena's own lazy
 * import did nothing at all. Vite said so and it was right.
 */
const CardGallery = lazy(() =>
  import("./components/CardGallery").then((m) => ({ default: m.CardGallery })),
);
const ArenaPreview = lazy(() =>
  import("./components/ArenaPreview").then((m) => ({ default: m.ArenaPreview })),
);
import { MoreModes } from "./components/MoreModes";
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

/**
 * A board's header in the playground: which half you are editing, and a way
 * to empty it. Both boards are yours there, so the label has to be a control
 * rather than a caption.
 */
function LabSideLabel({
  name,
  on,
  onPick,
  onClear,
}: {
  name: string;
  on: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <span className="lab-side">
      <button className={`lab-side__pick${on ? " lab-side__pick--on" : ""}`} onClick={onPick}>
        {on ? "✎ " : ""}
        {name}
      </button>
      <button className="lab-side__clear" onClick={onClear} title={`לרוקן את ${name}`}>
        נקה
      </button>
    </span>
  );
}

/** Vite serves the app under /amanda/ on Pages and / in dev. */
const BASE = import.meta.env.BASE_URL;

/** Drifting embers on the home screen. Fixed, so they never bunch up. */
const MOTES = [
  { x: 6, dur: 17, delay: 0, o: 0.5 },
  { x: 14, dur: 22, delay: 3.5, o: 0.35 },
  { x: 23, dur: 19, delay: 7, o: 0.45 },
  { x: 34, dur: 25, delay: 1.5, o: 0.3 },
  { x: 46, dur: 20, delay: 9, o: 0.4 },
  { x: 58, dur: 24, delay: 5, o: 0.3 },
  { x: 69, dur: 18, delay: 12, o: 0.45 },
  { x: 81, dur: 23, delay: 2.5, o: 0.35 },
  { x: 92, dur: 21, delay: 8, o: 0.4 },
];

/**
 * One line out of each set, chosen when the screen appears and held still
 * while it is on screen. Re-rolling on every render would change the words
 * under the player's eyes mid-sentence.
 */
function useLine(lines: readonly V.Line[]): string {
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

/**
 * Developer entrances to Amanda mode, so it can be looked at without waiting
 * for it to come round in normal play.
 *
 *   ?amanda        queue for it immediately — open on two devices and they pair
 *   ?amanda=solo   play it alone, no server and no partner (and unwinnable)
 */
const AMANDA_DEV = new URLSearchParams(location.search).get("amanda");

/**
 * Open a chest without winning one.
 *
 *   ?chest=gold    (or silver, or wood)
 *
 * The reveal only ever appears after a win that earned one, which makes the
 * most elaborate screen in the game also the hardest to look at. Same spirit
 * as ?amanda=solo: a door for whoever is working on it.
 */
const CHEST_DEV = new URLSearchParams(location.search).get("chest");

const REVIEW = new URLSearchParams(location.search).has("gallery")
  ? "gallery"
  : new URLSearchParams(location.search).has("arena")
    ? "arena"
    : new URLSearchParams(location.search).has("admin")
      ? "admin"
      : null;

export default function App() {
  if (REVIEW === "gallery" || REVIEW === "arena")
    return (
      <Suspense fallback={<div className="admin admin--msg">רגע…</div>}>
        {REVIEW === "gallery" ? <CardGallery /> : <ArenaPreview />}
      </Suspense>
    );
  // Loaded only when asked for: the panel pulls in the whole copy map and the
  // Supabase client, and nobody playing the game needs either.
  if (REVIEW === "admin")
    return (
      <Suspense fallback={<div className="admin admin--msg">רגע…</div>}>
        <Admin />
      </Suspense>
    );
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
  const [profileOpen, setProfileOpen] = useState(false);
  /** "Bring a friend" opens three ways to do it rather than guessing one. */
  const [friendOpen, setFriendOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  /** Set when a guest reaches for something that needs an account. */
  const [whyOpen, setWhyOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState<"bug" | "player" | null>(null);
  /** Turned off for the session the moment the clip fails to load. */
  const [idleOk, setIdleOk] = useState(true);
  /*
   * A chest is already open and already in the album by the time the result
   * screen appears — the server did both when it decided the match. So this
   * just looks for one that has not been SHOWN, which is why it can appear a
   * moment late without anything being wrong.
   */
  const [chest, setChest] = useState<Chest | null>(() =>
    CHEST_DEV
      ? {
          id: "dev",
          kind: CHEST_DEV,
          // A handful of real cards, so the reveal shows what it really shows.
          cards: cardPool().slice(0, 5),
          diamonds: 25,
          earnedAt: new Date().toISOString(),
        }
      : null,
  );
  /*
   * The reveal no longer ambushes you at the end of a match.
   *
   * It used to look for a chest the moment you won and play the whole opening
   * over the result screen — which was the only way to show one, because
   * winning a chest also opened it. Now a chest waits on the home screen until
   * you tap it, which is the point of having one.
   */
  /*
   * Shown once, when an account exists and has never been set up. Guests have
   * no account to save it to, so they are not asked — they are asked the
   * moment they make one.
   */
  const [onboarding, setOnboarding] = useState(false);
  /*
   * Tell the copy who it is talking to, as soon as the account says.
   *
   * Set globally rather than threaded through every component, because the
   * lines that need it are picked inside voice.ts and nothing in between has
   * any business knowing.
   */
  useEffect(() => {
    V.setGender(m.account?.gender ?? null);
  }, [m.account?.gender]);

  const askedRef = useRef(false);
  useEffect(() => {
    if (askedRef.current || !m.account) return;
    if (m.account.nickname) return;
    askedRef.current = true;
    setOnboarding(true);
  }, [m.account]);
  /*
   * Taught once, the first time a board is built. The account is the record
   * when there is one; localStorage covers guests, who would otherwise be
   * taught the game on every visit.
   */
  const [teaching, setTeaching] = useState(false);
  const taughtRef = useRef(false);
  /*
   * The tutorial starts its OWN match now, rather than attaching itself to
   * whatever the player happened to press.
   *
   * Or: "there is no need for a bot. It's a fixed tutorial. Decide in advance
   * what the opponent does." Riding on a normal game meant a child's first
   * ever match was against an opponent built to win, while Amanda talked them
   * through it — so the lesson and the match disagreed about what was
   * happening.
   */
  useEffect(() => {
    if (taughtRef.current || m.playground) return;
    // Wait until we know whether they have been taught: the account arrives a
    // moment late, and starting a lesson for someone who finished it months
    // ago is worse than starting it a second late.
    if (m.account === null && !tutorialSeenLocally()) {
      if (m.phase !== "intro") return;
    }
    const seen = m.account ? m.account.tutorialDone : tutorialSeenLocally();
    if (seen) return;
    if (m.phase !== "intro") return;
    taughtRef.current = true;
    setTeaching(true);
    m.startLesson(1);
  }, [m.phase, m.account, m.playground, m]);

  /*
   * Finishing a lesson moves to the next one, and finishing the last one ends
   * the teaching for good. Before this the tutorial simply stopped talking and
   * left the player in a match, which is not an ending.
   */
  const [lessonDone, setLessonDone] = useState(false);
  const lessonSeenRef = useRef(0);
  useEffect(() => {
    if (!teaching || m.lesson === 0) return;
    if (m.phase !== "result") return;
    if (lessonSeenRef.current === m.lesson) return;
    lessonSeenRef.current = m.lesson;
    setLessonDone(true);
  }, [teaching, m.lesson, m.phase]);

  /*
   * She comments on the card you actually drew, not on a script. Each line is
   * said at most once per match, and the set resets when a new match starts so
   * the second example match can teach the things the first did not reach.
   */
  const saidRef = useRef<Set<string>>(new Set());
  const [cue, setCue] = useState<Step | null>(null);
  /**
   * The cells on your board that a series bonus is lighting up right now.
   *
   * Three of a family touching each other (Or, 2026-10-06). Flattened to one
   * set because the board only needs to know whether a cell is lit, not which
   * family lit it — the frames are already tinted by series.
   */
  const mySynergy = useMemo(() => {
    const lit = new Set<string>();
    for (const cells of synergyGroups(m.placements, m.king).values())
      for (const cell of cells) lit.add(cell);
    return lit;
  }, [m.placements, m.king]);

  /*
   * The floor the two albums are lying on: the arena you have climbed to.
   *
   * Set as a CSS variable rather than passed down, because the element that
   * needs it is .boards and nothing between here and there cares.
   */
  const arena = arenaFor(m.account?.trophies ?? 0);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--arena-floor",
      `url("${BASE}arena/${arena.id}.webp")`,
    );
  }, [arena.id]);

  /** The opponent's board, cut down to what is actually showing right now. */
  const revealedOpponent = useMemo(() => {
    const placements: Record<string, string> = {};
    for (const [key, id] of Object.entries(m.opponent.placements)) {
      const [x, y] = key.split("-").map(Number);
      if (x !== undefined && y !== undefined && m.revealOpponentCell(x, y)) placements[key] = id;
    }
    return { placements, king: m.revealOpponentKing ? m.opponent.king : null };
  }, [m.opponent, m.revealOpponentCell, m.revealOpponentKing]);
  /*
   * Which lesson this is. Or asked for "a match or two" against a light bot,
   * and for the second one to be about the opponent rather than the buttons:
   * which card of theirs you answer with which card of yours. The coach needs
   * to know which match it is to know which of the two it is giving.
   */
  const [lesson, setLesson] = useState(1);
  useEffect(() => {
    if (!teaching || m.phase !== "countdown") return;
    setLesson((n) => n + 1);
    saidRef.current = new Set();
  }, [teaching, m.phase]);
  useEffect(() => {
    if (!teaching) return;
    const next = nextCue(
      {
        phase: m.phase,
        hand: m.hand,
        handIsAction: m.handIsAction,
        placements: m.placements,
        king: m.king,
        discardCount: m.discardCount,
        actionBarCount: m.actionBar.length,
        matchNo: lesson,
        /*
         * What she is allowed to point at: the revealed cells only.
         *
         * Not `m.opponent` straight through. Against the computer that object
         * holds the opponent's WHOLE board from the first second and the fog
         * is applied when it is drawn — so handing it over unfiltered would
         * have had her talking about cards the player is looking at the back
         * of. Same filter the board itself uses, so what she sees is exactly
         * what the player sees.
         */
        opponent: revealedOpponent,
      },
      saidRef.current,
    );
    if (!next) return;
    saidRef.current.add(next.id);
    setCue({
      target: next.target ?? ".side--me .board",
      text: next.text,
      // `awaits` is turned into a live boolean BELOW, on every render — not
      // captured here. A gate frozen at the moment the step appeared would
      // answer "has a King been placed?" with whatever was true back then,
      // forever, which is a bug this file has had once already.
      awaits: next.awaits,
    });
  }, [
    teaching,
    m.phase,
    m.hand,
    m.handIsAction,
    m.placements,
    m.king,
    m.discardCount,
    m.actionBar.length,
    revealedOpponent,
    lesson,
  ]);
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
  const searching = useLine(V.SEARCHING);

  // Drag a card from the hand onto a board slot (mouse + touch).
  const { drag, start: startDrag, dragging } = useDrag((_cardId, target) => {
    if (target === "king") m.placeKing();
    else {
      const [x, y] = target.split("-").map(Number);
      if (x !== undefined && y !== undefined) m.placeAt(x, y);
    }
  });

  // The developer entrances above, taken once on load.
  const devRef = useRef(false);
  useEffect(() => {
    if (devRef.current || AMANDA_DEV === null) return;
    devRef.current = true;
    if (AMANDA_DEV === "solo") m.startAmandaSolo();
    else if (m.onlineAvailable) m.startAmanda();
  }, [m]);

  // An invite link (?join=XXXX) joins that room on its own, so the person you
  // sent it to only has to open it.
  const invitedRef = useRef(false);
  useEffect(() => {
    if (invitedRef.current || !INVITE_CODE || !m.onlineAvailable) return;
    invitedRef.current = true;
    m.joinRoom(INVITE_CODE);
  }, [m]);

  /*
   * Fetch the arena while the player is building.
   *
   * The chunk carries PixiJS, which is the single biggest thing this game
   * downloads — and there is a minute and a half of board-building before
   * anybody needs it. Asking for it here means the lazy boundary above
   * effectively never renders.
   */
  useEffect(() => {
    if (m.phase === "build" || m.phase === "panic") prefetchArena();
  }, [m.phase]);

  /*
   * How many unread notices there are.
   *
   * Asked on the home screen only, and only with an account. A gift that
   * arrived while the game was closed should be visible on opening it, and a
   * gift that goes out on a schedule should turn up within the minute — but
   * polling while somebody is in the middle of a match is a request made for
   * nothing, because the bell is not drawn there.
   */
  useEffect(() => {
    if (!m.account || m.phase !== "intro") return;
    let alive = true;
    const ask = async () => {
      const { unread: n } = await loadInbox();
      if (alive) setUnread(n);
    };
    void ask();
    const t = window.setInterval(() => void ask(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [m.account, m.phase]);

  /*
   * What the rail advertises: the newest thing on the shelves.
   *
   * Read from the shop itself so a holiday sale is a row with dates on it
   * rather than a banner somebody has to remember to take down. Asked once,
   * on the home screen, and never during a match.
   */
  const [promo, setPromo] = useState<ShopItem | null>(null);
  useEffect(() => {
    if (m.phase !== "intro") return;
    void loadShop().then(({ items }) => {
      // Highest `sort` wins: it is the field Or already uses to put something
      // at the front of a shelf, so "featured" needs no second concept.
      const best = [...items].sort((a, b) => b.sort - a.sort)[0];
      setPromo(best ?? null);
    });
  }, [m.phase]);

  /*
   * Everything a guest may not do.
   *
   * Or: "an anonymous user can only play a one-off against a bot." Everybody
   * HAS an account — the game makes an anonymous one on first visit so a match
   * has somewhere to go — but that one is thrown away when the browser is
   * cleared, so it cannot be the thing that owns an album. `linked` is true
   * once a Google account or an email is attached, and that is the line.
   *
   * Locked, not hidden: see SignedInOnly.tsx.
   */
  const signedIn = m.account?.linked === true;
  /** Open the thing, or explain why not. One call at every locked door. */
  const gated = (open: () => void) => () => {
    if (signedIn) open();
    else {
      sfx.play("beep");
      setWhyOpen(true);
    }
  };

  // One continuous score, started on the first screen that wants it and never
  // interrupted again (see music.ts). The phase is still named, for later.
  useEffect(() => {
    if (m.phase === "intro" || m.phase === "countdown" || m.phase === "waiting")
      music.play("menu");
    else if (m.phase === "build") music.play("build");
    else if (m.phase === "panic") music.play("panic");
    else if (m.phase === "battle") music.play("battle");
    else if (m.phase === "result")
      // The score keeps playing through the result — see music.ts. The name
      // still says which ending it is, for whatever wants to know later.
      music.play(m.result?.winner === "A" ? "win" : "lose");
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

  /*
   * The phase announces itself across the middle of the screen and goes away,
   * the way a game does it — rather than sitting in the corner as a status
   * line nobody reads twice.
   */
  const [phaseCard, setPhaseCard] = useState<string | null>(null);
  useEffect(() => {
    if (m.playground || !["build", "panic", "battle"].includes(m.phase)) return;
    // The battle announcement is a moment, so it gets the variants treatment
    // the other moments have; build and panic keep their one name.
    setPhaseCard(m.phase === "battle" ? V.pick(V.BATTLE_PHASE) : (PHASE_LABEL[m.phase] ?? null));
    const t = window.setTimeout(() => setPhaseCard(null), 1700);
    return () => window.clearTimeout(t);
  }, [m.phase, m.playground]);

  return (
    <div className="app">
      {/* Two 4x4 boards of portrait cards only fit side by side in landscape,
          so on a phone held upright we ask for a turn instead of squashing. */}
      <div className="rotate-hint">
        <div className="rotate-hint__icon"><Icon name="phone" size={56} /></div>
        <h2>סובב את המכשיר</h2>
        <p>אני משוחקת לרוחב, ילד. ככה אני רואה את שניכם.</p>
      </div>
      {phaseCard && (
        <div className="phase-card" role="status" key={phaseCard}>
          <span>{phaseCard}</span>
        </div>
      )}
      <header className={`topbar${m.phase === "intro" ? " topbar--ghost" : ""}`}>
        {/* No name across the top while playing. It is a game, not an app —
            the title belongs on the home screen and nowhere else. */}
        {/* While waiting there is no match yet, so this is the only thing to
            say and it stays put. Once a match is running the phase announces
            itself across the screen and leaves (see .phase-card below). */}
        {m.phase === "waiting" && (
          <div className={`topbar__phase phase--${m.phase}`}>
            {m.roomCode ? "מחכה לחבר שלך…" : PHASE_LABEL[m.phase]}
          </div>
        )}
        {(m.phase === "build" || m.phase === "panic") && !m.playground && (
          <div className="topbar__timer">
            <Icon name="timer" size={15} /> {Math.ceil(m.timeLeft)}s
          </div>
        )}
        {/* Which match this is, when it is not the ordinary one. Without it a
            mirror match is indistinguishable from any other, and the one
            thing that makes it interesting is invisible. */}
        {m.mirrorSeed !== null && showBoards && (
          <div className="topbar__mode">
            <Icon name="deck" size={14} /> חפיסה זהה
          </div>
        )}
        <div className="topbar__right">
          {/*
           * The bell, only on the home screen and only with an account.
           *
           * Mid-match it would be a second thing asking to be looked at while
           * a clock is running, and there is nothing here that cannot wait
           * ninety seconds.
           */}
          {m.account && m.phase === "intro" && (
            <button
              className={`mute bell${unread ? " bell--new" : ""}`}
              title="הודעות"
              onClick={() => setInboxOpen(true)}
            >
              <Icon name="report" size={18} />
              {unread > 0 && <span className="bell__count">{unread > 9 ? "9+" : unread}</span>}
            </button>
          )}
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
              <Icon name="exit" size={14} /> יציאה
            </button>
          )}
          <button
            className={`mute${musicOn ? "" : " mute--off"}`}
            title={musicOn ? "כיבוי מוזיקה" : "הפעלת מוזיקה"}
            onClick={() => setMusicOn(music.toggleEnabled())}
          >
            <Icon name={musicOn ? "musicOn" : "musicOff"} size={19} />
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
            <Icon name={muted ? "soundOff" : "soundOn"} size={19} />
          </button>
        </div>
      </header>

      {/* ---- intro / start screen ---- */}
      {m.phase === "intro" && (
        <main className="intro intro--hero">
          {/* Who you are sits in the corner, the way a game does it, rather
              than in a row of text links with the game modes. */}
          {/* What you have, where you can see it without opening anything. */}
          {m.account && (
            <div className="purse" aria-label="מה יש לך">
              <span className="purse__item">
                <Icon name="win" size={16} /> {m.account.trophies}
              </span>
              <span className="purse__item purse__item--gem">
                <Icon name="gem" size={16} /> {m.account.diamonds}
              </span>
              <span className="purse__item">
                <Icon name="monster" size={16} /> {m.account.album.size}
              </span>
            </div>
          )}
          <button className="me" onClick={() => setProfileOpen(true)}>
            {m.account?.avatar ? (
              <img src={`${BASE}brand/${m.account.avatar}.webp`} alt="" />
            ) : (
              <Icon name="king" size={20} />
            )}
            <span className="me__name">
              {m.account?.nickname ?? (m.account?.linked ? "הפרופיל שלי" : "התחברות")}
            </span>
          </button>
          {/*
            She is the background, not a picture inside a box. The banner was
            generated with its left half deliberately empty, which is where
            everything below sits.
          */}
          {/*
            The still is always there; the clip plays over it if it loads.
            A hero that needs a video to exist is a hero that is a black
            rectangle on a slow connection, so the picture never depends on it.
            `onError` drops the video for good rather than retrying forever.
          */}
          <div
            className="intro__art"
            style={{ backgroundImage: `url("${BASE}brand/amanda_banner.webp")` }}
            aria-hidden="true"
          >
            {idleOk && (
              <video
                className="intro__idle"
                src={`${BASE}brand/amanda_idle.webm`}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onError={() => setIdleOk(false)}
              />
            )}
          </div>
          {/* The room she is standing in, behind the menu side only. */}
          <div className="intro__room" aria-hidden="true" />
          <div className="intro__wash" aria-hidden="true" />
          {/* Embers drifting up past her. Spread by hand rather than randomly
              so they never clump, and purely decorative. */}
          <div className="intro__motes" aria-hidden="true">
            {MOTES.map((mote, n) => (
              <i
                key={n}
                style={{
                  insetInlineStart: `${mote.x}%`,
                  animationDuration: `${mote.dur}s`,
                  animationDelay: `${mote.delay}s`,
                  opacity: mote.o,
                }}
              />
            ))}
          </div>
          {/*
           * The other half of the screen.
           *
           * Or: "notice you have the whole left side of the screen empty —
           * it is asking for the shop, friends, some promotional banner."
           * He is right: it was Amanda's portrait and nothing else, on the
           * widest part of the screen.
           *
           * It is a RAIL rather than more menu: these are places you visit
           * between matches, not ways to start one, and putting them in the
           * main column would have pushed the two "play" cards down.
           */}
          <aside className="rail">
            <button className="rail__item" onClick={gated(() => setShopOpen(true))}>
              <Icon name="gem" size={19} />
              <span>חנות נוחות</span>
              {!signedIn && <Lock />}
            </button>
            <button className="rail__item" onClick={gated(() => setFriendsOpen(true))}>
              <Icon name="friend" size={19} />
              <span>חברים</span>
              {!signedIn && <Lock />}
            </button>
            {/*
             * The promotion slot.
             *
             * Deliberately driven by the shop's own window rather than a
             * hard-coded message: an item with `available_until` set IS the
             * holiday sale, so the banner appears and disappears on its own
             * and Or never has to remember to take it down. Nothing to show
             * means nothing is drawn.
             */}
            {promo && (
              <button className="rail__promo" onClick={gated(() => setShopOpen(true))}>
                <span className="rail__promo-tag">חדש בחנות</span>
                <b>{promo.name.he}</b>
                {promo.blurb?.he && <small>{promo.blurb.he}</small>}
                <span className="rail__promo-price">
                  <Icon name="gem" size={12} /> {promo.price_diamonds}
                </span>
              </button>
            )}
          </aside>
          <div className="intro__card">
            {/*
              Drawn, not typeset. A webfont can fail to load — and did, on Or's
              screen, where the name fell back to a plain system face. The
              letterforms are baked into an image so the name always looks like
              the name. Rendered FROM the real font rather than generated, so
              the Hebrew is correct by construction instead of by luck.
            */}
            <h1 className="intro__name">
              <img src={`${BASE}brand/wordmark.png`} alt="אמנדה" width={720} height={197} />
            </h1>
            <p className="intro__sub">משחק קלפים מפלצתי</p>
            <div className="intro__main">
            <div className="intro__choices">
            {/*
              The "you VS the opponent" portrait was describing a match that
              has not been chosen yet. The same two pictures do more work as
              the choice itself: one is who you would be fighting.
            */}
            {!friendOpen ? (
              <div className="pick">
                <button className="pick__card" onClick={m.startMatch}>
                  <img src={`${BASE}brand/versus_robot.webp`} alt="" />
                  <span>לשחק עם בוט</span>
                </button>
                <button
                  className="pick__card"
                  onClick={gated(() => setFriendOpen(true))}
                  disabled={!m.onlineAvailable}
                  title={m.onlineAvailable ? "" : "לא בגרסה הזאת"}
                >
                  <img src={`${BASE}brand/versus_player.webp`} alt="" />
                  <span>לשחק עם חברים</span>
                  {!signedIn && <Lock />}
                </button>
              </div>
            ) : (
              <div className="pick pick--ways">
                <button className="btn-fight btn-online" onClick={() => m.hostRoom()}>
                  לפתוח חדר
                </button>
                <button className="btn-fight btn-online" onClick={() => setJoining(true)}>
                  יש לי קוד
                </button>
                <button className="btn-fight btn-online" onClick={() => m.startOnline()}>
                  מישהו אקראי
                </button>
                {/* The event, not the everyday opponent. It takes two people
                    on purpose: one board cannot beat her. */}
                <button className="btn-fight btn-amanda" onClick={() => m.startAmanda()}>
                  נגד אמנדה — שניים נגדה
                </button>
                <button className="btn-link" onClick={() => setFriendOpen(false)}>
                  ← חזרה
                </button>
              </div>
            )}
            {/*
              Where you are on the ladder, and what is above you.
              Drawn for a guest too, and shut — a ladder you cannot see the
              top of is not a ladder, and one you cannot see at all persuades
              nobody to sign in.
            */}
            <button
              className={`track-gate${signedIn ? "" : " is-locked"}`}
              onClick={signedIn ? undefined : gated(() => {})}
              disabled={signedIn}
            >
              <ArenaTrack trophies={m.account?.trophies ?? 0} />
              {!signedIn && <Lock />}
            </button>
            {/* And what is waiting to be opened. */}
            {signedIn && (
              <ChestShelf
                onOpened={setChest}
                reload={() => m.reloadAccount()}
              />
            )}
            <button className="btn-album" onClick={gated(() => setAlbumOpen(true))}>
              <Icon name="deck" size={20} /> האלבום שלי
              {!signedIn && <Lock />}
            </button>
            {/* The side doors. Deliberately smaller than the two ways to
                actually play — they sit beside the game, not in front of it.
                The playground is the one thing here a guest may have: it saves
                nothing, so there is nothing to lose. */}
            <div className="extras">
              <button className="btn-modes" onClick={() => setModesOpen(true)}>
                <Icon name="monster" size={18} /> עוד מודים
              </button>
              <button className="btn-lab" onClick={m.startPlayground} title="בלי שעון, שני הצדדים שלך">
                <Icon name="stacked" size={15} /> מגרש המשחקים
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
            {/* Told, and told until when. */}
            {m.suspendedUntil && (
              <p className="warn warn--suspended">
                החשבון הזה מושעה עד{" "}
                {new Date(m.suspendedUntil).toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                . אפשר לשחק נגד המחשב בינתיים.
              </p>
            )}
            {m.roomError && (
              <p className="warn">
                {m.roomError === "notFound"
                  ? "אין חדר כזה. אולי המצאת אותו."
                  : m.roomError === "self"
                    ? "זה הקוד שלך. אתה לא יכול לאכול את עצמך."
                    : "החדר מלא. שניים מספיקים לי."}
              </p>
            )}
            {/*
              About, and the legal pages. Required to be reachable WITHOUT an
              account and without installing anything — a store will check.
            */}
            <button className="btn-link about__open" onClick={() => setAboutOpen(true)}>
              אודות · פרטיות · נגישות
            </button>
            {/* The server refuses a report from an anonymous account anyway
                (apps/server/src/reports.ts) — so without this a guest pressed
                it, typed, and was told no at the end. */}
            <button className="btn-link about__open" onClick={gated(() => setReportOpen("bug"))}>
              משהו לא עובד?
            </button>
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
          {/*
           * The other half of the screen.
           *
           * Or: "notice you have the whole left side of the screen empty —
           * it is asking for the shop, friends, some promotional banner."
           * He is right: it was Amanda's portrait and nothing else, on the
           * widest part of the screen.
           *
           * It is a RAIL rather than more menu: these are places you visit
           * between matches, not ways to start one, and putting them in the
           * main column would have pushed the two "play" cards down.
           */}
          <aside className="rail">
            <button className="rail__item" onClick={gated(() => setShopOpen(true))}>
              <Icon name="gem" size={19} />
              <span>חנות נוחות</span>
              {!signedIn && <Lock />}
            </button>
            <button className="rail__item" onClick={gated(() => setFriendsOpen(true))}>
              <Icon name="friend" size={19} />
              <span>חברים</span>
              {!signedIn && <Lock />}
            </button>
            {/*
             * The promotion slot.
             *
             * Deliberately driven by the shop's own window rather than a
             * hard-coded message: an item with `available_until` set IS the
             * holiday sale, so the banner appears and disappears on its own
             * and Or never has to remember to take it down. Nothing to show
             * means nothing is drawn.
             */}
            {promo && (
              <button className="rail__promo" onClick={gated(() => setShopOpen(true))}>
                <span className="rail__promo-tag">חדש בחנות</span>
                <b>{promo.name.he}</b>
                {promo.blurb?.he && <small>{promo.blurb.he}</small>}
                <span className="rail__promo-price">
                  <Icon name="gem" size={12} /> {promo.price_diamonds}
                </span>
              </button>
            )}
          </aside>
          <div className="intro__card">
            <div className="overlay__count" style={{ fontSize: 60 }}>
              <Icon name={m.netError ? "unplugged" : m.roomCode ? "friend" : "online"} size={60} />
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
                  <Icon name="robot" size={18} /> נגד המחשב
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
          }${actionsOpen ? " build--drawer" : ""}${m.playground ? " build--lab" : ""}`}
        >
          <div className="boards">
            <section
              className={`side side--me${m.frozenFor > 0 ? " side--frozen" : ""}${
                m.playground && m.editSide === "me" ? " side--editing" : ""
              }${m.coop ? " side--split" : ""}${
                // Lane 4 means your half is the BOTTOM one. Draw it there, or
                // the screen and the battle disagree about who stands where.
                m.coop && m.myLane > 0 ? " side--low" : ""
              }`}
            >
              <div className="side__label">
                {m.playground ? (
                  <LabSideLabel
                    name="הצד שלך"
                    on={m.editSide === "me"}
                    onPick={() => m.setEditSide("me")}
                    onClear={() => m.clearSide("me")}
                  />
                ) : (
                  <>
                    {m.coop ? "החצי שלך" : "אתה"} <span className="side__way">⟵</span>
                  </>
                )}
              </div>
              {m.frozenFor > 0 && (
                <div className="frozen" role="status">
                  <span className="frozen__icon"><Icon name="frozen" size={26} /></span>
                  <strong>הידיים שלך קפואות</strong>
                  <span className="frozen__count">{m.frozenFor.toFixed(1)}</span>
                  <span className="frozen__note">לשלוף ולזרוק אפשר. להדביק — לא.</span>
                </div>
              )}
              {/* What you just said, over your own board, so you can see it
                  went out. The other player's sits over theirs. */}
              <SaidBubble said={m.spoke} mine />
              {m.coop && (
                <div className="mate__label mate__label--mine">
                  <Icon name="king" size={13} /> החצי שלך
                </div>
              )}
              <BoardGrid
                placements={m.placements}
                king={m.king}
                side="left"
                // In the lab the board you are not editing is still a picture.
                interactive={interactive && (!m.playground || m.editSide === "me")}
                editing={m.playground && m.editSide === "me"}
                synergy={mySynergy}
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
              {m.coop && (
                /*
                 * Your partner's half.
                 *
                 * Or, after playing Amanda mode with Hod: "first of all it
                 * sucks that each one only sees his own side." He was right,
                 * and it was worse than that — the panel labelled "Amanda"
                 * was showing the partner's cards through fog, so the one
                 * person you were allowed to see was the one person you
                 * weren't supposed to. This is the ally, unfogged, drawn
                 * under or over you depending on which half the server gave
                 * you, because that is the order the battle will use.
                 */
                <div className="mate mate--theirs">
                  <div className="mate__label">
                    <Icon name="friend" size={13} /> החצי של מי שאיתך
                  </div>
                  <BoardGrid
                    placements={m.mate?.placements ?? {}}
                    king={m.mate?.king ?? null}
                    side="left"
                    compact
                    onCardInfo={openInfo}
                  />
                </div>
              )}
            </section>

            <div className="midline">
              <Icon name="power" size={22} />
            </div>

            <section
              className={`side side--enemy${
                m.playground && m.editSide === "enemy" ? " side--editing" : ""
              }${m.coop ? " side--split" : ""}`}
            >
              <div className="side__label">
                {m.playground ? (
                  <LabSideLabel
                    name="הצד שמולך"
                    on={m.editSide === "enemy"}
                    onPick={() => m.setEditSide("enemy")}
                    onClear={() => m.clearSide("enemy")}
                  />
                ) : (
                  <>
                    <span className="side__way">⟶</span> {m.coop ? "אמנדה" : "היריב"}{" "}
                    {m.phase !== "build" && <span className="side__revealed">נחשף!</span>}
                  </>
                )}
              </div>
              <SaidBubble said={m.heard} />
              <BoardGrid
                placements={m.opponent.placements}
                king={m.opponent.king}
                // She faces two players, so her side is eight lanes deep and
                // her King sits across lanes 3 and 4 — the middle of the
                // eight, not the middle of four.
                lanes={m.coop ? COOP_LANES : undefined}
                kingLane={m.coop ? 3 : undefined}
                side="right"
                reveal={m.revealOpponentCell}
                revealKing={m.revealOpponentKing}
                onCardInfo={openInfo}
                targeting={m.targeting !== null && isEnemyTargeted(m.targeting)}
                interactive={
                  (m.playground && m.editSide === "enemy") ||
                  (m.targeting !== null && isEnemyTargeted(m.targeting))
                }
                handActive={m.playground && m.hand !== null}
                editing={m.playground && m.editSide === "enemy"}
                onTarget={m.applyTargetCell}
                onTargetKing={m.applyTargetKing}
                // The lab writes into whichever board is being edited, so the
                // same two calls serve both halves (see placeAt).
                onCellClick={m.playground ? (x, y) => m.placeAt(x, y) : undefined}
                onKingClick={m.playground ? m.placeKing : undefined}
              />
            </section>

            {/* Only against a person. Saying "nice move" to a bot, or to
                Amanda, is a button that does nothing. */}
            {m.online && !m.playground && (
              <SayButton onSay={m.say} hearing={m.hearing} onToggleHearing={m.toggleHearing} />
            )}
          </div>

          {m.targeting && (
            <div className="targeting-bar">
              <span className="targeting-bar__text">
                <Icon name="target" size={16} />{" "}
                {isEnemyTargeted(m.targeting)
                  ? "בחר קלף אצל היריב"
                  : m.firstPick
                    ? "ועכשיו את השני"
                    : "בחר קלף על הלוח שלך"}{" "}
                עבור "{ACTIONS.get(m.targeting)?.name.he}"
              </span>
              <button className="targeting-bar__cancel" onClick={m.cancelTargeting}>
                <Icon name="exit" size={13} /> ביטול
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
                        ? "פעיל ∞"
                        : a.used
                          ? "נוצל"
                          : !m.canPlayAction(a.id)
                            ? "מאוחר מדי"
                            : "הפעל"}
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

          {interactive && m.playground && (
            <aside className="lab">
              <div className="lab__hold">
              <div className="lab__held">
                {m.hand ? (
                  m.handIsAction ? (
                    <ActionCardView
                      actionId={m.hand}
                      size="large"
                      onClick={() => setActionDetail(m.hand!)}
                      onInfo={() => setActionDetail(m.hand!)}
                    />
                  ) : (
                    <CardView
                      cardId={m.hand}
                      size="large"
                      onClick={() => openInfo(m.hand!)}
                      onInfo={() => openInfo(m.hand!)}
                    />
                  )
                ) : (
                  <div className="lab__eraser" title="גע בקלף על הלוח כדי להוריד אותו">
                    <Icon name="erase" size={34} />
                  </div>
                )}
              </div>
              <div className="lab__buttons">
                {m.handIsAction && (
                  <button className="take-action" onClick={m.takeAction} disabled={m.barFull}>
                    {m.barFull ? (
                      "הבר מלא"
                    ) : (
                      <>
                        <Icon name="plus" size={14} /> קח לפעולה
                      </>
                    )}
                  </button>
                )}
                <button className="btn-fight" onClick={m.toBattle}>
                  <Icon name="play" size={15} /> הרץ קרב
                </button>
              </div>
              </div>
              <CardPicker
                picked={m.hand}
                onPick={m.pickCard}
                onInfo={(id) => (ACTIONS.has(id) ? setActionDetail(id) : openInfo(id))}
              />
            </aside>
          )}

          {interactive && !m.playground && (
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
                    {m.barFull ? (
                      "הבר מלא"
                    ) : (
                      <>
                        <Icon name="plus" size={14} /> קח לפעולה
                      </>
                    )}
                  </button>
                )}
                <button onClick={m.discardHand} disabled={m.hand === null}>
                  זרוק <Icon name="discard" size={15} />
                </button>
                <button onClick={m.takeDiscard} disabled={!m.discardTop}>
                  קח מהפח {m.discardTop && <Icon name="recycle" size={15} />}
                </button>
              </div>
              {m.stackSlots > 0 && (
                <p className="hand__hint hand__hint--stack">
                  <Icon name="build" size={14} /> אפשר להניח קלף על קלף שכבר הנחתם — נשארו{" "}
                  {m.stackSlots}
                </p>
              )}
              {m.stackCorners && (
                <p className="hand__hint hand__hint--stack">
                  <Icon name="build" size={14} /> ארבע הפינות פתוחות להנחה כפולה
                </p>
              )}
              {/* No sentence here any more — the empty crown on the board
                  says it, and said it first. */}
              <button
                className={`btn-fight${m.ready ? " btn-fight--ready" : ""}`}
                onClick={m.online ? m.toggleReady : m.toBattle}
              >
                {!m.online
                  ? "התחל קרב!"
                  : m.ready
                    ? "מוכן — לחץ לביטול"
                    : "אני מוכן"}
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
                  <div className="overlay__wait" aria-hidden="true">
                    <Icon name="timer" size={54} />
                  </div>
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
                <h1><Icon name="explode" size={64} /></h1>
                <p>שגיאה בהצגת הקרב</p>
                <button className="btn-fight" onClick={m.finishBattle}>
                  המשך לתוצאה
                </button>
              </div>
            }
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
                result={m.result}
                onFinish={m.finishBattle}
                flip={m.mySide === "B"}
                verdict={verdictText(m.result, m.iWon)}
                // Where you fight is where you have climbed to. A guest with
                // no account fights in the first one, which is right.
                backdrop={arena.id}
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
      )}

      {/* ---- result ---- */}
      {m.phase === "result" && (
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
                <button className="btn-fight btn-ghost" onClick={() => setReportOpen("player")}>
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

      {chest && (
        <ChestReveal
          chest={chest}
          onClose={() => {
            markChestSeen(chest.id);
            setChest(null);
            m.reloadAccount();
          }}
        />
      )}

      {onboarding && m.phase === "intro" && (
        <Onboarding
          initialNickname={m.account?.nickname}
          onDone={() => {
            setOnboarding(false);
            m.reloadAccount();
          }}
        />
      )}

      {/*
        The end of a lesson. Two of them, and then she lets you go — which is
        the ending the tutorial did not have: it used to run out of lines and
        leave you standing in a match.
      */}
      {lessonDone && (
        <div className="modal-overlay">
          <div className="modal modal--confirm lesson-end">
            <Icon name="win" size={72} />
            {m.lesson < LESSONS.length ? (
              <>
                <h2>יפה. עכשיו משהו קצת יותר מתוחכם.</h2>
                <p>במשחק הבא יש ליריב לוח אמיתי — ולך יש בדיוק מה שמנצח אותו.</p>
                <div className="result__buttons">
                  <button
                    className="btn-fight"
                    onClick={() => {
                      setLessonDone(false);
                      saidRef.current = new Set();
                      m.startLesson(m.lesson + 1);
                    }}
                  >
                    קדימה
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>זהו, אתה יודע לשחק.</h2>
                <p>עכשיו לך תאסוף קלפים. אני רעבה.</p>
                <div className="result__buttons">
                  <button
                    className="btn-fight"
                    onClick={() => {
                      setLessonDone(false);
                      setTeaching(false);
                      setCue(null);
                      void markTutorialDone();
                      m.reset();
                    }}
                  >
                    יאללה
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {teaching && cue && (
        <Tutorial
          steps={[
            {
              ...cue,
              // Recomputed here, every render, from the match as it is now.
              done:
                cue.awaits === "king"
                  ? m.hasKing
                  : cue.awaits === "placed"
                    ? Object.keys(m.placements).length > 0
                    : undefined,
            },
          ]}
          onDone={() => setCue(null)}
          onQuit={() => {
            setTeaching(false);
            setCue(null);
            void markTutorialDone();
          }}
        />
      )}

      {profileOpen && (
        <Profile
          account={m.account}
          onClose={() => setProfileOpen(false)}
          onChanged={() => m.reloadAccount()}
        />
      )}

      {aboutOpen && (
        <About onClose={() => setAboutOpen(false)} birthDate={m.account?.birthDate} />
      )}

      {reportOpen && (
        <Report initialKind={reportOpen} onClose={() => setReportOpen(null)} />
      )}

      {whyOpen && (
        <WhySignIn
          onClose={() => setWhyOpen(false)}
          onSignIn={() => {
            setWhyOpen(false);
            setProfileOpen(true);
          }}
        />
      )}

      {shopOpen && (
        <Shop
          onClose={() => setShopOpen(false)}
          diamonds={m.account?.diamonds ?? 0}
          onBought={() => m.reloadAccount()}
        />
      )}

      {inboxOpen && (
        <Inbox
          onClose={() => {
            setInboxOpen(false);
            setUnread(0);
          }}
          onAction={(a) => {
            if (a === "shop") setShopOpen(true);
            else if (a === "friends") setFriendsOpen(true);
            else if (a === "album") setAlbumOpen(true);
          }}
        />
      )}

      {friendsOpen && (
        <Friends
          onClose={() => setFriendsOpen(false)}
          onInvite={(id) => {
            setFriendsOpen(false);
            m.inviteFriend(id);
          }}
          // An invitation opens a room, so it can only be sent from the
          // home screen — not from inside a match that is already running.
          canInvite={m.phase === "intro"}
        />
      )}

      {/*
       * Somebody is calling you in. Shown over whatever is on screen,
       * because the room is open and waiting while this sits there.
       */}
      {m.invitation && (
        <div className="modal-overlay" onClick={m.declineInvitation}>
          <div className="modal modal--invite" onClick={(e) => e.stopPropagation()}>
            <Icon name="friend" size={44} />
            <h2>{m.invitation.nickname ?? "חבר"} מזמין אותך למשחק</h2>
            <div className="result__buttons">
              <button className="btn-fight" onClick={m.acceptInvitation}>
                <Icon name="play" size={16} /> קדימה
              </button>
              <button className="btn-fight btn-ghost" onClick={m.declineInvitation}>
                אולי אחר כך
              </button>
            </div>
          </div>
        </div>
      )}

      {modesOpen && (
        <MoreModes
          onClose={() => setModesOpen(false)}
          onAmandaSolo={m.startAmandaSolo}
          onMirror={m.startMirror}
        />
      )}

      {albumOpen && (
        <Album
          account={m.account}
          onClose={() => setAlbumOpen(false)}
          onCardInfo={(id) => setDetail(id)}
          onChanged={() => m.reloadAccount()}
        />
      )}

      {detail && (
        <CardDetailModal
          cardId={detail}
          onClose={() => setDetail(null)}
          owned={m.account?.album.get(detail) ?? null}
        />
      )}
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
