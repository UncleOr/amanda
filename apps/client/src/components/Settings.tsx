/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **Changing how the game behaves, and finding the small print.** Nothing
 * here is part of playing; it is the drawer everything that is not the game
 * went into.
 *
 * Or: *"language should be in settings. Let's do a gear for settings with
 * sound and music on/off, language, about, privacy, accessibility, what's new
 * and something's-not-working, and also a way to see the version."*
 *
 * ═══ IT ALSO FIXES THE TOP BAR ═══
 *
 * Or: *"the notifications button hides the profile button on mobile, in both
 * languages — should be solved by the settings button."* Measured at 844x390
 * before this existed: the top-right row held four buttons and ran from x=10
 * to x=177, and the profile button starts at x=136. **The bell sat on top of
 * the first 41 pixels of it.**
 *
 * Three of those four are now one gear, so the row ends around x=115 and the
 * profile button is clear with room to spare. The bell stays out there: it
 * carries a count and a dot, and a notification you have to open a menu to
 * discover is not a notification.
 *
 * ═══ WHY THE LANGUAGE SWITCH IS ALLOWED IN HERE ═══
 *
 * It used to be on the top bar with a note saying it must not move into "a
 * Hebrew-labelled settings screen — somebody who cannot read the game has to
 * be able to find it." That reasoning is still right, so the two things it
 * depends on are both true here on purpose:
 *
 *   - the way IN is a cog, which is a picture and not a word;
 *   - the row itself offers "עברית" and "English", each written in its own
 *     script, so whichever one you can read is the one you can see.
 *
 * ═══ AND WHY DELETING IS AT THE BOTTOM, CLOSED ═══
 *
 * Or: *"the delete-my-data / delete-my-account buttons should not be so
 * accessible. It almost looks as though we are inviting them to do it."*
 *
 * They were two full-width buttons in the profile wearing `btn-fight`, the
 * same class as "המשך עם גוגל" and the same class as the button that starts
 * a match. The most destructive action in the game looked exactly like the
 * most wanted one.
 *
 * Play requires the route to account deletion to be FINDABLE from inside the
 * app — it does not require it to be loud. So it is a closed section, in the
 * settings, below the version, and what is inside it is text links rather
 * than buttons. The confirmations that were already there are unchanged:
 * they are the part that is supposed to be heavy.
 */
import { useState } from "react";
import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { deleteAccount, scrubMyData, type Account } from "../game/account";
import { hardRefresh } from "../game/refresh";
import { sfx } from "../game/sfx";
import { music } from "../game/music";
import { lang, setLang } from "../game/lang";
import type { Overlays } from "../game/useOverlay";
import type { Page as AboutPage } from "./About";
import { line as t, lineF as tf } from "../game/copy";

/**
 * An installed app has nothing to hard-refresh in the sense a browser tab
 * does, and Or wants the button gone from there. Same test as the home
 * screen used when the version line lived down there.
 */
const INSTALLED =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS does not report standalone through matchMedia.
    (navigator as { standalone?: boolean }).standalone === true);

/**
 * The four documents, each under its own name.
 *
 * A function per label rather than a plain string: `line()` reads the chosen
 * language when it is CALLED, and a module-level constant would be evaluated
 * once at import — in whichever language the game happened to boot in.
 */
const DOCS: Array<{ page: AboutPage; label: () => string }> = [
  { page: "about", label: () => t("sc8369bd", "עלינו") },
  { page: "privacy", label: () => t("saf78986", "פרטיות") },
  { page: "a11y", label: () => t("sf13b7f5", "נגישות") },
  { page: "terms", label: () => t("sf28862a", "תנאים") },
];

export function Settings({
  account,
  panel,
  viewport,
  newsUnread,
  onNewsRead,
  onClose,
}: {
  account: Account | null;
  /** To hand off to About, Updates and the bug report, which are their own panels. */
  panel: Overlays;
  /** "844×390", for the version line. */
  viewport: string;
  newsUnread: boolean;
  onNewsRead: () => void;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(sfx.muted);
  const [musicOn, setMusicOn] = useState(music.isEnabled());
  const [danger, setDanger] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reallyDeleting, setReallyDeleting] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [reallyScrubbing, setReallyScrubbing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const he = lang() === "he";

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--settings" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("se811a27", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>

        <h2>{t("seb080a0", "הגדרות")}</h2>

        {/* ── the switches: the reason anybody opens this ── */}
        <section className="set__group">
          <button
            className="set__row"
            onClick={() => {
              const nowMuted = sfx.toggleMute();
              music.setMuted(nowMuted);
              setMuted(nowMuted);
            }}
          >
            <Icon name={muted ? "soundOff" : "soundOn"} size={20} />
            <span className="set__label">{t("s497670b", "צלילים")}</span>
            <span className={`set__state${muted ? "" : " set__state--on"}`}>
              {muted ? t("s6af16ba", "כבוי") : t("s4e2eb6c", "דולק")}
            </span>
          </button>

          <button
            className="set__row"
            onClick={() => setMusicOn(music.toggleEnabled())}
          >
            <Icon name={musicOn ? "musicOn" : "musicOff"} size={20} />
            <span className="set__label">{t("sa503b39", "מוזיקה")}</span>
            <span className={`set__state${musicOn ? " set__state--on" : ""}`}>
              {musicOn ? t("s6f43267", "דולקת") : t("s3c95ca3", "כבויה")}
            </span>
          </button>

          {/*
            Both options in their own script, always. The row does not say
            "language" in one language and offer the other as a word you
            cannot read — whichever of the two you can read, you can see.
          */}
          <div className="set__row set__row--langs">
            <Icon name="flag" size={20} />
            <span className="set__label">{t("s46dcd47", "שפה")}</span>
            <span className="set__langs">
              <button
                className={`set__lang${he ? " set__lang--on" : ""}`}
                lang="he"
                onClick={() => setLang("he")}
              >
                עברית
              </button>
              <button
                className={`set__lang${he ? "" : " set__lang--on"}`}
                lang="en"
                onClick={() => setLang("en")}
              >
                English
              </button>
            </span>
          </div>
        </section>

        {/* ── the small print, which is still reachable without an account ── */}
        <section className="set__group set__group--links">
          {/*
            Four rows, not one.

            Or: *"now that there are settings there is no reason to put
            about, privacy, accessibility and terms together. Put each one
            separately."* They were a single row reading
            "אודות · פרטיות · נגישות" opening a panel of tabs — so finding
            the privacy policy meant knowing it hid behind a word that was
            not "privacy", and the terms were not named at all.
          */}
          {DOCS.map((d) => (
            <button
              key={d.page}
              className="set__link"
              onClick={() => {
                onClose();
                panel.show({ kind: "about", page: d.page });
              }}
            >
              {d.label()}
            </button>
          ))}
          <button
            className="set__link"
            onClick={() => {
              onNewsRead();
              onClose();
              panel.show("updates");
            }}
          >
            {t("s8e11615", "מה חדש")}
            {newsUnread && <i className="btn-news__dot" aria-label={t("s6eed161", "יש עדכון שלא קראתם")} />}
          </button>
          <button
            className="set__link"
            onClick={() => {
              onClose();
              panel.show({ kind: "report", about: "bug" });
            }}
          >
            {t("s50fb087", "משהו לא עובד?")}
          </button>
        </section>

        {/* ── margin: the version, and the way to force a fresh copy ── */}
        <p className="set__version">
          {tf("s3d84a17", "גרסה {0} · מסך {1}", __BUILD_ID__, viewport)}
          {!INSTALLED && (
            <button
              className="set__refresh"
              title={t("s7dee97b", "מוריד אותי מחדש ומנקה גרסאות ישנות")}
              onClick={() => void hardRefresh()}
            >
              {t("s1f572e7", "⟳ רענן")}
            </button>
          )}
        </p>

        {/*
          Closed, last, and quiet. Only for an account that exists to be
          deleted — an anonymous one has nothing on a server to erase, and
          offering it there would be offering nothing.
        */}
        {account?.linked && (
          <section className="set__danger">
            <button
              className="set__danger-open"
              aria-expanded={danger}
              onClick={() => setDanger((v) => !v)}
            >
              {danger ? "▾" : "▸"} {t("sf4d6e5d", "מחיקת מידע")}
            </button>
            {danger && (
              <div className="set__danger-body">
                <button className="set__danger-link" onClick={() => setScrubbing(true)}>
                  {t("sa694783", "מחיקת הפרטים שלי")}
                </button>
                <button className="set__danger-link" onClick={() => setDeleting(true)}>
                  {t("s60338b2", "מחיקת החשבון שלי")}
                </button>
              </div>
            )}
          </section>
        )}

        {note && <p className="set__note">{note}</p>}

        {/*
          ═══ THE GENTLER ERASURE ═══

          Google Play asks, separately from account deletion: "do you provide
          a way for users to request that some or all of their data be deleted
          WITHOUT requiring them to delete their account?" This is it, and it
          is the better offer of the two: a child who is uncomfortable should
          not have to burn a year of stickers to stop being findable.
        */}
        {scrubbing && (
          <Overlay onClick={() => setScrubbing(false)}>
            <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
              <h2>{t("s5a90022", "למחוק את הפרטים שלך?")}</h2>
              <p>
                {t(
                  "s926d0e0",
                  "הכינוי, הפרצוף, יום ההולדת, משפט המחץ, רשימת החברים וכל המשחקים שלך — נמחקים.",
                )}{" "}
                <b>{t("s6e1464d", "האלבום, הקלפים, הגביעים והיהלומים נשארים.")}</b>
              </p>
              <div className="result__buttons">
                <button
                  className="btn-fight profile__delete"
                  disabled={reallyScrubbing}
                  onClick={() => {
                    setReallyScrubbing(true);
                    void scrubMyData().then((err) => {
                      setReallyScrubbing(false);
                      setScrubbing(false);
                      if (err) return setNote(err);
                      // Everything on this screen just changed underneath it.
                      window.location.reload();
                    });
                  }}
                >
                  {reallyScrubbing ? t("s9a33847", "מוחק…") : t("sa2535e5", "כן, למחוק את הפרטים")}
                </button>
                <button className="btn-fight btn-ghost" onClick={() => setScrubbing(false)}>
                  {t("sf2fe2be", "ביטול")}
                </button>
              </div>
            </div>
          </Overlay>
        )}

        {deleting && (
          <Overlay onClick={() => setDeleting(false)}>
            <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
              <h2>{t("s119a2a3", "למחוק את החשבון?")}</h2>
              <p>
                {t("s57fde6a", "הכול נמחק: האלבום, הקלפים, הגביעים, היהלומים וההיסטוריה. מיד, בלי תקופת המתנה.")}{" "}
                <b>{t("s06f4486", "אי אפשר לבטל.")}</b>
              </p>
              <p className="set__note">
                {t("sc39a712", "אם רק רצית לשחק מחשבון אחר — יציאה / החלפת משתמש בפרופיל עושה את זה בלי למחוק כלום.")}
              </p>
              <div className="result__buttons">
                <button
                  className="btn-fight profile__delete"
                  disabled={reallyDeleting}
                  onClick={() => {
                    setReallyDeleting(true);
                    void deleteAccount().then((err) => {
                      setReallyDeleting(false);
                      if (err) {
                        setDeleting(false);
                        setNote(err);
                        return;
                      }
                      window.location.reload();
                    });
                  }}
                >
                  {reallyDeleting ? t("sa4bb51d", "מוחק…") : t("s15a335a", "כן, למחוק הכול")}
                </button>
                <button className="btn-fight btn-ghost" onClick={() => setDeleting(false)}>
                  {t("sfb7cc23", "ביטול")}
                </button>
              </div>
            </div>
          </Overlay>
        )}
      </div>
    </Overlay>
  );
}
