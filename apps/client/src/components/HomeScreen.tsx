import { useState } from "react";
import { Icon } from "./Icon";
import { ArenaTrack } from "./ArenaTrack";
import { ChestShelf } from "./ChestShelf";
import { NachoBar } from "./NachoBar";
import { Challenges } from "./Challenges";
import { Lock } from "./SignedInOnly";
import { shopItemArt } from "./Shop";
import { hardRefresh } from "../game/refresh";
import { hasUnreadUpdate } from "../data/updates";
import type { Chest, ShopItem } from "../game/account";
import type { Overlays } from "../game/useOverlay";
import type { MatchApi } from "../game/useMatch";

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
 *   home__meta      the small print
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
  { id: "easy", he: "קליל", note: "לוח דליל, קלפים חלשים. מנצח ב-17% מהקרבות." },
  { id: "normal", he: "רגיל", note: "בונה כמו שהוא יודע. חצי-חצי." },
  { id: "hard", he: "קשה", note: "בוחר מתוך אוסף גדול בהרבה. מנצח בערך ב-58%." },
];

/**
 * True when the game is running as an installed app rather than a browser tab.
 * Read once: a window does not stop being installed halfway through a visit.
 */
const INSTALLED =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS does not report standalone through matchMedia.
    (navigator as { standalone?: boolean }).standalone === true);

export function HomeScreen({
  m,
  panel,
  gated,
  signedIn,
  promo,
  onChest,
  viewport,
}: {
  m: MatchApi;
  panel: Overlays;
  /** Run this, or show the sign-in prompt — see SignedInOnly.tsx. */
  gated: (open: () => void) => () => void;
  signedIn: boolean;
  /** What the shop corner advertises, or null. */
  promo: ShopItem | null;
  onChest: (chest: Chest) => void;
  /** "1024×768", for the version line. */
  viewport: string;
}) {
  /** Which way of playing with a friend is showing. */
  const [friendOpen, setFriendOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  /** Turned off for the session the moment the clip fails to load. */
  const [idleOk, setIdleOk] = useState(true);
  /*
   * Is there a "what's new" nobody here has read?
   *
   * Read ONCE, into state, rather than on every render. The answer changes
   * when the panel is opened, and a value recomputed during render would
   * flip the dot off mid-paint while the panel that did it is still
   * animating open. `unread && !panel.is("updates")` would read better and
   * would do exactly that.
   */
  const [newsUnread, setNewsUnread] = useState(hasUnreadUpdate);

  return (
    <main className="intro intro--hero">
      {/* What you have, where you can see it without opening anything. */}
      {m.account && (
        <div className="purse" aria-label="מה יש לך">
          <span className="purse__item">
            <Icon name="win" size={16} /> {m.account.trophies}
          </span>
          <span className="purse__item purse__item--gem">
            <Icon name="gem" size={16} /> {m.account.diamonds}
          </span>
          {/* The third number is now nachos rather than the album size: the
              album has its own button two inches away, and this row is for
              the things a match MOVES. */}
          <span className="purse__item purse__item--nacho">
            <Icon name="nacho" size={16} /> {m.account.nachos}
          </span>
        </div>
      )}
      <button className="me" onClick={() => panel.show("profile")}>
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

      <div className="home">
        {/*
          Drawn, not typeset. A webfont can fail to load — and did, on Or's
          screen, where the name fell back to a plain system face. The
          letterforms are baked into an image so the name always looks like
          the name. Rendered FROM the real font rather than generated, so the
          Hebrew is correct by construction instead of by luck.
        */}
        <header className="home__brand">
          <h1 className="intro__name">
            <img src={`${BASE}brand/wordmark.png`} alt="אמנדה" width={720} height={197} />
          </h1>
          <p className="intro__sub">משחק קלפים מפלצתי</p>
        </header>

        {/* ─────────────── playing ─────────────── */}
        <section className="home__play intro__card" aria-label="לשחק">
          {/*
            The "you VS the opponent" portrait was describing a match that has
            not been chosen yet. The same two pictures do more work as the
            choice itself: one is who you would be fighting.
          */}
          {!friendOpen ? (
            <div className="pick">
              <button className="pick__card" onClick={m.startMatch}>
                <img src={`${BASE}brand/versus_robot.webp`} alt="" />
                <span>לשחק עם בוט</span>
                {/*
                  How hard it tries. Three settings, each one MEASURED over
                  700 battles rather than guessed: the easy bot wins 17% of
                  them, the ordinary one 51%, the hard one around 58%.
                  Remembered, so a child who found the easy one does not have
                  to find it again.
                */}
                <span
                  className="pick__levels"
                  role="group"
                  aria-label="כמה הבוט מתאמץ"
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
                      {lvl.he}
                    </span>
                  ))}
                </span>
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
              {/* The event, not the everyday opponent. It takes two people on
                  purpose: one board cannot beat her. */}
              <button className="btn-fight btn-amanda" onClick={() => m.startAmanda()}>
                נגד אמנדה — שניים נגדה
              </button>
              <button className="btn-link" onClick={() => setFriendOpen(false)}>
                ← חזרה
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
          {/* The other two ways to play. Or: "more modes should be beside
              'play with friends'." Deliberately smaller than the two cards —
              they sit beside the game, not in front of it. The playground is
              the one thing here a guest may have: it saves nothing, so there
              is nothing to lose. */}
          <div className="extras">
            <button className="btn-modes" onClick={() => panel.show("modes")}>
              <Icon name="monster" size={18} /> עוד מודים
            </button>
            <button
              className="btn-lab"
              onClick={m.startPlayground}
              title="בלי שעון, שני הצדדים שלך"
            >
              <Icon name="stacked" size={15} /> מגרש המשחקים
            </button>
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
          {!m.onlineAvailable && <p className="intro__hint">(מצב אונליין דורש שרת פעיל)</p>}
        </section>

        {/* ─────────────── progress ─────────────── */}
        {/*
          Everything that answers "what am I two games away from", in one
          place and in the order the distances get shorter: the arena is weeks
          off, the chest is three matches, a daily challenge is tonight.
        */}
        <section className="home__progress" aria-label="ההתקדמות שלי">
          {/*
            Open to a guest: Or, after seeing how many padlocks a first visit
            had on it — "open the album to guests and leave only the shop,
            friends and online play locked". The collecting IS the game; what
            an account buys is keeping it.
          */}
          <ArenaTrack trophies={m.account?.trophies ?? 0} />
          <NachoBar nachos={m.account?.nachos ?? 0} />
          {/* And what is waiting to be opened. It draws nothing at all when
              there is nothing waiting, so it gets its panel from CSS rather
              than from a wrapper here — a wrapper would leave an empty box in
              the row on every day nobody won a chest. */}
          {m.account && <ChestShelf onOpened={onChest} reload={() => m.reloadAccount()} />}
          <Challenges
            signedIn={signedIn}
            gated={gated}
            onClaimed={() => m.reloadAccount()}
            // Re-read after every finished match, which is the only thing that
            // moves a challenge along.
            reloadKey={m.award}
          />
        </section>

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
        <section className="home__collect" aria-label="האוסף שלי">
          <button className="rail__item" onClick={gated(() => panel.show("shop"))}>
            <Icon name="gem" size={19} />
            <span>חנות נוחות</span>
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
              <span className="rail__promo-tag">חדש בחנות</span>
              <span className="rail__promo-row">
                {/* The thing itself. An advertisement with no picture of what
                    it is selling is a sentence, not an advertisement. */}
                {shopItemArt(promo) && (
                  <img className="rail__promo-art" src={shopItemArt(promo)!} alt="" />
                )}
                <span className="rail__promo-words">
                  <b>{promo.name.he}</b>
                  {promo.blurb?.he && <small>{promo.blurb.he}</small>}
                </span>
              </span>
              <span className="rail__promo-price">
                <Icon name="gem" size={12} /> {promo.price_diamonds}
              </span>
            </button>
          )}
          <button className="rail__item" onClick={() => panel.show("album")}>
            <Icon name="deck" size={19} />
            <span>האלבום שלי</span>
          </button>
        </section>

        {/* ─────────────── other people ─────────────── */}
        {/* Or: "and friends in an area slightly apart from them." */}
        <section className="home__social" aria-label="חברים">
          <button className="rail__item" onClick={gated(() => panel.show("friends"))}>
            <Icon name="friend" size={19} />
            <span>חברים</span>
            {!signedIn && <Lock />}
          </button>
        </section>

        {/*
          The small print.

          Or: "אודות, פרטיות, נגישות and 'something not working?' can move to
          the bottom left." They are not things anybody chooses between
          matches, and the column they were in — the one with the actual game
          in it — was running off the top of a short window partly because of
          them. They stay reachable WITHOUT an account and without installing
          anything, which a store will check.
        */}
        <aside className="home__meta smallprint">
          <button className="btn-link" onClick={() => panel.show("about")}>
            אודות · פרטיות · נגישות
          </button>
          {/*
            Or: "updates — what's new in this version, so there is a reason to
            come back." It sits with the small print because it is not a thing
            you choose between matches — and it carries a dot when there is
            something unread, which is the part that does the bringing back.
          */}
          <button
            className="btn-link btn-news"
            onClick={() => {
              setNewsUnread(false);
              panel.show("updates");
            }}
          >
            מה חדש
            {newsUnread && <i className="btn-news__dot" aria-label="יש עדכון שלא קראתם" />}
          </button>
          {/* Open to everybody: the player most likely to hit a bug is the one
              who just arrived. Reporting a PERSON still needs an account, and
              the server is where that is decided. */}
          <button className="btn-link" onClick={() => panel.show({ kind: "report", about: "bug" })}>
            משהו לא עובד?
          </button>
          {/*
            The version, and the way to force a fresh copy. The refresh button
            only exists in a browser tab — installed as an app there is nothing
            to hard-refresh in the same sense, and Or wants it gone from there:
            "a button we will remove soon, or that should only appear in the
            browser app".
          */}
          <p className="intro__version">
            גרסה {__BUILD_ID__} · מסך {viewport}
            {!INSTALLED && (
              <button
                className="btn-link"
                title="מוריד אותי מחדש ומנקה גרסאות ישנות"
                onClick={() => void hardRefresh()}
              >
                ⟳ רענן
              </button>
            )}
          </p>
        </aside>
      </div>
    </main>
  );
}
