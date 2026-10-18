import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { ArenaTrack } from "./ArenaTrack";
import { ChestShelf } from "./ChestShelf";
import { NachoBar } from "./NachoBar";
import { ChallengeButton, Challenges } from "./Challenges";
import { Lock } from "./SignedInOnly";
import { shopItemArt } from "./Shop";
import { useCompact } from "../game/useCompact";
import { DEFAULT_BACK } from "@amanda/shared";
import { listFriends, type Chest, type ShopItem } from "../game/account";
import type { Overlays } from "../game/useOverlay";
import type { MatchApi } from "../game/useMatch";
import { line as t, lineF as tf } from "../game/copy";
import { lang, say } from "../game/lang";

const BASE = import.meta.env.BASE_URL;

/**
 * The first screen: who you are, what you have, and the two ways to play.
 *
 * Pulled out of App.tsx, which had grown to two thousand lines with every
 * screen in one function. Four pieces of state came with it — which friend
 * option is showing, the room code being typed, and whether the idle clip
 * loaded — because nothing outside this screen has ever looked at them.
 *
 * ═══ THE SCREEN IS SIX GROUPS, AND THE LAYOUT ONLY ARRANGES THEM ═══
 *
 * Or: *"think about a much smarter, more sensible arrangement — what belongs
 * to playing together, what belongs to progress together, what belongs to
 * settings together."* So the markup below is grouped by PURPOSE and says
 * nothing about position:
 *
 *   home__brand     the name
 *   home__play      the ways to start a match, and nothing else
 *   home__progress  where you are and what you are two games from
 *   home__collect   the shop, what it is advertising, and the album
 *   home__social    other people
 *
 * Where each group LANDS is one set of grid-template-areas in
 * home-layout.css. Three were built and shown side by side — Or picked the
 * one where the progress strip runs the full width under the two ways to
 * play ("ב הכי בכיוון"), and the other two are gone along with the
 * `?layout=` parameter that switched between them.
 */

/** Embers drifting up past her. Spread by hand so they never clump. */
const MOTES = [
  { x: 8, dur: 15, delay: 0, o: 0.5 },
  { x: 17, dur: 19, delay: 3.5, o: 0.35 },
  { x: 26, dur: 13, delay: 7, o: 0.45 },
  { x: 34, dur: 21, delay: 1.5, o: 0.3 },
  { x: 43, dur: 16, delay: 9, o: 0.4 },
  { x: 52, dur: 18, delay: 5, o: 0.3 },
  { x: 61, dur: 14, delay: 11, o: 0.45 },
  { x: 70, dur: 20, delay: 2.5, o: 0.35 },
  { x: 79, dur: 17, delay: 8, o: 0.4 },
  { x: 88, dur: 15, delay: 13, o: 0.3 },
];

/** The three settings of the bot dial, and what each one means in a sentence. */
const BOT_LEVELS: ReadonlyArray<{ id: "easy" | "normal" | "hard"; he: string; note: string }> = [
  { id: "easy", he: t("s5eb66c7", "קליל"), note: t("s9251769", "לוח דליל, קלפים חלשים. מנצח ב-17% מהקרבות.") },
  { id: "normal", he: t("s0c9f683", "רגיל"), note: t("s901d39c", "בונה כמו שהוא יודע. חצי-חצי.") },
  { id: "hard", he: t("sc93cdac", "קשה"), note: t("s62d48e5", "בוחר מתוך אוסף גדול בהרבה. מנצח בערך ב-58%.") },
];

/**
 * True when the game is running as an installed app rather than a browser tab.
 * Read once: a window does not stop being installed halfway through a visit.
 */
/**
 * Has the home screen been looked at yet this visit?
 *
 * Module-level, so it survives HomeScreen being unmounted and mounted again —
 * which happens on the way back from every match. See `.home--enter` in
 * home-layout.css for what it is for: the buttons fly in once, when the game
 * opens, and never again while the tab is open.
 */
let seenHome = false;

export function HomeScreen({
  m,
  panel,
  gated,
  signedIn,
  promo,
  onChest,
  viewport,
  deckBack = DEFAULT_BACK,
}: {
  /** The back of the deck being played, drawn on the door to the builder. */
  deckBack?: string;
  m: MatchApi;
  panel: Overlays;
  /** Run this, or show the sign-in prompt — see SignedInOnly.tsx. */
  gated: (open: () => void) => () => void;
  signedIn: boolean;
  /** What the shop corner advertises, or null. */
  promo: ShopItem | null;
  onChest: (chest: Chest) => void;
  /** Run the lessons again, from the start. See replayTutorial in App. */
  /** "1024×768", for the version line. */
  viewport: string;
}) {
  /** Which way of playing with a friend is showing. */
  const [friendOpen, setFriendOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  /** Turned off for the session the moment the clip fails to load. */
  const [idleOk, setIdleOk] = useState(true);
  /** Too little room for the full arrangement — see useCompact. */
  const compact = useCompact();
  /*
   * How many friends, and how many are waiting for an answer.
   *
   * Or: *"the friends button should say how many friends, small."* The second
   * number matters more than the first: somebody who has asked to be your
   * friend is waiting on YOU, and a request that sits unseen for a week is
   * the thing this screen can actually fix. So the count is quiet and the
   * waiting ones are a dot.
   *
   * Only for a signed-in player — a guest has no friends list to count, and
   * the call would be a round trip to be told so.
   */
  const [friends, setFriends] = useState<{ have: number; waiting: number } | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    void listFriends().then((list) => {
      if (!alive) return;
      setFriends({
        have: list.filter((f) => f.state === "friend").length,
        waiting: list.filter((f) => f.state === "asking").length,
      });
    });
    return () => {
      alive = false;
    };
  }, [signedIn]);
  /*
   * Or: *"so that people see Amanda's background, all the buttons should come
   * into the screen with an animation on load — at first you see the
   * background and only after half a second the buttons come into place."*
   *
   * Read in a lazy initialiser rather than an effect, so the very first
   * render already carries the class: set it afterwards and the screen paints
   * once with everything in place, which is the one frame the whole thing
   * exists to avoid.
   */
  const [firstLook] = useState(() => {
    if (seenHome) return false;
    seenHome = true;
    return true;
  });

  return (
    <main className="intro intro--hero">
      {/*
        The profile button lives in the top bar now, beside the bell — see
        App.tsx. Or: *"pin the profile button to the notifications button."*

        It was here, absolutely positioned at a fixed distance from the
        corner, while the top-bar row ran out from that same corner. The two
        were near each other by coincidence, and the gap changed with every
        button added or removed to the row — which is how the bell came to be
        sitting on top of it. In the row, flexbox keeps the gap.
      */}
      {/*
        She is the background, not a picture inside a box. The banner was
        generated with its left half deliberately empty, which is where
        everything below sits.

        The still is always there; the clip plays over it if it loads. A hero
        that needs a video to exist is a hero that is a black rectangle on a
        slow connection, so the picture never depends on it. `onError` drops
        the video for good rather than retrying forever.
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

      <div className={`home${firstLook ? " home--enter" : ""}`}>
        {/*
          Drawn, not typeset. A webfont can fail to load — and did, on Or's
          screen, where the name fell back to a plain system face. The
          letterforms are baked into an image so the name always looks like
          the name. Rendered FROM the real font rather than generated, so the
          Hebrew is correct by construction instead of by luck.

          There are two of them, because a logotype is letters and letters
          have a language. An English player was being shown אמנדה — a mark
          they cannot read, over an alt attribute saying Amanda, which is the
          screen reader getting a better experience than the player.
        */}
        <header className="home__brand">
          <h1 className="intro__name">
            {lang() === "en" ? (
              <img src={`${BASE}brand/wordmark-en.png`} alt="Amanda" width={720} height={174} />
            ) : (
              <img src={`${BASE}brand/wordmark.png`} alt={t("sfd7535c", "אמנדה")} width={720} height={197} />
            )}
          </h1>
          <p className="intro__sub">{t("s86247d1", "משחק קלפים מפלצתי")}</p>
        </header>

        {/* ─────────────── playing ─────────────── */}
        <section className="home__play intro__card" aria-label={t("s0cadb17", "לשחק")}>
          {/*
            The "you VS the opponent" portrait was describing a match that has
            not been chosen yet. The same two pictures do more work as the
            choice itself: one is who you would be fighting.
          */}
          {!friendOpen ? (
            <div className="pick">
              <button className="pick__card" onClick={m.startMatch}>
                <img src={`${BASE}brand/versus_robot.webp`} alt="" />
                {/*
                  How hard it tries. Three settings, each one MEASURED over
                  700 battles rather than guessed: the easy bot wins 17% of
                  them, the ordinary one 51%, the hard one around 58%.
                  Remembered, so a child who found the easy one does not have
                  to find it again.

                  ═══ ABOVE THE LABEL, AND THAT IS WHAT ALIGNS THE TWO CARDS ═══

                  Or: *"look at the words 'play with a bot' and 'play with a
                  friend' — they should be on the same line. For that to
                  happen, the easy-normal-hard bar needs to be ABOVE the words
                  'play with a bot', not below."*

                  He has diagnosed it exactly. The two labels are pinned to
                  the bottom of their cards with `margin-top: auto`, which was
                  the last attempt at lining them up and works only while the
                  label is the last thing in the card. On this one it was not:
                  the difficulty bar came after it and pushed it up by its own
                  height. Measured at 832x384 — the bot's label sat at y 133.9
                  and the friend's at 152.3, which is 18.4px apart, and the bar
                  is 15.6 tall plus a 4px gap. Exactly it.

                  Moving the bar above the label makes the label the last
                  child of BOTH cards, so one rule now pins both to the same
                  line. Nothing in the CSS had to change.
                */}
                <span
                  className="pick__levels"
                  role="group"
                  aria-label={t("s066beed", "כמה הבוט מתאמץ")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {BOT_LEVELS.map((lvl) => (
                    <span
                      key={lvl.id}
                      role="button"
                      tabIndex={0}
                      className={m.botLevel === lvl.id ? "is-on" : ""}
                      title={lvl.note}
                      onClick={() => m.setBotLevel(lvl.id)}
                      onKeyDown={(e) => e.key === "Enter" && m.setBotLevel(lvl.id)}
                    >
                      {say(lvl)}
                    </span>
                  ))}
                </span>
                {/* Last, so `margin-top: auto` pins it to the card's bottom
                    edge — the same line the friends card's label lands on. */}
                <span>{t("sb99e77d", "לשחק עם בוט")}</span>
              </button>
              <button
                className="pick__card"
                onClick={gated(() => setFriendOpen(true))}
                disabled={!m.onlineAvailable}
                title={m.onlineAvailable ? "" : t("s0443085", "לא בגרסה הזאת")}
              >
                <img src={`${BASE}brand/versus_player.webp`} alt="" />
                {/*
                  ═══ A COPY OF THE DIFFICULTY BAR, WITH THE LIGHTS OFF ═══

                  There is nothing to choose on this card, and that is the
                  problem: the other card carries three difficulty pills and
                  this one carries nothing, so the two labels sat on
                  different lines. Or asked for them to line up and worked
                  out the half of it that is a reordering; this is the other
                  half.

                  Measured at 832x384: with the bar moved above the label the
                  gap closed from 18.4px to 4, and nothing fixed the last 4 —
                  not `margin-top: auto` (already at its limit), not
                  `align-content`, not `justify-content`. The bot card's
                  three items come to 102px inside 101px of content box, so
                  its label is jammed against the bottom and a little past
                  it, while the friends card's label stops politely at the
                  edge. Four pixels, and no amount of alignment can close a
                  gap caused by one card overflowing and the other not.

                  So the two cards are given the same SHAPE instead. This is
                  the real bar, rendered and then hidden — not a spacer of a
                  fixed height, because the bar's height is not fixed: it
                  changes with three media queries that move its font between
                  10 and 11px and its padding between 2 and 3. A number
                  copied out of one of them would be right on one screen and
                  wrong on the other two. A hidden copy of the thing itself
                  is the same height as the thing itself, on every screen,
                  for ever.

                  `visibility: hidden` rather than `display: none`, because
                  the whole point is that it still takes up its space.
                */}
                <span className="pick__levels pick__levels--ghost" aria-hidden="true">
                  {BOT_LEVELS.map((lvl) => (
                    <span key={lvl.id}>{say(lvl)}</span>
                  ))}
                </span>
                <span>{t("sa6f7e6a", "לשחק עם חברים")}</span>
                {!signedIn && <Lock />}
              </button>
            </div>
          ) : (
            <div className="pick pick--ways">
              <button className="btn-fight btn-online" onClick={() => m.hostRoom()}>
                {t("s665bc9f", "לפתוח חדר")}
              </button>
              <button className="btn-fight btn-online" onClick={() => setJoining(true)}>
                {t("s3ebc7cd", "יש לי קוד")}
              </button>
              <button className="btn-fight btn-online" onClick={() => m.startOnline()}>
                {t("saedd95d", "מישהו אקראי")}
              </button>
              {/*
                ═══ THE OTHER DOOR INTO AMANDA MODE, ALSO SHUT ═══

                Or: *"Amanda mode looks awful. Put it behind 'soon' so users
                have no access to it — I don't want it to let down the first
                users."*

                Putting it behind "soon" in the modes list was half the job;
                this button is the other half, and it is the one a player
                actually finds. See the long note in MoreModes.tsx: the mode
                works, the screen around it has not caught up with eight
                lanes, and turning it back on is deleting these four lines.
              */}
              <button className="btn-link" onClick={() => setFriendOpen(false)}>
                {t("s9cadb42", "← חזרה")}
              </button>
            </div>
          )}
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
                placeholder={t("scf8cabd", "קוד החדר")}
                maxLength={6}
                autoFocus
                inputMode="text"
              />
              <button className="btn-fight" type="submit">
                {t("sd1f36fa", "הצטרף")}
              </button>
            </form>
          )}
          {/* The other two ways to play. Or: "more modes should be beside
              'play with friends'." Deliberately smaller than the two cards —
              they sit beside the game, not in front of it. The playground is
              the one thing here a guest may have: it saves nothing, so there
              is nothing to lose. */}
          <div className="extras">
            <button className="btn-modes" onClick={() => panel.show("modes")}>
              <Icon name="monster" size={18} /> {t("s2c8e767", "עוד מודים")}
            </button>
            <button
              className="btn-lab"
              onClick={m.startPlayground}
              title={t("s1dda509", "בלי שעון, שני הצדדים שלך")}
            >
              <Icon name="stacked" size={15} /> {t("s77f529a", "מגרש המשחקים")}
            </button>
          </div>
          {/* Told, and told until when. */}
          {m.suspendedUntil && (
            <p className="warn warn--suspended">
              {/* The locale follows the game, not the country. It was pinned
                  to he-IL, so an English player read an English sentence with
                  a Hebrew month in the middle of it. */}
              {tf(
                "s48c712b",
                "החשבון הזה מושעה עד {0}. אפשר לשחק נגד המחשב בינתיים.",
                new Date(m.suspendedUntil).toLocaleDateString(lang() === "he" ? "he-IL" : "en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              )}
            </p>
          )}
          {m.roomError && (
            <p className="warn">
              {m.roomError === "notFound"
                ? t("sd01b2d8", "אין חדר כזה. אולי המצאת אותו.")
                : m.roomError === "self"
                  ? t("sf8d116e", "זה הקוד שלך. אתה לא יכול לאכול את עצמך.")
                  : t("s1f6e5ea", "החדר מלא. שניים מספיקים לי.")}
            </p>
          )}
          {/* No sentence here. The friends card is already disabled with
              t("se81adad", "לא בגרסה הזאת") on it, which says the same thing in the place
              somebody is actually looking when they wonder. */}
        </section>

        {/* ─────────────── progress ─────────────── */}
        {/*
          Everything that answers "what am I two games away from", in one
          place and in the order the distances get shorter: the arena is weeks
          off, the chest is three matches, a daily challenge is tonight.
        */}
        <section className="home__progress" aria-label={t("sefa91e2", "ההתקדמות שלי")}>
          {/*
            Open to a guest: Or, after seeing how many padlocks a first visit
            had on it — "open the album to guests and leave only the shop,
            friends and online play locked". The collecting IS the game; what
            an account buys is keeping it.
          */}
          {/*
            The ladder and the album, side by side.

            Or: *"my album could be on the same row as the arena"* — and he is
            right about why. They are the same sentence: where you have got to,
            and what you have got. It was in the shop column because the shop
            is where more of it comes from, which is a fact about the shop and
            not about the album.
          */}
          <div className="home__ladder">
            <ArenaTrack trophies={m.account?.trophies ?? 0} />
            {/*
              ═══ STRAIGHT FROM THE HOME SCREEN, AND ABOVE THE ALBUM ═══

              Or: *"they need to reach it directly from the main screen"*, and
              then: *"call it 'my deck', and put it above the album."*

              Above, and he is right: the two are one sentence read in order,
              and it runs the other way from how I first wrote it. The deck is
              what you take into the next match — it is the nearer thing — and
              the album is the collection it comes out of. The near thing goes
              first.

              The card back on the button is the deck's own, so what you built
              is visible from the home screen without opening anything.
            */}
            <button className="btn-album btn-deck" onClick={() => panel.show("decks")}>
              <span className={`btn-deck__back back--${deckBack}`} aria-hidden="true" />
              {t("s7c9dce4", "הדק שלי")}
            </button>
            <button className="btn-album" onClick={() => panel.show("album")}>
              <Icon name="deck" size={18} /> {t("sac17bac", "האלבום שלי")}
            </button>
          </div>
          <NachoBar nachos={m.account?.nachos ?? 0} />
          {/* And what is waiting to be opened. It draws nothing at all when
              there is nothing waiting, so it gets its panel from CSS rather
              than from a wrapper here — a wrapper would leave an empty box in
              the row on every day nobody won a chest. */}
          {m.account && <ChestShelf onOpened={onChest} reload={() => m.reloadAccount()} />}
          {/*
            On a phone this is a button, and everywhere else it is the block
            itself.

            Or: *"on mobile it does not look inviting at all… maybe more menus
            and popups so that everything fits."* The challenge list is the
            tallest thing on this screen by a long way — three rows, a header
            and a set of tabs — and it is also the one part that a player
            opens, reads and closes. That makes it the right thing to put
            behind a button on a screen 384 pixels tall, and the wrong thing
            to hide on a screen with room for it.

            The dot is what keeps it honest: a panel nobody opens is a feature
            nobody has, so when something in there is finished the button says
            so from the outside.
          */}
          {compact ? (
            <ChallengeButton onOpen={() => panel.show("challenges")} reloadKey={m.award} />
          ) : (
            <Challenges
              signedIn={signedIn}
              gated={gated}
              onClaimed={() => m.reloadAccount()}
              // Re-read after every finished match, which is the only thing
              // that moves a challenge along.
              reloadKey={m.award}
            />
          )}
        </section>

        {/*
          What you have, where you can see it without opening anything.

          ═══ IT IS A ROW OF THE GRID NOW, NOT A CORNER ═══

          Or: *"the diamond bar is not aligned with anything… I would move the
          whole left part up so it lines up with the shop and friends."* It was
          `position: absolute` at 12px from the edge while the column beside it
          starts at the screen's own padding — 92px on his monitor — so the two
          could only ever line up by someone matching two numbers by hand and
          keeping them matched.

          Being the first cell of that column lines it up by construction. It
          also answers the other half of what he asked — *"and where do I see
          how many nachos I have?"* — because the count now sits at the top of
          the column he is already looking at.
        */}
        {m.account && (
          <div className="home__purse purse" aria-label={t("s3cd2566", "מה יש לך")}>
            <span className="purse__item">
              <Icon name="win" size={16} /> {m.account.trophies}
            </span>
            <span className="purse__item purse__item--gem">
              <Icon name="gem" size={16} /> {m.account.diamonds}
            </span>
            {/*
              The third number WAS nachos, and Or is right that it should not
              be: *"in the winnings bar there's no reason to show me how many
              nachos I have, because they actually get swapped for a chest
              every time, right? That's only relevant to the chests right
              now."*

              He has it exactly: nachos are not a balance, they are a bar
              filling towards the next chest, and they reset when it opens.
              A number that returns to zero on its own is not a thing you
              have — and the chest shelf already draws that bar, where it
              means something.

              So: how many monsters are in the album. That one only ever goes
              up, and it is the thing the whole game is for.
            */}
            <span className="purse__item purse__item--cards">
              <Icon name="monster" size={16} /> {m.account.album.size}
            </span>
          </div>
        )}

        {/* ─────────────── collecting ─────────────── */}
        {/*
          Or: "my album can be beside the shop, and the banner should be above
          or below the shop." The three are one thing — where more cards come
          from, what is new there, and what you already have.

          ═══ THE ALBUM IS LAST HERE ON PURPOSE ═══

          It was first, and Or: *"it is a bit strange that 'my album' is right
          at the top right — it needs to come down, both in the hierarchy and
          physically."* He is right twice over. It was the loudest thing on the
          screen — top of the quiet column, in a gold box, with a glow
          animation on it — which put the thing you look at BETWEEN matches
          above the two buttons that start one. It is now a plain row under
          the shop, and the column itself starts below the title.
        */}
        <section className="home__collect" aria-label={t("s5d488a4", "האוסף שלי")}>
          {/*
            The album, as a door — but only where it is not already beside
            the arena.

            On a wide screen it rides in the ladder cell, which is what Or
            asked for: *"my album could be on the same row as the arena."* On
            a phone that cell is one line of pictures with no room for a
            button, so the album joins the shop and friends in the row of
            doors instead. One button, one place, decided by whether there is
            room — not two copies that can drift.
          */}
          {/*
            ═══ AND THE DECK IS A DOOR HERE TOO ═══

            Or, with a photograph of his phone: *"doesn't look like it
            updated."* It had updated — his build stamp was 11:40 UTC, which
            was my last deploy of the day. The deck door genuinely was not
            there, and only on a phone.

            Because the rule two files away is `.home__ladder .btn-album {
            display: none }`, and I gave the new button `btn-album btn-deck`
            so it would match the album beside it. On a phone that made it
            match the album by DISAPPEARING with it.

            The album has always had two renders for exactly this reason —
            the ladder on a wide screen, this row on a narrow one. The deck
            needed the same, and it goes FIRST, which is the order Or asked
            for: the deck you are taking, then the collection it came out of.

            Checked at 832x384, which is the screen in his photograph, rather
            than at the desktop size I built it on.
          */}
          {compact && (
            <>
              <button className="rail__item rail__item--deck" onClick={() => panel.show("decks")}>
                <span className={`btn-deck__back back--${deckBack}`} aria-hidden="true" />
                <span>{t("s3fc668a", "דק")}</span>
              </button>
              <button className="rail__item" onClick={() => panel.show("album")}>
                <Icon name="deck" size={19} />
                <span>{t("sb1c5413", "האלבום")}</span>
              </button>
            </>
          )}
          <button className="rail__item" onClick={gated(() => panel.show("shop"))}>
            <Icon name="gem" size={19} />
            <span>{t("s2706aa0", "חנות נוחות")}</span>
            {!signedIn && <Lock />}
          </button>
          {/*
            The promotion slot.

            Deliberately driven by the shop's own window rather than a
            hard-coded message: an item with `available_until` set IS the
            holiday sale, so the banner appears and disappears on its own and
            Or never has to remember to take it down. Nothing to show means
            nothing is drawn.
          */}
          {promo && (
            <button className="rail__promo" onClick={gated(() => panel.show("shop"))}>
              <span className="rail__promo-tag">{t("s26c5785", "חדש בחנות")}</span>
              <span className="rail__promo-row">
                {/* The thing itself. An advertisement with no picture of what
                    it is selling is a sentence, not an advertisement. */}
                {shopItemArt(promo) && (
                  <img className="rail__promo-art" src={shopItemArt(promo)!} alt="" />
                )}
                <span className="rail__promo-words">
                  <b>{say(promo.name)}</b>
                  {promo.blurb && <small>{say(promo.blurb)}</small>}
                </span>
              </span>
              <span className="rail__promo-price">
                <Icon name="gem" size={12} /> {promo.price_diamonds}
              </span>
            </button>
          )}
        </section>

        {/* ─────────────── other people ─────────────── */}
        {/* Or: "and friends in an area slightly apart from them." */}
        <section className="home__social" aria-label={t("s0cab6b9", "חברים")}>
          <button className="rail__item" onClick={gated(() => panel.show("friends"))}>
            <Icon name="friend" size={19} />
            <span>{t("s44d803c", "חברים")}</span>
            {friends && friends.have > 0 && (
              <small className="rail__count">{friends.have}</small>
            )}
            {/* Somebody is waiting on an answer. A dot rather than a number,
                for the same reason the challenge tabs use one: "there is
                something here" is the whole message. */}
            {friends && friends.waiting > 0 && (
              <i className="rail__dot" aria-label={t("sd0647c4", "מישהו מחכה לתשובה")} />
            )}
            {!signedIn && <Lock />}
          </button>
        </section>

        {/*
          ═══ THE SMALL PRINT MOVED INTO THE GEAR ═══

          אודות · פרטיות · נגישות, "מה חדש", "משהו לא עובד?" and the version
          line were all down here. Or: *"language should be in settings.
          Let's do a gear with sound and music on/off, language, about,
          privacy, accessibility, what's new and something's-not-working, and
          also a way to see the version."*

          Which is all of it, so none of it is also here — two places showing
          the same link is two places to change it and one of them to forget.
          See components/Settings.tsx.

          The unread dot went with them, onto the gear itself, because the
          dot's whole job is to be seen by somebody who was not looking for
          it.
        */}
      </div>
    </main>
  );
}
