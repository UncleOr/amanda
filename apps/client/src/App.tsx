import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./components/Icon";
import { Album } from "./components/Album";
import { Tutorial, type Step } from "./components/Tutorial";
import { nextCue } from "./game/coach";
import { LESSONS } from "./game/lessons";
import { Profile } from "./components/Profile";
import { Onboarding } from "./components/Onboarding";
import { ChestReveal } from "./components/ChestReveal";
import { loadInbox, loadShop, markChestSeen, openChest, unopenedChests, type Chest, type ShopItem } from "./game/account";
import { track } from "./game/track";
import { markTutorialDone, tutorialSeenLocally } from "./game/account";
import { COOP_LANES, PHASES, arenaFor } from "@amanda/shared";
import type { BattleResult } from "@amanda/engine";
import { useMatch } from "./game/useMatch";
import { useOverlay } from "./game/useOverlay";
import { HomeScreen } from "./components/HomeScreen";
import { BattleScreen } from "./components/BattleScreen";
import { ResultScreen } from "./components/ResultScreen";
import { useDrag } from "./game/useDrag";
import { sfx } from "./game/sfx";
import { music } from "./game/music";
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
import { CardPicker } from "./components/CardPicker";
import { About } from "./components/About";
import { Updates } from "./components/Updates";
import { MatePeek } from "./components/MatePeek";
import { Challenges } from "./components/Challenges";
import { Versus } from "./components/Versus";
import { Report } from "./components/Report";
import { Friends } from "./components/Friends";
import { Shop } from "./components/Shop";
import { WhySignIn } from "./components/SignedInOnly";
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
import { Overlay } from "./components/Overlay";


/**
 * Why the match ended. A battle that runs the full 15 seconds with both Kings
 * standing is settled by a tiebreak chain — and a player who sees their King
 * and half their board alive deserves to be told which link decided it.
 */

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

/**
 * `?legal=privacy` — a URL that lands on the privacy policy.
 *
 * Google Play will not accept an app without a reachable policy URL, and the
 * policy lives inside the app. Rather than keeping a second copy on a static
 * page — which is a copy that will one day disagree with the first — the
 * panel takes a starting page and the URL names it.
 */
const LEGAL = (() => {
  const want = new URLSearchParams(location.search).get("legal");
  return want === "privacy" || want === "terms" || want === "a11y" || want === "about"
    ? want
    : null;
})();

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
  const [copied, setCopied] = useState(false);
  // On a phone the action cards are a drawer, so the board keeps its height.
  const [actionsOpen, setActionsOpen] = useState(false);
  /*
   * Which full-screen panel is open — one value, not nine booleans.
   * See useOverlay.ts for why that matters.
   */
  const panel = useOverlay();
  /*
   * Landing straight on the policy, for the URL Play Console is given. Once,
   * on the first render — after that it is an ordinary panel the player can
   * close, and re-opening it on every render would make it impossible to.
   */
  useEffect(() => {
    if (LEGAL) panel.show("about");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Set when a guest reaches for something that needs an account. */
  const [unread, setUnread] = useState(0);
  /** Turned off for the session the moment the clip fails to load. */
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
          // Two of them new, so the celebration can be looked at too — it
          // depends on an answer only the server can give (see grantChest),
          // which otherwise makes it unreachable from this door.
          fresh: cardPool().slice(0, 2),
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
  /**
   * Open the chest this match just won, from the result screen.
   *
   * Or: *"it would make sense that pressing 'a chest is waiting for you' takes
   * you straight to the chests."* The oldest unopened one, because a player
   * who already had one waiting and then won another should get the one that
   * has been waiting longer — the list comes back in that order.
   *
   * Opening is still the server's business (it marks `opened_at` and returns
   * the contents), so this is exactly what the shelf on the home screen does.
   * Nothing happens on a miss: if the chest is somehow gone, the home screen
   * is where it would have been.
   */
  const openNewestChest = useCallback(async () => {
    const waiting = await unopenedChests();
    const first = waiting[0];
    if (!first) return;
    const opened = await openChest(first.id);
    if (opened) setChest(opened);
  }, []);
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
  /*
   * Whether she has said hello yet.
   *
   * Or: *"and it needs a little introduction there."* The tutorial used to
   * open mid-sentence, pointing at a board, to a child who had not been told
   * what the board was. Three lines, his words, before any of it.
   */
  const [metAmanda, setMetAmanda] = useState(false);
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
    setMetAmanda(false);
    setTeaching(true);
    m.startLesson(1);
  }, [m.phase, m.account, m.playground, m]);

  /**
   * Teach it again, on purpose.
   *
   * Or: *"give me a small button somewhere in a menu that lets me get back
   * into the tutorial — for testing, and in case somebody suddenly decides
   * they want to learn even though they pressed skip at the start. Call it
   * 'how you play'."*
   *
   * Both halves matter and the second is the real one: skipping a tutorial
   * is a decision a seven-year-old makes in the first ten seconds, before
   * they know whether they needed it, and until now it was irreversible.
   *
   * `taughtRef` is set so the automatic trigger does not treat this as its
   * own doing, and the lesson counter is wound back so finishing lesson one
   * leads into two as it does the first time.
   */
  const replayTutorial = useCallback(() => {
    taughtRef.current = true;
    lessonSeenRef.current = 0;
    setLessonDone(false);
    setMetAmanda(false);
    setTeaching(true);
    m.startLesson(1);
  }, [m]);

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
  /*
   * And what this player already holds, which the emoji picker needs.
   *
   * It comes from the same call, on the home screen, and NOT during a match:
   * the picker opens mid-battle and must not be waiting on a fetch to know
   * what it may offer. Re-read whenever the account is, which is what the
   * shop does after a purchase.
   */
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  useEffect(() => {
    if (m.phase !== "intro") return;
    void loadShop().then(({ items, owned }) => {
      // Highest `sort` wins: it is the field Or already uses to put something
      // at the front of a shelf, so "featured" needs no second concept.
      const best = [...items].sort((a, b) => b.sort - a.sort)[0];
      setPromo(best ?? null);
      setOwnedItems(owned);
    });
  }, [m.phase, m.account]);

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
      panel.show("why");
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
              onClick={() => panel.show("inbox")}
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
        <HomeScreen
          m={m}
          panel={panel}
          gated={gated}
          signedIn={signedIn}
          promo={promo}
          onChest={setChest}
          onTutorial={replayTutorial}
          viewport={viewport}
        />
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
                /*
                 * On a phone it is a thumbnail you tap to open — Or, playing
                 * it with Hod: "two against Amanda on mobile, you can't see
                 * what is going on because it is so small." See MatePeek.
                 */
                <MatePeek
                  label="החצי של מי שאיתך"
                  placements={m.mate?.placements ?? {}}
                  king={m.mate?.king ?? null}
                  side="left"
                  onCardInfo={openInfo}
                />
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
                    {/*
                      Who it is, not just that it is somebody.

                      Or: *"and during the battle you need to see your
                      opponent's profile picture and name."* It was the word
                      "היריב" over an anonymous grid — which is who you are
                      playing against in the abstract, and nobody in
                      particular. The face is small on purpose: it belongs
                      beside the label, not over the board.
                    */}
                    <span className="side__way">⟶</span>{" "}
                    {m.coop ? (
                      "אמנדה"
                    ) : (
                      <span className="side__who">
                        {m.rival?.avatar && (
                          <img
                            className="side__face"
                            src={`${BASE}brand/${m.rival.avatar}.webp`}
                            alt=""
                          />
                        )}
                        {m.rival?.nickname ?? "היריב"}
                        {m.rival && (
                          <span className="side__cups">
                            <Icon name="win" size={11} /> {m.rival.trophies}
                          </span>
                        )}
                      </span>
                    )}{" "}
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
              <SayButton
                onSay={m.say}
                hearing={m.hearing}
                onToggleHearing={m.toggleHearing}
                owned={ownedItems}
                onWantMore={() => panel.show("shop")}
              />
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
                {/* One take-back a match. Once it is spent the button goes
                    out and stays out — see takeDiscard for why. */}
                <button onClick={m.takeDiscard} disabled={!m.canTakeDiscard}>
                  קח מהפח {m.canTakeDiscard && <Icon name="recycle" size={15} />}
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
          {/*
            The three seconds before a match now show who is in it.

            Or: "at the start of a match against a friend (and against the bot
            too) there should be a second where you see who you are fighting."
            This pause already existed with nothing in it but a number; the
            number is still here, smaller, in the middle of the card.

            The playground has no opponent — both sides are yours — so it keeps
            the plain count.
          */}
          {m.playground ? (
            <div className="overlay">
              <div className="overlay__count">{Math.ceil(m.timeLeft)}</div>
              <div className="overlay__label">{countdownLabel}</div>
            </div>
          ) : (
            <div className="overlay overlay--versus">
              <Versus
                me={m.me}
                them={m.rival}
                secondsLeft={m.timeLeft}
                total={3}
                joined={m.coop}
              />
              <div className="overlay__label">{countdownLabel}</div>
            </div>
          )}
        </main>
      )}

      {/* ---- battle ---- */}
      {m.phase === "battle" && m.result && (
        <BattleScreen m={m} result={m.result} backdrop={arena.id} />
      )}

      {/* ---- result ---- */}
      {m.phase === "result" && (
        <ResultScreen
          m={m}
          panel={panel}
          signedIn={signedIn}
          onOpenChest={() => void openNewestChest()}
        />
      )}

      {/* floating card that follows the pointer while dragging */}
      {drag.cardId && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardView cardId={drag.cardId} size="medium" />
        </div>
      )}

      {confirmExit && (
        <Overlay onClick={() => setConfirmExit(false)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <h2>{exitTitle}</h2>
            <p className="modal__role">{exitBody}</p>
            <div className="modal__actions">
              <button
                className="btn-fight btn-danger"
                onClick={() => {
                  /*
                   * Or asked to see *"user behaviour (abandoning mid-game for
                   * instance)"*. This is the deliberate kind — the player
                   * said yes to leaving — and the phase is the useful half of
                   * it: quitting while building is boredom with the build,
                   * quitting during the battle is something else entirely.
                   */
                  if (m.phase !== "result" && m.phase !== "intro")
                    track("quit", {
                      phase: m.phase,
                      mode: m.playground ? "playground" : m.online ? "online" : "bot",
                    });
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
        </Overlay>
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
        <Overlay>
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
        </Overlay>
      )}

      {/*
        ═══ HELLO, BEFORE ANY POINTING ═══

        Or's words, as he wrote them. She introduces herself, says where you
        are and what the two albums are for, and only then starts teaching —
        which is the order a person uses and the order the tutorial did not.

        These carry no target: there is nothing to circle while she is talking
        about what the game IS. Tutorial.tsx renders a line with no target
        centred and with a button, because reading is the only thing to do.
      */}
      {teaching && !metAmanda && (
        <Tutorial
          steps={[
            {
              target: null,
              text: "היי, אני אמנדה. באת להילחם מולי, ילד? בוא נלמד איך עושים את זה.",
              cta: "בוא",
            },
            {
              target: null,
              text: "אנחנו בחדר המשחקים. אם תנצח אותי פה תוכל להתקדם למקומות אחרים. זה האלבום שלי, זה האלבום שלך. אנחנו מדביקים מדבקות, ובסוף הן ילחמו.",
            },
          ]}
          onDone={() => setMetAmanda(true)}
          onQuit={() => {
            setMetAmanda(true);
            setTeaching(false);
            setCue(null);
            void markTutorialDone();
          }}
        />
      )}

      {teaching && metAmanda && cue && (
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

      {panel.is("profile") && (
        <Profile
          account={m.account}
          onClose={() => panel.close()}
          onChanged={() => m.reloadAccount()}
        />
      )}

      {panel.is("about") && (
        <About
          onClose={() => panel.close()}
          birthDate={m.account?.birthDate}
          start={LEGAL ?? undefined}
        />
      )}

      {panel.is("updates") && <Updates onClose={() => panel.close()} />}

      {/*
        Today's challenges, when the home screen had no room to show them.
        See ChallengeButton — on anything bigger this panel never opens,
        because the list is already on the screen.
      */}
      {panel.is("challenges") && (
        <Overlay onClick={() => panel.close()}>
          <div className="modal modal--quests" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" onClick={() => panel.close()} title="סגירה">
              <Icon name="exit" size={15} />
            </button>
            <Challenges
              signedIn={signedIn}
              gated={gated}
              onClaimed={() => m.reloadAccount()}
              reloadKey={m.award}
            />
          </div>
        </Overlay>
      )}

      {/* The kind of report rides along with the panel itself, so it cannot
          fall out of step with it — see useOverlay.ts. */}
      {panel.open?.kind === "report" && (
        <Report initialKind={panel.open.about} onClose={() => panel.close()} />
      )}

      {panel.is("why") && (
        <WhySignIn
          onClose={() => panel.close()}
          onSignIn={() => {
            panel.close();
            panel.show("profile");
          }}
        />
      )}

      {panel.is("shop") && (
        <Shop
          onClose={() => panel.close()}
          diamonds={m.account?.diamonds ?? 0}
          onBought={() => m.reloadAccount()}
        />
      )}

      {panel.is("inbox") && (
        <Inbox
          onClose={() => {
            panel.close();
            setUnread(0);
          }}
          onAction={(a) => {
            if (a === "shop") panel.show("shop");
            else if (a === "friends") panel.show("friends");
            else if (a === "album") panel.show("album");
          }}
        />
      )}

      {panel.is("friends") && (
        <Friends
          onClose={() => panel.close()}
          onInvite={(id) => {
            panel.close();
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
        <Overlay onClick={m.declineInvitation}>
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
        </Overlay>
      )}

      {panel.is("modes") && (
        <MoreModes
          onClose={() => panel.close()}
          onAmandaSolo={m.startAmandaSolo}
          onMirror={m.startMirror}
        />
      )}

      {panel.is("album") && (
        <Album
          account={m.account}
          onClose={() => panel.close()}
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
