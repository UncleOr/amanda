import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./components/Icon";
import { Album } from "./components/Album";
import { Tutorial, type Step } from "./components/Tutorial";
import { gateMet, nextCue } from "./game/coach";
import { newDeckName } from "./data/deckNames";
import { STAGE_LESSONS } from "./game/lessons";
import { SCRIPTS, STAGES, handFor, lessonSquares } from "./game/lessonScript";
import { Profile } from "./components/Profile";
import { Onboarding } from "./components/Onboarding";
import { ChestReveal } from "./components/ChestReveal";
import {
  clearTutorialMark,
  deleteDeck,
  loadDecks,
  loadInbox,
  loadShop,
  markChestSeen,
  markTutorialAt,
  openChest,
  saveDeck,
  saveProfile,
  setActiveDeck,
  tutorialMark,
  unopenedChests,
  type Chest,
  type DeckShelf,
  type ShopItem,
} from "./game/account";
import { track } from "./game/track";
import { markTutorialDone, tutorialSeenLocally } from "./game/account";
import { line } from "./data/tutorialLines";
import {
  ARENAS,
  COOP_LANES,
  CARD_BACKS,
  CATCHPHRASES,
  DEFAULT_BACK,
  PHASES,
  arenaFor,
  type Arena,
  type Deck,
} from "@amanda/shared";
import type { BattleResult } from "@amanda/engine";
import { useMatch } from "./game/useMatch";
import { useAchievements } from "./game/useAchievements";
import { useOverlay } from "./game/useOverlay";
import { HomeScreen } from "./components/HomeScreen";
import { BattleScreen } from "./components/BattleScreen";
import { ResultScreen } from "./components/ResultScreen";
import { useDrag } from "./game/useDrag";
import { sfx } from "./game/sfx";
import { voiceFor } from "./game/cardSound";
import { music } from "./game/music";
import { ACTIONS, cardPool, isEnemyTargeted, synergyGroups } from "./data/catalog";
import { carryOf } from "./game/carry";
import * as V from "./data/voice";
import { BoardGrid } from "./components/BoardGrid";
import { CardView } from "./components/CardView";
import { DragGhost } from "./components/DragGhost";
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
import { Settings } from "./components/Settings";
import { hasUnreadUpdate } from "./data/updates";
import { MatePeek } from "./components/MatePeek";
import { Challenges } from "./components/Challenges";
import { DeckBuilder, DeckShelfView } from "./components/DeckBuilder";
import { ArenaUp } from "./components/ArenaUp";
import { BirthdayCard } from "./components/BirthdayCard";
import { birthdayShown, onBirthday, type BirthdayGift } from "./game/meta";
import { Versus } from "./components/Versus";
import { Report } from "./components/Report";
import { Friends } from "./components/Friends";
import { Club } from "./components/Club";
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
import { Draft } from "./components/Draft";
import { Overlay } from "./components/Overlay";
import { lang, say, setLang } from "./game/lang";
import { line as t, lineF as tf } from "./game/copy";


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
      <button className="lab-side__clear" onClick={onClear} title={tf("safa431d", "לרוקן את {0}", name)}>
        {t("sdfa1c45", "נקה")}
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
  countdown: t("sdfad51e", "מתארגנת…"),
  waiting: t("s8da6ce3", "מחפשת לך יריב…"),
  build: say(PHASES.build.label),
  panic: say(PHASES.panic.label) + "!",
  prebattle: t("s7265e57", "נועלת לוחות…"),
  battle: say(PHASES.battle.label),
  result: t("s7b1e036", "זהו"),
};

/** Phases where leaving means abandoning a match in progress. */
const IN_MATCH = ["countdown", "build", "panic", "prebattle", "battle"];

/**
 * Review views, chosen once at module load: ?gallery for the card art, ?arena
 * for the battle effects. Reading this inside App would mean returning before
 * its hooks run, which breaks the rules of hooks (and Fast Refresh with it).
 */
/** A room code from an invite link (?join=XXXX), used once on first load. */
/*
 * The arena this device last saw you in.
 *
 * Kept in storage rather than in a ref so that climbing one and closing the
 * game before the screen appears does not lose it — you are told next time
 * you open, which is the whole point of telling you at all.
 */
const ARENA_SEEN = "amanda.arena.seen";

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
 * `?draft` — go straight into a draft.
 *
 * Same spirit as the two above, and it earns its keep twice: the mode is
 * behind the Court, so anybody working on it has to win a few matches first,
 * and Or wants to put it in front of Hod without that.
 */
const DRAFT_DEV = new URLSearchParams(location.search).has("draft");

/** `?duo` — straight into a 2v2, for the same reason as ?draft. */
const DUO_DEV = new URLSearchParams(location.search).has("duo");

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
      <Suspense fallback={<div className="admin admin--msg">{t("sb472148", "רגע…")}</div>}>
        {REVIEW === "gallery" ? <CardGallery /> : <ArenaPreview />}
      </Suspense>
    );
  // Loaded only when asked for: the panel pulls in the whole copy map and the
  // Supabase client, and nobody playing the game needs either.
  if (REVIEW === "admin")
    return (
      <Suspense fallback={<div className="admin admin--msg">{t("s49e6902", "רגע…")}</div>}>
        <Admin />
      </Suspense>
    );

  /*
   * ═══ A LEGAL URL IS A DOCUMENT, NOT THE GAME ═══
   *
   * `?legal=privacy` is the URL Google Play Console is given, and it used to
   * boot the whole game and then open the policy on top of it. Three
   * different things then queued up in front of the document a reviewer had
   * come to read: the opening film, the onboarding asking their birthday,
   * and lesson one of the tutorial with Amanda's bubble across the text and
   * a match clock ticking in the corner.
   *
   * I fixed the first two one at a time and the third appeared, which is the
   * sign of fixing the wrong thing. Anything that gates a first visit will
   * gate this one, because arriving at a policy URL IS a first visit — so
   * the answer is not to list the gates but to not start the game at all.
   *
   * Closing it goes to the game by dropping the parameter, so the link is
   * still a way in rather than a dead end.
   */
  if (LEGAL)
    return (
      <About
        start={LEGAL}
        onClose={() => {
          window.location.search = "";
        }}
      />
    );

  return <Game />;
}

function Game() {
  const m = useMatch();
  const [detail, setDetail] = useState<string | null>(null);
  const [actionDetail, setActionDetail] = useState<string | null>(null);
  /*
   * Whether there is an update nobody has read.
   *
   * It lived in HomeScreen while its dot did, and its dot is on the settings
   * gear now — which is drawn here, in the top bar, on every screen. Read
   * ONCE into state rather than on each render: the answer changes when the
   * panel opens, and a value recomputed during render would flip the dot off
   * mid-paint while the panel that did it is still animating.
   */
  const [newsUnread, setNewsUnread] = useState(hasUnreadUpdate);
  const [confirmExit, setConfirmExit] = useState(false);
  const [copied, setCopied] = useState(false);
  // On a phone the action cards are a drawer, so the board keeps its height.
  const [actionsOpen, setActionsOpen] = useState(false);
  /**
   * Play an action card, and shut the drawer behind it.
   *
   * Or: *"after you use a card the bar closes. In the tutorial too — from
   * the moment you use an action card in stage three the bar is open, the
   * whole board is small, and you cannot tell what is going on."*
   *
   * The open drawer takes 104px off the bottom of the boards so that it
   * covers nothing it would stop you tapping (`.build--drawer .boards` in
   * report.css). That is the right trade while you are choosing a card and
   * the wrong one for the rest of the match, because the card you just
   * played did something ON THE BOARD and the board is what you need to be
   * looking at.
   */
  const playAction = (id: string) => {
    m.activateAction(id);
    setActionsOpen(false);
  };
  /*
   * And a new round starts with it shut.
   *
   * `actionsOpen` is a screen's worth of state that outlives the match it
   * belongs to: open the drawer in one game, and the next one begins with
   * 104px already taken off the boards for a drawer nobody opened. Caught
   * walking stage three of the tutorial, which opened with the board small
   * because the playground before it had left the drawer up.
   */
  useEffect(() => {
    if (m.phase === "countdown") setActionsOpen(false);
  }, [m.phase]);
  /*
   * Which full-screen panel is open — one value, not nine booleans.
   * See useOverlay.ts for why that matters.
   */
  const panel = useOverlay();
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
    /*
     * ═══ WHERE YOU LEFT OFF, NOT THE BEGINNING ═══
     *
     * Or: *"when you come back to the tutorial it goes back to where it
     * stopped. If you finished — back to the start."* The second half is
     * free: finishing clears the mark, so there is nothing to come back to.
     *
     * `metAmanda` is skipped when there IS a mark, because the two greeting
     * lines are the part nobody wants twice.
     */
    const mark = tutorialMark();
    // The greetings are the one part nobody wants twice.
    setMetAmanda(!!mark);
    saidRef.current = new Set();
    setTeaching(true);
    m.startLesson(mark?.lesson ?? 1);
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
  const replayTutorial = useCallback(
    /**
     * @param stage Which of the three to start at. Or: *"you can always get
     * back to any of the three stages through the settings menu."*
     *
     * The menu offers all three by name, so this takes a number rather than
     * always starting at one. Somebody who wants reminding how a series
     * works does not want to be told again what a king is.
     */
    (stage = 1) => {
      taughtRef.current = true;
      lessonSeenRef.current = 0;
      setLessonDone(false);
      /*
       * The greeting belongs to the first stage only. Jumping straight to
       * stage three and being introduced to Amanda again is the two lines
       * nobody wants twice — which is the same reason a resumed tutorial
       * skips them.
       */
      setMetAmanda(stage > 1);
      /*
       * She has to be allowed to say it all again.
       *
       * `said` is only cleared when a lesson ENDS, so pressing this a second
       * time in one session started a walkthrough that silently skipped
       * every line it had already given — the opening, the King, the guard —
       * and fell through to the generic "put it there" for every card. Which
       * is exactly what it looks like from outside: a tutorial that never
       * introduces itself.
       */
      /*
       * Asking for a stage is a restart OF THAT STAGE, not a resume: the
       * player picked where to go, so there is nothing left to come back to.
       */
      clearTutorialMark();
      saidRef.current = new Set();
      // Same reason as the next-stage button: a line from last time would
      // outlive the lesson it belonged to.
      setCue(null);
      setTeaching(true);
      m.startLesson(stage);
    },
    [m],
  );

  /*
   * Finishing a lesson moves to the next one, and finishing the last one ends
   * the teaching for good. Before this the tutorial simply stopped talking and
   * left the player in a match, which is not an ending.
   */
  /**
   * ═══ WHAT A LESSON'S TWO BOARDS ARE ALLOWED TO DRAW ═══
   *
   * Null for every real match, so this is one ternary and no behaviour at
   * all outside the tutorial.
   *
   * Mine comes from the SCRIPT — the squares the steps name — so adding a
   * step that points at a new square draws it, and nobody has to remember a
   * second list. His comes from the cards he is actually holding, which is
   * the same idea read from the other end.
   */
  const teachingBoard = useMemo(
    () => (teaching && m.lesson > 0 ? lessonSquares(m.lesson) : null),
    [teaching, m.lesson],
  );
  const teachingFoeBoard = useMemo(() => {
    if (!teaching || m.lesson === 0) return null;
    const spec = STAGE_LESSONS[m.lesson - 1];
    if (!spec) return null;
    const out = new Set<string>();
    for (const p of spec.opponent) out.add(p.king ? "king" : `${p.x}-${p.y}`);
    // His crown is always drawn: "bring down the king" is the first thing
    // stage one says, and it has to have something to point at.
    out.add("king");
    return out as ReadonlySet<string>;
  }, [teaching, m.lesson]);

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
  /*
   * The step on screen, plus the one thing a Tutorial step does not have: the
   * instruction to move the MATCH on when it is done (lessonScript.ts), which
   * is how a lesson with no clock ever reaches the panic phase.
   */
  const [cue, setCue] = useState<(Step & { advance?: "panic" | "prebattle"; id?: string }) | null>(null);
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
  /*
   * ═══ NOTICING THAT YOU CLIMBED ═══
   *
   * Or: *"I moved up an arena without any message on the screen."*
   *
   * Worked out here rather than told by the server, because the client
   * already has both numbers: the arena it was showing a moment ago and the
   * one the reloaded account says. The server's job is the GIFTS, which have
   * to be authoritative; the announcement does not.
   *
   * Keyed on BEST trophies for the same reason the server is — trophies go
   * down on a loss, and a player hovering on a threshold must not be
   * congratulated every other match. The ref starts at null so the first
   * account load, which is somebody arriving at the game already in an
   * arena, is remembered rather than celebrated.
   */
  const [climbed, setClimbed] = useState<Arena | null>(null);
  /*
   * The birthday present, if the server minted one on the way in.
   *
   * Subscribed rather than fetched: the call that mints it is the challenges
   * one, made by a different component — see onBirthday in game/meta.ts.
   */
  const [birthday, setBirthday] = useState<BirthdayGift | null>(null);
  useEffect(() => onBirthday(setBirthday), []);
  useEffect(() => {
    const best = m.account?.bestTrophies;
    if (best === undefined) return;
    const now = arenaFor(best);
    let was: string | null = null;
    try {
      was = localStorage.getItem(ARENA_SEEN);
      localStorage.setItem(ARENA_SEEN, now.id);
    } catch {
      // No storage: the climb is announced within this session or not at all,
      // which is the old behaviour and still better than nothing.
    }
    /*
     * `was === null` is the first time this device has ever looked, and that
     * is somebody ARRIVING in an arena rather than reaching one — a new phone
     * for an old player must not throw them a party for where they already
     * live. Remembered, not celebrated.
     */
    /*
     * And only UPWARDS. best_trophies never falls, so in the ordinary run of
     * things this cannot go backwards — but a reset account or a restored
     * backup can leave the stored arena ahead of the real one, and "well
     * done, you are back in the playroom" is not a celebration.
     */
    const rose =
      was !== null &&
      was !== now.id &&
      ARENAS.findIndex((a) => a.id === now.id) > ARENAS.findIndex((a) => a.id === was);
    if (rose) setClimbed(now);
  }, [m.account?.bestTrophies]);
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
   * ═══ WHICH LESSON THIS IS — AND THERE IS ONLY ONE ANSWER TO IT ═══
   *
   * Or asked for "a match or two" against a light bot, and for the second
   * one to be about the opponent rather than the buttons. The coach needs to
   * know which match it is to know which of the two it is giving.
   *
   * This used to be a SECOND counter, kept here and bumped on every
   * countdown — so it read 2 from the first build phase of lesson ONE, a
   * whole match ahead of `m.lesson`, which `startLesson` sets. Nothing
   * noticed while the number only gated a few counter lines that then fired
   * a lesson early. The moment lesson two became a written script it was
   * unmissable: a child met Amanda, said hello, and was told to look at the
   * x-ray card in the middle of their first game.
   *
   * There is one lesson number now and the match owns it.
   */
  const lesson = m.lesson;
  /*
   * She starts again when the LESSON changes, not on every countdown.
   *
   * The reset used to hang off the countdown, which also fires when a match
   * is replayed — so "again" inside a lesson wiped what she had said and
   * started her from the top of a match already half built.
   */
  const lessonSaidRef = useRef(0);
  useEffect(() => {
    if (!teaching || m.lesson === 0) return;
    if (lessonSaidRef.current === m.lesson) return;
    lessonSaidRef.current = m.lesson;
    saidRef.current = new Set();
  }, [teaching, m.lesson]);
  useEffect(() => {
    /*
     * ═══ NOT WHILE SHE IS STILL SAYING HELLO ═══
     *
     * This ran from the moment teaching started, including through the two
     * introduction lines — and every cue it produced went into `said`. So
     * "let's start sticking, here is the first card" was spoken to an empty
     * room behind the introduction, marked as said, and by the time the
     * player was actually looking they got the generic fallback instead. Or
     * saw it as the walkthrough skipping its own opening and never mentioning
     * the King.
     */
    if (!teaching || !metAmanda) return;
    /*
     * ═══ DO NOT INTERRUPT YOURSELF ═══
     *
     * One instruction at a time, and it stays until it is carried out.
     *
     * This effect runs on every change to the hand, the board and the phase.
     * It used to be safe to re-ask on each one, because `nextCue` returned
     * null once it had run out of things to say — so the line already on
     * screen survived. Then she stopped running out (there is a catch-all
     * now, so that a card is never met with silence), and the two together
     * meant every render REPLACED the standing instruction with the next one:
     * "let's start sticking, here is the first card" was swapped for the
     * generic "put it there" before the player had moved.
     */
    if (cue) return;
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
    // Which match she is in, written down as soon as she says anything in it.
    markTutorialAt({ lesson });
    /*
     * ═══ COPIED WHOLE, BECAUSE COPYING IT FIELD BY FIELD LOST ONE ═══
     *
     * This listed the fields by hand — patient, advance, target, text,
     * awaits — and `press` was not among them. So `press: "target"`, which
     * says "the highlighted thing IS the action, do not put a continue
     * button beside it", never reached the component. It was set on the step
     * that lights the FIGHT BUTTON, where a continue button ends the
     * tutorial on a board that never fought, and it had been written down
     * and believed for a while.
     *
     * The same field was being dropped a layer down in scriptedCue, by the
     * same mistake, for the same reason: a cue was assembled by hand in two
     * places and both lists had to be remembered. Neither was.
     *
     * One spread. A field added to Cue now arrives here without anybody
     * having to notice.
     *
     * `target` keeps its default — a step with nothing to point at still
     * frames the board rather than pointing at nothing. And `awaits` is
     * turned into a live boolean BELOW, on every render: a gate frozen at
     * the moment the step appeared would answer "has a King been placed?"
     * with whatever was true back then, for ever.
     */
    setCue({ ...next, target: next.target ?? ".side--me .board" });
  }, [
    teaching,
    metAmanda,
    cue,
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

  /*
   * ═══ THE HAND IS KEPT ON THE STEP, NOT PUT THERE ONCE ═══
   *
   * Or: *"there is no synchronisation between the tutorial and what the
   * player actually does. It is enough for the player to draw another card
   * from the deck — the tutorial does not know about it and everything is
   * out of step from there on. At any moment the tutorial has to allow
   * exactly one action, and make sure it was really carried out."*
   *
   * The first half is already true and was measured rather than assumed: on
   * a pointing step the four dimming panels swallow everything except the
   * lit thing, so a finger aimed at the bin lands on a wall.
   *
   * This is the second half. If the hand drifts anyway — from a frame
   * before anything was lit, from a reload, from something nobody has
   * thought of — it is put back, rather than discovered three steps later
   * when Amanda is naming a card that has left the game.
   *
   * Keyed on `m.hand`, because the hand is the thing that can go wrong.
   * `handFor` derives the card from the script itself rather than from a
   * list beside it (lessonScript.ts), answers null for every step that is
   * not about a card in hand — the bin lesson among them, where the hand is
   * SUPPOSED to change — and `expectCard` does nothing when it is already
   * right, which is almost every step of almost every run.
   */
  useEffect(() => {
    if (!teaching || !cue?.id || lesson === 0) return;
    const script = SCRIPTS[lesson];
    const deck = STAGE_LESSONS[lesson - 1]?.deck;
    if (!script || !deck) return;
    const at = script.findIndex((step) => step.id === cue.id);
    if (at > -1) m.expectCard(handFor(script, at, deck));
  }, [teaching, cue, lesson, m.hand, m]);

  // Shown next to the build id: a screenshot of a layout problem is only
  // useful if it says what size screen the layout was solving for.
  const [viewport, setViewport] = useState(() => `${window.innerWidth}×${window.innerHeight}`);
  useEffect(() => {
    const onResize = () => setViewport(`${window.innerWidth}×${window.innerHeight}`);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  /*
   * ⚠ THIS DOOR DOES NOT SPEAK, AND THAT IS THE DECISION.
   *
   * It did, for an afternoon: every screen that opens a card goes through
   * here, so saying the name here reached the album, the deck builder, the
   * rack and the hand in one line. Or took it straight back off:
   *
   *   *"the voice should be said when you press, before the drag. Not every
   *   time you press it. That is just annoying. Trust me, that is how it is
   *   in Marvel Snap and it is great."*
   *
   * And he is right about which moment it is. The name is the card picking
   * ITSELF up — it belongs to the gesture that puts the card in your hand,
   * once, and nowhere else. A card that announces itself every time you open
   * it to read its numbers is a card you stop opening.
   *
   * So the voice lives on the pointerdown that arms the drag, in the rack
   * and in the hand. See `onDragOut` below.
   */
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
    /*
     * ═══ A DROP KEY MAY NAME ITS BOARD ═══
     *
     * Or: *"I need to be able to drag straight onto the board, whatever
     * side I have 'picked' right now. Just drag and stick."*
     *
     * In a match there is one board you can put anything on and a key is
     * "2-1". In the playground both are live, so BoardGrid writes
     * "me:2-1" and "enemy:2-1" and the side travels with the gesture — see
     * `dropSide` there and `onSide` in useMatch's placeAt.
     */
    const at = target.indexOf(":");
    const side = at < 0 ? undefined : (target.slice(0, at) as "me" | "enemy");
    const where = at < 0 ? target : target.slice(at + 1);
    // An action card goes to the bar; everything else goes on the board.
    if (where === "actionbar") m.takeAction();
    else if (where === "king") m.placeKing(side);
    else {
      const [x, y] = where.split("-").map(Number);
      if (x !== undefined && y !== undefined) m.placeAt(x, y, side);
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

  const draftRef = useRef(false);
  useEffect(() => {
    if (draftRef.current || !DRAFT_DEV) return;
    draftRef.current = true;
    panel.show("draft");
  }, [panel]);

  const duoRef = useRef(false);
  useEffect(() => {
    if (duoRef.current || !DUO_DEV) return;
    duoRef.current = true;
    m.startDuo();
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
  /*
   * The decks, and the one being edited.
   *
   * Held here rather than inside the panel because the panel is unmounted
   * every time it closes, and a child who taps away mid-build should not come
   * back to an empty screen — `editing` outlives the overlay.
   */
  const [shelf, setShelf] = useState<DeckShelf>({ decks: [], activeId: null });
  const [editing, setEditing] = useState<Deck | null>(null);
  const [deckBusy, setDeckBusy] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);
  const refreshDecks = useCallback(() => loadDecks().then(setShelf), []);
  /** The deck being played, which is the one a card back belongs to. */
  const activeDeck = shelf.decks.find((d) => d.id === shelf.activeId) ?? null;
  /**
   * Put a bought thing on.
   *
   * One function for three kinds because the player's side of it is one
   * gesture — "use this now" — and only the place it is SAVED differs. A
   * card back is a property of a deck, so wearing one without a deck to
   * put it on is not possible; the button is simply not offered then.
   */
  const wearItem = useCallback(
    (item: ShopItem) => {
      const avatar = (item.grants as { avatar?: string } | undefined)?.avatar;
      if (item.kind === "avatar" && avatar) {
        void saveProfile({ avatar }).then(() => m.reloadAccount());
        return;
      }
      if (item.kind === "phrase") {
        const phrase = CATCHPHRASES.find((p) => p.item === item.id);
        if (phrase) void saveProfile({ catchphrase: phrase.id }).then(() => m.reloadAccount());
        return;
      }
      if (item.kind === "back") {
        const back = CARD_BACKS.find((b) => b.item === item.id);
        if (!back || !activeDeck) return;
        void saveDeck({ ...activeDeck, back: back.id }).then(() => {
          void refreshDecks();
          m.reloadDecks();
        });
      }
    },
    [activeDeck, refreshDecks, m],
  );
  useEffect(() => {
    if (m.phase !== "intro") return;
    void refreshDecks();
  }, [m.phase, m.account, refreshDecks]);
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
  /**
   * === THE PADLOCK WAITS UNTIL IT KNOWS ===
   *
   * Or: *"the padlock is too small and out of sync."*
   *
   * Out of sync because `signedIn` is false in two completely different
   * situations: this player is a guest, and we have not heard back yet.
   * The account is fetched after the first paint, so EVERY load of the home
   * screen drew padlocks on the friends card and the challenges for as long
   * as that took, and then took them off again — on a signed-in account,
   * which is the one place they are simply wrong.
   *
   * So the lock is drawn from a third state: not "not signed in" but "known
   * to be a guest". While the answer is unknown nothing is drawn, which is
   * the one of the three readings that is never wrong on screen.
   */
  const guest = m.account?.linked === false;
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
      // `iWon`, not `winner === "A"`: online you are side B half the time,
      // and this named every one of those wins a loss.
      music.play(m.iWon ? "win" : "lose");
  }, [m.phase, m.iWon]);

  /*
   * Play Games, watching from one place. Does nothing at all in a browser —
   * see achievements.ts — so this is the whole of its cost on the web.
   */
  useAchievements(m);

  /*
   * The phase, on <html>, for the one thing outside React that needs it.
   *
   * main.tsx reloads the page when a new version of the game takes over, and
   * must not do that while somebody is building a board. This is how it asks:
   * one attribute, read with no import and no bridge, from a file that is
   * deliberately not part of this tree.
   */
  useEffect(() => {
    document.documentElement.dataset.phase = m.phase;
  }, [m.phase]);

  /*
   * ═══ ONE COUNTDOWN, AND PANIC IS ITS LAST TEN SECONDS ═══
   *
   * Or: *"it is terribly confusing that the time runs out and THEN panic. The
   * last ten seconds ARE panic. It should appear on screen when you reach the
   * last ten seconds of the countdown — not reach 0 and then add another ten
   * seconds."*
   *
   * He is right and the fix costs nothing, because the two phases were
   * already adjacent: 45 seconds of building and then 10 of panic. The clock
   * restarted between them, which is the whole of what he saw — a timer that
   * reaches zero and then hands you more time has broken its own promise, and
   * a child who was racing it learns not to believe it.
   *
   * So the numbers are untouched. 45 and 10 are both Or's own tunings and
   * both still turnable from the admin panel; all that changes is that the
   * build phase shows what is left INCLUDING the panic that follows it. The
   * player now sees 55 run to 0 without a break, and at 10 — which is exactly
   * where the phase changes anyway — the screen says פאניקה and the enemy
   * King appears.
   */
  const clock =
    m.phase === "build" ? m.timeLeft + PHASES.panic.seconds : m.timeLeft;

  // The clock, out loud. Building is a race against a timer you cannot see
  // while you are looking at your board, so the last seconds have to be heard.
  const secRef = useRef(-1);
  useEffect(() => {
    const s = Math.ceil(clock);
    if (s === secRef.current || s <= 0) return;

    if (m.phase === "countdown" || m.phase === "prebattle") {
      secRef.current = s;
      /*
       * A clock, and it alternates.
       *
       * Or: *"the 3 2 1 at the start of a match sounds like gunshots. Change
       * it to a clock ticking."* It was three of `beep` — a 400ms broadband
       * thud — and three of those in a row is a fair description of
       * gunshots. Odd seconds tick and even ones tock, so even a count of
       * three carries the rhythm that makes it a clock. See sfx.ts.
       */
      sfx.play(s % 2 === 1 ? "clock" : "clockLow");
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
  }, [clock, m.phase]);

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
    /*
      * `app--teaching` is what lets the top bar step aside for a lesson —
      * see topbar.css. The bar sits ABOVE the tutorial on purpose (the exit
      * must always work), which also left the gear and the sound reachable
      * while Amanda was pointing at something else.
      */
    <div className={`app${teaching && m.lesson > 0 ? " app--teaching" : ""}`}>
      {/* Two 4x4 boards of portrait cards only fit side by side in landscape,
          so on a phone held upright we ask for a turn instead of squashing. */}
      <div className="rotate-hint">
        <div className="rotate-hint__icon"><Icon name="phone" size={56} /></div>
        <h2>{t("s1396b7a", "סובב את המכשיר")}</h2>
        <p>{t("sf038582", "אני משוחקת לרוחב, ילד. ככה אני רואה את שניכם.")}</p>
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
            {m.roomCode ? t("sbd466e9", "מחכה לחבר שלך…") : PHASE_LABEL[m.phase]}
          </div>
        )}
        {/*
          No clock in the playground, and none during a lesson.

          Or: *"and in the tutorial the clock shouldn't run."* It does not
          any more (useMatch), but a number sitting at 45 and never moving is
          its own question — a child waiting for it to tick is being given
          something to worry about instead of something to do. The same
          reason the playground has never shown one.
        */}
        {(m.phase === "build" || m.phase === "panic") && !m.playground && m.lesson === 0 && (
          <div className="topbar__timer">
            <Icon name="timer" size={15} /> {Math.ceil(clock)}s
          </div>
        )}
        {/* Which match this is, when it is not the ordinary one. Without it a
            mirror match is indistinguishable from any other, and the one
            thing that makes it interesting is invisible. */}
        {m.mirrorSeed !== null && showBoards && (
          <div className="topbar__mode">
            <Icon name="deck" size={14} /> {t("sc18c32d", "דק זהה")}
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
          {/*
            Who you are, beside the things that change what you see. Only on
            the home screen: mid-match it is one more thing to look at while
            a clock runs, and the profile is not going anywhere.
          */}
          {m.phase === "intro" && (
            <button className="me" onClick={() => panel.show("profile")}>
              {/*
                `m.me`, not `m.account`: somebody who never chose a nickname
                or a face now has both anyway (shared/identity.ts), and this
                chip has to agree with what every other player is shown.
                The crown is only for a guest, who has no account to be
                anybody with.
              */}
              {m.me.avatar ? (
                <img src={`${BASE}brand/${m.me.avatar}.webp`} alt="" />
              ) : (
                <Icon name="king" size={20} />
              )}
              {/*
                `data-name` only when it IS a name. The chip shows a
                nickname OR a label — "my profile", "sign in" — and Or's
                rule is about the first: *"the username in particular should
                not be in capitals, camelCase should be possible."* A label
                is a label and shouts with the rest of them.
              */}
              <span className="me__name" data-name={m.me.nickname ? "" : undefined}>
                {m.me.nickname ??
                  (m.account?.linked ? t("se2c2032", "הפרופיל שלי") : t("sda25897", "התחברות"))}
              </span>
            </button>
          )}
          {m.account && m.phase === "intro" && (
            <button
              className={`mute bell${unread ? " bell--new" : ""}`}
              title={t("s1703f49", "הודעות")}
              onClick={() => panel.show("inbox")}
            >
              <Icon name="report" size={18} />
              {unread > 0 && <span className="bell__count">{unread > 9 ? "9+" : unread}</span>}
            </button>
          )}
          {m.phase !== "intro" && (
            <button
              className="topbar__exit"
              title={t("s460b8e8", "חזרה לתפריט")}
              onClick={() => {
                sfx.play("click");
                /*
                 * Leaving mid-match throws the board away, so ask first.
                 *
                 * ═══ AND A LESSON IS "MID" RIGHT UP TO ITS LAST SCREEN ═══
                 *
                 * Or: *"when I finished the first tutorial I didn't go
                 * straight to the second. I went back to the menu and it
                 * offered me the tutorial again. Weird flow."*
                 *
                 * `result` is deliberately not in IN_MATCH — a finished
                 * ordinary match has nothing left to throw away, so its exit
                 * should not nag. But a finished LESSON has its own ending
                 * still to come: the effect that raises "now something a bit
                 * trickier" runs a render after the phase changes, and in
                 * that gap the ordinary result screen is suppressed (because
                 * we are teaching) and this is the only live control on the
                 * screen. One tap there and the lesson is over, the mark is
                 * still set, and the menu offers to resume the tutorial he
                 * thought he had just finished. Which is exactly what he
                 * described.
                 *
                 * So while a lesson is running, leaving always asks.
                 */
                if (IN_MATCH.includes(m.phase) || (teaching && m.lesson > 0)) setConfirmExit(true);
                else m.reset();
              }}
            >
              <Icon name="exit" size={14} /> {t("s7ee96f5", "יציאה")}
            </button>
          )}
          {/*
            ═══ ONE GEAR WHERE THERE WERE THREE BUTTONS ═══

            Language, music and sound each had their own button up here. At
            844x390 that made this row 167px wide running to x=177 — and the
            profile button starts at x=136, so the bell was sitting on top of
            the first 41 pixels of it. Or found it: "the notifications button
            hides the profile button on mobile, in both languages."

            The old note on the language switch said it must not move into "a
            Hebrew-labelled settings screen — somebody who cannot read the
            game has to be able to find it." Still true, and still satisfied:
            the way in is a COG, which is a picture, and the row inside offers
            עברית and English each written in its own script. See Settings.

            The bell stays out here. It carries a count, and a notification
            you have to open a menu to discover is not a notification.
          */}
          <button
            className={`mute${newsUnread ? " bell--new" : ""}`}
            title={t("s0dad0ff", "הגדרות")}
            onClick={() => {
              sfx.play("click");
              panel.show("settings");
            }}
          >
            <Icon name="gear" size={19} />
            {/* "What's new" used to carry its dot in the home screen footer,
                which is where it did the bringing-back. The footer is gone,
                so the dot comes up here — otherwise an update announces
                itself only to somebody already looking at the menu that
                announces it. */}
            {newsUnread && <i className="btn-news__dot" aria-label={t("s0eb9706", "יש עדכון שלא קראתם")} />}
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
          guest={guest}
          promo={promo}
          onChest={setChest}
          viewport={viewport}
          deckBack={shelf.decks.find((d) => d.id === shelf.activeId)?.back ?? DEFAULT_BACK}
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
              {m.netError ? t("se65fa4a", "השרת לא עונה") : m.roomCode ? t("sa759290", "מחכה לחבר שלך…") : t("s70fb9fd", "מחפשת לך יריב…")}
            </h2>
            {m.roomCode ? (
              <>
                <p className="intro__tag">{t("sbb39d20", "שלח את הקוד למי שבא לך לאכול:")}</p>
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
                  {copied ? t("s8850299", "✔ העתקתי") : t("sb48d812", "⧉ העתק הזמנה")}
                </button>
              </>
            ) : (
              <p className="intro__tag">
                {m.netError
                  ? t("s20677b2", "השרת לא עונה. אני פנויה.")
                  : searching}
              </p>
            )}
            <div className="intro__buttons">
              {m.netError && (
                <button className="btn-fight" onClick={m.startMatch}>
                  <Icon name="robot" size={18} /> {t("s7156cf4", "נגד המחשב")}
                </button>
              )}
              <button className="btn-fight btn-online" onClick={m.reset}>
                {m.netError ? t("s3ffaa2b", "חזרה") : t("s7807abd", "ביטול")}
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
          }${
            /*
             * ═══ WHICH BOARD IS BEING PICKED FROM ═══
             *
             * Or: *"the card destroyer does not work. I have no way to
             * delete the opponent's cards."*
             *
             * The logic was right and had been fixed once already; the CSS
             * was not. `.build--targeting .side--enemy` sets
             * `pointer-events: none` on the opponent's half while a card is
             * being aimed — correct for the four cards that aim at your own
             * board, and exactly wrong for the one that aims at theirs. The
             * bar said "pick a card on the opponent's side" over a board
             * that could not be clicked.
             *
             * So the class says WHICH side is live, and the stylesheet pushes
             * the other one into the background.
             */
            m.targeting && isEnemyTargeted(m.targeting) ? " build--targeting-enemy" : ""
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
                    name={t("sc2b0252", "הצד שלך")}
                    on={m.editSide === "me"}
                    onPick={() => m.setEditSide("me")}
                    onClear={() => m.clearSide("me")}
                  />
                ) : (
                  <>
                    {m.coop ? t("sc84b632", "החצי שלך") : t("s502312f", "אתה")} <span className="side__way">⟵</span>
                  </>
                )}
              </div>
              {m.frozenFor > 0 && (
                <div className="frozen" role="status">
                  <span className="frozen__icon"><Icon name="frozen" size={26} /></span>
                  <strong>{t("sa531737", "הידיים שלך קפואות")}</strong>
                  <span className="frozen__count">{m.frozenFor.toFixed(1)}</span>
                  <span className="frozen__note">{t("s5d4a4e0", "לשלוף ולזרוק אפשר. להדביק — לא.")}</span>
                </div>
              )}
              {/* What you just said, over your own board, so you can see it
                  went out. The other player's sits over theirs. */}
              <SaidBubble said={m.spoke} mine />
              {m.coop && (
                <div className="mate__label mate__label--mine">
                  <Icon name="king" size={13} /> {t("s138a2c6", "החצי שלך")}
                </div>
              )}
              <BoardGrid
                placements={m.placements}
                king={m.king}
                side="left"
                /*
                 * ═══ A LESSON BOARD IS THE SIZE OF THE LESSON ═══
                 *
                 * Or: *"not hiding an existing board, but building a new
                 * board where only what you can click appears"* — and then,
                 * stage by stage: *"a board of three squares"*, *"seven
                 * squares"*.
                 *
                 * Null in every other match, which is the whole game.
                 */
                only={teachingBoard}
                /*
                 * Both halves of the playground are live at once now. The
                 * side label still lights up and still has its "clear", but
                 * it is a HIGHLIGHT rather than a gate: a mode you have to
                 * remember you are in is the thing a seven-year-old loses
                 * track of, and Or's instruction was *"just drag and
                 * stick"*.
                 */
                interactive={interactive}
                editing={m.playground}
                dropSide={m.playground ? "me" : undefined}
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
                onCellClick={(x, y) => m.placeAt(x, y, m.playground ? "me" : undefined)}
                onKingClick={() => m.placeKing(m.playground ? "me" : undefined)}
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
                  label={t("sc8775fd", "החצי של מי שאיתך")}
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
                    name={t("sfc83143", "הצד שמולך")}
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
                      t("s52b9172", "היריב") over an anonymous grid — which is who you are
                      playing against in the abstract, and nobody in
                      particular. The face is small on purpose: it belongs
                      beside the label, not over the board.
                    */}
                    <span className="side__way">⟶</span>{" "}
                    {m.coop && !m.duo ? (
                      t("s9d29f31", "אמנדה")
                    ) : (
                      <span className="side__who">
                        {m.rival?.avatar && (
                          <img
                            className="side__face"
                            src={`${BASE}brand/${m.rival.avatar}.webp`}
                            alt=""
                          />
                        )}
                        {m.rival?.nickname ?? t("sdb2b008", "היריב")}
                        {m.rival && (
                          <span className="side__cups">
                            <Icon name="win" size={11} /> {m.rival.trophies}
                          </span>
                        )}
                      </span>
                    )}{" "}
                    {/* An eye, not the word. Or: *"instead of REVEALED — an
                        eye icon."* */}
                    {m.phase !== "build" && (
                      <span
                        className="side__revealed"
                        title={t("sf0485e7", "נחשף!")}
                        aria-label={t("sb9b9741", "נחשף!")}
                      >
                        <Icon name="eye" size={16} />
                      </span>
                    )}
                  </>
                )}
              </div>
              <SaidBubble said={m.heard} />
              <BoardGrid
                placements={m.opponent.placements}
                king={m.opponent.king}
                /*
                 * The same rule for his side, from the squares his own cards
                 * sit on. A three-square board facing a full enemy one would
                 * teach that the game is lopsided before it taught anything
                 * about the game.
                 */
                only={teachingFoeBoard}
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
                  m.playground || (m.targeting !== null && isEnemyTargeted(m.targeting))
                }
                handActive={m.playground && m.hand !== null}
                editing={m.playground}
                dropSide={m.playground ? "enemy" : undefined}
                onTarget={m.applyTargetCell}
                onTargetKing={m.applyTargetKing}
                // The lab writes into whichever board is being edited, so the
                // same two calls serve both halves (see placeAt).
                onCellClick={m.playground ? (x, y) => m.placeAt(x, y, "enemy") : undefined}
                onKingClick={m.playground ? () => m.placeKing("enemy") : undefined}
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
                  ? t("sbcd9db8", "בחר קלף אצל היריב")
                  : m.firstPick
                    ? t("s1445cf1", "ועכשיו את השני")
                    : t("s4106038", "בחר קלף על הלוח שלך")}{" "}
                {/* Typographic quotes, not ASCII ones: the straight pair has to
                    be escaped inside the string, and the inventory and the
                    verifier then disagree about what the text IS — one reads the
                    source bytes, the other JSON.parses them. These need neither. */}
                {tf("s8004b74", "עבור „{0}”", say(ACTIONS.get(m.targeting)?.name))}
              </span>
              <button className="targeting-bar__cancel" onClick={m.cancelTargeting}>
                <Icon name="exit" size={13} /> {t("s7ab31ff", "ביטול")}
              </button>
            </div>
          )}

          {interactive && (
            /*
              ═══ AND YOU CAN DRAG A CARD INTO IT ═══

              Or: *"besides that, action cards need dragging too — you drag
              them to the bar."*

              Monsters have been dragged onto the board since the drag
              existed; an action card was the one thing in the hand you
              could only ever press a button for. Same gesture, different
              target, and the drag system already took whatever `data-drop`
              it landed on — so this is an attribute and a branch, not a
              second drag.

              `data-drop` goes on the whole panel rather than on the row of
              chips: the bar can be EMPTY, which is exactly when you most
              want to drop something into it.
            */
            <div
              className={`actions${actionsOpen ? " actions--open" : ""}${
                drag.over === "actionbar" && !m.barFull ? " actions--dropping" : ""
              }`}
              data-drop={m.handIsAction && !m.barFull ? "actionbar" : undefined}
            >
              <button
                className={`actions__handle${m.actionBar.length ? " actions__handle--full" : ""}`}
                onClick={() => setActionsOpen((v) => !v)}
                aria-expanded={actionsOpen}
              >
                {actionsOpen ? "▾" : "▴"} <Icon name="action" size={17} />
                <b className="actions__handle-count">{m.actionBar.length}/3</b>
              </button>
              {/*
                ═══ THE CARD IS THE BUTTON ═══

                Or: *"you can see what an action card does BEFORE you take
                it. Once it is in the bar, pressing it PLAYS it. Without the
                middle step of looking at what it does and pressing 'use'.
                We are in a game against the clock."*

                Tapping the little card used to open the full card, which
                held the button that actually played it. On a phone that was
                not one path among several — it was the ONLY one: the inline
                row of buttons is `display: none` at this width (rooms.css),
                so every action card in the game cost a tap, a read and a
                second tap, with the clock running the whole time.

                The reading happens in the hand, before you decide to keep
                it. In the bar there is nothing left to decide.

                And nothing else is on the chip. The ℹ corner that opens the
                full card went too: measured at 52x68 — the size of a card in
                the drawer on a landscape phone — it came out 18px wide with
                16 of them OUTSIDE the card, a second target hanging off the
                edge of the one you are aiming at.
              */}
              {m.actionBar.map((a) => {
                // "Frozen hands" goes dead near the buzzer; see canPlayAction.
                const late = !a.passive && !a.used && !m.canPlayAction(a.id);
                const live = !a.passive && !a.used && !late;
                return (
                  <div
                    key={a.id}
                    className={`action-chip${live ? " action-chip--live" : ""}`}
                    title={late ? t("s3cec9ca", "מאוחר. תכננת גרוע.") : undefined}
                  >
                    <div className="action-chip__card">
                      <ActionCardView
                        actionId={a.id}
                        size="small"
                        used={a.used}
                        onClick={live ? () => playAction(a.id) : undefined}
                      />
                    </div>
                    {!live && (
                      <span className="action-chip__state">
                        {a.passive
                          ? t("sb9a31bf", "פעיל ∞")
                          : a.used
                            ? t("s34ec88c", "נוצל")
                            : t("sa549a85", "מאוחר מדי")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {interactive && m.playground && (
            <aside className="lab">
              <div className="lab__hold">
              {/*
                ═══ AND IT IS DRAGGED HERE TOO ═══

                Or: *"the animations and the sounds and the whole drag
                thing need to work in the playground as well."*

                They did not exist here at all. The playground's held card
                was a picture with an onClick, so the one screen in the game
                whose entire purpose is to look at cards and try them out
                was the one screen where a card did not say its name, make
                its noise or grow its wings. Everything below is the same
                three lines the hand uses in a match — the drag, the voice,
                the ghost — because it is the same gesture and should not be
                a second implementation of it.
              */}
              <div className={`lab__held${dragging ? " hand__draggable--dragging" : ""}`}>
                {m.hand ? (
                  m.handIsAction ? (
                    <div
                      className="hand__draggable"
                      onPointerDown={(e) => startDrag(m.hand!, e)}
                    >
                      <ActionCardView
                        actionId={m.hand}
                        size="large"
                        onClick={() => !dragging && setActionDetail(m.hand!)}
                        onInfo={() => setActionDetail(m.hand!)}
                        /* The arrow that spends it, on the card itself. See
                           the note by `onUse` in ActionCardView. */
                        onUse={m.barFull ? undefined : m.takeAction}
                        useLabel={t("s25edd89", "קח לפעולה")}
                      />
                    </div>
                  ) : (
                    <div
                      className="hand__draggable"
                      onPointerDown={(e) => {
                        sfx.voice(voiceFor(m.hand!).name);
                        startDrag(m.hand!, e);
                      }}
                    >
                      <CardView
                        cardId={m.hand}
                        size="large"
                        onClick={() => !dragging && openInfo(m.hand!)}
                        onInfo={() => openInfo(m.hand!)}
                      />
                    </div>
                  )
                ) : (
                  <div className="lab__eraser" title={t("s932d88e", "גע בקלף על הלוח כדי להוריד אותו")}>
                    <Icon name="erase" size={34} />
                  </div>
                )}
              </div>
              <div className="lab__buttons">
                {/*
                  No "take to the bar" button here any more: the arrow is on
                  the card itself (ActionCardView, `onUse`). Or: *"put it on
                  the card, a button with an arrow on it so it is understood
                  that this is how you use it."*
                */}
                <button className="btn-fight" onClick={m.toBattle}>
                  <Icon name="play" size={15} /> {t("s8006c77", "הרץ קרב")}
                </button>
              </div>
              </div>
              <CardPicker
                picked={m.hand}
                onPick={m.pickCard}
                onInfo={(id) => (ACTIONS.has(id) ? setActionDetail(id) : openInfo(id))}
                /*
                 * The same drag the hand uses, armed from the rack. `onDrop`
                 * reads the card out of `m.hand`, which `onPick` has just
                 * set — both run on the same pointerdown, so the hand is
                 * right long before the finger lifts.
                 */
                onDragOut={(id, e) => {
                  if (!ACTIONS.has(id)) sfx.voice(voiceFor(id).name);
                  startDrag(id, e);
                }}
              />
            </aside>
          )}

          {interactive && !m.playground && (
            <aside className="hand">
              <div className="hand__current">
                {!m.hand ? (
                  <div className="hand__empty">{t("sb0d338c", "אין קלף")}</div>
                ) : m.handIsAction ? (
                  <div
                    className={`action-hand hand__draggable${
                      dragging ? " hand__draggable--dragging" : ""
                    }`}
                    onPointerDown={(e) => startDrag(m.hand!, e)}
                  >
                    <ActionCardView
                      actionId={m.hand}
                      size="large"
                      onClick={() => !dragging && setActionDetail(m.hand!)}
                      onInfo={() => setActionDetail(m.hand!)}
                      onUse={m.barFull ? undefined : m.takeAction}
                      useLabel={t("s9f032e5", "קח לפעולה")}
                    />
                  </div>
                ) : (
                  <div
                    className={`hand__draggable${dragging ? " hand__draggable--dragging" : ""}`}
                    /*
                     * ═══ THE CARD SAYS ITS NAME WHEN YOU TOUCH IT ═══
                     *
                     * Or, setting out the whole life of a card: *"Stone
                     * Golem — when you press it, it says its name in
                     * English in a deep voice. Through the drag it makes
                     * the drag sound plus the animation. When you place it,
                     * a placing sound."*
                     *
                     * This is the first of the three, and it belongs on
                     * pointerDOWN rather than on click: the press IS the
                     * gesture, and waiting for a click would mean a card
                     * that is dragged never says anything at all. Eleven
                     * cards have a name; every other card is silent here
                     * and `sfx.voice` does nothing for them.
                     */
                    onPointerDown={(e) => {
                      sfx.voice(voiceFor(m.hand!).name);
                      startDrag(m.hand!, e);
                    }}
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
                  title={t("sba4d2ee", "קלפים שנשארו בדק")}
                >
                  <Icon name="deck" size={15} /> {m.deckLeft}
                </span>
                <span className="count count--discard" title={t("s6c4fc10", "קלפים בפח")}>
                  <Icon name="discard" size={15} /> {m.discardCount}
                </span>
              </div>
              <div className="hand__buttons">
                {/* Named, so the walkthrough can point at them. A tutorial
                    step targets a CSS selector, and these two were the only
                    buttons on the screen without one — which is why the
                    first lesson could say "bin it" and ring nothing. */}
                <button
                  className="hand__discard"
                  onClick={m.discardHand}
                  disabled={m.hand === null}
                  /*
                   * ═══ A PICTURE, AND THE WORD BEHIND IT ═══
                   *
                   * Or: *"swap words for icons wherever you can — binning a
                   * card, taking an action card, challenges, playground,
                   * more modes… FIGHT, FROM THE BIN, ACTION CARDS can all
                   * be icons. Got the idea? Like that on everything."*
                   *
                   * The bin is the clearest case in the game: the icon is
                   * already in the button, beside a word that says what the
                   * icon says. One of the two was always doing nothing.
                   *
                   * The word survives as the title and the accessible name
                   * — that is the one job a picture cannot do, and it is
                   * also how the tutorial still finds this button.
                   */
                  title={t("sd06d0bd", "זרוק")}
                  aria-label={t("s81312bd", "זרוק")}
                >
                  <Icon name="discard" size={19} />
                </button>
                {/* One take-back a match. Once it is spent the button goes
                    out and stays out — see takeDiscard for why. */}
                <button
                  className="hand__bin"
                  onClick={m.takeDiscard}
                  disabled={!m.canTakeDiscard}
                  title={t("s1bd8f04", "קח מהפח")}
                  aria-label={t("s026083c", "קח מהפח")}
                >
                  <Icon name="recycle" size={19} />
                </button>
              </div>
              {m.stackSlots > 0 && (
                <p className="hand__hint hand__hint--stack">
                  <Icon name="build" size={14} />{" "}
                  {tf("sfbeaf8c", "אפשר להניח קלף על קלף שכבר הנחתם — נשארו {0}", m.stackSlots)}
                </p>
              )}
              {m.stackCorners && (
                <p className="hand__hint hand__hint--stack">
                  <Icon name="build" size={14} /> {t("sb28db8b", "ארבע הפינות פתוחות להנחה כפולה")}
                </p>
              )}
              {/* No sentence here any more — the empty crown on the board
                  says it, and said it first. */}
              <button
                className={`btn-fight${m.ready ? " btn-fight--ready" : ""}${
                  !m.online ? " btn-fight--icon" : ""
                }`}
                onClick={m.online ? m.toggleReady : m.toBattle}
                title={t("s4a9f52a", "התחל קרב!")}
                aria-label={t("saeb9b8c", "התחל קרב!")}
              >
                {/*
                  Or: *"you do not need a FIGHT button… it can be an icon."*
                  Offline it is one: a big play triangle on the loudest
                  button on the screen, which is the one gesture in this
                  game nobody has ever had to read.

                  Online it keeps its words, because those two are not an
                  action — they are a STATE, "I am ready" and "no longer",
                  and a picture of a state is a riddle.
                */}
                {!m.online ? (
                  <Icon name="play" size={26} />
                ) : m.ready ? (
                  t("s72c3f50", "מוכן — לחץ לביטול")
                ) : (
                  t("sd693107", "אני מוכן")
                )}
              </button>
              {m.online && (m.ready || m.oppReady) && (
                <p className="hand__hint hand__hint--ready">
                  {m.ready && m.oppReady
                    ? t("sa4fb281", "שניכם מוכנים — מתחילים")
                    : m.ready
                      ? t("s0ecac63", "אתה מוכן. אפשר להמשיך לבנות עד שגם הוא יהיה.")
                      : t("sabbc0bf", "היריב מוכן. אתה עדיין יכול לבנות.")}
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
                  <div className="overlay__mini">{t("seef7e51", "הלוח שלך נעול")}</div>
                  <div className="overlay__wait" aria-hidden="true">
                    <Icon name="timer" size={54} />
                  </div>
                  <div className="overlay__label">{t("sc0930d9", "מחכה שהיריב יסיים…")}</div>
                </>
              ) : (
                <>
                  <div className="overlay__mini">{t("s40977ec", "ממלאת לך את החורים…")}</div>
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
                joined={m.coop && !m.duo}
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
      {/*
        ═══ NOT DURING A LESSON ═══

        Or: *"I couldn't even get to the end. It broke on me before the
        end."* It did, and this was it: a lesson ends like any other match,
        with `phase === "result"` — so the ordinary result screen rendered,
        and the lesson's own ending rendered on top of it. Two full-screen
        cards stacked, two headings, two rows of buttons through each other,
        and no way to read either.

        A lesson has its own ending — "now something a bit trickier", and
        then "that's it, you know how to play". That IS its result screen.
        Trophies, chests and a rematch button belong to a real match.

        Gated on `teaching` rather than on `lessonDone`, which the effect
        above sets one render LATER: gating on that would let the wrong
        screen paint for a frame before the right one covered it.
      */}
      {m.phase === "result" && !(teaching && m.lesson > 0) && (
        <ResultScreen
          m={m}
          panel={panel}
          signedIn={signedIn}
          onOpenChest={() => void openNewestChest()}
        />
      )}

      <DragGhost drag={drag} />

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
                  /*
                   * Or's first rule for the tutorial: *"you can always also
                   * press the exit button at the top and stop"* — as well as
                   * "I already know how to play".
                   *
                   * Without this, leaving mid-lesson reset the match while
                   * `teaching` stayed on, so the tutorial simply started
                   * again from the top: the exit button was the one button on
                   * the screen that did not work.
                   *
                   * It is NOT marked done. Stopping is not finishing, and
                   * coming back picks up where it stopped.
                   */
                  setTeaching(false);
                  setCue(null);
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
          /* A catchphrase won here can be said from here. See Prize. */
          onWear={
            m.account
              ? (phraseId) =>
                  void saveProfile({ catchphrase: phraseId }).then(() => m.reloadAccount())
              : undefined
          }
          /*
           * And a card won here has somewhere to go. Or: *"when you get a
           * new card, give a 'put it in the deck' button — pressing it goes
           * to the deck builder."* The chest is closed first, so what the
           * player lands on is the builder and not the builder behind a
           * celebration.
           *
           * Not gated on an account, unlike wearing a catchphrase: the deck
           * builder is open to a guest — it is the one door on the home
           * screen with no padlock on it — so a card won by a guest has
           * somewhere to go too.
           */
          onToDeck={() => {
            markChestSeen(chest.id);
            setChest(null);
            m.reloadAccount();
            panel.show("decks");
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
        ═══ THE END OF A STAGE IS A CHOICE, NOT A DOOR ═══

        Or: *"at the end of each stage, offer a big button to carry on to the
        next stage, or a small button to start playing already."*

        Both halves matter. The big one is the invitation; the small one is
        the way out for a child who has had enough, and it has to BE small —
        a seven-year-old presses the biggest thing on the screen, so making
        them the same size would be the tutorial quietly ending itself.

        Leaving early is not a failure and is not punished: the mark is kept,
        so the settings menu still offers the stage they stopped at.
      */}
      {lessonDone && (
        <Overlay>
          <div className="modal modal--confirm lesson-end">
            <Icon name="win" size={72} />
            {m.lesson < STAGES ? (
              <>
                <h2>{t("s22c9ded", "יפה. מוכן לשלב הבא?")}</h2>
                <div className="result__buttons">
                  <button
                    className="btn-fight"
                    onClick={() => {
                      setLessonDone(false);
                      saidRef.current = new Set();
                      /*
                       * The standing line goes with the stage that said it.
                       *
                       * The cue effect bails on `if (cue) return`, so a line
                       * left over from the previous stage survives into the
                       * next one and blocks its opening line for ever.
                       * Measured: stage two opened on "press start battle",
                       * which is the last thing stage ONE says.
                       */
                      setCue(null);
                      m.startLesson(m.lesson + 1);
                    }}
                  >
                    {t("sff1ea12", "לשלב הבא")}
                  </button>
                </div>
                <button
                  className="btn-link lesson-end__skip"
                  onClick={() => {
                    setLessonDone(false);
                    setTeaching(false);
                    setCue(null);
                    // The mark stays: settings still offers where they got to.
                    m.reset();
                  }}
                >
                  {t("sd9b2943", "כבר לשחק")}
                </button>
              </>
            ) : (
              <>
                {/*
                  His words, as he sent them: *"and at the end, copy that is a
                  bit more inviting."* The old ending told the player what
                  they now were; this one tells them what they may now do,
                  and offers both doors instead of one.
                */}
                <h2>{t("s6ae56df", "זהו, הכנתי אותך לקרב.")}</h2>
                <p>
                  {t(
                    "s75e24cb",
                    "מוזמן להתחיל לשחק ולהתאמן, או להיכנס למגרש המשחקים ולגלות את כל הקלפים והיכולות שלהם בלי לחץ.",
                  )}
                </p>
                <div className="result__buttons">
                  <button
                    className="btn-fight"
                    onClick={() => {
                      setLessonDone(false);
                      setTeaching(false);
                      setCue(null);
                      clearTutorialMark();
                      void markTutorialDone();
                      /*
                       * A real match, not the menu. "יאללה משחק אמיתי" is a
                       * promise, and landing on the home screen instead
                       * would be the game making it and not keeping it.
                       */
                      m.startMatch();
                    }}
                  >
                    {t("s57066be", "יאללה משחק אמיתי")}
                  </button>
                </div>
                <button
                  className="btn-link lesson-end__skip"
                  onClick={() => {
                    setLessonDone(false);
                    setTeaching(false);
                    setCue(null);
                    clearTutorialMark();
                    void markTutorialDone();
                    m.reset();
                  }}
                >
                  {t("s93b5f77", "חזרה לתפריט")}
                </button>
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
            /*
             * The two Or opens with. They are handed over here rather than
             * through the script because they are said before there is a
             * board to point at — the script holds off until the build
             * phase for exactly that reason (see scriptedCue).
             *
             * `{kid}` is filled from the account's own answer. He wrote it
             * as "ילד/ ילדה", which is a copywriter saying "whichever this
             * player is" rather than a slash he wants on screen.
             */
            { target: null, text: line("l1-hello", { kid: V.kid() }) },
            { target: null, text: line("l1-room") },
          ]}
          onDone={() => setMetAmanda(true)}
        />
      )}

      {teaching && metAmanda && cue && (
        <Tutorial
          steps={[
            {
              ...cue,
              /*
               * Recomputed here, every render, from the match as it is now.
               *
               * The cue describes what it is waiting for rather than carrying
               * a callback, so this is the one place that looks at the live
               * board — and it cannot go stale, because there is nothing held
               * from the render that produced the step.
               */
              // No gate means a continue button, NOT "already done".
              done: !cue.awaits
                ? undefined
                : gateMet(cue.awaits, {
                    phase: m.phase,
                    timeLeft: m.timeLeft,
                    hand: m.hand,
                    hasKing: m.hasKing,
                    placements: m.placements,
                    actionBar: m.actionBar,
                    discardCount: m.discardCount,
                  }),
            },
          ]}
          onDone={() => {
            /*
             * There is no clock in a lesson — Or: *"and there is no time in
             * either match"* — so the phases have to be caused by something,
             * and the script is the thing that causes them. `advance` on a
             * step means "this is the moment the build time would have run
             * out", which is how the panic phase arrives at all.
             */
            /*
             * A step can ask the match to move on, because a lesson has no
             * clock. "panic" is the last phase and has its own door now;
             * routing it through toBattle was what made the fight button
             * need pressing twice.
             */
            if (cue.advance === "panic") m.toPanic();
            else if (cue.advance) m.toBattle();
            setCue(null);
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

      {panel.open?.kind === "about" && (
        <About
          onClose={() => panel.close()}
          birthDate={m.account?.birthDate}
          start={panel.open.page}
        />
      )}

      {panel.is("updates") && <Updates onClose={() => panel.close()} />}

      {panel.is("settings") && (
        <Settings
          account={m.account}
          panel={panel}
          viewport={viewport}
          newsUnread={newsUnread}
          onNewsRead={() => setNewsUnread(false)}
          onTutorial={replayTutorial}
          onClose={() => panel.close()}
        />
      )}

      {/*
        Today's challenges, when the home screen had no room to show them.
        See ChallengeButton — on anything bigger this panel never opens,
        because the list is already on the screen.
      */}
      {panel.is("challenges") && (
        <Overlay onClick={() => panel.close()}>
          <div className="modal modal--quests" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" onClick={() => panel.close()} title={t("s0e0ecca", "סגירה")}>
              <Icon name="exit" size={15} />
            </button>
            <Challenges
              signedIn={signedIn}
              guest={guest}
              gated={gated}
              // Close before the prize flies: the purse and the nacho bar it
              // flies to are on the home screen, behind this panel. See
              // onTaking in Challenges.tsx.
              onTaking={() => panel.close()}
              onClaimed={() => m.reloadAccount()}
              reloadKey={m.award}
            />
          </div>
        </Overlay>
      )}

      {/*
        ═══ THE DECKS ═══

        Or: *"there should be a way to save at least 3 decks, each with a
        unique name and a unique card-back design… deck building is a
        significant part of the appeal."*

        Two screens behind one door: the shelf of what you have built, and
        the builder for one of them. Not two panels, because moving between
        them is the whole interaction — you look at three decks, you pick one,
        you change four cards, you come back out.
      */}
      {panel.is("decks") && (
        <Overlay onClick={() => (editing ? undefined : panel.close())}>
          <div className="modal modal--decks" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <DeckBuilder
                account={m.account}
                items={ownedItems}
                deck={editing}
                busy={deckBusy}
                error={deckError}
                onCancel={() => {
                  setEditing(null);
                  setDeckError(null);
                }}
                onDelete={
                  editing.id && editing.id !== "auto"
                    ? () => {
                        const id = editing.id;
                        setEditing(null);
                        void deleteDeck(id).then(() => {
                          void refreshDecks();
                          m.reloadDecks();
                        });
                      }
                    : undefined
                }
                onSave={(d) => {
                  setDeckBusy(true);
                  setDeckError(null);
                  void saveDeck(d).then((saved) => {
                    setDeckBusy(false);
                    if (typeof saved === "string") {
                      setDeckError(saved);
                      return;
                    }
                    setEditing(null);
                    /* A deck you just built is the deck you want to play. */
                    void setActiveDeck(saved.id).then(() => {
                      void refreshDecks();
                      m.reloadDecks();
                    });
                  });
                }}
              />
            ) : (
              <>
                <button className="modal__close" onClick={() => panel.close()} title={t("sb3ce2e0", "סגירה")}>
                  <Icon name="exit" size={15} />
                </button>
                <h2>{t("scb3bea3", "הדקים שלי")}</h2>
                <DeckShelfView
                  decks={shelf.decks}
                  activeId={shelf.activeId}
                  onPlay={(id) =>
                    void setActiveDeck(id).then(() => {
                      void refreshDecks();
                      m.reloadDecks();
                    })
                  }
                  onEdit={(d) => setEditing(d)}
                  /*
                   * Born with a name. Or: *"also give every deck a random
                   * name when you open it: Cool Deck, Crazy Deck and so
                   * on."* An empty one could not be saved and the save
                   * button said nothing about why. See data/deckNames.ts.
                   */
                  onNew={() =>
                    setEditing({ id: "", name: newDeckName(), cards: [], back: DEFAULT_BACK })
                  }
                />
              </>
            )}
          </div>
        </Overlay>
      )}

      {/*
        Five times in a player's life, and it takes the screen — see
        ArenaUp.tsx. The gifts are already granted and already on the shelf;
        this says so.
      */}
      {/*
        A present rather than a prize — the only thing in the game that
        happens because of who you are and not what you did. See
        BirthdayCard.tsx; the chest is already on the shelf.
      */}
      {birthday && (
        <BirthdayCard
          age={birthday.age}
          diamonds={birthday.diamonds}
          onClose={() => {
            setBirthday(null);
            birthdayShown();
            m.reloadAccount();
          }}
        />
      )}

      {climbed && (
        <ArenaUp
          arena={climbed}
          diamonds={40 * ARENAS.findIndex((a) => a.id === climbed.id)}
          onClose={() => {
            setClimbed(null);
            /* The chest and the diamonds landed while this was up. */
            m.reloadAccount();
          }}
        />
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
          /*
           * ═══ WHAT IS ON YOU, AND PUTTING ON WHAT IS NOT ═══
           *
           * Or: *"yes, put a mark on the item that is equipped now. And
           * when you get a new item, give the option to use it right
           * away."*
           *
           * Three wearable kinds and they are kept in two places — the
           * avatar and the catchphrase on the PLAYER, the card back on the
           * DECK — which is why neither the shop nor the sheet works it
           * out: this is the only component holding both.
           */
          worn={{
            avatar: m.account?.avatar ?? null,
            phrase: m.account?.catchphrase ?? null,
            back: activeDeck?.back ?? DEFAULT_BACK,
          }}
          onWear={m.account ? wearItem : undefined}
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

      {panel.is("club") && (
        <Club
          onClose={() => panel.close()}
          /*
           * Or: *"club members can have a battle in one click if both of
           * them are connected."* It is the friend invitation underneath —
           * the same room, the same accept — so there is no second way into
           * a match to keep working. The server checks the club the same way
           * it checks the friendship.
           */
          onBattle={
            m.phase === "intro"
              ? (id) => {
                  panel.close();
                  m.inviteFriend(id);
                }
              : undefined
          }
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
            <h2>{tf("s7347353", "{0} מזמין אותך למשחק", m.invitation.nickname ?? t("seaa865f", "חבר"))}</h2>
            <div className="result__buttons">
              <button className="btn-fight" onClick={m.acceptInvitation}>
                <Icon name="play" size={16} /> {t("se31bdcc", "קדימה")}
              </button>
              <button className="btn-fight btn-ghost" onClick={m.declineInvitation}>
                {t("sfe483c6", "אולי אחר כך")}
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
          onDraft={() => panel.show("draft")}
          onDuo={() => {
            panel.close();
            m.startDuo();
          }}
          best={m.account?.bestTrophies ?? 0}
        />
      )}

      {panel.is("draft") && (
        <Draft
          onClose={() => panel.close()}
          best={m.account?.bestTrophies ?? m.account?.trophies ?? 0}
          onReady={(result) => {
            panel.close();
            m.startDraft(result);
          }}
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
                      playAction(actionDetail);
                    }
                  : undefined
              }
            />
          );
        })()}
    </div>
  );
}
